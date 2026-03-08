import { Mastro } from "@mastrojs/mastro/server-programmatic";
import * as Home from "./handlers/Home.ts";
// @ts-expect-error
import swConfig from "./sw-config" with { type: "json" };

const swHandler = new Mastro()
  .get("/", Home)
  .createHandler({ serveStaticFiles: false });

/**
 * This file contains a Service Worker that is installed in your user's browser.
 * It's installed on initial page load, downloads `staticFiles` for later offline usage,
 * and then takes over rendering.
 *
 * see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers
 * debug with chrome://serviceworker-internals
 */

const { cacheVersion, staticFiles } = swConfig;

on("install", async () => {
  (self as unknown as ServiceWorkerGlobalScope).skipWaiting();
  const cache = await caches.open(cacheVersion);
  return cache.addAll(staticFiles);
});

on("activate", async () => {
  const keys = await caches.keys();
  // TODO: do we really need to return Promise.all here
  // and delay the activation if we're using `caches.open(cacheVersion)` later on anyway?
  // this is taken from https://developer.chrome.com/docs/workbox/service-worker-lifecycle#activation_2
  return Promise.all(
    // delete old caches
    keys.filter((key) => key !== cacheVersion).map(key => caches.delete(key)),
  );
});

// intercept browser HTTP requests and handle them
onFetch(async (req) => {
  const cache = await caches.open(cacheVersion);
  const staticFile = await cache.match(req);
  return staticFile || swHandler(req);
});


/**
 * Utility wrapper for Service Worker events
 */
function on(eventName: "install" | "activate", fn: () => Promise<unknown>) {
  self.addEventListener(eventName, (event) => {
    (event as ExtendableEvent).waitUntil(fn());
  });
}

/**
 * Utility wrapper for Service Worker fetch event
 */
function onFetch(handler: (req: Request) => Promise<Response>) {
  self.addEventListener("fetch", (event) => {
    const e = event as FetchEvent;
    e.respondWith(handler(e.request));
  });
}
