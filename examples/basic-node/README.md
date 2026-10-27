# Mastro Template Basic for Node.js

This is a basic TypeScript template for [Mastro](https://mastrojs.github.io) when using [Node.js](https://nodejs.org).

Click the green **Use this template** button in the top right to create your own copy of this repository. Then clone the **Code** to your computer.


## Run locally

Mastro requires Node.js >=24, which can be installed [via pnpm](https://pnpm.io/next/cli/runtime) – the package manager [recommended by JSR](https://jsr.io/docs/npm-compatibility#installing-and-using-jsr-packages).
Therefore, first [install pnpm](https://pnpm.io/installation#using-a-standalone-script): On Windows, use the `PowerShell` method. On macOS/Linux use the `curl` method (The `pnpm` version in homebrew isn't able to install Node.js).

The first time, you need to install the project dependencies:

    pnpm install

After that, to start the server:

    pnpm run start

and open <http://localhost:8000> in your browser.

To generate the whole static site (this will create a `generated` folder):

    pnpm run generate

## Next steps

To see how Mastro works, [follow the guide](https://mastrojs.github.io/guide/server-side-components-and-routing/).

To make sure you're using the latest Mastro packages:

    pnpm update "@mastrojs/*" --latest


## Deploy to production

- [Deploy static site](https://mastrojs.github.io/guide/deploy/#deploy-static-site-with-ci%2Fcd)
- [Deploy server](https://mastrojs.github.io/guide/deploy/#deploy-server-to-production)
