#!/usr/bin/env node

import { parseArgs } from "node:util";
import { generate } from "../generator.js";

const flags = parseArgs({
  allowPositionals: true,
  options: {
    outFolder: {
      type: "string",
    },
    pregenerateOnly: {
      type: "boolean",
    },
  }
});

if (flags.positionals[0] === "generate") {
  generate(flags.values);
} else {
  console.log("Usage: mastro generate");
}
