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
import Card from "@/components/ui/Card";
import SectionHeading from "@/components/ui/SectionHeading";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import SubmitButton from "@/components/ui/SubmitButton";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const hasSupabaseEnv =
    !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!hasSupabaseEnv) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <Card className="w-full max-w-xl text-center">
          <h1 className="text-xl font-semibold text-foreground">
            Supabase 설정이 필요합니다.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 환경 변수를 설정한 뒤
            다시 접속해 주세요.
          </p>
        </Card>
      </div>
    );
  }

  const supabase = getSupabaseServerClient();

  const { data: categories } = await supabase
    .from("categories")
    .select("id,key,label,description,color")
    .order("created_at", { ascending: true });

  const { data: partners } = await supabase
    .from("partners")
    .select("id,name,category_id,location,map_url,contact,period_start,period_end,benefits,tags")
    .order("created_at", { ascending: false });

  const safeCategories = categories ?? [];
  const safePartners = partners ?? [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              SSAFY 15기 운영
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">
              Admin 제휴 관리
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <form action={logout}><SubmitButton variant="ghost" pendingText="로그아웃 중">로그아웃</SubmitButton></form>
            <Button variant="ghost" href="/">
              사용자 화면
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 pb-16 pt-10">
        <section className="grid gap-6">
          <Card>
            <SectionHeading
              title="카테고리 관리"
              description="카테고리 키는 소문자 영문/숫자 조합을 권장합니다."
            />

            <form
              className="mt-6 grid gap-4 lg:grid-cols-[160px_200px_1fr_120px_auto]"
              action={createCategory}
            >
              <Input name="key" placeholder="category-key" required />
              <Input name="label" placeholder="라벨" required />
              <Input name="description" placeholder="설명" />
              <input
                type="color"
                name="color"
                defaultValue="#0f172a"
                className="h-10 w-full cursor-pointer rounded-2xl border border-border bg-surface p-1"
                title="카테고리 색상"
              />
              <SubmitButton pendingText="추가 중">추가</SubmitButton>
            </form>

            <div className="mt-6 grid gap-3">
              {safeCategories.map((category) => (
                <div
                  key={category.id}
                  className="rounded-2xl border border-border bg-surface-muted p-4"
                >
                  <form
                    className="grid gap-3 lg:grid-cols-[160px_200px_1fr_120px_auto]"
                    action={updateCategory}
                  >
                    <input type="hidden" name="id" value={category.id} />
                    <Input name="key" defaultValue={category.key} />
                    <Input name="label" defaultValue={category.label} />
                    <Input
                      name="description"
                      defaultValue={category.description ?? ""}
                    />
                    <input
                      type="color"
                      name="color"
                      defaultValue={category.color ?? "#0f172a"}
                      className="h-10 w-full cursor-pointer rounded-2xl border border-border bg-surface p-1"
                      title="카테고리 색상"
                    />
                    <SubmitButton variant="ghost" pendingText="수정 중">
                      수정
                    </SubmitButton>
                  </form>
                  <form className="mt-2" action={deleteCategory}>
                    <input type="hidden" name="id" value={category.id} />
                    <SubmitButton variant="danger" pendingText="삭제 중">
                      삭제
                    </SubmitButton>
                  </form>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionHeading
              title="제휴 업체 관리"
              description="혜택/태그는 콤마(,)로 구분해 입력합니다."
            />

            <form className="mt-6 grid gap-4 lg:grid-cols-3" action={createPartner}>
              <Input name="name" placeholder="업체명" required />
              <Select name="categoryId" required>
                {safeCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </Select>
              <Input name="location" placeholder="위치" required />
              <Input name="mapUrl" placeholder="지도 URL" />
              <Input name="contact" placeholder="연락처" required />
              <Input name="periodStart" placeholder="시작일" />
              <Input name="periodEnd" placeholder="종료일" />
              <Input name="benefits" placeholder="혜택 목록" />
              <Input name="tags" placeholder="태그" />
              <SubmitButton pendingText="등록 중">제휴 추가</SubmitButton>
            </form>

            <div className="mt-6 grid gap-4">
              {safePartners.map((partner) => (
                <div
                  key={partner.id}
                  className="rounded-2xl border border-border bg-surface-muted p-4"
                >
                  <form className="grid gap-3 lg:grid-cols-3" action={updatePartner}>
                    <input type="hidden" name="id" value={partner.id} />
                    <Input name="name" defaultValue={partner.name} required />
                    <Select name="categoryId" defaultValue={partner.category_id} required>
                      {safeCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.label}
                        </option>
                      ))}
                    </Select>
                    <Input
                      name="location"
                      defaultValue={partner.location}
                      required
                    />
                    <Input
                      name="mapUrl"
                      defaultValue={partner.map_url ?? ""}
                    />
                    <Input
                      name="contact"
                      defaultValue={partner.contact}
                      required
                    />
                    <Input
                      name="periodStart"
                      defaultValue={partner.period_start ?? ""}
                    />
                    <Input
                      name="periodEnd"
                      defaultValue={partner.period_end ?? ""}
                    />
                    <Input
                      name="benefits"
                      defaultValue={(partner.benefits ?? []).join(", ")}
                    />
                    <Input
                      name="tags"
                      defaultValue={(partner.tags ?? []).join(", ")}
                    />
                    <SubmitButton variant="ghost" pendingText="수정 중">
                      수정
                    </SubmitButton>
                  </form>
                  <form className="mt-2" action={deletePartner}>
                    <input type="hidden" name="id" value={partner.id} />
                    <SubmitButton variant="danger" pendingText="삭제 중">
                      삭제
                    </SubmitButton>
                  </form>
                </div>
              ))}
            </div>
          </Card>
        </section>
      </main>
    </div>
  );
}
