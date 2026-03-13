import { sseResponse } from "@mastrojs/mastro";

export const GET = () => {
  return sseResponse(generator());
};

// JS generator returning an AsyncIterable
async function* generator() {
  let i = 1;
  while (true) {
    yield { i };
    i++;
    await new Promise((r) => setTimeout(r, 1000));
  }
}
