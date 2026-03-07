# Mastro Service Worker, bundled with esbuild

This example demonstrates how [Mastro](https://mastrojs.github.io) can be used to run on the client inside a [Service Worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers). We bundle all client-side JavaScript for the Service Worker with [esbuild](https://esbuild.github.io/).


## Get started

The project root folder (where this `README.md` file is located) contains the code that runs on the server (or during static site generation). Here in [routes/sw.js.server.ts](routes/sw.js.server.ts) is the `http://localhost:8000/sw.js` route, which calls `esbuild` and bundles the code in the [`sw/`](sw/) folder.

The [sw](sw/) folder in turns contains the code that runs on the client inside the Service Worker. `cd` into that folder and run `pnpm install`.

Then `cd` back into the propject root folder and run `pnpm install`, followed by `pnpm run start` to start the dev server.

If you open http://localhost:8000 in a browser, it will download and install the Service Worker while displaying "Loading" from [routes/index.server.ts](routes/index.server.ts). Once installed, it should reload the page which then will be rendered by the Service Worker. At that point, you have a completely offline-capable Mastro app.

Read [MDN: Using Service Worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers) and [Mastro docs](https://mastrojs.github.io/docs/) for more info.
