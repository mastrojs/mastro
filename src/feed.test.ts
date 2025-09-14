import { assertEquals } from 'jsr:@std/assert'
import { html } from "./core/html.ts";
import { atomResponse } from "./feed.ts";

const baseUrl = "https://mastrojs.github.io/";
const updated = new Date("2025-01-01");

Deno.test('Basic Atom feed', async () => {
  const res = await atomResponse({
    title: "Mastro News",
    id: new URL(baseUrl),
    linkSelf: new URL("feed.xml", baseUrl),
    updated,
    author: {
      name: "me"
    },
    entries: [{
      title: "Test",
      id: new URL(baseUrl + "blog/test/"),
      updated,
      content: html`Less: <em> &lt; </em>`,
    }]
  });
  assertEquals(
    await res.text(),
    `<?xml version="1.0" encoding="utf-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <title>Mastro News</title>
      
      <link rel="self" href="https://mastrojs.github.io/feed.xml" />
      
      <updated>2025-01-01T00:00:00.000Z</updated>
      
    <author>
      <name>me</name>
      
      
    </author>
  
      <id>https://mastrojs.github.io/</id>
      
      
      
    <entry>
      <id>https://mastrojs.github.io/blog/test/</id>
      <title>Test</title>
      <updated>2025-01-01T00:00:00.000Z</updated>
      
      
      
      <content type="html">Less: &lt;em&gt; &amp;lt; &lt;/em&gt;</content>
    </entry>
  
    </feed>
  `,
  )
})
