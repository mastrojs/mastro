# @mastrojs/images

A route handler to transform images with [Mastro](https://mastrojs.github.io/). For example to resize images, or compress them into WebP format.

Uses [`@imagemagick/magick-wasm`](https://www.npmjs.com/package/@imagemagick/magick-wasm) under the hood.


## Install

    pnpm add @mastrojs/images


## Usage

With `/routes/_images/[...slug].server.ts` containing the following route handler (which specifies an image preset called `small`):

```ts
import { createImagesRoute } from "@mastrojs/images";

export const { GET, getStaticPaths } = createImagesRoute({
  small: {
    format: "WEBP", // WEBP is the default, so could remove this line
    transform: image => image.resize(300, 300),
  },
});
```

and an image placed at `/images/blue-marble.jpg`, you can use the transformed image with:

```html
<img src="/_images/small/blue-marble.jpg.webp" alt="Planet Earth">
```

You can name your image presets whatever you want – `small` is just an example. The `image` that the `transform` callback receives is a [IMagickImage](https://github.com/dlemstra/magick-wasm/blob/82a4c4e45d5fda6c88becbaba8340df3f5d30c13/src/magick-image.ts#L81), on which you can call methods like `.resize(64, 64)` etc.

To learn more, see the [source](src/images.ts) and [Mastro Guide: Transforming images](https://mastrojs.github.io/guide/bundling-assets/#transforming-images).

For a statically generated site, this is all you need to do. If you're running Mastro as a server, read the section [Build step](https://mastrojs.github.io/guide/bundling-assets/#build-step) in the Mastro Guide to pregenerate the images.
