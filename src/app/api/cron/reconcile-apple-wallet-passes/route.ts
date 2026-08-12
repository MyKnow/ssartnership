import { unstable_noStore as noStore } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { reconcileInstalledAppleWalletPasses } from "@/lib/wallet/wallet-pass-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorizedByCronSecret(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(
    secret && request.headers.get("authorization") === `Bearer ${secret}`,
  );
}

export async function GET(request: NextRequest) {
  noStore();
  if (!isAuthorizedByCronSecret(request)) {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const result = await reconcileInstalledAppleWalletPasses();
    return NextResponse.json(
      { ok: true, ...result },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "Apple Wallet 패스 상태 조정을 완료하지 못했습니다.",
      },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
