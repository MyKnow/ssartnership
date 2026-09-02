import assert from "node:assert/strict";
import test from "node:test";
import {
  getHeifSpatialExtentError,
  getImagePixelError,
} from "../src/lib/image-upload/heif.ts";

function box(type: string, payload = new Uint8Array()) {
  const result = new Uint8Array(8 + payload.length);
  const view = new DataView(result.buffer);
  view.setUint32(0, result.length);
  for (let index = 0; index < type.length; index += 1) {
    result[4 + index] = type.charCodeAt(index);
  }
  result.set(payload, 8);
  return result;
}

function joinBoxes(...boxes: Uint8Array[]) {
  const result = new Uint8Array(boxes.reduce((total, item) => total + item.length, 0));
  let offset = 0;
  for (const item of boxes) {
    result.set(item, offset);
    offset += item.length;
  }
  return result;
}

function spatialExtent(width: number, height: number) {
  const payload = new Uint8Array(12);
  const view = new DataView(payload.buffer);
  view.setUint32(4, width);
  view.setUint32(8, height);
  return box("ispe", payload);
}

function heifWithSpatialExtents(...extents: Uint8Array[]) {
  const ipco = box("ipco", joinBoxes(...extents));
  const iprp = box("iprp", ipco);
  const meta = box("meta", joinBoxes(new Uint8Array(4), iprp));
  return joinBoxes(box("ftyp", new Uint8Array(12)), meta).buffer;
}

test("공통 이미지 픽셀 계약은 안전한 정수와 정책 상한만 허용한다", () => {
  assert.equal(getImagePixelError(5_000, 5_000, 25_000_000), null);
  assert.match(getImagePixelError(5_001, 5_000, 25_000_000) ?? "", /해상도/);
  assert.match(getImagePixelError(0, 5_000, 25_000_000) ?? "", /해상도/);
  assert.match(getImagePixelError(5_000, 5_000, Number.NaN) ?? "", /해상도/);
});

test("공통 HEIC/HEIF parser는 디코드 전에 metadata 해상도를 제한한다", () => {
  assert.equal(
    getHeifSpatialExtentError(
      heifWithSpatialExtents(spatialExtent(5_000, 5_000)),
      25_000_000,
    ),
    null,
  );
  assert.match(
    getHeifSpatialExtentError(
      heifWithSpatialExtents(spatialExtent(5_001, 5_000)),
      25_000_000,
    ) ?? "",
    /해상도/,
  );
  assert.match(
    getHeifSpatialExtentError(
      box("mdat", spatialExtent(100, 100)).buffer,
      25_000_000,
    ) ?? "",
    /해상도를 확인하지 못했습니다/,
  );
});
