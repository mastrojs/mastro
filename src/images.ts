/**
 * Module with helper function to transform images.
 * Uses `@imagemagick/magick-wasm` under the hood.
 * @module
 */

import { findFiles } from "./core/fs.ts";
import { getParams } from "./core/router.ts";
import { staticCacheControlVal } from "./server.ts";

import { contentType } from "@std/media-types";
import {
  initializeImageMagick,
  ImageMagick,
  type IMagickImage,
  MagickFormat,
} from "npm:@imagemagick/magick-wasm@0.0.35";

export interface ImagePreset {
  format?: MagickFormat;
  transform: (image: IMagickImage) => void;
}

const wasmUrl = new URL(
  "https://cdn.jsdelivr.net/npm/@imagemagick/magick-wasm@0.0.35/dist/magick.wasm",
);

/**
 * Creates a route to transform images according to the specified presets.
 *
 * Important: Cache-Control maxage is set to 7 days if not on localhost. Thus once you deploy it,
 * you may need to change the preset name (`small` in the example below) for things to update.
 *
 * Usage: with `/routes/_images/[...slug].server.ts` containing:
 *
 * ```
 * import { createImagesRoute } from "mastro";
 * export const { GET, getStaticPaths } = createImagesRoute({
 *   small: {
 *     transform: image => image.resize(300, 300),
 *   },
 * });
 * ```
 *
 * and for example a `/images/blue-marble.jpg` file, use it like:
 *
 * ```
 * <img src="/_images/small/blue-marble.jpg.webp" alt="Planet Earth">
 * ```
 */
export const createImagesRoute = (
  presets: Record<string, ImagePreset>,
  baseDir = "images/",
): {
    GET: (req: Request) => Promise<Response>;
    getStaticPaths: () => Promise<string[]>;
} => {
  const GET = async (req: Request) => {
    const { slug } = getParams(req.url);
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

    const img = await transformImage(baseDir + filePath, { ...preset, format });

    const res = new Response(img);
    res.headers.set("Content-Type", contentType(format) || "image/?");
    const cacheHeader = staticCacheControlVal(req);
    if (cacheHeader) {
      res.headers.set("Cache-Control", cacheHeader);
    }
    return res;
  };

  const getStaticPaths = async () => {
    const images = await findFiles(baseDir + "**/*");
    return images.flatMap((img) =>
      Object.keys(presets).map((preset) =>
        `/_images/${preset}/${img.slice(baseDir.length + 1)}.webp`
      )
    );
  };

  return { GET, getStaticPaths };
};

const splitAt = (
  str: string,
  index: number,
) => [str.substring(0, index), str.substring(index + 1)];

let inialized = false;

const transformImage = async (path: string, preset: Required<ImagePreset>) => {
  if (!inialized) {
    await initialize();
    inialized = true;
  }
  const data = await Deno.readFile(path);
  return new Promise<Uint8Array>((resolve) =>
    ImageMagick.read(data, (image: IMagickImage) => {
      preset.transform(image);
      image.write(preset.format, resolve);
    })
  );
};

const initialize = async () => {
  if (typeof caches === "undefined") {
    const response = await fetch(wasmUrl);
    await initializeImageMagick(new Int8Array(await response.arrayBuffer()));
    return;
  }

  const cache = await caches.open("magick_native");
  const cached = await cache.match(wasmUrl);

  if (cached) {
    await initializeImageMagick(new Int8Array(await cached.arrayBuffer()));
    return;
  }

  const response = await fetch(wasmUrl);
  await cache.put(wasmUrl, response.clone());
  await initializeImageMagick(new Int8Array(await response.arrayBuffer()));
}
