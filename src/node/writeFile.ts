export const writeFile = async (path: string, data: ReadableStream<Uint8Array>) => {
  if (typeof Deno === "object") {
    return Deno.writeFile(path, data);
  } else {
    const { createWriteStream } = await import("node:fs");
    const { Readable } = await import("node:stream");
    return new Promise<void>((resolve, reject) =>
      // deno-lint-ignore no-explicit-any
      Readable.fromWeb(data as any)
        .pipe(createWriteStream(path))
        .on("finish", resolve)
        .on("error", reject)
    );
  }
};
