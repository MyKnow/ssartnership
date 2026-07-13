import { NextResponse } from "next/server";
import {
  getHomePartnerState,
  normalizeHomePartnerStateIds,
} from "@/lib/home-partner-state";
import { getPartnerViewerContext } from "@/lib/partner-view-context";
import { partnerRepository } from "@/lib/repositories";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { getSignedUserSession } from "@/lib/user-auth";

export const runtime = "nodejs";

function parseRequestedPartnerIds(request: Request) {
  const url = new URL(request.url);
  return normalizeHomePartnerStateIds([
    ...url.searchParams.getAll("id"),
    ...url.searchParams
      .getAll("ids")
      .flatMap((value) => value.split(",").map((item) => item.trim())),
  ]);
}

export async function GET(request: Request) {
  if (!isTrustedSameOriginRequest(request)) {
    return NextResponse.json(
      { message: "잘못된 요청입니다." },
      { status: 403 },
    );
  }

  const requestedIds = parseRequestedPartnerIds(request);
  if (requestedIds.length === 0) {
    return NextResponse.json({
      loadedPartnerIds: [],
      partnerFavoriteStateById: {},
      partnerPopularityById: {},
    });
  }

  const session = await getSignedUserSession().catch(() => null);
  const viewerContext = await getPartnerViewerContext(session?.userId);
  const allowedPartners = await partnerRepository.getPartners({
    authenticated: viewerContext.authenticated,
    viewerAudience: viewerContext.viewerAudience,
  });
  const allowedIds = new Set(allowedPartners.map((partner) => partner.id));
  const partnerIds = requestedIds.filter((partnerId) =>
    allowedIds.has(partnerId),
  );

  const state = await getHomePartnerState({
    partnerIds,
    currentUserId: session?.userId ?? null,
  });

  return NextResponse.json(state);
}
