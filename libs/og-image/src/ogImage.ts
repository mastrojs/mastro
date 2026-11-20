import CanvasKitInit, { type CanvasKit, type EmulatedCanvas2DContext } from "canvaskit-wasm";
import { toLines } from "./util.ts";

export { softHyphen } from "./util.ts";

/** Emulated Canvas, see https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial */
export type Canvas = CanvasKitInit.EmulatedCanvas2D;

/** Emulated CanvasContext, see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D */
export type CanvasContext = EmulatedCanvas2DContext;

/** Options */
export interface Opts {
  /**
   * Either a string containing a CSS color value (defaults to "white"),
   * or a function that draws on the Canvas.
   */
  background?: string | ((ctx: CanvasContext, canvas: Canvas) => void);
  /** A CSS color value like `#ff0099`. Defaults to "black". */
  fontColor?: string;
  /** canvaskit-wasm doesn't seem to be able to use system fonts.
      Use e.g. `await Deno.readFile("./Roboto-Bold.ttf")` */
  fontFile: Uint8Array<ArrayBufferLike>;
  /** in px. defaults to 67 */
  fontSize?: number;
  /** in px. defaults to 630, which is recommended for og:image */
  height?: number;
  /** defaults to 1.25 */
  lineHeight?: number;
  /** in px, defaults to 100. Don't reduce too much or text will be cut off on some social apps. */
  paddingLeft?: number;
  /** in px, defaults to 100. Don't reduce too much or text will be cut off on some social apps. */
  paddingRight?: number;
  /** in px, defaults to 90. Don't reduce too much or text will be cut off on some social apps. */
  paddingTop?: number;
  /** in px. defaults to 1200, which is recommended for og:image */
  width?: number;
}

/**
 * Provided with a text string and a fontFile, returns a `Response` with a rasterized PNG image.
 */
export const renderImage = (text: string, opts: Opts): Response => {
  // if we wanted to generalize this for an array of texts, we could make the interface:
  // `renderImage(text: string | Opts[], defaultOpts: Opts)`
  const {
    background,
    fontColor = "black",
    fontFile,
    fontSize = 67,
    height = 630,
    lineHeight = 1.25,
    paddingLeft = 100,
    paddingRight = 100,
    paddingTop = 90,
    width = 1200,
  } = opts;
  const canvas = CanvasKit.MakeCanvas(width, height);
  const family = "DefaultFont";
  canvas.loadFont(fontFile, { family });
  const font = `${fontSize}px ${family}`;
  const ctx = canvas.getContext("2d") as CanvasContext;

  if (typeof background === "function") {
    ctx.fillStyle = fontColor;
    ctx.font = font;
    background(ctx, canvas);
  } else {
    ctx.fillStyle = background || "white";
    ctx.fillRect(0, 0, width, height);
  }

  ctx.fillStyle = fontColor;
  ctx.font = font;

  const lineWidth = width - paddingLeft - paddingRight;
  const lines = toLines(text, lineWidth, ctx.measureText.bind(ctx));
  let y = fontSize + paddingTop;
  lines.forEach((line) => {
    if (line) {
      ctx.fillText(line, paddingLeft, y);
      y += fontSize * lineHeight;
    } else {
      // a whole empty line takes too much space
      y += fontSize * lineHeight * 0.5;
    }
  });

  return toResponse(canvas);
};

const CanvasKit: CanvasKit = await (CanvasKitInit as any)();

const toResponse = (canvas: Canvas) => {
  const base64 = canvas.toDataURL().split(",")[1]!;
  const binary = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  const res = new Response(binary);
  // TODO: when in prod, set Cache-Control
  return res;
};
