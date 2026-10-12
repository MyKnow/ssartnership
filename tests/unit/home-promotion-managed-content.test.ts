import { afterEach, expect, test, vi } from "vitest";
import { getHomePromotionSlides, listManagedPromotionSlides } from "../../src/lib/promotions/events";

const { from, getEvent } = vi.hoisted(() => ({ from: vi.fn(), getEvent: vi.fn() }));
vi.mock("../../src/lib/supabase/server", () => ({ getSupabaseAdminClient: () => ({ from }) }));
vi.mock("../../src/lib/project-showcase", () => ({ projectShowcaseRepository: { getEvent } }));
vi.mock("next/cache", () => ({ unstable_cache: (callback: unknown) => callback }));

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

test("홈 조회는 종료 이벤트에서도 관리자 조회와 동일한 저장 내용을 반환한다", async () => {
  vi.stubEnv("SUPABASE_URL", "https://database.example.com");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "synthetic-offline-only");
  getEvent.mockResolvedValue({ isActive: false, experienceEndAt: "2000-01-01", announcementStartAt: "2000-01-02" });
  const saved = {
    id: "managed-showcase", display_order: 2, title: "관리자 제목", subtitle: "관리자 설명",
    image_src: "https://cdn.example.com/first.webp", image_alt: "관리자 대체 텍스트",
    href: "/events/project-showcase", is_active: true, audiences: ["guest"], allowed_campuses: [],
    event_slug: "project-showcase", ad_campaign_id: null, sponsor_label: "", created_at: null, updated_at: null,
  };
  from.mockImplementation((table: string) => {
    const query = {
      select: () => query, order: () => query, eq: () => query,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({
        data: table === "promotion_slides" ? [{ ...saved }] : [], error: null,
      }).then(resolve),
    };
    return query;
  });
  for (const imageSrc of ["https://cdn.example.com/first.webp", "https://cdn.example.com/replacement.webp"]) {
    saved.image_src = imageSrc;
    const [managed] = await listManagedPromotionSlides({ includeInactive: true });
    const [home] = await getHomePromotionSlides();
    expect(managed.source).toBe("database");
    expect(home).toMatchObject({
      id: managed.id, title: managed.title, description: managed.subtitle,
      imageSrc: managed.imageSrc, imageAlt: managed.imageAlt, href: managed.href,
    });
    expect(home.imageSrc).toBe(imageSrc);
  }
});
