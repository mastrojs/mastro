import { createImagesRoute } from "@mastrojs/images";

export const pregenerate = true;

export const { GET } = createImagesRoute({
  hero: {
    transform: image => image.resize(300, 300),
  },
  hero2x: {
    transform: image => image.resize(600, 600),
  }
});

export const getStaticPaths = () =>
  ["/_assets/hero/blue-marble.jpg.webp"]
