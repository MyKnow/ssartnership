import assert from "node:assert/strict";
import * as nodeModule from "node:module";
import test from "node:test";

/**
 * `promotion_slides.ad_campaign_id` and `sponsor_label` ship with
 * 20260701183014, so the slide loader reads them in its only query. A query
 * error is surfaced once (logged for the public carousel, thrown for editing)
 * instead of being retried without the ad columns.
 */

type ResolveResult = { shortCircuit?: boolean; url: string };
type NextResolve = (specifier: string, context: unknown) => ResolveResult;

const { registerHooks } = nodeModule as unknown as {
  registerHooks(hooks: {
    resolve: (
      specifier: string,
      context: unknown,
      nextResolve: NextResolve,
    ) => ResolveResult;
  }): void;
};

const mockModules = new Map<string, string>([
  [
    "@/lib/supabase/server",
    `export function getSupabaseAdminClient() {
      return globalThis.__promotionSlideSchemaSupabase;
    }`,
  ],
  // unstable_cache needs the Next incremental cache; run the loader directly.
  [
    "next/cache",
    `export function unstable_cache(callback) {
      return (...args) => callback(...args);
    }`,
  ],
]);

registerHooks({
  resolve(specifier, context, nextResolve) {
    const source = mockModules.get(specifier);
    if (source !== undefined) {
      return {
        shortCircuit: true,
        url: `data:text/javascript,${encodeURIComponent(source)}`,
      };
    }
    return nextResolve(specifier, context);
  },
});

process.env.SUPABASE_URL ??= "https://supabase.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";

type SlideQueryCall = { table: string; columns: string | null };

function installSupabase(result: {
  data?: unknown;
  error?: { message: string; code?: string } | null;
}) {
  const calls: SlideQueryCall[] = [];
  (globalThis as Record<string, unknown>).__promotionSlideSchemaSupabase = {
    from(table: string) {
      const call: SlideQueryCall = { table, columns: null };
      const builder = {
        select(columns: string) {
          call.columns = columns;
          calls.push(call);
          return builder;
        },
        order() {
          return builder;
        },
        eq() {
          return builder;
        },
        then<TResult>(
          onfulfilled: (value: { data: unknown; error: unknown }) => TResult,
        ) {
          return Promise.resolve({
            data: result.data ?? null,
            error: result.error ?? null,
          }).then(onfulfilled);
        },
      };
      return builder;
    },
  };
  return calls;
}

async function withMutedConsoleError<T>(run: () => Promise<T>) {
  const messages: unknown[][] = [];
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    messages.push(args);
  };
  try {
    return { result: await run(), messages };
  } finally {
    console.error = originalConsoleError;
  }
}

const missingAdColumnError = {
  message: "column promotion_slides.ad_campaign_id does not exist",
  code: "42703",
};

const eventsModulePromise = import("../src/lib/promotions/events.ts");

test("공개 슬라이드는 광고 컬럼 오류를 광고 컬럼 없는 조회로 재시도하지 않고 로그 후 기본 슬라이드를 쓴다", async () => {
  const { listManagedPromotionSlides } = await eventsModulePromise;
  const calls = installSupabase({ error: missingAdColumnError });

  const { result: slides, messages } = await withMutedConsoleError(() =>
    listManagedPromotionSlides(),
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].table, "promotion_slides");
  assert.match(calls[0].columns ?? "", /,ad_campaign_id,sponsor_label,/);
  assert.ok(slides.every((slide) => slide.source === "catalog"));
  // Matches both a plain label argument and a structured JSON log line.
  assert.ok(
    messages.some((args) =>
      args.some(
        (arg) =>
          typeof arg === "string" &&
          arg.includes("[promotions] promotion_slides query failed"),
      ),
    ),
  );
});

test("슬라이드 편집 목록은 같은 오류를 기본 슬라이드로 덮지 않고 실패한다", async () => {
  const { listEditablePromotionSlides } = await eventsModulePromise;
  const calls = installSupabase({ error: missingAdColumnError });

  await assert.rejects(
    withMutedConsoleError(() => listEditablePromotionSlides()),
    /promotion_slide_database_unavailable/,
  );
  assert.equal(calls.length, 1);
});

test("슬라이드는 광고 컬럼을 포함한 한 번의 조회로 행을 매핑한다", async () => {
  const { listEditablePromotionSlides } = await eventsModulePromise;
  const calls = installSupabase({
    data: [
      {
        id: "slide-1",
        display_order: 1,
        title: "후원 슬라이드",
        subtitle: "",
        image_src: "/images/slide.webp",
        image_alt: "슬라이드",
        href: "/events/sample",
        is_active: true,
        audiences: ["student"],
        allowed_campuses: [],
        event_slug: null,
        ad_campaign_id: "campaign-1",
        sponsor_label: "제휴 광고",
        created_at: "2026-10-01T00:00:00.000Z",
        updated_at: "2026-10-01T00:00:00.000Z",
      },
    ],
  });

  const slides = await listEditablePromotionSlides();

  assert.equal(calls.length, 1);
  assert.equal(slides.length, 1);
  assert.equal(slides[0].source, "database");
  assert.equal(slides[0].adCampaignId, "campaign-1");
  assert.equal(slides[0].sponsorLabel, "제휴 광고");
});
