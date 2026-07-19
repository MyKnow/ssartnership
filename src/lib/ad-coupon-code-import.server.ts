import ExcelJS from "exceljs";
import { normalizeCouponCodeRows } from "@/lib/ad-coupon-domain";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_CODES = 20_000;

export async function parseCouponCodeWorkbook(file: File) {
  if (!file || file.size === 0) return [];
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("쿠폰 코드 파일은 5MB 이하만 업로드할 수 있습니다.");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await file.arrayBuffer()) as never);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const values: unknown[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) values.push(row.getCell(1).value?.toString() ?? "");
  });
  if (values.length > MAX_CODES) throw new Error("쿠폰 코드는 한 번에 20,000개까지 업로드할 수 있습니다.");
  return normalizeCouponCodeRows(values).codes;
}
