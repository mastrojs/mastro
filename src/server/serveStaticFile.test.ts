import { assertEquals } from "jsr:@std/assert";
import { generatePagesForRoute } from "../generator.ts";
import { serveStaticFile } from "./serveStaticFile.ts";

Deno.test("serveStaticFile: serves filenames containing spaces", async () => {
  const cwd = Deno.cwd();
  const tempDir = await Deno.makeTempDir();
  try {
    Deno.chdir(tempDir);
    await Deno.mkdir("routes");
    await Deno.writeTextFile("routes/hello world.txt", "Hello world!");

    const response = await serveStaticFile(
      new Request("http://localhost/hello%20world.txt"),
      true,
    );
    assertEquals(response?.status, 200);
    assertEquals(await response?.text(), "Hello world!");
  } finally {
    Deno.chdir(cwd);
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("generatePagesForRoute: spaces in directory name", async () => {
  const cwd = Deno.cwd();
  const tempDir = await Deno.makeTempDir();
  try {
    Deno.chdir(tempDir);
    const pages = await generatePagesForRoute({
      name: "space route",
      method: "GET",
      pattern: new URLPattern({ pathname: "/hello world/" }),
      handler: () => new Response("Generated page"),
    });
    const page = pages[0];
    if (!page) throw new Error("Expected a generated page");
    assertEquals(page.outFilePath, "/hello world/index.html");
  } finally {
    Deno.chdir(cwd);
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("serveStaticFile: rejects malformed escapes", async () => {
  const response = await serveStaticFile(new Request("http://localhost/%FF"), true);
  assertEquals(response?.status, 400);
});
