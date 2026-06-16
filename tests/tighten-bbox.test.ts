import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { tightenBboxes } from "@/lib/tighten-bbox";

// A white 200x100 canvas with a single black rectangle at x:50..120, y:30..60.
// The tight box around the ink is therefore x=0.25, y=0.30, w=0.35, h=0.30.
async function imageWithBlackRect() {
  const rect = await sharp({
    create: { width: 70, height: 30, channels: 3, background: "#000000" },
  })
    .png()
    .toBuffer();
  const composed = await sharp({
    create: { width: 200, height: 100, channels: 3, background: "#ffffff" },
  })
    .composite([{ input: rect, left: 50, top: 30 }])
    .png()
    .toBuffer();
  return new Uint8Array(composed);
}

describe("tightenBboxes", () => {
  it("shrinks a loose box down to the inked text", async () => {
    const bytes = await imageWithBlackRect();
    const result = await tightenBboxes(bytes, {
      brand_name: { x: 0, y: 0, w: 1, h: 1 },
    });
    const box = result.brand_name;
    expect(box).toBeTruthy();
    expect(box!.x).toBeCloseTo(0.25, 1);
    expect(box!.y).toBeCloseTo(0.3, 1);
    expect(box!.w).toBeCloseTo(0.35, 1);
    expect(box!.h).toBeCloseTo(0.3, 1);
  });

  it("leaves a fully blank region's box unchanged", async () => {
    const blank = new Uint8Array(
      await sharp({
        create: { width: 100, height: 100, channels: 3, background: "#ffffff" },
      })
        .png()
        .toBuffer(),
    );
    const original = { x: 0.1, y: 0.1, w: 0.5, h: 0.5 };
    const result = await tightenBboxes(blank, { brand_name: { ...original } });
    expect(result.brand_name).toEqual(original);
  });

  it("skips null boxes", async () => {
    const bytes = await imageWithBlackRect();
    const result = await tightenBboxes(bytes, { brand_name: null });
    expect(result.brand_name).toBeNull();
  });
});
