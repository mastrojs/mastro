import { } from "mastro";

import {
  ImageMagick,
  IMagickImage,
  initialize,
  MagickGeometry,
  MagickFormat,
} from "https://deno.land/x/imagemagick_deno@0.0.31/mod.ts";

await initialize();

export const GET = async (req: Request): Promise<Response> => {
  const { pathname } = new URL(req.url);
  console.log({pathname});

  const img = await transform(pathname);

  return new Response(img, {
    headers: {
      "Content-Type": "image/webp",
    },
  });
};

const transform = async (path: string) => {
  const data = await Deno.readFile(path);
  return new Promise<Uint8Array>((resolve) =>
    ImageMagick.read(data, (img: IMagickImage) => {
      img.resize(200, 100);
      img.write(
        MagickFormat.WebP,
        (data) => resolve(data),
      );
    })
  );
}
