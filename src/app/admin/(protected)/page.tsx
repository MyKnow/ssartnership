import ThemeToggle from "@/components/ThemeToggle";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  createCategory,
  createPartner,
  deleteCategory,
  deletePartner,
  logout,
  updateCategory,
  updatePartner,
} from "@/app/admin/(protected)/actions";

export default async function AdminPage() {
  const hasSupabaseEnv =
    !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!hasSupabaseEnv) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 dark:bg-slate-950">
        <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
            Supabase 설정이 필요합니다.
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 환경 변수를 설정한 뒤
            다시 접속해 주세요.
          </p>
        </div>
      </div>
    );
  }

  const supabase = getSupabaseServerClient();

  const { data: categories } = await supabase
    .from("categories")
    .select("id,key,label,description")
    .order("created_at", { ascending: true });

  const { data: partners } = await supabase
    .from("partners")
    .select(
      "id,name,location,map_url,contact,period_start,period_end,benefits,tags,categories(id,key,label)"
    )
    .order("created_at", { ascending: false });

  const safeCategories = categories ?? [];
  const safePartners = partners ?? [];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              SSAFY 15기 운영
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
              Admin 제휴 관리
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <form action={logout}>
              <button
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:text-slate-200"
                type="submit"
              >
                로그아웃
              </button>
            </form>
            <a
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:text-slate-200"
              href="/"
            >
              사용자 화면
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 pb-16 pt-10">
        <section className="grid gap-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              카테고리 관리
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              카테고리 키는 소문자 영문/숫자 조합을 권장합니다.
            </p>

            <form
              className="mt-6 grid gap-4 lg:grid-cols-[160px_200px_1fr_auto]"
              action={createCategory}
            >
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                name="key"
                placeholder="category-key"
                required
              />
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                name="label"
                placeholder="라벨"
                required
              />
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                name="description"
                placeholder="설명"
              />
              <button
                className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                type="submit"
              >
                추가
              </button>
            </form>

            <div className="mt-6 grid gap-3">
              {safeCategories.map((category) => (
                <div
                  key={category.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"
                >
                  <form
                    className="grid gap-3 lg:grid-cols-[160px_200px_1fr_auto]"
                    action={updateCategory}
                  >
                    <input type="hidden" name="id" value={category.id} />
                    <input
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                      name="key"
                      defaultValue={category.key}
                    />
                    <input
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                      name="label"
                      defaultValue={category.label}
                    />
                    <input
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                      name="description"
                      defaultValue={category.description ?? ""}
                    />
                    <button
                      className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                      type="submit"
                    >
                      수정
                    </button>
                  </form>
                  <form className="mt-2" action={deleteCategory}>
                    <input type="hidden" name="id" value={category.id} />
                    <button
                      className="rounded-2xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 dark:border-rose-500/40 dark:text-rose-300"
                      type="submit"
                    >
                      삭제
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              제휴 업체 관리
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              혜택/태그는 콤마(,)로 구분해 입력합니다.
            </p>

            <form
              className="mt-6 grid gap-4 lg:grid-cols-3"
              action={createPartner}
            >
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                name="name"
                placeholder="업체명"
                required
              />
              <select
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                name="categoryId"
                required
              >
                {safeCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                name="location"
                placeholder="위치"
                required
              />
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                name="mapUrl"
                placeholder="지도 URL"
              />
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                name="contact"
                placeholder="연락처"
                required
              />
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                name="periodStart"
                placeholder="시작일"
              />
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                name="periodEnd"
                placeholder="종료일"
              />
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                name="benefits"
                placeholder="혜택 목록"
              />
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                name="tags"
                placeholder="태그"
              />
              <button
                className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                type="submit"
              >
                제휴 추가
              </button>
            </form>

            <div className="mt-6 grid gap-4">
              {safePartners.map((partner) => (
                <div
                  key={partner.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"
                >
                  <form className="grid gap-3 lg:grid-cols-3" action={updatePartner}>
                    <input type="hidden" name="id" value={partner.id} />
                    <input
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                      name="name"
                      defaultValue={partner.name}
                      required
                    />
                    <select
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                      name="categoryId"
                      defaultValue={partner.categories?.id}
                      required
                    >
                      {safeCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                    <input
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                      name="location"
                      defaultValue={partner.location}
                      required
                    />
                    <input
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                      name="mapUrl"
                      defaultValue={partner.map_url ?? ""}
                    />
                    <input
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                      name="contact"
                      defaultValue={partner.contact}
                      required
                    />
                    <input
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                      name="periodStart"
                      defaultValue={partner.period_start ?? ""}
                    />
                    <input
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                      name="periodEnd"
                      defaultValue={partner.period_end ?? ""}
                    />
                    <input
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                      name="benefits"
                      defaultValue={(partner.benefits ?? []).join(", ")}
                    />
                    <input
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                      name="tags"
                      defaultValue={(partner.tags ?? []).join(", ")}
                    />
                    <button
                      className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                      type="submit"
                    >
                      수정
                    </button>
                  </form>
                  <form className="mt-2" action={deletePartner}>
                    <input type="hidden" name="id" value={partner.id} />
                    <button
                      className="rounded-2xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 dark:border-rose-500/40 dark:text-rose-300"
                      type="submit"
                    >
                      삭제
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
