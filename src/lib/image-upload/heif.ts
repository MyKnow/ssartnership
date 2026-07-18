type HeifBoxScope = "root" | "meta" | "iprp" | "ipco";

type HeifBox = {
  end: number;
  payloadStart: number;
  type: string;
};

const MAX_HEIF_BOXES = 2_048;
const MAX_HEIF_BOX_DEPTH = 8;
const INVALID_HEIF_ERROR = "HEIC/HEIF 이미지의 해상도를 확인하지 못했습니다.";

function getHeifBox(view: DataView, offset: number, parentEnd: number): HeifBox | null {
  if (offset + 8 > parentEnd) return null;
  const size32 = view.getUint32(offset);
  const type = String.fromCharCode(
    view.getUint8(offset + 4),
    view.getUint8(offset + 5),
    view.getUint8(offset + 6),
    view.getUint8(offset + 7),
  );
  let payloadStart = offset + 8;
  let size = size32;

  if (size32 === 1) {
    if (offset + 16 > parentEnd) return null;
    size = view.getUint32(offset + 8) * 4_294_967_296 + view.getUint32(offset + 12);
    payloadStart = offset + 16;
  } else if (size32 === 0) {
    size = parentEnd - offset;
  }
  if (!Number.isSafeInteger(size) || size < payloadStart - offset || offset + size > parentEnd) {
    return null;
  }
  return { end: offset + size, payloadStart, type };
}

/**
 * Reads only the HEIF metadata property path before a WASM decoder allocates
 * pixel memory. The parser intentionally rejects malformed/ambiguous files.
 */
export function getHeifSpatialExtentError(source: ArrayBuffer, maxPixels: number) {
  const view = new DataView(source);
  let boxCount = 0;
  let foundSpatialExtent = false;

  const inspectBoxes = (
    offset: number,
    end: number,
    depth: number,
    scope: HeifBoxScope,
  ): string | null => {
    if (depth > MAX_HEIF_BOX_DEPTH) return INVALID_HEIF_ERROR;
    let cursor = offset;
    while (cursor < end) {
      boxCount += 1;
      if (boxCount > MAX_HEIF_BOXES) return INVALID_HEIF_ERROR;
      const box = getHeifBox(view, cursor, end);
      if (!box) return INVALID_HEIF_ERROR;

      if (scope === "ipco" && box.type === "ispe") {
        if (box.payloadStart + 12 > box.end) return INVALID_HEIF_ERROR;
        foundSpatialExtent = true;
        const width = view.getUint32(box.payloadStart + 4);
        const height = view.getUint32(box.payloadStart + 8);
        if (
          !Number.isSafeInteger(width)
          || !Number.isSafeInteger(height)
          || width <= 0
          || height <= 0
          || width * height > maxPixels
        ) {
          return "이미지 해상도가 너무 큽니다.";
        }
      } else if (scope === "root" && box.type === "meta") {
        if (box.payloadStart + 4 > box.end) return INVALID_HEIF_ERROR;
        const error = inspectBoxes(box.payloadStart + 4, box.end, depth + 1, "meta");
        if (error) return error;
      } else if (scope === "meta" && box.type === "iprp") {
        const error = inspectBoxes(box.payloadStart, box.end, depth + 1, "iprp");
        if (error) return error;
      } else if (scope === "iprp" && box.type === "ipco") {
        const error = inspectBoxes(box.payloadStart, box.end, depth + 1, "ipco");
        if (error) return error;
      }
      cursor = box.end;
    }
    return cursor === end ? null : INVALID_HEIF_ERROR;
  };

  const error = inspectBoxes(0, view.byteLength, 0, "root");
  return error ?? (foundSpatialExtent ? null : INVALID_HEIF_ERROR);
}
