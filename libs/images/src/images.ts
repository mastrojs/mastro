/**
 * Module with helper function to transform images.
 * Uses `@imagemagick/magick-wasm` under the hood.
 * @module
 */

import {
  ImageMagick,
  type IMagickImage,
  initializeImageMagick,
  MagickFormat,
} from "@imagemagick/magick-wasm";
import { type Context, findFiles, readFile } from "@mastrojs/mastro";
import { contentType } from "@std/media-types";

/**
 * Image format, for example `"WEBP"`.
 */
export type ImageFormat = MagickFormat;

/**
 * Preset to transform an image to the specified format, using a transform function
 * which gets passed an [IMagickImage](https://github.com/dlemstra/magick-wasm/blob/82a4c4e45d5fda6c88becbaba8340df3f5d30c13/src/magick-image.ts#L81)
 * on which you can call methods like `.resize(64, 64)`;
 */
export interface ImagePreset {
  /** defaults to WEBP */
  format?: ImageFormat;
  transform: (image: IMagickImage) => void;
}

const version = "0.0.45";
const wasmUrl = new URL(
  `https://cdn.jsdelivr.net/npm/@imagemagick/magick-wasm@${version}/dist/magick.wasm`,
);

/**
 * Creates a route to transform images according to the specified presets.
 *
 * Usage: with `/routes/_images/[...slug].server.ts` containing:
 *
 * ```
 * import { createImagesRoute } from "@mastrojs/images";
 * export const { GET, getStaticPaths } = createImagesRoute({
 *   small: {
 *     transform: image => image.resize(300, 300),
 *   },
 * });
 * ```
 *
 * and an image placed at `/images/blue-marble.jpg`, you can use the transformed image with:
 *
 * ```
 * <img src="/_images/small/blue-marble.jpg.webp" alt="Planet Earth">
 * ```
 */
export const createImagesRoute = (
  presets: Record<string, ImagePreset>,
  baseDir = "images/",
): {
  GET: (req: Request, ctx: Context) => Promise<Response>;
  getStaticPaths: () => Promise<string[]>;
} => {
  const GET = async (req: Request, ctx: Context) => {
    const { slug } = ctx.params;
    if (!slug) {
      return new Response("404 not found", { status: 404 });
    }
    const [presetName, path] = splitAt(slug, slug.indexOf("/"));
    const [filePath, suffix] = splitAt(path, path.lastIndexOf("."));
    if (!presetName || !filePath || !suffix) {
      return new Response("404 not found", { status: 404 });
    }

    const preset = presets[presetName];
    if (!preset) {
      const names = Object.keys(presets).join('", "');
      return new Response(
        `404 Image preset "${presetName}" not found.\n\nMust be one of: "${names}".`,
        { status: 404 },
      );
    }
    const format = preset.format || MagickFormat.WebP;
    if (format !== suffix.toUpperCase()) {
      return new Response(
        `404 Format for preset ${presetName} must be ${format} instead of ${suffix.toUpperCase()}`,
        { status: 404 },
      );
    }

    const img: Uint8Array<any> = await transformImage(baseDir + filePath, { ...preset, format });

    const res = new Response(img);
    res.headers.set("Content-Type", contentType(format) || "image/?");
    if (new URL(req.url).hostname === "localhost") {
      res.headers.set("Cache-Control", "max-age=0");
    }
    return res;
  };

  const getStaticPaths = async () => {
    const images = await findFiles(baseDir + "**/*");
    return images.flatMap((img) =>
      Object.keys(presets).map((preset) => `/_images/${preset}/${img.slice(baseDir.length)}.webp`),
    );
  };

  return { GET, getStaticPaths };
};

const splitAt = (str: string, index: number): [string, string] => [
  str.substring(0, index),
  str.substring(index + 1),
];

let inialized = false;

/**
 * Lower-level function that reads an image from disk and returns it transformed.
 * Exported mainly for tests.
 */
export const transformImage = async (
  path: string,
  preset: Required<ImagePreset>,
): Promise<Uint8Array> => {
  if (!inialized) {
    await initialize();
    inialized = true;
  }
  const data = await readFile(path);
  return new Promise((resolve) =>
    ImageMagick.read(data, (image: IMagickImage) => {
      preset.transform(image);
      image.write(preset.format, resolve);
    }),
  );
};

const initialize = async () => {
  if (typeof document === "undefined") {
    const fs = await import("node:fs/promises");
    const wasmUrl = new URL(import.meta.resolve("@imagemagick/magick-wasm/magick.wasm"));
    await initializeImageMagick(await fs.readFile(wasmUrl));
  } else {
    const cache = await caches.open("magick_native");
    const cached = await cache.match(wasmUrl);
    if (cached) {
      await initializeImageMagick(new Int8Array(await cached.arrayBuffer()));
    } else {
      const response = await fetch(wasmUrl);
      await cache.put(wasmUrl, response.clone());
      await initializeImageMagick(new Int8Array(await response.arrayBuffer()));
    }
  }
};
