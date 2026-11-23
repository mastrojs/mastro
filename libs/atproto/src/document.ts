import type { Agent } from "@atproto/api";
import { isDeepStrictEqual } from "node:util";

import { rkeyFromPath, type RkeyStrategy } from "./rkey.ts";

export type Action = "createRecord" | "putRecord";

/**
 * https://standard.site/docs/lexicons/document/
 */
export interface Document {
  /**
   * Document title
   */
  title: string;
  url: URL;
  publishedAt: Date;
  description?: string;
  /**
   * Full plaintext of the article. No markdown."
   */
  textContent?: string;
  /** Optionally provide your own [rkey](https://atproto.com/specs/record-key)
   * to override the `opts.rkeyStrategy` passed to `createOrUpdateStandardSite` */
  rkey?: string;
  /** Allow any additional fields supported by the standard.site document lexicon. */
  [key: string]: unknown;
}

type DocumentValidated = Document & { path: string; rkey: string };

const documentStringFields = [
  "title",
  "description",
  "textContent",
] as const satisfies Array<keyof Document>;

const documentDeepEqualsFields = [
  "content",
  "tags",
  "links",
  "labels",
  "bskyPostRef",
] as const;

export const validateAndAddRkey = (
  docs: Document[],
  publicationUrl: URL,
  strategy: RkeyStrategy,
): DocumentValidated[] => {
  const usedRKeys: Record<string, boolean> = {};
  const pubPath = publicationUrl.pathname;
  for (const doc of docs) {
    // Basic validation in case people don't typecheck their YAML metadata.
    if (!doc.url) throw Error(`doc.url not found for doc: ${doc.title || JSON.stringify(doc)}`);
    if (!doc.title) throw Error(`doc.title not found for doc "${doc.url}"`);
    if (!doc.publishedAt) throw Error(`doc.publishedAt not found for doc "${doc.url}"`);

    const { pathname } = doc.url;
    const path = pathname.slice(pubPath.length);
    (doc as DocumentValidated).path = path;

    if (!doc.rkey) {
      if (!pathname.startsWith(pubPath)) {
        throw Error(
          `doc.url path must start with publication.url path (i.e. ${pubPath}), but was ${pathname}`,
        );
      }
      const rkey = rkeyFromPath(pathname, strategy);
      if (!rkey) throw Error(`Couldn't construct rkey for doc ${doc.url}`);
      if (usedRKeys[rkey]) throw Error(`rkey ${rkey} was already used by another document`);
      usedRKeys[rkey] = true;
      doc.rkey = rkey;
    }
  }
  return docs as DocumentValidated[];
};

export const createOrUpdateDocuments = async (
  agent: Agent,
  docs: DocumentValidated[],
  publicationAtUri: string,
  pubPathChanged: boolean,
): Promise<void> => {
  const existingDocs: Record<string, Record<string, unknown>> = {};
  for (const oldDoc of await fetchDocuments(agent, publicationAtUri)) {
    existingDocs[oldDoc.rkey] = oldDoc;
  }
  for (const newDoc of docs) {
    const oldDoc = existingDocs[newDoc.rkey];
    if (!oldDoc) {
      await pushDocument(agent, publicationAtUri, "createRecord", newDoc);
    } else if (pubPathChanged || docChanged(oldDoc, newDoc)) {
      await pushDocument(agent, publicationAtUri, "putRecord", newDoc);
    }
  }
};

export const docChanged = (oldDoc: Record<string, unknown>, newDoc: Document): boolean =>
  oldDoc.publishedAt !== newDoc.publishedAt.toISOString() ||
  documentStringFields.some((field) => oldDoc[field] !== newDoc[field]) ||
  documentDeepEqualsFields.some((field) => !isDeepStrictEqual(oldDoc[field], newDoc[field]));

const fetchDocuments = async (agent: Agent, publicationUri: string) => {
  const docs = await agent.com.atproto.repo.listRecords({
    repo: agent.did!,
    collection: "site.standard.document",
    limit: 100,
  });
  return docs.data.records
    .filter((r) => r.value.site === publicationUri)
    .map((r) => ({ ...r.value, rkey: r.uri.split("/").pop() as string }));
};

const pushDocument = async (
  agent: Agent,
  publicationUri: string,
  action: Action,
  doc: DocumentValidated,
) => {
  const { url: _url, rkey, ...rest } = doc;
  try {
    const res = await agent.com.atproto.repo[action]({
      repo: agent.did!,
      collection: "site.standard.document",
      rkey,
      record: {
        ...rest,
        $type: "site.standard.document",
        site: publicationUri,
        publishedAt: doc.publishedAt.toISOString(),
      },
    });
    console.log(
      `${
        action === "createRecord" ? "Created" : "Updated"
      } ${doc.path} ${ansiSetBlue}${res.data.uri}${ansiResetStyles}`,
    );
    return res;
  } catch (e) {
    console.error(`pushDocument failed to ${action} for ${publicationUri}`, doc, e);
    process.exit(1);
  }
};

const ansiSetBlue = "\x1b[34m";
const ansiResetStyles = "\x1b[0m";
