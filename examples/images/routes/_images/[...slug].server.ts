import { createImagesRoute } from "mastro/images";

export const pregenerate = true;

export const { GET, getStaticPaths } = createImagesRoute({
  hero: {
    transform: image => image.resize(300, 300),
  },
  hero2x: {
    transform: image => image.resize(600, 600),
  }
});
