import type { Agent, BlobRef } from "@atproto/api";
import fs from "node:fs/promises";

import type { Action } from "./document.ts";

/**
 * https://standard.site/docs/lexicons/publication/
 */
export interface Publication {
  url: URL;
  name: string;
  description?: string;
  icon?: {
    blob: Buffer;
    mimeType: string;
  };
  basicTheme?: BasicTheme;
}

export type PublicationWithRkey = Publication & { rkey: string };
type PublicationWithOldIcon = Omit<PublicationWithRkey, "icon"> & { icon?: BlobRef };

export interface FetchedPublication {
  name: string;
  url: string;
  description?: string;
  icon?: BlobRef;
  basicTheme?: BasicTheme;
  preferences: { showInDiscover: boolean };
}

/**
 * https://standard.site/docs/lexicons/theme/
 */
export interface BasicTheme {
  /** Color used for content background */
  background: Color;
  /** Color used for content text */
  foreground: Color;
  /** Color used for button backgrounds and links */
  accent: Color;
  /** Color used for button text */
  accentForeground: Color;
}

/**
 * RGB Color
 */
export type Color = { r: number; g: number; b: number };

const themeKeys = [
  "background",
  "foreground",
  "accent",
  "accentForeground",
] as const satisfies Array<keyof BasicTheme>;

export const pubUriFromFile = async (
  wellKnownFilePath: string,
): Promise<{ uri: string; rkey: string } | undefined> => {
  try {
    const uri = (
      await fs.readFile(wellKnownFilePath, { encoding: "utf8" })
    ).trim();
    if (!uri.startsWith("at://")) {
      throw Error(`publicationUri must be an at:// protocol URI, was ${uri}`);
    }
    const [_, rkey] = uri.split("/site.standard.publication/");
    if (!rkey) {
      throw Error(`Could not extract site.standard.publication rkey from ${uri}`);
    }
    return { uri, rkey };
  } catch (e: any) {
    if (e.code !== "ENOENT") {
      throw e;
    }
  }
};

export const createOrUpdatePublication = async (
  agent: Agent,
  pub: PublicationWithRkey,
): Promise<boolean> => {
  const oldPub = await fetchPublication(agent, pub.rkey);
  if (!oldPub) {
    await pushPublication(agent, "createRecord", pub);
  } else {
    const changedPub = comparePubs(oldPub, pub);
    if (changedPub) {
      await pushPublication(agent, "putRecord", changedPub);
      const pubPathChanged = new URL(oldPub.url).pathname !== pub.url.pathname;
      return pubPathChanged;
    }
  }
  return false;
};

export const comparePubs = (
  oldPub: FetchedPublication,
  pub: PublicationWithRkey,
): PublicationWithRkey | PublicationWithOldIcon | undefined => {
  const { icon: oldIcon, basicTheme: oldTheme } = oldPub;
  const iconChanged = oldIcon?.size !== (pub.icon ? Buffer.byteLength(pub.icon.blob) : undefined);
  const newTheme = pub.basicTheme;
  const themeChanged = themeKeys.some((key) =>
    oldTheme?.[key].r !== newTheme?.[key].r ||
    oldTheme?.[key].g !== newTheme?.[key].g ||
    oldTheme?.[key].b !== newTheme?.[key].b
  );
  const stringFieldChanged = new URL(oldPub.url).toString() !== pub.url.toString() ||
    oldPub.name !== pub.name || oldPub.description !== pub.description;
  return iconChanged || themeChanged || stringFieldChanged
    ? (iconChanged ? pub : { ...pub, icon: oldIcon }) // don't re-upload icon if not changed
    : undefined;
};

const fetchPublication = async (agent: Agent, rkey: string) => {
  try {
    const pub = await agent.com.atproto.repo.getRecord({
      repo: agent.did!,
      collection: "site.standard.publication",
      rkey,
    });
    return pub.data.value as unknown as FetchedPublication;
  } catch (e: any) {
    if (e.error === "RecordNotFound") {
      return;
    } else {
      throw e;
    }
  }
};

export function pushPublication(
  agent: Agent,
  action: "createRecord",
  pub: Publication,
): ReturnType<typeof agent.com.atproto.repo.createRecord>;
export function pushPublication(
  agent: Agent,
  action: "putRecord",
  pub: PublicationWithRkey | PublicationWithOldIcon,
): ReturnType<typeof agent.com.atproto.repo.putRecord>;
export async function pushPublication(
  agent: Agent,
  action: Action,
  pub: Publication | PublicationWithOldIcon,
) {
  let icon;
  if (pub.icon && "blob" in pub.icon) {
    const res = await agent.com.atproto.repo.uploadBlob(
      new Uint8Array(pub.icon.blob),
      { encoding: pub.icon.mimeType },
    );
    console.log("Uploaded new icon");
    const { mimeType, ref, size } = res.data.blob;
    icon = {
      $type: "blob",
      ref: { $link: ref.toString() },
      mimeType,
      size,
    };
  } else {
    icon = pub.icon;
  }

  const theme = pub.basicTheme;
  const basicTheme = theme
    ? {
      "$type": "site.standard.theme.basic",
      ...Object.fromEntries(
        themeKeys.map((key) => [key, { ...theme[key], $type: "site.standard.theme.color#rgb" }]),
      ),
    }
    : undefined;

  try {
    const res = await agent.com.atproto.repo[action]({
      repo: agent.did!,
      collection: "site.standard.publication",
      rkey: (pub as PublicationWithRkey).rkey,
      record: {
        $type: "site.standard.publication",
        url: pub.url.toString(),
        name: pub.name,
        description: pub.description,
        icon,
        basicTheme,
        preferences: { showInDiscover: true },
      },
    });
    console.log(`${action === "createRecord" ? "Created" : "Updated"} publication ${res.data.uri}`);
    return res;
  } catch (e) {
    console.error(`pushPublication failed to ${action}`, pub, e);
    process.exit(1);
  }
}
