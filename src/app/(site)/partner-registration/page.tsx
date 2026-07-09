import type { Metadata } from "next";
import PartnerRegistrationClient from "@/components/partner-registration/PartnerRegistrationClient";
import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import ShellHeader from "@/components/ui/ShellHeader";
import { getHeaderSession } from "@/lib/header-session";
import { SITE_NAME } from "@/lib/site";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `신규 파트너사 등록 | ${SITE_NAME}`,
  description:
    "SSARTNERSHIP 신규 파트너사 등록에 필요한 업체 정보를 단계별 등록 또는 파일 업로드로 접수합니다.",
  robots: {
    index: false,
    follow: true,
  },
};

export default async function PartnerRegistrationPage() {
  const [headerSession, categoriesResult] = await Promise.all([
    getHeaderSession(),
    getSupabaseAdminClient()
      .from("categories")
      .select("id,key,label")
      .order("created_at", { ascending: true }),
  ]);
  const categories = categoriesResult.data ?? [];

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader suggestHref="/suggest" initialSession={headerSession} />
      <main>
        <Container className="pb-16 pt-8 sm:pt-10" size="wide">
          <div className="mx-auto grid max-w-6xl min-w-0 gap-5">
            <ShellHeader
              eyebrow="Partner Registration"
              title="신규 파트너사 등록"
              description="브랜드 유형을 선택하고 단계별 등록 또는 파일 업로드로 신규 파트너사 검토를 요청할 수 있습니다."
              className="px-5 py-5 sm:px-6 sm:py-6"
            />

            <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
              <PartnerRegistrationClient categories={categories} />

              <aside className="order-first grid min-w-0 gap-4 xl:sticky xl:top-24 xl:order-none">
                <Card tone="muted" padding="md" className="grid gap-3">
                  <div className="min-w-0">
                    <p className="ui-kicker">Guide</p>
                    <h2 className="mt-1 truncate text-lg font-semibold text-foreground">
                      제출 전 확인
                    </h2>
                  </div>
                  <ul className="grid min-w-0 gap-2 text-sm leading-6 text-muted-foreground">
                    <li className="rounded-[1rem] border border-border/70 bg-surface px-4 py-3">
                      <strong className="block truncate text-foreground">
                        한 브랜드, 여러 지점 가능
                      </strong>
                      <span className="line-clamp-2">
                        공통 정보는 한 번 입력하고 지점 단계에서 여러 지점을 추가합니다.
                      </span>
                    </li>
                    <li className="rounded-[1rem] border border-border/70 bg-surface px-4 py-3">
                      <strong className="block truncate text-foreground">
                        신규 카테고리 가능
                      </strong>
                      <span className="line-clamp-2">
                        목록에 없으면 새 카테고리명을 그대로 입력해 주세요.
                      </span>
                    </li>
                    <li className="rounded-[1rem] border border-border/70 bg-surface px-4 py-3">
                      <strong className="block truncate text-foreground">
                        연락처 분리
                      </strong>
                      <span className="line-clamp-2">
                        브랜드 전화번호와 협력사 담당자 번호를 별도로 입력합니다.
                      </span>
                    </li>
                  </ul>
                </Card>

                <Card tone="elevated" padding="md" className="grid gap-2">
                  <h2 className="truncate text-base font-semibold text-foreground">
                    이후 처리
                  </h2>
                  <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                    제출 내용은 바로 공개되지 않고 관리자 검토 큐에 접수됩니다.
                  </p>
                </Card>
              </aside>
            </div>
          </div>
        </Container>
      </main>
    </div>
  );
}
