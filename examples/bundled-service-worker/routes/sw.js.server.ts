import * as esbuild from "esbuild";

export const GET = async () => {
  const { outputFiles } = await esbuild.build({
    entryPoints: ["sw/sw.ts"],
    bundle: true,
    format: "esm",
    write: false,
  });
  return new Response(outputFiles[0]?.contents as BodyInit, {
    headers: { "Content-Type": "text/javascript; charset=utf-8" },
  });
};
