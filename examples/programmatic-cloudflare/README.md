# Mastro Template with Programmatic Router for Cloudflare Workers

This is a TypeScript template for [Mastro](https://mastrojs.github.io) when using [Cloudflare Workers](https://workers.cloudflare.com/) to run your server code on-demand on the edge, using Mastro's [programmatic router](https://mastrojs.github.io/docs/routing/#programmatic-router). If you only need to generate a static site for the Cloudflare CDN, you don't need this template.


## Run locally

Mastro requires Node.js >=24, which can be installed [via pnpm](https://pnpm.io/next/cli/runtime).

The first time, you need to:

    pnpm install

After that, to start the [Cloudflare Workers runtime](https://developers.cloudflare.com/workers/runtime-apis/) using [Wrangler](https://developers.cloudflare.com/workers/wrangler/):

    pnpm run dev

Then open <http://localhost:8787> in your browser.

### The build step

If you check out the `dev` script in the [package.json](package.json) file, you'll see that it first runs `pnpm run generate` (which creates the `generated` folder with the static assets using [--only-pregenerate](https://mastrojs.github.io/guide/bundling-assets/#build-step)) and then runs `wrangler dev` (which bundles all your code using _esbuild_, and then runs it in the _workerd_ JavaScript runtime).

This mirrors how Cloudflare works in production: when a request comes in, it fill first try to find a static asset (what's in the `generated` folder) and serve that directly from the CDN. Only if there's no match, it will spin up the Worker and run your server code (what's in `dist/server.js` if you've run `pnpm run build` – this can be useful for debugging, but otherwise isn't required).

### Node.js dev server

For Cloudflare, the above build step is [recommended](https://developers.cloudflare.com/workers/wrangler/bundling/#disable-bundling) (even though that's only beneficial for dead-code elimination – the importing itself is fast).
However, for local development, you can use Node.js to spin up a server that reloads more quickly than Wrangler:

    pnpm run start

Then open <http://localhost:8000> in your browser.

However, be aware that the _Node.js_ and _workerd_ JavaScript runtimes don't support exactly the same features. Thus to get the exact same behaviour as on production, you should use `pnpm run dev`.


## Next steps

To see how Mastro works, see the [docs](https://mastrojs.github.io/docs/) or [follow the guide](https://mastrojs.github.io/guide/server-side-components-and-routing/).

To make sure you're on the latest Mastro version:

    pnpm update @mastrojs/mastro --latest


## Deploy to production

To deploy to production directly from your commandline, run:

    pnpm run deploy

Alternatively, to set up automatic deployment from your GitHub repo, go to the [Cloudflare Dashboard](https://dash.cloudflare.com). On the **Build > Workers & Pages** page, click **Create application**, choose **Continue with GitHub**, and follow the instructions. Make sure you've set:

- Build command: `pnpm run build`
- Deploy command: `npx wrangler deploy`

and that the Node.js version in your [`.node-version`](.node-version) file is the same as in the `engines` field of your [`package.json`](package.json).
