import { describe, expect, it } from "vitest";

import { collectWords, matchFieldBox, type OcrWord } from "@/lib/ocr-bbox";

// CALA DEL SOL laid out across a 400x120 image, plus unrelated words elsewhere.
const WORDS: OcrWord[] = [
  { text: "CARIBBEAN", x0: 100, y0: 10, x1: 200, y1: 28 },
  { text: "RUM", x0: 210, y0: 10, x1: 250, y1: 28 },
  { text: "CALA", x0: 22, y0: 36, x1: 131, y1: 70 },
  { text: "DEL", x0: 164, y0: 37, x1: 243, y1: 70 },
  { text: "SOL", x0: 276, y0: 36, x1: 355, y1: 70 },
  { text: "750", x0: 150, y0: 300, x1: 200, y1: 320 },
  { text: "mL", x0: 205, y0: 300, x1: 240, y1: 320 },
];

describe("matchFieldBox", () => {
  it("returns the union box of the matched words as fractions", () => {
    const box = matchFieldBox(WORDS, "Cala del Sol", 400, 120);
    expect(box).toBeTruthy();
    // Union of CALA, DEL, SOL: x0=22, x1=355, y0=36, y1=70.
    expect(box!.x).toBeCloseTo(22 / 400, 4);
    expect(box!.y).toBeCloseTo(36 / 120, 4);
    expect(box!.w).toBeCloseTo((355 - 22) / 400, 4);
    expect(box!.h).toBeCloseTo((70 - 36) / 120, 4);
  });

  it("matches despite punctuation and casing differences", () => {
    const box = matchFieldBox(WORDS, "750 mL", 400, 120);
    expect(box).toBeTruthy();
    expect(box!.x).toBeCloseTo(150 / 400, 4);
    expect(box!.w).toBeCloseTo((240 - 150) / 400, 4);
  });

  it("returns null when the text is not present", () => {
    expect(matchFieldBox(WORDS, "Bourbon Whiskey", 400, 120)).toBeNull();
  });

  it("returns null for empty inputs", () => {
    expect(matchFieldBox([], "Cala", 400, 120)).toBeNull();
    expect(matchFieldBox(WORDS, "   ", 400, 120)).toBeNull();
    expect(matchFieldBox(WORDS, "Cala", 0, 0)).toBeNull();
  });
});

describe("collectWords", () => {
  it("reads words from a blocks -> paragraphs -> lines -> words page", () => {
    const page = {
      blocks: [
        {
          paragraphs: [
            {
              lines: [
                {
                  words: [
                    { text: "CALA", bbox: { x0: 22, y0: 36, x1: 131, y1: 70 } },
                    { text: "DEL", bbox: { x0: 164, y0: 37, x1: 243, y1: 70 } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const words = collectWords(page);
    expect(words.map((w) => w.text)).toEqual(["CALA", "DEL"]);
    expect(words[0]).toMatchObject({ x0: 22, y0: 36, x1: 131, y1: 70 });
  });

  it("skips words with missing or non-numeric boxes", () => {
    const page = {
      blocks: [
        {
          paragraphs: [
            {
              lines: [
                {
                  words: [
                    { text: "OK", bbox: { x0: 1, y0: 2, x1: 3, y1: 4 } },
                    { text: "bad", bbox: { x0: "x", y0: 2, x1: 3, y1: 4 } },
                    { text: "  ", bbox: { x0: 1, y0: 2, x1: 3, y1: 4 } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(collectWords(page).map((w) => w.text)).toEqual(["OK"]);
  });
});
