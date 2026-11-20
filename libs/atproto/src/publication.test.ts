import assert from "node:assert/strict";
import { test } from "node:test";

import {
  comparePubs,
  pubUriFromFile,
  type FetchedPublication,
  type PublicationWithRkey,
} from "./publication.ts";

const icon = (size: number): any => ({
  size,
  $type: "blob",
  ref: { $link: "baf" },
  mimeType: "image/png",
});

const blob = (size: number) => ({ blob: Buffer.alloc(size), mimeType: "image/png" });

const theme = () => ({
  background: { r: 255, g: 255, b: 255 },
  foreground: { r: 0, g: 0, b: 0 },
  accent: { r: 0, g: 100, b: 200 },
  accentForeground: { r: 255, g: 255, b: 255 },
});

const oldPub = (): FetchedPublication => ({
  name: "My Blog",
  description: "A blog",
  url: "https://example.com",
  icon: icon(100),
  basicTheme: theme(),
  preferences: { showInDiscover: true },
});

const newPub = (): PublicationWithRkey => ({
  url: new URL("https://example.com"),
  name: "My Blog",
  description: "A blog",
  rkey: "self",
  icon: blob(100),
  basicTheme: theme(),
});

test("comparePubs: identical publications", () => {
  const changedPub = comparePubs(oldPub(), newPub());
  assert.deepStrictEqual(changedPub, undefined);
});

test("comparePubs: name changed", () => {
  const name = "New Name";
  const changedPub = comparePubs(oldPub(), { ...newPub(), name });
  assert.deepStrictEqual(changedPub?.name, name);
  assert.deepStrictEqual(changedPub?.icon, icon(100));
});

test("comparePubs: description changed", () => {
  const description = "New description";
  const changedPub = comparePubs(oldPub(), { ...newPub(), description });
  assert.deepStrictEqual(changedPub?.description, description);
  assert.deepStrictEqual(changedPub?.icon, icon(100));
});

test("comparePubs: icon same size, nothing else changed", () => {
  const pub = { ...newPub(), icon: blob(100) };
  const changedPub = comparePubs(oldPub(), pub);
  assert.deepStrictEqual(changedPub, undefined);
});

test("comparePubs: name changed, no icon stays", () => {
  const pub = {
    ...newPub(),
    name: "New Name",
    icon: undefined,
  };
  const changedPub = comparePubs({ ...oldPub(), icon: undefined }, pub);
  assert.deepStrictEqual(changedPub, pub);
});

test("comparePubs: icon size changed", () => {
  const newIcon = blob(200);
  const changedPub = comparePubs(oldPub(), { ...newPub(), icon: newIcon });
  assert.deepStrictEqual(changedPub?.icon, newIcon);
});

test("comparePubs: new icon added for upload", () => {
  const pub = newPub();
  const changedPub = comparePubs({ ...oldPub(), icon: undefined }, pub);
  assert.deepStrictEqual(changedPub, pub);
});

test("comparePubs: icon removed", () => {
  const changedPub = comparePubs(oldPub(), { ...newPub(), icon: undefined });
  assert.deepStrictEqual(changedPub?.icon, undefined);
});

test("comparePubs: no icon in either publication", () => {
  const changedPub = comparePubs(
    { ...oldPub(), icon: undefined },
    {
      ...newPub(),
      icon: undefined,
    },
  );
  assert.deepStrictEqual(changedPub, undefined);
});

test("comparePubs: theme color changed", () => {
  const background = { r: 128, g: 0, b: 0 };
  const pub = { ...newPub(), basicTheme: { ...theme(), background } };
  const changedPub = comparePubs(oldPub(), pub);
  assert.deepStrictEqual(changedPub?.basicTheme?.background, background);
  assert.deepStrictEqual(changedPub?.icon, icon(100));
});

test("comparePubs: no theme in either publication", () => {
  const changedPub = comparePubs(
    { ...oldPub(), basicTheme: undefined },
    {
      ...newPub(),
      basicTheme: undefined,
    },
  );
  assert.deepStrictEqual(changedPub, undefined);
});

test("comparePubs: theme added", () => {
  const changedPub = comparePubs({ ...oldPub(), basicTheme: undefined }, newPub());
  assert.deepStrictEqual(changedPub?.basicTheme, theme());
  assert.deepStrictEqual(changedPub?.icon, icon(100));
});

test("comparePubs: theme removed", () => {
  const changedPub = comparePubs(oldPub(), { ...newPub(), basicTheme: undefined });
  assert.deepStrictEqual(changedPub?.basicTheme, undefined);
  assert.deepStrictEqual(changedPub?.icon, icon(100));
});

test("pubUriFromFile", async () => {
  const pub = await pubUriFromFile("./__fixtures__/well-known/index.html");

  assert.deepStrictEqual(pub, {
    uri: "at://did:plc:irutxjhccx4xajwsurbjdq6f/site.standard.publication/3mqlriwasx627",
    rkey: "3mqlriwasx627",
  });
});
