import sharp from "sharp";

import { FIELD_NAMES, type Bbox, type Bboxes } from "@/lib/types";

// Deterministically tighten the *width* of each model bounding box by trimming
// uniform-colour left/right margins (e.g. trailing whitespace or blank area
// that runs to the line edge). The VLM still locates the field and sets its
// vertical position and height; we only recompute the horizontal edges.
//
// Why horizontal-only: trimming vertically too would snap the box onto a
// neighbouring line's ink whenever the model's loose box brushed it, moving the
// box off its own text. Keeping the model's y/h preserves the correct line.
//
// Caveat: trimming keys off the box's corner colour as the background, so it
// works best on text with reasonable contrast against a roughly uniform
// margin. On low-contrast or textured backgrounds it simply trims less and
// falls back to the model's original box rather than producing a worse one.
export async function tightenBboxes(
  bytes: Uint8Array,
  bboxes: Bboxes,
): Promise<Bboxes> {
  let width = 0;
  let height = 0;
  try {
    const meta = await sharp(bytes).metadata();
    width = meta.width ?? 0;
    height = meta.height ?? 0;
  } catch {
    return bboxes;
  }
  if (!width || !height) return bboxes;

  const tightened: Bboxes = { ...bboxes };
  for (const field of FIELD_NAMES) {
    const box = bboxes[field];
    if (!box) continue;
    tightened[field] = await tightenOne(bytes, box, width, height);
  }
  return tightened;
}

async function tightenOne(
  bytes: Uint8Array,
  box: Bbox,
  width: number,
  height: number,
): Promise<Bbox> {
  const left = Math.min(width - 1, Math.max(0, Math.round(box.x * width)));
  const top = Math.min(height - 1, Math.max(0, Math.round(box.y * height)));
  const regionW = Math.min(width - left, Math.round(box.w * width));
  const regionH = Math.min(height - top, Math.round(box.h * height));
  if (regionW < 4 || regionH < 4) return box;

  try {
    // Extract and trim must be separate pipelines — chaining them in one
    // sharp call reorders the operations and throws "bad extract area".
    const region = await sharp(bytes)
      .extract({ left, top, width: regionW, height: regionH })
      .toBuffer();
    const { info } = await sharp(region)
      .trim({ threshold: 12 })
      .toBuffer({ resolveWithObject: true });

    const removedLeft = Math.abs(info.trimOffsetLeft ?? 0);
    if (!info.width || !info.height) return box;

    // Horizontal-only: keep the model's vertical position and height (already
    // on the correct line) and recompute just the left/right edges. Trimming
    // vertically too would snap the box onto a neighbouring line's ink when the
    // model's box brushed it, moving the box off its text.
    return {
      x: (left + removedLeft) / width,
      y: box.y,
      w: info.width / width,
      h: box.h,
    };
  } catch {
    // A fully uniform region (nothing to trim) or any sharp error throws here;
    // keep the model's original box in that case.
    return box;
  }
}
