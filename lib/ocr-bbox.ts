import sharp from "sharp";
import { createWorker } from "tesseract.js";

import { type Bbox } from "@/lib/types";

export interface OcrWord {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OcrResult {
  words: OcrWord[];
  width: number;
  height: number;
}

// Minimal shape of the Tesseract page we traverse, kept local so we do not
// depend on the library's exact (version-specific) type exports.
interface RawWord {
  text?: unknown;
  bbox?: { x0?: unknown; y0?: unknown; x1?: unknown; y1?: unknown };
}
interface RawLine {
  words?: RawWord[];
}
interface RawParagraph {
  lines?: RawLine[];
}
interface RawBlock {
  paragraphs?: RawParagraph[];
}
interface RawPage {
  words?: RawWord[];
  blocks?: RawBlock[] | null;
}

function normalize(value: string): string {
  return value.toLocaleLowerCase("en-US").replace(/[^a-z0-9]/g, "");
}

function pushWord(out: OcrWord[], word: RawWord) {
  if (typeof word.text !== "string" || !word.text.trim()) return;
  const box = word.bbox;
  if (!box) return;
  const { x0, y0, x1, y1 } = box;
  if (
    typeof x0 !== "number" ||
    typeof y0 !== "number" ||
    typeof x1 !== "number" ||
    typeof y1 !== "number"
  ) {
    return;
  }
  out.push({ text: word.text, x0, y0, x1, y1 });
}

// Flatten the page into a flat, reading-order list of words. Tesseract v7
// exposes words under blocks -> paragraphs -> lines -> words; older shapes
// exposed a top-level words array, so handle both.
export function collectWords(page: RawPage): OcrWord[] {
  const out: OcrWord[] = [];
  if (Array.isArray(page.words) && page.words.length) {
    for (const word of page.words) pushWord(out, word);
    return out;
  }
  for (const block of page.blocks ?? []) {
    for (const para of block.paragraphs ?? []) {
      for (const line of para.lines ?? []) {
        for (const word of line.words ?? []) pushWord(out, word);
      }
    }
  }
  return out;
}

// Pure geometry: given OCR words (pixel boxes) and a field's text, find the
// contiguous run of words that best matches the text and return the union box
// as fractions of the image. Exported for unit testing without running OCR.
export function matchFieldBox(
  words: OcrWord[],
  text: string,
  imageWidth: number,
  imageHeight: number,
): Bbox | null {
  if (!imageWidth || !imageHeight) return null;
  const tokens = text.split(/\s+/).map(normalize).filter(Boolean);
  if (!tokens.length || !words.length) return null;

  const tokenSet = new Set(tokens);
  const normWords = words.map((word) => ({ word, norm: normalize(word.text) }));
  const windowSize = Math.min(Math.max(tokens.length, 1), normWords.length);

  let best = { score: 0, lo: -1, hi: -1 };
  for (let start = 0; start + windowSize <= normWords.length; start += 1) {
    let score = 0;
    for (let i = start; i < start + windowSize; i += 1) {
      if (normWords[i].norm && tokenSet.has(normWords[i].norm)) score += 1;
    }
    if (score > best.score) best = { score, lo: start, hi: start + windowSize };
  }

  // Require at least a third of the field's tokens within the window so a
  // single coincidental word elsewhere on the label cannot place the box.
  const required = Math.max(1, Math.ceil(tokens.length / 3));
  if (best.score < required) return null;

  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = best.lo; i < best.hi; i += 1) {
    if (!tokenSet.has(normWords[i].norm)) continue;
    const word = normWords[i].word;
    x0 = Math.min(x0, word.x0);
    y0 = Math.min(y0, word.y0);
    x1 = Math.max(x1, word.x1);
    y1 = Math.max(y1, word.y1);
  }
  if (!Number.isFinite(x0) || x1 <= x0 || y1 <= y0) return null;

  return {
    x: x0 / imageWidth,
    y: y0 / imageHeight,
    w: (x1 - x0) / imageWidth,
    h: (y1 - y0) / imageHeight,
  };
}

// Run OCR once and return every word with its pixel box plus the image
// dimensions. This is the expensive step (worker init + recognition), so the
// caller runs it concurrently with the vision request and does the cheap
// per-field matching itself. Returns null on any failure so callers degrade
// gracefully rather than throwing.
export async function recognizeWords(
  bytes: Uint8Array,
): Promise<OcrResult | null> {
  let width = 0;
  let height = 0;
  try {
    const meta = await sharp(bytes).metadata();
    width = meta.width ?? 0;
    height = meta.height ?? 0;
  } catch {
    return null;
  }
  if (!width || !height) return null;

  const worker = await createWorker("eng");
  try {
    const result = await worker.recognize(Buffer.from(bytes), {}, { blocks: true });
    const words = collectWords(result.data as unknown as RawPage);
    return words.length ? { words, width, height } : null;
  } catch {
    return null;
  } finally {
    await worker.terminate();
  }
}
