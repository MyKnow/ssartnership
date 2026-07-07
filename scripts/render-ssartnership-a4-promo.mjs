import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "playwright";
import QRCode from "qrcode";
import sharp from "sharp";

const root = process.cwd();
const outputDir = path.join(root, "output/pdf");
const htmlPath = path.join(outputDir, "ssartnership-a4-promo.html");
const qrPath = path.join(outputDir, "ssartnership-a4-promo-qr.svg");
const pdfPath = path.join(outputDir, "ssartnership-a4-promo.pdf");
const popplerPrefix = path.join(outputDir, "ssartnership-a4-promo");
const popplerPngPath = path.join(outputDir, "ssartnership-a4-promo-1.png");
const finalPngPath = path.join(outputDir, "ssartnership-a4-promo.png");
const exactPngPath = path.join(outputDir, "ssartnership-a4-promo.exact.png");
const qrTargetUrl = "https://ssartnership.myknow.xyz";

async function renderQr() {
  const svg = await QRCode.toString(qrTargetUrl, {
    type: "svg",
    margin: 4,
    width: 620,
    color: {
      dark: "#061629",
      light: "#ffffff",
    },
    errorCorrectionLevel: "M",
  });

  await writeFile(qrPath, svg);
}

async function renderPdf() {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 1800 },
      deviceScaleFactor: 1,
    });

    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle" });
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    await page.emulateMedia({ media: "print" });
    await page.pdf({
      path: pdfPath,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
  } finally {
    await browser.close();
  }
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function renderPng() {
  if (existsSync(popplerPngPath)) {
    await unlink(popplerPngPath);
  }

  await run("pdftoppm", ["-r", "300", "-png", pdfPath, popplerPrefix]);
  await rename(popplerPngPath, finalPngPath);

  await sharp(finalPngPath)
    .resize(2480, 3508, { fit: "fill" })
    .withMetadata({ density: 300 })
    .toFile(exactPngPath);

  await rename(exactPngPath, finalPngPath);
}

await renderQr();
await renderPdf();
await renderPng();

console.log(`Rendered ${pdfPath}`);
console.log(`Rendered ${finalPngPath}`);
