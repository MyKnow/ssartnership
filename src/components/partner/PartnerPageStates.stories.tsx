import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ReactNode } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import FormMessage from "@/components/ui/FormMessage";
import SectionHeading from "@/components/ui/SectionHeading";
import ShellHeader from "@/components/ui/ShellHeader";
import StatsRow from "@/components/ui/StatsRow";
import { ToastProvider } from "@/components/ui/Toast";
import PartnerNotificationCenter from "@/components/partner/partner-notifications/PartnerNotificationCenter";
import PartnerSupportRequestPanel from "@/components/partner/PartnerSupportRequestPanel";
import type { PartnerNotificationCenterData } from "@/lib/partner-notifications";

const companyId = "mock-partner-company-cafe-ssafy";
const companyName = "카페 싸피";
const loginId = "partner@cafessafy.example";
const displayName = "김도연";
const now = "2026-07-05T09:30:00.000+09:00";

const notificationData = {
  warningMessage: null,
  summary: {
    totalCount: 5,
    requestCount: 2,
    pendingRequestCount: 1,
    resolvedRequestCount: 1,
    reviewCount: 1,
    operationCount: 2,
    companyCount: 1,
    serviceCount: 6,
  },
  items: [
    {
      id: "mock-partner-notification-plan-pending",
      category: "plan",
      status: "pending",
      tone: "warning",
      badgeLabel: "입금 확인 대기",
      title: "카페 싸피 강남역점 Boost 업그레이드 요청이 접수되었습니다",
      body: "안내 계좌 입금 확인 후 관리자가 승인하면 플랜과 상세 지표 접근 권한이 반영됩니다.",
      companyId,
      companyName,
      partnerId: "mock-partner-service-cafe-ssafy-gangnam",
      partnerName: "카페 싸피 강남역점",
      href: `/partner/companies/${companyId}/plans`,
      createdAt: now,
    },
    {
      id: "mock-partner-notification-review",
      category: "review",
      status: "created",
      tone: "primary",
      badgeLabel: "새 리뷰",
      title: "카페 싸피 삼성점에 새 리뷰가 등록되었습니다",
      body: "리뷰 목록에서 별점, 사진 포함 여부, 답변 필요 여부를 확인해 주세요.",
      companyId,
      companyName,
      partnerId: "mock-partner-service-cafe-ssafy-samseong",
      partnerName: "카페 싸피 삼성점",
      href: `/partner/companies/${companyId}/services/mock-partner-service-cafe-ssafy-samseong`,
      createdAt: "2026-07-05T08:50:00.000+09:00",
    },
    {
      id: "mock-partner-notification-request",
      category: "request",
      status: "rejected",
      tone: "danger",
      badgeLabel: "수정 반려",
      title: "카페 싸피 잠실점 위치 변경 요청이 반려되었습니다",
      body: "주소와 지도 URL이 서로 달라 관리자 검토에서 반려되었습니다. 수정 요청 화면에서 다시 제출해 주세요.",
      companyId,
      companyName,
      partnerId: "mock-partner-service-cafe-ssafy-jamsil",
      partnerName: "카페 싸피 잠실점",
      href: `/partner/companies/${companyId}/services/mock-partner-service-cafe-ssafy-jamsil?mode=edit`,
      createdAt: "2026-07-04T18:15:00.000+09:00",
    },
    {
      id: "mock-partner-notification-operation",
      category: "operation",
      status: "notified",
      tone: "neutral",
      badgeLabel: "운영 안내",
      title: "증빙 프로필을 플랜 요청에서 다시 사용할 수 있습니다",
      body: "프로필 탭에서 저장한 입금자와 세금계산서 정보가 모든 협력사 화면에서 동일하게 제공됩니다.",
      companyId: null,
      companyName: "계정 전역",
      partnerId: null,
      partnerName: null,
      href: `/partner/companies/${companyId}/account`,
      createdAt: "2026-07-04T12:00:00.000+09:00",
    },
  ],
} satisfies PartnerNotificationCenterData;

function PartnerStateFrame({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-background">
      <Container size="wide" className="pb-12 pt-4 sm:pt-6">
        <div className="grid min-w-0 gap-5">
          <ShellHeader
            eyebrow="Partner Portal"
            title={title}
            description={description}
            actions={<Badge variant="primary">{companyName}</Badge>}
          />
          {children}
        </div>
      </Container>
    </div>
  );
}

function CompactField({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  tone?: "neutral" | "primary" | "success" | "warning" | "danger";
}) {
  return (
    <div className="min-w-0 rounded-[1rem] border border-border/70 bg-surface-inset p-4">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <p className="truncate text-sm font-semibold text-foreground">{label}</p>
        <Badge variant={tone}>상태</Badge>
      </div>
      <div className="mt-2 min-w-0 text-sm leading-6 text-muted-foreground">
        {value}
      </div>
    </div>
  );
}

function RegistrationWebInputState() {
  return (
    <PartnerStateFrame
      title="신규 파트너사 등록"
      description="웹 입력 탭에서 브랜드 유형, 혜택 방식, 이미지, 담당자 정보를 한 번에 접수합니다."
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Card className="grid min-w-0 gap-5" padding="md">
          <div className="flex flex-wrap gap-2">
            <Badge variant="primary">웹 입력</Badge>
            <Badge variant="neutral">엑셀 파일 입력</Badge>
            <Badge variant="warning">필수값 오류 3건</Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <CompactField
              label="브랜드 유형"
              tone="primary"
              value="오프라인 매장, 지점, 시설처럼 방문 주소와 지도 링크가 필요한 브랜드"
            />
            <CompactField
              label="혜택 이용 방식"
              tone="primary"
              value="구성원 인증 카드 확인 후 현장에서 할인 혜택을 적용"
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {[
              ["브랜드명", "카페 싸피 역삼본점", "danger"],
              ["카테고리", "카페, 디저트, 스터디 공간", "danger"],
              ["위치", "서울 강남구 역삼로 123 카페 싸피 빌딩 1층", "danger"],
              ["담당자 이메일", "partner@cafessafy.example", "neutral"],
            ].map(([label, value, tone]) => (
              <CompactField
                key={label}
                label={label}
                tone={tone as "neutral" | "danger"}
                value={
                  <span className="line-clamp-2 break-words">
                    {value}
                  </span>
                }
              />
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {["아메리카노 10% 할인", "시그니처 라떼 500원 할인", "SSAFY 인증 필수"].map(
              (chip) => (
                <span
                  key={chip}
                  className="min-w-0 rounded-full border border-border bg-surface-control px-3 py-2 text-sm font-semibold text-foreground"
                >
                  <span className="block truncate">{chip}</span>
                </span>
              ),
            )}
          </div>
          <FormMessage variant="error">
            누락 항목 확인 후 첫 오류 필드로 이동합니다.
          </FormMessage>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary">임시 확인</Button>
            <Button>신청 접수</Button>
          </div>
        </Card>
        <Card tone="muted" padding="md" className="grid content-start gap-3">
          <SectionHeading title="이미지" description="대표 1장, 상세 최대 5장" />
          <div className="aspect-square rounded-[1rem] border border-dashed border-border bg-surface-control p-4 text-sm font-semibold text-muted-foreground">
            대표 이미지는 1:1로 조정 후 저장됩니다.
          </div>
          <Button variant="secondary">이미지 추가</Button>
        </Card>
      </div>
    </PartnerStateFrame>
  );
}

function RegistrationExcelState() {
  return (
    <PartnerStateFrame
      title="신규 파트너사 등록"
      description="엑셀 파일 입력 탭에서는 유형을 고른 뒤 템플릿을 내려받고 XLSX 파일을 업로드합니다."
    >
      <Card className="grid min-w-0 gap-5" padding="md">
        <div className="flex flex-wrap gap-2">
          <Badge variant="neutral">웹 입력</Badge>
          <Badge variant="primary">엑셀 파일 입력</Badge>
          <Badge variant="warning">파일 미첨부</Badge>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card tone="muted" padding="md" className="grid gap-3">
            <SectionHeading title="브랜드 유형" description="업체 성격에 맞는 기본 항목을 고릅니다." />
            {["오프라인", "온라인", "오프라인+온라인"].map((label) => (
              <Button key={label} variant={label === "오프라인" ? "soft" : "secondary"}>
                {label}
              </Button>
            ))}
          </Card>
          <Card tone="muted" padding="md" className="grid gap-3">
            <SectionHeading title="혜택 이용 방식" description="인증 확인, 외부 링크, 현장 제시 중 선택합니다." />
            {["인증 확인", "외부 링크", "현장 제시"].map((label) => (
              <Button key={label} variant={label === "인증 확인" ? "soft" : "secondary"}>
                {label}
              </Button>
            ))}
          </Card>
        </div>
        <div className="grid gap-3 rounded-[1rem] border border-dashed border-danger/40 bg-danger/5 p-4">
          <p className="font-semibold text-danger">XLSX 파일을 업로드해 주세요.</p>
          <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
            현재 템플릿은 브랜드 1개 접수 기준입니다. 여러 지점은 지점별로 파일을 나눠 제출합니다.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary">XLSX 다운로드</Button>
            <Button variant="secondary">파일 선택</Button>
            <Button>신청 접수</Button>
          </div>
        </div>
      </Card>
    </PartnerStateFrame>
  );
}

function AccountProfileState() {
  return (
    <PartnerStateFrame
      title="프로필"
      description="계정 정보, 비밀번호 변경, 입금자와 세금계산서 증빙 프로필을 모든 협력사에서 동일하게 사용합니다."
    >
      <StatsRow
        minItemWidth="12rem"
        items={[
          { label: "담당자", value: displayName, hint: "모든 협력사 공통 계정" },
          { label: "로그인 ID", value: loginId, hint: "비밀번호 변경 탭과 연결" },
          { label: "기본 증빙", value: "카페 싸피 본점", hint: "플랜 요청 기본값" },
        ]}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card padding="md" className="grid gap-4">
          <SectionHeading title="저장된 증빙 프로필" description="입금자와 세금계산서 정보를 재사용합니다." />
          <CompactField label="카페 싸피 본점" tone="primary" value="카페싸피 · 220-81-62517 · tax@cafessafy.example" />
          <CompactField label="카페 싸피 지점 공통" value="카페싸피 운영팀 · 120-88-00000 · invoice@cafessafy.example" />
        </Card>
        <Card padding="md" className="grid gap-4">
          <SectionHeading title="비밀번호 변경" description="현재 비밀번호 확인 후 새 비밀번호를 저장합니다." />
          <CompactField label="현재 상태" tone="success" value="최근 로그인 2026년 7월 5일 09:10" />
          <Button>비밀번호 변경 저장</Button>
        </Card>
      </div>
    </PartnerStateFrame>
  );
}

function NotificationsInboxState() {
  return (
    <PartnerStateFrame
      title="알림"
      description="선택 협력사의 알림과 계정 전역 알림을 함께 확인하고 수신 설정은 계정 단위로 관리합니다."
    >
      <PartnerNotificationCenter data={notificationData} />
    </PartnerStateFrame>
  );
}

function PlansBillingState() {
  return (
    <PartnerStateFrame
      title="플랜"
      description="브랜드별 현재 플랜, 결제 대기, 증빙 상태, 업그레이드 가능 플랜을 같은 구조로 확인합니다."
    >
      <Card padding="md" className="grid gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionHeading title="브랜드별 플랜" description="미납 7일 경과 시 Basic으로 조정될 수 있습니다." />
          <Badge variant="warning">결제 대기 1건</Badge>
        </div>
        {[
          ["카페 싸피 역삼본점", "Basic", "무료 · 핵심 요약 지표", "neutral"],
          ["카페 싸피 강남역점", "Partner → Boost", "150,000원 VAT 포함 · 입금 확인 대기", "warning"],
          ["카페 싸피 삼성점", "Boost", "상세 지표와 광고 성과 확인 가능", "primary"],
        ].map(([name, plan, detail, tone]) => (
          <div
            key={name}
            className="grid min-w-0 gap-3 rounded-[1rem] border border-border/70 bg-surface-inset p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={tone as "neutral" | "warning" | "primary"}>{plan}</Badge>
                <h3 className="truncate text-base font-semibold text-foreground">{name}</h3>
              </div>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                {detail}
              </p>
            </div>
            <Button variant={tone === "warning" ? "primary" : "secondary"}>
              {tone === "warning" ? "입금 정보 확인" : "상세 보기"}
            </Button>
          </div>
        ))}
      </Card>
    </PartnerStateFrame>
  );
}

function ServiceDetailState() {
  return (
    <PartnerStateFrame
      title="브랜드 상세"
      description="공개 상태, 승인 상태, 플랜, 수정 요청, 지표 권한, 리뷰를 한 화면에서 스캔합니다."
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card padding="md" className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="success">공개</Badge>
            <Badge variant="success">승인됨</Badge>
            <Badge variant="neutral">Basic</Badge>
            <Badge variant="warning">잠긴 지표 있음</Badge>
          </div>
          <SectionHeading
            title="카페 싸피 역삼본점"
            description="SSAFY 서울캠퍼스 인근 프랜차이즈 카페입니다."
          />
          <div className="grid gap-3 md:grid-cols-2">
            <CompactField label="위치" value="서울 강남구 역삼로 123" />
            <CompactField label="리뷰" tone="primary" value="24건 · 평균 4.7점" />
            <CompactField label="PV" value="1,240회" />
            <CompactField label="잠긴 지표" tone="warning" value="UV, 광고 성과, 시계열은 Partner 이상에서 확인" />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary">사용자 화면</Button>
            <Button>수정 요청</Button>
          </div>
        </Card>
        <Card tone="muted" padding="md" className="grid content-start gap-3">
          <SectionHeading title="최근 리뷰" description="필터 변경 시 목록 갱신 상태가 표시됩니다." />
          {["시그니처 라떼 할인 적용이 빨랐어요.", "좌석이 넓어서 스터디하기 좋았습니다."].map((review) => (
            <div key={review} className="rounded-[1rem] border border-border bg-surface-control p-4">
              <p className="line-clamp-2 text-sm leading-6 text-foreground">{review}</p>
            </div>
          ))}
        </Card>
      </div>
    </PartnerStateFrame>
  );
}

function ServiceNewState() {
  return (
    <RegistrationWebInputState />
  );
}

function ServiceRequestState() {
  return (
    <PartnerStateFrame
      title="브랜드 수정 요청"
      description="즉시 반영 항목과 관리자 승인 필요 항목을 분리해 수정 흐름을 명확하게 보여줍니다."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Card padding="md" className="grid gap-3">
          <Badge variant="success">즉시 반영</Badge>
          <SectionHeading title="이미지와 링크" description="대표 이미지, 추가 이미지, 혜택 이용 링크, 태그는 저장 직후 반영됩니다." />
          <Button variant="secondary">이미지 추가</Button>
          <FormMessage variant="info">저장 중에는 폼 섹션에 처리 중 상태가 표시됩니다.</FormMessage>
        </Card>
        <Card padding="md" className="grid gap-3">
          <Badge variant="warning">승인 필요</Badge>
          <SectionHeading title="브랜드 핵심 정보" description="브랜드명, 위치, 기간, 혜택, 이용 조건은 관리자 검토 후 반영됩니다." />
          <CompactField label="대기 요청" tone="warning" value="카페 싸피 잠실점 지도 URL 확인 필요" />
          <Button>승인 요청 제출</Button>
        </Card>
      </div>
    </PartnerStateFrame>
  );
}

function SupportTemplateState() {
  return (
    <ToastProvider>
      <PartnerStateFrame
        title="기술 지원"
        description="문의 유형을 고르면 협력사, 로그인 계정, 브랜드 목록, 현재 URL이 들어간 템플릿이 갱신됩니다."
      >
        <PartnerSupportRequestPanel
          to="support@ssartnership.example"
          siteName="싸트너십"
          companyName={companyName}
          brandNames="카페 싸피 역삼본점, 카페 싸피 강남역점, 카페 싸피 삼성점"
          displayName={displayName}
          loginId={loginId}
          currentUrl={`/partner/companies/${companyId}/support`}
        />
      </PartnerStateFrame>
    </ToastProvider>
  );
}

function SetupInitialState() {
  return (
    <PartnerStateFrame
      title="초기 설정"
      description="관리자가 발급한 링크로 담당자 계정의 비밀번호를 설정하고 협력사 연결 상태를 확인합니다."
    >
      <Card padding="md" className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="success">토큰 유효</Badge>
          <Badge variant="primary">{companyName}</Badge>
          <Badge variant="neutral">6개 브랜드 연결</Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <CompactField label="로그인 ID" value={loginId} />
          <CompactField label="담당자" value={displayName} />
        </div>
        <FormMessage variant="info">
          비밀번호 설정 후 파트너 포털에서 협력사를 선택해 운영 화면으로 이동합니다.
        </FormMessage>
        <Button>비밀번호 설정 완료</Button>
      </Card>
    </PartnerStateFrame>
  );
}

const meta = {
  title: "Domains/Partner/PageStates/Core",
  parameters: {
    chromatic: {
      viewports: [360, 820, 1366],
    },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const RegistrationWebInput: Story = {
  render: () => <RegistrationWebInputState />,
  parameters: {
    mockScenario: {
      routePath: "/partner-registration",
      scenarioId: "public.partner.registration.web-input",
    },
  },
};

export const RegistrationExcelUpload: Story = {
  render: () => <RegistrationExcelState />,
  parameters: {
    mockScenario: {
      routePath: "/partner-registration",
      scenarioId: "public.partner.registration.excel-upload",
    },
  },
};

export const AccountProfile: Story = {
  render: () => <AccountProfileState />,
  parameters: {
    mockScenario: {
      routePath: "/partner/companies/[companyId]/account",
      scenarioId: "partner.account.profile",
    },
  },
};

export const NotificationsInbox: Story = {
  render: () => <NotificationsInboxState />,
  parameters: {
    mockScenario: {
      routePath: "/partner/companies/[companyId]/notifications",
      scenarioId: "partner.notifications.inbox",
    },
  },
};

export const PlansBilling: Story = {
  render: () => <PlansBillingState />,
  parameters: {
    mockScenario: {
      routePath: "/partner/companies/[companyId]/plans",
      scenarioId: "partner.plans.billing",
    },
  },
};

export const ServiceDetail: Story = {
  render: () => <ServiceDetailState />,
  parameters: {
    mockScenario: {
      routePath: "/partner/companies/[companyId]/services/[partnerId]",
      scenarioId: "partner.service.detail",
    },
  },
};

export const ServiceNew: Story = {
  render: () => <ServiceNewState />,
  parameters: {
    mockScenario: {
      routePath: "/partner/companies/[companyId]/services/new",
      scenarioId: "partner.service.new",
    },
  },
};

export const ServiceRequest: Story = {
  render: () => <ServiceRequestState />,
  parameters: {
    mockScenario: {
      routePath: "/partner/services/[partnerId]/request",
      scenarioId: "partner.service.request",
    },
  },
};

export const SupportTemplate: Story = {
  render: () => <SupportTemplateState />,
  parameters: {
    mockScenario: {
      routePath: "/partner/companies/[companyId]/support",
      scenarioId: "partner.support.template",
    },
  },
};

export const SetupInitial: Story = {
  render: () => <SetupInitialState />,
  parameters: {
    mockScenario: {
      routePath: "/partner/setup/[token]",
      scenarioId: "partner.setup.initial",
    },
  },
};
