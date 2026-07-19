import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/admin-access";

export const runtime = "nodejs";

export async function GET() {
  await requireAdminPermission("home_ads", "update", { path: "/admin/advertisement" });
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("쿠폰 코드");
  sheet.addRow(["쿠폰 코드"]);
  sheet.addRow(["PARTNER-CODE-001"]);
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1428A0" } };
  sheet.columns = [{ width: 32 }];
  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="coupon-code-template.xlsx"',
    },
  });
}
