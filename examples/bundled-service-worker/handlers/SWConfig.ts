import { findFiles, jsonResponse } from "@mastrojs/mastro";
import process from "node:process";

export const handler = async () => {
  const cacheVersion = process.env.GITHUB_SHA || "local";
  const files = await findFiles("routes/**/*.{css,}");
  return jsonResponse({
    cacheVersion,
    staticFiles: files.map(f => f.slice(6)),
  });
}
