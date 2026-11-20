import { Agent, CredentialSession } from "@atproto/api";
import fs from "node:fs/promises";
import { dirname } from "node:path";
import { stdout } from "node:process";

import { createOrUpdateDocuments, type Document, validateAndAddRkey } from "./document.ts";
import {
  createOrUpdatePublication,
  type Publication,
  pubUriFromFile,
  pushPublication,
} from "./publication.ts";
import type { RkeyStrategy } from "./rkey.ts";

export { type Document } from "./document.ts";
export type { BasicTheme, Color, Publication } from "./publication.ts";
export { rkeyFromUrl, type RkeyStrategy } from "./rkey.ts";

/**
 * Either an object `{ identifier: "your.bsky.social", password: process.env.ATPROTO_PASSWORD }`
 * or any kind of [session](https://npmx.dev/package/@atproto/api#user-content-session-management)
 * that can be passed to `new Agent(session)`.
 */
export type Auth =
  // we use `password: string | undefined` because that's the type of `process.env.ATPROTO_PASSWORD`
  | { identifier: string; password: string | undefined; serviceUrl?: string }
  | ConstructorParameters<typeof Agent>[0];

/**
 * If in an interactive terminal and project is not already set up, this does the setup.
 * If set up, it creates or updates the publication and the latest 100 documents in the Atmosphere.
 */
export const createOrUpdateStandardSite = async (
  auth: Auth,
  pub: Publication,
  docs: Document[],
  opts?: {
    /** Defaults to `routes`, but for other frameworks than Mastro may need to be set to `public` */
    baseFolder?: string;
    /**
     * If your documents don't specify a custom rkey, this strategy is used to derive one from
     * the document URL. Can be either:
     *
     * - `tidFromPath`: derive an rkey of type `TID` from `document.url.pathname` (default)
     * - `anyFromPath`: derive a human readable rkey of type `any` from
     * `document.url.pathname`. While it works in practice, it's unfortunately
     * [invalid per the current standard site schema](https://tangled.org/standard.site/lexicons/issues/7).
     */
    rkeyStrategy?: RkeyStrategy;
  },
): Promise<void> => {
  const agent = new Agent(await getSession(auth));

  const { pathname } = pub.url;
  const wellKnown = `${opts?.baseFolder || "routes"}/.well-known/site.standard.publication${
    pathname === "/" ? "" : (pathname.endsWith("/") ? `${pathname}index.html` : pathname)
  }`;
  const publicationUri = await pubUriFromFile(wellKnown);

  docs.sort((a, b) => a.publishedAt < b.publishedAt ? 1 : -1);

  let newDocs;
  try {
    newDocs = validateAndAddRkey(docs, pub.url, opts?.rkeyStrategy || "tidFromPath");
  } catch (e) {
    console.error(`${e}`);
    process.exit(1);
  }
  // limit to 100 until we implement pagination in fetchDocuments
  newDocs = newDocs.slice(0, 100);

  const addLinkText = `
${ansiSetBold}Update your HTML${ansiResetStyles}
Don't forget to add the following link tag to your document detail pages using
import { rkeyFromUrl } from "@mastrojs/atproto";

<link rel="site.standard.document"
  href="at://${agent.did}/site.standard.document/\${rkeyFromUrl(doc.url)}">

${ansiSetBold}Verify${ansiResetStyles}
After you've deployed your site, verify with https://site-validator.fly.dev
`;

  if (!publicationUri) {
    if (!stdout.isTTY || process.env.CI) {
      console.error(
        `No publication URI found in ${wellKnown}. Run this script locally to set things up.`,
      );
      process.exit(1);
    }
    stdout.write(`
${ansiSetBold}Documents path ${ansiSetBlue}rkey${ansiResetStyles}
${newDocs.map((d) => `${d.path} ${ansiSetBlue}${d.rkey}${ansiResetStyles}`).join("\n")}

${ansiSetBold}Publication URL${ansiResetStyles}
${pub.url}

Create publication now? [y/n] `);
    const answer = await detectKeyPress();
    if (answer.toLowerCase() === "y") {
      const res = await pushPublication(agent, "createRecord", pub);
      const pubRkey = res.data.uri.split("/").at(-1);
      if (!pubRkey) throw Error(`Could not extract rkey from ${res.data.uri}`);
      const uri = `at://${agent.did}/site.standard.publication/${pubRkey}`;
      try {
        await fs.mkdir(dirname(wellKnown), { recursive: true });
        await fs.writeFile(wellKnown, uri + "\n");
        console.clear();
        console.log(`${ansiSetBoldGreen}Successfully created publication${ansiResetStyles}\nURI: ${uri}\n\nAlso wrote ${wellKnown}`);
      } catch (e) {
        console.error(
          `Created publication but failed to write ${wellKnown} Please create it yourself with the following content:\n${uri}`,
          e,
        );
      }
      console.log(`${ansiSetBold}Add that file to your git repository.${ansiResetStyles}

Next time you run this script, it will publish your documents to the Atmosphere.
Either run this script manually whenver you have a new post,
or set up your CI/CD build step to run it automatically.

${addLinkText}
`);
    }
  } else {
    console.clear();
    const { uri, rkey } = publicationUri;
    const pubPathChanged = await createOrUpdatePublication(agent, { ...pub, rkey });
    await createOrUpdateDocuments(agent, newDocs, uri, pubPathChanged);
    console.log(`\n${ansiSetBoldGreen}Finished successfully!${ansiResetStyles}\n${addLinkText}`);
  }
};

const detectKeyPress = () =>
  new Promise<string>((resolve) => {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", (key: string) => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      stdout.write(key + "\n");
      resolve(key);
    });
  });

const getSession = async (auth: Auth) => {
  if (typeof auth === "object" && "identifier" in auth) {
    const { identifier, password, serviceUrl } = auth;
    if (!password) {
      console.error(`
No password found!

Get one from https://bsky.app/settings/app-passwords and locally run like:
ATPROTO_PASSWORD=xxxx-xxxx-xxxx-xxxx deno task publishToAtmosphere

In your CI/CD pipeline, add the password to a secret manager instead.
      `);
      process.exit(1);
    }
    const session = new CredentialSession(new URL(serviceUrl || "https://bsky.social"));
    await session.login({ identifier, password });
    return session;
  } else {
    return auth;
  }
};

const ansiSetBlue = "\x1b[34m";
const ansiSetBold = "\x1b[1m";
const ansiSetBoldGreen = "\x1b[1;32m";
const ansiResetStyles = "\x1b[0m";
