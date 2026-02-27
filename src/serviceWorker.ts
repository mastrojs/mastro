/**
 * This module exports everything needed to run Mastro in a Service Worker.
 * @module
 */

import { html, renderToStream, renderToString, unsafeInnerHtml } from "./core/html.ts";
import { getParams, htmlResponse, htmlToResponse, jsonResponse } from "./core/responses.ts";
import { Mastro } from "./routers/programmaticRouter.ts";

export {
  getParams,
  html,
  htmlResponse,
  htmlToResponse,
  jsonResponse,
  Mastro,
  renderToStream,
  renderToString,
  unsafeInnerHtml,
};
