import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import PartnerAccountScreen from "@/components/partner/PartnerAccountScreen";
import PartnerLoginScreen from "@/components/partner/PartnerLoginScreen";
import PartnerNotificationsScreen from "@/components/partner/PartnerNotificationsScreen";
import PartnerPlanScreen from "@/components/partner/PartnerPlanScreen";
import PartnerResetScreen from "@/components/partner/PartnerResetScreen";
import PartnerServiceDetailView from "@/components/partner/PartnerServiceDetailView";
import PartnerServiceNewScreen from "@/components/partner/PartnerServiceNewScreen";
import PartnerSupportScreen from "@/components/partner/PartnerSupportScreen";
import { ToastProvider } from "@/components/ui/Toast";
import type { PartnerRegistrationWebAction } from "@/components/partner-registration/usePartnerRegistrationController";
import {
  PARTNER_CANONICAL_STORY_COMPANY_ID,
  partnerCanonicalBankTransferAccount,
  partnerCanonicalBillingProfiles,
  partnerCanonicalCategories,
  partnerCanonicalMetricTimeseries,
  partnerCanonicalNotificationData,
  partnerCanonicalNotificationPreferences,
  partnerCanonicalPlanData,
  partnerCanonicalReviews,
  partnerCanonicalReviewSummary,
  partnerCanonicalServiceContext,
  partnerCanonicalServiceMetrics,
  partnerCanonicalStorySession,
} from "@/lib/mock/scenarios/storybook-partner-canonical";

const noOpFormAction = async () => undefined;
const noOpRegistrationAction: PartnerRegistrationWebAction = async (
  previousState,
) => previousState;

async function expectPageHeading(
  canvasElement: HTMLElement,
  accessibleName: string,
) {
  const canvas = within(canvasElement);
  await expect(
    canvas.getByRole("heading", { level: 1, name: accessibleName }),
  ).toBeInTheDocument();
}

const meta = {
  title: "Domains/Partner/CanonicalViews",
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
      </ToastProvider>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    chromatic: {
      viewports: [360, 820, 1366],
    },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const AccountDefault: Story = {
  render: () => (
    <PartnerAccountScreen
      companyId={PARTNER_CANONICAL_STORY_COMPANY_ID}
      displayName={partnerCanonicalStorySession.displayName}
      loginId={partnerCanonicalStorySession.loginId}
      profiles={partnerCanonicalBillingProfiles}
      actions={{
        createProfile: noOpFormAction,
        setDefaultProfile: noOpFormAction,
        archiveProfile: noOpFormAction,
      }}
    />
  ),
  play: ({ canvasElement }) => expectPageHeading(canvasElement, "계정"),
};

export const PlansDefault: Story = {
  render: () => (
    <PartnerPlanScreen
      companyId={PARTNER_CANONICAL_STORY_COMPANY_ID}
      companyName="카페 싸피"
      data={partnerCanonicalPlanData}
      bankTransferAccount={partnerCanonicalBankTransferAccount}
      billingProfiles={partnerCanonicalBillingProfiles}
      actions={{
        requestUpgrade: noOpFormAction,
        cancelUpgrade: noOpFormAction,
      }}
    />
  ),
  play: ({ canvasElement }) => expectPageHeading(canvasElement, "플랜 관리"),
};

export const ServiceDetailDefault: Story = {
  render: () => (
    <PartnerServiceDetailView
      session={partnerCanonicalStorySession}
      context={partnerCanonicalServiceContext}
      mode="view"
      errorMessage={null}
      successMessage={null}
      saveImmediateAction={noOpFormAction}
      createAction={noOpFormAction}
      cancelAction={noOpFormAction}
      reviewSummary={partnerCanonicalReviewSummary}
      brandPlanTier={partnerCanonicalServiceContext.brandPlanTier}
      serviceMetrics={partnerCanonicalServiceMetrics}
      metricTimeseries={partnerCanonicalMetricTimeseries}
      serviceMetricsWarningMessage="Basic 플랜에서는 일부 상세 지표가 잠겨 있습니다."
      initialReviews={partnerCanonicalReviews}
      initialReviewSort="latest"
      initialReviewOffset={partnerCanonicalReviews.length}
    initialReviewHasMore={false}
    coupons={[]}
    createCouponAction={async () => undefined}
    uploadCouponCodesAction={async () => undefined}
  />
  ),
  play: ({ canvasElement }) =>
    expectPageHeading(canvasElement, partnerCanonicalServiceContext.partnerName),
};

export const ServiceNewDefault: Story = {
  render: () => (
    <PartnerServiceNewScreen
      companyId={PARTNER_CANONICAL_STORY_COMPANY_ID}
      companyName="카페 싸피"
      companyDescription="서울 주요 학습권역에서 여러 지점을 운영하는 파트너사입니다."
      displayName={partnerCanonicalStorySession.displayName}
      contactEmail={partnerCanonicalStorySession.loginId}
      categories={partnerCanonicalCategories}
      brandProfiles={[]}
      webAction={noOpRegistrationAction}
    />
  ),
  play: ({ canvasElement }) => expectPageHeading(canvasElement, "제휴처 추가"),
};

export const LoginDefault: Story = {
  render: () => <PartnerLoginScreen action={noOpFormAction} />,
  play: ({ canvasElement }) =>
    expectPageHeading(canvasElement, "파트너 포털 로그인"),
};

export const NotificationsDefault: Story = {
  render: () => (
    <PartnerNotificationsScreen
      data={partnerCanonicalNotificationData}
      pushConfigured={false}
      publicKey=""
      preferences={partnerCanonicalNotificationPreferences}
      deviceCount={0}
    />
  ),
  play: ({ canvasElement }) => expectPageHeading(canvasElement, "알림"),
};

export const ResetDefault: Story = {
  render: () => <PartnerResetScreen />,
  play: ({ canvasElement }) =>
    expectPageHeading(canvasElement, "비밀번호 재설정"),
};

export const SupportDefault: Story = {
  render: () => (
    <PartnerSupportScreen
      to="support@ssartnership.example"
      siteName="싸트너십"
      companyName="카페 싸피"
      brandNames="카페 싸피 역삼본점, 카페 싸피 삼성점"
      displayName={partnerCanonicalStorySession.displayName}
      loginId={partnerCanonicalStorySession.loginId}
      currentUrl={`/partner/support?companyId=${PARTNER_CANONICAL_STORY_COMPANY_ID}`}
    />
  ),
  play: ({ canvasElement }) => expectPageHeading(canvasElement, "기술 지원"),
};
