import sharp from "sharp";

import { FIELD_NAMES, type Bbox, type Bboxes } from "@/lib/types";

// Deterministically shrink each model bounding box to the inked text it
// surrounds by trimming uniform-colour margins (e.g. trailing whitespace or
// blank area that runs to the line edge). The VLM still *locates* the field;
// only the box edges are recomputed here, so the geometry no longer depends on
// the model's spatial precision.
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
    const removedTop = Math.abs(info.trimOffsetTop ?? 0);
    if (!info.width || !info.height) return box;

    return {
      x: (left + removedLeft) / width,
      y: (top + removedTop) / height,
      w: info.width / width,
      h: info.height / height,
    };
  } catch {
    // A fully uniform region (nothing to trim) or any sharp error throws here;
    // keep the model's original box in that case.
    return box;
  }
}
