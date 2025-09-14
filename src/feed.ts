/**
 * Module with helper function to create an Atom feed.
 *
 * It’s not intended as a complete solution to all your feed generation needs,
 * but as a minimal yet practical default that works well with most feed readers.
 * @module
 */

import { type Html, html, renderToString } from "./core/html.ts";
import { htmlToResponse } from "./core/responses.ts";

interface AtomFeed {
  author?: AtomAuthor;
  entries: AtomEntry[];
  /** Link to the feed itself. */
  linkSelf?: URL;
  /** Link to an alternate representation of the feed, e.g. the HTML web page. */
  linkWebsite?: URL;
  /** Small image for the feed. Should be square. */
  icon?: URL;
  /** Universally unique and permanent URI identifying the feed. */
  id: URL;
  /** Large image for the feed. Should be twice as wide as it's tall. */
  logo?: URL;
  /** Human-readable description or subtitle for the feed. */
  subtitle?: string;
  /** Human-readable title of the feed. */
  title: string;
  /** Last time the feed was modified in a significant way. */
  updated: Date;
}

interface AtomEntry {
  author?: AtomAuthor;
  content?: Html;
  /** Universally unique and permanent URI identifying the entry. */
  id: URL;
  /** Link to an alternate representation of the entry, e.g. the HTML web page. */
  link?: URL;
  /** Short summary, abstract, or excerpt of the entry. */
  summary?: string;
  /** Human-readable title of the entry. */
  title: string;
  /** Last time the entry was modified in a significant way. */
  updated: Date;
}

interface AtomAuthor {
  email?: string;
  name: string;
  uri?: URL;
}

/**
 * Create a standard Response object containing an [Atom feed](https://validator.w3.org/feed/docs/atom.html).
 *
 * Validate your output with the [feed validator](https://validator.w3.org/feed/).
 */
export const atomResponse = async (feed: AtomFeed): Promise<Response> => {
  const node = html`<?xml version="1.0" encoding="utf-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <title>${feed.title}</title>
      ${feed.subtitle ? html`<subtitle>${feed.subtitle}</subtitle>` : ""}
      ${feed.linkSelf ? html`<link rel="self" href=${feed.linkSelf.toString()} />` : "" }
      ${feed.linkWebsite ? html`<link rel="alternate" href=${feed.linkWebsite.toString()} />` : "" }
      <updated>${feed.updated.toISOString()}</updated>
      ${feed.author ? renderAuthor(feed.author) : ""}
      <id>${feed.id.toString()}</id>
      ${feed.icon ? html`<icon>${feed.icon.toString()}</icon>` : ""}
      ${feed.logo ? html`<logo>${feed.logo.toString()}</logo>` : ""}
      ${feed.entries.map(renderEntry)}
    </feed>
  `;
  const res = await htmlToResponse(node);
  res.headers.set("Content-Type", "application/atom+xml");
  return res;
}

const renderAuthor = (a: AtomAuthor) =>
  html`
    <author>
      <name>${a.name}</name>
      ${a.email ? html`<email>${a.email}</email>` : ""}
      ${a.uri ? html`<uri>${a.uri.toString()}</uri>` : ""}
    </author>
  `;

const renderEntry = (e: AtomEntry) =>
  html`
    <entry>
      <id>${e.id.toString()}</id>
      <title>${e.title}</title>
      <updated>${e.updated.toISOString()}</updated>
      ${e.author ? renderAuthor(e.author) : ""}
      ${e.link
        ? html`<link rel="alternate" href=${e.link.toString()} />`
        : "" }
      ${e.summary ? html`<summary>${e.summary}</summary>` : ""}
      ${e.content
        ? html`<content type="html">${renderToString(e.content)}</content>`
        : ""}
    </entry>
  `;
