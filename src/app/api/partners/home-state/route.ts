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

function parseRequestedState(request: Request) {
  const url = new URL(request.url);
  const includeFavorites = url.searchParams.get("includeFavorites");
  const includePopularity = url.searchParams.get("includePopularity");

  return {
    includeFavorites: includeFavorites !== "0" && includeFavorites !== "false",
    includePopularity: includePopularity !== "0" && includePopularity !== "false",
  };
}

export async function GET(request: Request) {
  if (!isTrustedSameOriginRequest(request)) {
    return NextResponse.json(
      { message: "잘못된 요청입니다." },
      { status: 403 },
    );
  }

  const requestedIds = parseRequestedPartnerIds(request);
  const requestedState = parseRequestedState(request);
  if (requestedIds.length === 0) {
    return NextResponse.json({
      loadedFavoritePartnerIds: [],
      partnerFavoriteStateById: {},
      partnerPopularityById: {},
    });
  }

  const session = await getSignedUserSession().catch(() => null);
  const viewerContext = await getPartnerViewerContext(session?.userId);
  const partnerIds = await partnerRepository.getHomeStateAuthorizedPartnerIds(
    requestedIds,
    {
      authenticated: viewerContext.authenticated,
      viewerAudience: viewerContext.viewerAudience,
    },
  );

  const state = await getHomePartnerState({
    partnerIds,
    currentUserId: session?.userId ?? null,
    includeFavorites: requestedState.includeFavorites,
    includePopularity: requestedState.includePopularity,
  });

  return NextResponse.json(state);
}
