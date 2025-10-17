# Contributing to the extension

This is a VS Code [Web Extension](https://code.visualstudio.com/api/extension-guides/web-extensions).

## Develop

    npm ci; npm run open-in-browser

See also [test your web extension](https://code.visualstudio.com/api/extension-guides/web-extensions#test-your-web-extension).

### Architecture

There are three levels of turtles, all containes within one file: `src/extension.ts` (that was we [don't need a bundler](https://code.visualstudio.com/api/working-with-extensions/bundling-extension)).

#### Extension web worker

Since we're in a VS Code web extension (which is being run in a [web worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API), we don't have access to Node.js's modules like `fs`. But we can use [`vscode.workspace.fs`](https://code.visualstudio.com/api/references/vscode-api#FileSystem) and [`vscode.Uri`](https://code.visualstudio.com/api/references/vscode-api#Uri).

#### WebviewPanel (server)

The extension calls `vscode.window.createWebviewPanel` and sets its html to the result of `getWebviewContent`. This webview (effectively also just an iframe) replaces Deno/Node.js as the place where the server-side code is run, i.e. where the static site generation takes place. Look out for:

```js
const { GET } = await import(route.filePath)
```

The Webview has some theming CSS set by VS Code. In the HTML, we render a sort of browser-like address bar, a back button and a giant iframe.

APIs we can call here:

- importing JavaScript modules that were set up in `getImportMap`
- `vscode.postMessage` and our utility function `postMessageAndAwaitAnswer`

#### iframe (browser)

It is that iframe that takes the role of the browser. The last step is that the output of the static page generation is injected into the iframe. Essentially:

```js
const output = await GET(req)
  .then(res => res.text())
iframe.srcdoc = output
```

APIs we can call here are those we set up in the WebViewPanel:
- `document.fs`
- `window.parent.postMessage`
