import * as esbuild from "esbuild";

export const handler = async () => {
  const { outputFiles } = await esbuild.build({
    entryPoints: ["sw/sw.ts"],
    external: ["./sw-config"],
    bundle: true,
    format: "esm",
    write: false,
  });
  return new Response(outputFiles[0]?.contents as BodyInit, {
    headers: { "Content-Type": "text/javascript; charset=utf-8" },
  });
};
