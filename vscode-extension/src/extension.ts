import * as vscode from "vscode";

export const activate = async (context: vscode.ExtensionContext) => {
  context.subscriptions.push(
    vscode.commands.registerCommand("mastro.preview", async () => {
      const rootFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
      if (!rootFolder) {
        vscode.window.showErrorMessage(
          "Working folder not found, open a folder and try again",
        );
        return;
      }
      const basePath = rootFolder.path === "/" ? "" : rootFolder.path;
      const basePathLen = basePath.length;
      const outputChannel = vscode.window.createOutputChannel("Mastro Generate")

      const panel = vscode.window.createWebviewPanel(
        "mastro",
        "Preview",
        vscode.ViewColumn.Two,
        {
          enableScripts: true,
        },
      );
      const { webview } = panel;

      const history: string[] = [];
      webview.html = await getWebviewContent(webview, context, rootFolder, basePath, history);
      webview.onDidReceiveMessage(async (msg) => {
        switch (msg.type) {
          case "openExternal": {
            vscode.env.openExternal(vscode.Uri.parse(msg.target))
            return;
          }
          case "pushHistory": {
            history.push(msg.path);
            return;
          }
          case "popHistoryTwice": {
            history.pop();
            history.pop();
            return;
          }
          case "findFiles": {
            const { pattern, requestId } = msg;
            const response = [];
            for (const uri of await findFiles(rootFolder, basePath, pattern)) {
              response.push(uri.path.slice(basePathLen));
            }
            webview.postMessage({ type: "success", response, requestId });
            return;
          }
          case "clearOutputChannel": {
            outputChannel.clear();
            return;
          }
          case "generateFiles": {
            const { files } = msg;
            try {
              await vscode.workspace.fs.delete(
                rootFolder.with({ path: basePath + "/docs" }),
                { recursive: true },
              );
              await vscode.workspace.fs.writeFile(
                rootFolder.with({ path: basePath + "/docs/.nojekyll" }),
                new Uint8Array(0),
              );

              const encoder = new TextEncoder();
              await Promise.all(files.map(async (file: any) => {
                const { outFilePath, output } = file;
                const fileUri = rootFolder.with({ path: basePath + "/docs" + outFilePath });
                const contents = output
                  ? encoder.encode(output)
                  : await vscode.workspace.fs.readFile(
                      rootFolder.with({ path: basePath + "/routes" + outFilePath }),
                    );
                return vscode.workspace.fs.writeFile(fileUri, contents);
              }));
              outputChannel.appendLine('🟢 Updated docs/ folder. Click the "Source Control" icon on the left, then click "Commit & Push" to publish your changes.');
              outputChannel.show(true);
            } catch (e) {
              vscode.window.showErrorMessage(`${e}`);
            }
            return;
          }
          case "readDir": {
            const { path, requestId } = msg;
            try {
              const entries = await vscode.workspace.fs.readDirectory(
                rootFolder.with({ path: basePath + path }),
              );
              const response = entries.flatMap(([name, type]) =>
                type === vscode.FileType.File ? name : []
              );
              webview.postMessage({ type: "success", response, requestId });
            } catch (e) {
              const response = `readDir failed to find ${path}: ${(e as any)?.code || e}`
              webview.postMessage({ type: "error", response, requestId });
            }
            return;
          }
          case "readTextFile": {
            const { path, requestId } = msg;
            try {
              const bs = await vscode.workspace.fs.readFile(
                rootFolder.with({ path: basePath + path }),
              );
              const response = new TextDecoder().decode(bs);
              webview.postMessage({ type: "success", response, requestId });
            } catch (e) {
              const response = `readTextFile failed to find ${path}: ${(e as any)?.code || e}`
              webview.postMessage({ type: "error", response, requestId });
            }
            return;
          }
          case "setPanelTitle": {
            panel.title = msg.title;
            return;
          }
          case "showError": {
            vscode.window.showErrorMessage(msg.error);
            return;
          }
          case "showErrorInOutputChannel": {
            outputChannel.appendLine("🔴 " + msg.error);
            outputChannel.show(true);
            return;
          }
        }
      });

      const disposables: vscode.Disposable[] = [];

      // TODO: perhaps we wouldn't need to redraw the whole webview every time...
      const redrawWebview = () =>
        getWebviewContent(webview, context, rootFolder, basePath, history)
          .then(html => {
            webview.html = "";
            webview.html = html;
          })
      vscode.workspace.onDidCreateFiles(redrawWebview, this, disposables)
      vscode.workspace.onDidDeleteFiles(redrawWebview, this, disposables)
      vscode.workspace.onDidRenameFiles(redrawWebview, this, disposables)
      vscode.workspace.onDidSaveTextDocument(redrawWebview, this, disposables)

      panel.onDidDispose(() => disposables.forEach((d) => d.dispose()));
    }),
  );
};

const getWebviewContent = async (
  webview: vscode.Webview,
  context: vscode.ExtensionContext,
  rootFolder: vscode.Uri,
  basePath: string,
  history: string[],
) => {
  return String.raw`<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>WebviewPanel</title>

        <script type="importmap">
          ${await getImportMap(webview, context, rootFolder, basePath)}
        </script>

        <!--
          we need to keep the following script inline, because with asWebviewUri, it
          would be on a different origin, and then the importmap wouldn't apply anymore.
        -->
        <script type="module">
        const vscode = acquireVsCodeApi()
        try {

          const postMessageAndAwaitAnswer = msg =>
            new Promise((resolve, reject) => {
              const requestId = crypto.randomUUID()
              window.addEventListener("message", event => {
                const { data } = event
                if (data?.requestId === requestId) {
                  if (data.type === "success") {
                    resolve(data.response)
                  } else {
                    reject(data.response)
                  }
                }
              })
              vscode.postMessage({ ...msg, requestId })
            })
          window.fs = {
            findFiles: pattern => postMessageAndAwaitAnswer({ type: "findFiles", pattern }),
            readDir: pathOfDir => postMessageAndAwaitAnswer({ type: "readDir", path: pathOfDir }),
            readTextFile: path => postMessageAndAwaitAnswer({ type: "readTextFile", path }),
          }

          // after we've populated window.fs, we can import things that use it
          const { routes, matchRoute } = await import("mastro/router.js")

          const replaceAsync = async (str, regex, asyncFn) => {
            const promises = []
            str.replace(regex, (match, ...args) => {
                promises.push(asyncFn(match, ...args))
                return match
            })
            const data = await Promise.all(promises)
            return str.replace(regex, () => data.shift())
          }

          const toDataUrl = url =>
            new Promise(async resolve => {
              const reader = new FileReader()
              reader.onload = () => resolve(reader.result)
              reader.readAsDataURL(await fetch(url).then(r => r.blob()))
            })

          const staticFiles = ${await getStaticFiles(webview, rootFolder, basePath)};
          const replaceStaticLinksWithDataUrls = (path, str) =>
            replaceAsync(str, /(<.*?[src|href]=")([^"]+)(".*>)/gi, async (match, p1, p2, p3) => {
                const assetPath = URL.parse(p2, "http://localhost" + path)?.pathname
                const webViewUrl = staticFiles[assetPath]
                return webViewUrl
                  ? p1 + await toDataUrl(webViewUrl) + p3
                  : match
                }
            )

          const getTitle = str =>
            str.match(/.*<title>([^<]+)/)?.[1]

          const insertNavigationInterceptScript = str => {
            // hack that injects a script that tells parent window when a link was clicked or similar
            const [head, tail] = str.split("</head>")
            return head + '<script' + '>window.addEventListener("beforeunload", e => {e.preventDefault(); window.parent.postMessage({ type: "navigate", target: document.activeElement.getAttribute("href") }, "*");})</script' + '>' + "</head>" + (tail || "")
          }

          const transformOutput = async (path, output) => {
            vscode.postMessage({ type: "setPanelTitle", title: getTitle(output) || "Preview" })
            const out = await replaceStaticLinksWithDataUrls(path, output)
            return insertNavigationInterceptScript(out)
          }

          const getStaticFile = async (origPath, segment) => {
            const path = (origPath === "/" ? "" : origPath) + segment + ".html"
            return staticFiles[path]
              ? postMessageAndAwaitAnswer({ type: "readTextFile", path: "/routes" + path })
              : undefined
          }

          const backBtn = document.getElementById("backBtn")
          const pathInput = document.getElementById("pathInput")
          const history = ${JSON.stringify(history)}
          const iframe = document.querySelector("iframe")

          const render = async (path) => {
            console.clear()
            console.log('rendering ', path)
            vscode.postMessage({
              type: "pushHistory",
              path,
            })
            pathInput.value = path
            backBtn.disabled = history.length < 1
            history.push(path)

            try {
              const staticHtml = await getStaticFile(path, "") || await getStaticFile(path, "/index")
              if (staticHtml) {
                iframe.srcdoc = await transformOutput(path, staticHtml)
                return
              }

              const urlStr = "http://localhost" + path
              const route = matchRoute(urlStr)
              if (route) {
                try {
                  const { GET } = await import(route.filePath)
                  if (typeof GET === "function") {
                    const res = await GET(new Request(urlStr))
                    if (res instanceof Response) {
                      const output = await res.text()
                      iframe.srcdoc = await transformOutput(path, output)
                    } else {
                      iframe.srcdoc = '<h2>Failed to render page</h2><p>GET must return a Response object</p>'
                    }
                  } else {
                    iframe.srcdoc = '<p>' + route.filePath + ' must export a function named GET</p>'
                  }
                } catch (e) {
                  console.error(e)
                  const eStr = e?.message || e?.name || e?.toString()
                  iframe.srcdoc = '<h2>Failed to render page</h2><p>' + eStr + '</p>'
                  const urlStr = e.stack?.split("\n")?.[1]?.trim().match(/\((.*)\)/)?.[1]
                  const msg = URL.parse(urlStr)?.pathname
                  iframe.srcdoc += '<p>' + (msg
                      ? ('at ' + msg)
                      : urlStr || (e.stack.endsWith(eStr) ? '' : (e.stack || ''))
                    ) + '</p>'
                }
              } else {
                iframe.srcdoc = '<h1>404 page not found</h1>'
              }
            } catch (e) {
              iframe.srcdoc = '<p>' + e + '</p>'
            }
          }

          window.addEventListener("message", event => {
            const { data } = event
            if (data.type === "navigate" && data.target) {
              const { target } = data
              const oldPath = history.at(-1) || "/"
              if (target.startsWith("https://") || target.startsWith("http://")) {
                vscode.postMessage({ type: "openExternal", target })
                // overwrite iframe contents because we cannot prevent it from navigating away:
                render(oldPath)
              } else {
                const newPath = URL.parse(target, "http://localhost" + pathInput.value)?.pathname
                render(newPath || oldPath)
              }
            }
          })

          render("${history.at(-1) || "/"}")

          document.querySelector("form").addEventListener("submit", e => {
            e.preventDefault()
            render(pathInput.value || "/")
          })
          backBtn.addEventListener("click", () => {
            history.pop()
            render(history.pop())
            vscode.postMessage({
              type: "popHistoryTwice",
            })
          })

          document.getElementById("generateBtn").addEventListener("click", async () => {
            try {
              vscode.postMessage({ type: "clearOutputChannel" })
              const { generatePagesForRoute, getStaticFilePaths } = await import("mastro/generate.js")

              const files = (await getStaticFilePaths()).map(outFilePath => ({ outFilePath }))
              for (const { filePath } of routes) {
                try {
                  // we have to do the import here and cannot factor it out to mastro/generate
                  const module = await import(filePath)
                  try {
                    const pages = await generatePagesForRoute(filePath, module)
                    files.push(...pages.filter(p => p))
                  } catch (e) {
                    const error = "Failed to generate route " + filePath + ": " +
                      (e?.message || e?.code || JSON.stringify(e))
                    vscode.postMessage({ type: "showErrorInOutputChannel", error });
                  }
                } catch (e) {
                  const error = "Failed to import route " + filePath + ": " + e;
                  vscode.postMessage({ type: "showErrorInOutputChannel", error });
                }
              }
              vscode.postMessage({ type: "generateFiles", files })
            } catch (e) {
              console.error(e)
              vscode.postMessage({ type: "showErrorInOutputChannel", error: e.message || e.toString() })
            }
          })
        } catch (e) {
          console.error(e)
          vscode.postMessage({ type: "showError", error: e.toString() })
        }
        </script>

        <style>
          html {
            height: 100%;
          }
          body {
            padding: 0;
            min-height: 100%;
          }
          form {
            margin: 0 1em;
            display: flex;
            gap: 0.75em;
            margin: 0.75em 1em;
          }
          #pathInput {
            flex-grow: 1;
            width: 3em;
          }
          #generateBtn {
            margin-left: auto;
          }
          input {
            background-color: transparent;
            color: var(--vscode-editor-foreground);
            font-family: var(--vscode-font-family);
            font-weight: var(--vscode-font-weight);
            font-size: var(--vscode-font-size);
          }
          iframe {
            border: 0;
            height: calc(100vh - 25px);
            width: 100%;
            overflow: hidden;
            background-color: white;
          }
        </style>
      </head>
      <body>
        <form>
          <button id="backBtn" type="button" disabled>←</button>
          <input id="pathInput">
          <button id="generateBtn" type="button">Generate</button>
        </form>
        <iframe sandbox="allow-modals allow-scripts">
      </body>
    </html>
    `;
};

const getImportMap = async (
  webview: vscode.Webview,
  context: vscode.ExtensionContext,
  rootFolder: vscode.Uri,
  basePath: string,
) => {
  const imports = {} as Record<string, string>;
  for (const uri of await findFiles(rootFolder, basePath, "**/*")) {
    if (uri.path.endsWith(".js")) {
      imports[uri.path.slice(basePath.length)] = webview.asWebviewUri(uri)
        .toString();
    }
  }

  ["fs.js", "generate.js", "html.js", "markdown.js", "router.js", "routes.js"]
    .forEach((fileName) => {
      const uri = vscode.Uri.joinPath(context.extensionUri, "mastro", fileName);
      imports["mastro/" + fileName] = webview.asWebviewUri(uri).toString();
    });
  return JSON.stringify({ imports });
};

const getStaticFiles = async (webview: vscode.Webview, rootFolder: vscode.Uri, basePath: string) => {
  const files = {} as Record<string, string>;
  for (const uri of await findFiles(rootFolder, basePath, "routes/**/*")) {
    if (isStaticFile(uri.path)) {
      files[uri.path.slice(7 + basePath.length)] = webview.asWebviewUri(uri)
        .toString();
    }
  }
  return JSON.stringify(files);
};

const findFiles = async (
  rootFolder: vscode.Uri,
  basePath: string,
  pattern: string,
): Promise<vscode.Uri[]> => {
  // once https://github.com/microsoft/vscode/issues/249197 is fixed, this whole
  // function can be replaced with `vscode.workspace.findFiles(pattern)`

  // for now, this poor replacement implementation only works on patterns of the form:
  // `**/*`
  // `routes/**/*`
  // `routes/**/*.server.js`
  // `data/posts/*.md`

  const readDir = async (path: string) => {
    try {
      const entries = await vscode.workspace.fs.readDirectory(
        rootFolder.with({ path: basePath + path })
      )
      return entries.map(([name, type]) => [path + "/" + name, type] as const)
    } catch (e) {
      console.warn(e)
      return []
    }
  }

  pattern = pattern.startsWith("/") ? pattern : "/" + pattern
  const segments = pattern.split("/")
  const fileNamePattern = segments.pop()
  if (!fileNamePattern) return []

  const traverse = async (dirPath: string): Promise<string[]> => {
    const paths = []
    for (const [name, type] of await readDir(dirPath)) {
      if (type === vscode.FileType.File) {
        paths.push(name)
      } else if (type === vscode.FileType.Directory) {
        paths.push(...await traverse(name))
      }
    }
    return paths
  }

  const files = segments.at(-1) === "**"
    ? await traverse(segments.slice(0, -1).join("/"))
    : await readDir(segments.join("/")).then(entries => entries.map(([name]) => name))

  const makePredicate = () => {
    if (fileNamePattern[0] === "*") {
     const suffix = fileNamePattern.slice(1)
     return (fileName: string) => fileName.endsWith(suffix)
    } else {
      return (fileName: string) => fileName === fileNamePattern
    }
  }
  return files
    .filter(makePredicate())
    .map(name => rootFolder.with({ path: basePath + name }))
}

const isStaticFile = (p: string) =>
  !p.endsWith(".server.ts") && !p.endsWith(".server.js") && !p.endsWith("/.DS_Store");
