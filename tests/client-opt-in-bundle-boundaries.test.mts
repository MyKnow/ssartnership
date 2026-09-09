import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("관리자 사진 ZIP 파서는 파일을 선택한 뒤에만 로드한다", async () => {
  const source = await readSource("src/components/admin/AdminMemberManualAddPanel.tsx");

  assert.doesNotMatch(source, /^import JSZip from ["']jszip["'];$/m);
  assert.match(source, /const \{ default: JSZip \} = await import\(["']jszip["']\);/);
});

test("인증 QR 생성기는 QR URL을 받은 뒤에만 로드한다", async () => {
  const source = await readSource("src/components/certification/CertificationQrButton.tsx");

  assert.doesNotMatch(source, /^import QRCode from ["']qrcode["'];$/m);
  assert.match(source, /const \{ default: QRCode \} = await import\(["']qrcode["']\);/);
});

test("이미지 크롭 UI는 편집 대화상자가 열릴 때 별도 청크로 로드한다", async () => {
  const source = await readSource("src/components/media/ImageCropDialog.tsx");

  assert.match(source, /import dynamic from ["']next\/dynamic["'];/);
  assert.match(source, /import type \{ Area \} from ["']react-easy-crop["'];/);
  assert.match(
    source,
    /const Cropper = dynamic\(\(\) => import\(["']react-easy-crop["']\), \{ ssr: false \}\);/,
  );
  assert.doesNotMatch(source, /^import Cropper(?:,| from)/m);
});

test("사용하지 않는 차트 라이브러리를 런타임 직접 의존성으로 유지하지 않는다", async () => {
  const packageJson = JSON.parse(await readSource("package.json")) as {
    dependencies?: Record<string, string>;
  };

  assert.equal(packageJson.dependencies?.recharts, undefined);
});
