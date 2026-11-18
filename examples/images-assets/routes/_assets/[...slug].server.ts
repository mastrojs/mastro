import { createImagesRoute } from "@mastrojs/images";

export const pregenerate = true;

const { GET, getStaticPaths: getPaths } = createImagesRoute({
  hero: {
    transform: image => image.resize(300, 300),
  },
  hero2x: {
    transform: image => image.resize(600, 600),
  }
});

export { GET };
export const getStaticPaths = () =>
  getPaths().then(paths => paths.map(p => p.replace("/_images/", "/_assets/")));
