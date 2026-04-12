import AdminShell from "@/components/admin/AdminShell";
import AdminStyleGuideTabsDemo from "@/components/admin/AdminStyleGuideTabsDemo";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import DataPanel from "@/components/ui/DataPanel";
import FilterBar from "@/components/ui/FilterBar";
import FormSection from "@/components/ui/FormSection";
import InlineMessage from "@/components/ui/InlineMessage";
import Input from "@/components/ui/Input";
import MotionReveal from "@/components/ui/MotionReveal";
import ResponsiveGrid from "@/components/ui/ResponsiveGrid";
import SectionHeading from "@/components/ui/SectionHeading";
import Select from "@/components/ui/Select";
import ShellHeader from "@/components/ui/ShellHeader";
import StatsRow from "@/components/ui/StatsRow";
import Textarea from "@/components/ui/Textarea";

export const dynamic = "force-dynamic";

export default function AdminStyleGuidePage() {
  return (
    <AdminShell title="UI 스타일 가이드" backHref="/admin" backLabel="관리 홈">
      <div className="ui-page-stack">
        <MotionReveal>
          <ShellHeader
            eyebrow="Design System"
            title="UI 스타일 가이드"
            description="실제 토큰, 프리미티브, 조합 컴포넌트가 light/dark와 반응형에서 어떻게 보이는지 검증하는 내부 페이지입니다."
            actions={
              <>
                <Badge variant="primary">네이비 시스템</Badge>
                <Badge variant="success">motion active</Badge>
              </>
            }
          />
        </MotionReveal>

        <MotionReveal delay={0.03}>
          <Card tone="elevated" padding="lg" className="space-y-6">
            <SectionHeading
              eyebrow="Foundations"
              title="Color · Typography · Elevation"
              description="표면 계층, 상태색, 제목/본문 스케일을 한 화면에서 확인합니다."
            />
            <ResponsiveGrid minItemWidth="14rem">
              <DataPanel label="surface" title="기본 표면" description="카드/필터/폼의 기본 레이어" />
              <DataPanel label="surface-muted" title="보조 표면" description="필터 바, 보조 정보 패널" className="bg-surface-muted/90" />
              <DataPanel label="surface-elevated" title="강조 표면" description="핵심 카드, CTA, 주요 섹션" className="bg-surface-elevated/95 shadow-[var(--shadow-raised)]" />
              <DataPanel
                label="status"
                title={
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="success">성공</Badge>
                    <Badge variant="warning">주의</Badge>
                    <Badge variant="danger">위험</Badge>
                  </div>
                }
                description="상태색은 정보 구분에만 제한적으로 사용합니다."
              />
            </ResponsiveGrid>
          </Card>
        </MotionReveal>

        <MotionReveal delay={0.06}>
          <Card tone="elevated" padding="lg" className="space-y-6">
            <SectionHeading
              eyebrow="Elements"
              title="Core Elements"
              description="버튼, 입력, 탭, 피드백, 상태 표식을 공용 규칙으로 확인합니다."
            />

            <div className="space-y-6">
              <div className="space-y-3">
                <p className="ui-kicker">Buttons</p>
                <div className="flex flex-wrap gap-2">
                  <Button>Primary</Button>
                  <Button variant="soft">Soft</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="danger">Danger</Button>
                </div>
              </div>

              <div className="space-y-3">
                <p className="ui-kicker">Inputs</p>
                <ResponsiveGrid minItemWidth="14rem">
                  <Input placeholder="협력사명" />
                  <Select defaultValue="brand">
                    <option value="brand">브랜드</option>
                    <option value="company">협력사</option>
                  </Select>
                  <Textarea placeholder="혜택이나 운영 메모를 입력합니다." />
                </ResponsiveGrid>
              </div>

              <div className="space-y-3">
                <p className="ui-kicker">Tabs</p>
                <AdminStyleGuideTabsDemo />
              </div>

              <div className="space-y-3">
                <p className="ui-kicker">Inline Messages</p>
                <div className="grid gap-3">
                  <InlineMessage
                    title="즉시 반영"
                    description="링크, 태그, 이미지처럼 승인 없이 반영되는 항목입니다."
                  />
                  <InlineMessage
                    tone="warning"
                    title="승인 대기"
                    description="제출된 변경 요청은 관리자 검토 후 반영됩니다."
                  />
                </div>
              </div>
            </div>
          </Card>
        </MotionReveal>

        <MotionReveal delay={0.09}>
          <Card tone="elevated" padding="lg" className="space-y-6">
            <SectionHeading
              eyebrow="Compositions"
              title="Layout And Composite Components"
              description="페이지에서 직접 조합하게 될 shell, stats, filter, form section 샘플입니다."
            />

            <StatsRow
              items={[
                { label: "연결 협력사", value: "8", hint: "계정이 관리하는 협력사 수" },
                { label: "브랜드 수", value: "24", hint: "연결된 브랜드 총합" },
                { label: "총 클릭", value: "3,128", hint: "지도·예약·문의 클릭 합계" },
              ]}
            />

            <FilterBar
              title="Filter Bar"
              description="검색, 정렬, 상태를 같은 밀도로 배치합니다."
              trailing={<Button variant="ghost">초기화</Button>}
            >
              <div className="grid min-w-[13rem] gap-1">
                <span className="ui-caption">검색</span>
                <Input placeholder="브랜드명, 위치, 태그" />
              </div>
              <div className="grid min-w-[10rem] gap-1">
                <span className="ui-caption">정렬</span>
                <Select defaultValue="recent">
                  <option value="recent">등록순</option>
                  <option value="endingSoon">마감순</option>
                </Select>
              </div>
              <div className="grid min-w-[10rem] gap-1">
                <span className="ui-caption">상태</span>
                <Select defaultValue="all">
                  <option value="all">전체</option>
                  <option value="public">공개</option>
                  <option value="private">비공개</option>
                </Select>
              </div>
            </FilterBar>

            <FormSection
              eyebrow="Form Section"
              title="파트너 변경 요청 예시"
              description="폼은 의미 단위로 분리하고, 한 섹션에 너무 많은 필드를 몰지 않습니다."
            >
              <ResponsiveGrid minItemWidth="14rem">
                <div className="grid gap-1.5">
                  <span className="ui-caption">브랜드명</span>
                  <Input placeholder="브랜드명" />
                </div>
                <div className="grid gap-1.5">
                  <span className="ui-caption">위치</span>
                  <Input placeholder="역삼역 도보 3분" />
                </div>
              </ResponsiveGrid>
            </FormSection>
          </Card>
        </MotionReveal>
      </div>
    </AdminShell>
  );
}
