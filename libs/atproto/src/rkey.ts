/**
 * Strategy to deterministically derive an rkey from a URL path
 */
export type RkeyStrategy = "tidFromPath" | "anyFromPath";

/**
 * If you're not using custom rkeys in your documents, use this function to reconstruct
 * the rkey that was used to publish this document to the Atmosphere.
 * Pass in the same `url` that your document had when you called `createOrUpdateDocuments`.
 *
 * ```
 * <link rel="site.standard.document"
 *   href="at://${myDid}/site.standard.document/${rkeyFromUrl(doc.url)}">
 * ```
 */
export const rkeyFromUrl = (url: URL, strategy: RkeyStrategy = "tidFromPath"): string =>
  rkeyFromPath(url.pathname, strategy);

export const rkeyFromPath = (path: string, strategy: RkeyStrategy): string =>
  strategy === "anyFromPath" ? anyFromPath(path) : tidFromPath(path);

export const anyFromPath = (path: string): string => {
  if (path.at(0) === "/") path = path.slice(1);
  if (path.at(-1) === "/") path = path.slice(0, path.length - 1);
  return path.replaceAll("/", "-").replace(/[^a-zA-Z0-9._~-]/g, "").slice(0, 512);
};

export const tidFromPath = (path: string): string => {
  if (path.replaceAll("/", "").length === 0) {
    throw Error(`tidFromPath received empty path (after slashes were removed): ${path}`);
  }
  const dateStr = extractDate(path);
  // TID: 64-bit int (bit 63 = 0)
  // - bits 62-10 = microsecond timestamp (53 bits)
  // - bits 9-0 = clock ID (10 bits)
  let tid: bigint;
  if (dateStr) {
    const date = new Date(dateStr);
    const micros = (BigInt(date.getTime()) * 1000n) & ((1n << 53n) - 1n);
    const clockId = hashBits(path, 10);
    tid = (micros << 10n) | clockId;
  } else {
    tid = hashBits(path, 63);
  }
  return encodeTid(tid);
};

/**
 * exported only for tests
 */
export const extractDate = (path: string): string | undefined => {
  const m = path.match(/(\d{4})[/-](\d{2})[/-](\d{2})/);
  if (m) {
    return `${m[1]}-${m[2]}-${m[3]}`;
  }
};

/**
 * FNV-1a hash truncated to `nrOfBits` bits
 */
const hashBits = (s: string, nrOfBits: number): bigint => {
  const mask = (1n << BigInt(nrOfBits)) - 1n;
  let h = 0xcbf29ce484222325n;
  for (let i = 0; i < s.length; i++) {
    h ^= BigInt(s.charCodeAt(i));
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return h & mask;
};

const encodeTid = (n: bigint): string => {
  let result = "";
  for (let i = 0; i < 13; i++) {
    result = BASE32[Number(n & 31n)] + result;
    n >>= 5n;
  }
  return result;
};

const BASE32 = "234567abcdefghijklmnopqrstuvwxyz";
