# Service Worker, bundled with esbuild

This example demonstrates how [Mastro](https://mastrojs.github.io) can be used to run on the client, inside a [Service Worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers). We bundle all client-side JavaScript for the Service Worker with [esbuild](https://esbuild.github.io/).


## Get started

The project structure:

- [routes/](routes/) contains the static files.
- [server.ts](server.ts) and [handlers/](handlers/) contains the code that runs on the server (or during static site generation). For example in [handlers/SW.ts](handlers/SW.ts), we call `esbuild` to bundle the code in the [sw/](sw/) folder.
- [sw/](sw/) in turns contains the code that runs on the client inside the Service Worker.

Both on the [server](server.ts) and on the [client](sw/sw.ts), we're using one instance each of the [Mastro programmatic router](https://mastrojs.github.io/docs/routing/#programmatic-router). (For the server, we could have used the default client-side router as well, but that doesn't run in Workers.)

We're also sharing the same `package.json` file for both server and client and rely on eslint's tree-shaking to only include the dependencies used in the client bundle. However, tree-shaking behaviour can be surprising (primarily because imports in JavaScript can have side-effects and therefore can not always be automatically removed when they're not needed). You could also add a separate `sw/package.json` file and manage the client as a separate project for more control 

To start the server, run `pnpm install`, followed by:

    pnpm run start

If you open http://localhost:8000 in a browser, it will download and install the Service Worker while displaying "Loading" from [handlers/Home.ts](handlers/Home.ts). Once installed, it should reload the page which then will be rendered by the Service Worker. At that point, you have a completely offline-capable Mastro app.

Read [MDN: Using Service Worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers) and [Mastro docs](https://mastrojs.github.io/docs/) for more info.
