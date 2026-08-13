import { NextResponse } from "next/server";
import { resetMockPartnerChangeRequestStore } from "@/lib/mock/partner-change-requests";
import { resetMockPartnerPortalStore } from "@/lib/mock/partner-portal";
import { isE2eMockMutationEnabled } from "@/lib/e2e-mutation-mode";

export const runtime = "nodejs";

export async function POST() {
  if (!isE2eMockMutationEnabled()) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  resetMockPartnerPortalStore();
  resetMockPartnerChangeRequestStore();

  return NextResponse.json({ ok: true });
}
