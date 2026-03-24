import ThemeToggle from "@/components/ThemeToggle";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
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
import Button from "@/components/ui/Button";
import SubmitButton from "@/components/ui/SubmitButton";
import Container from "@/components/ui/Container";
import { SITE_NAME } from "@/lib/site";
import EmptyState from "@/components/ui/EmptyState";
import { ADMIN_COPY } from "@/lib/content";
import AdminPartnerManager from "@/components/admin/AdminPartnerManager";

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

  const supabase = getSupabaseAdminClient();

  const { data: categories } = await supabase
    .from("categories")
    .select("id,key,label,description,color")
    .order("created_at", { ascending: true });

  const { data: partners } = await supabase
    .from("partners")
    .select("id,name,category_id,location,map_url,reservation_link,inquiry_link,period_start,period_end,benefits,conditions,images,tags")
    .order("created_at", { ascending: false });

  const safeCategories = categories ?? [];
  const safePartners = partners ?? [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface/90 backdrop-blur">
        <Container className="flex items-center justify-between gap-4 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {SITE_NAME}
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
        </Container>
      </header>

      <main>
        <Container className="pb-16 pt-10">
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
              {safeCategories.length === 0 ? (
                <EmptyState
                  title={ADMIN_COPY.emptyCategoryTitle}
                  description={ADMIN_COPY.emptyCategoryDescription}
                />
              ) : (
                safeCategories.map((category) => (
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
                ))
              )}
            </div>
          </Card>

          <Card>
            <SectionHeading
              title="제휴 업체 관리"
              description="혜택/태그는 콤마(,)로 구분해 입력합니다."
            />
            <AdminPartnerManager
              categories={safeCategories}
              partners={safePartners}
              createPartner={createPartner}
              updatePartner={updatePartner}
              deletePartner={deletePartner}
            />
          </Card>
        </section>
        </Container>
      </main>
    </div>
  );
}
