import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { useState } from "react";
import PortalBadge from "./PortalBadge";
import PortalButton, { PortalButtonLink } from "./PortalButton";
import PortalConfirmDialog from "./PortalConfirmDialog";
import PortalFilterBar, { PortalSearchField } from "./PortalFilterBar";
import { PortalField, PortalInput, PortalSelect, PortalTextarea, portalFieldProps } from "./PortalFormControls";
import PortalMetricGrid from "./PortalMetric";
import PortalPageHeader from "./PortalPageHeader";
import PortalPagination from "./PortalPagination";
import PortalPanel from "./PortalPanel";
import PortalStatePanel from "./PortalStatePanel";
import PortalTabs from "./PortalTabs";

const meta = {
  title: "Domains/PortalV2/Primitives",
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="portal-v2 min-h-96 p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Buttons: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <PortalButton variant="primary">보완할 제휴처 보기</PortalButton>
      <PortalButton>플랜 확인</PortalButton>
      <PortalButton variant="danger">삭제</PortalButton>
      <PortalButton variant="primary" disabled>
        저장 중
      </PortalButton>
      <PortalButton disabled>이전</PortalButton>
      <PortalButtonLink href="/partner" variant="secondary">
        링크 버튼
      </PortalButtonLink>
    </div>
  ),
};

export const Badges: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <PortalBadge tone="success">운영 중</PortalBadge>
      <PortalBadge tone="neutral">종료</PortalBadge>
      <PortalBadge tone="info">검토 중</PortalBadge>
      <PortalBadge tone="warning">보완 필요</PortalBadge>
      <PortalBadge tone="danger">반려</PortalBadge>
    </div>
  ),
};

export const PanelWithMetrics: Story = {
  render: () => (
    <div className="flex max-w-5xl flex-col gap-4">
      <PortalPageHeader
        title="제휴 성과와 운영 현황"
        description="제휴로 생긴 관심과 지금 처리할 일을 한눈에 확인하세요."
        primaryAction={<PortalButtonLink href="#" variant="primary">보완할 제휴처 보기</PortalButtonLink>}
      />
      <PortalPanel title="핵심 현황">
        <PortalMetricGrid
          items={[
            { id: "views", label: "제휴처 조회", value: "1,284회" },
            { id: "saves", label: "관심 저장", value: "96회" },
            { id: "services", label: "운영 제휴처", value: "2곳" },
            { id: "pending", label: "검토 대기", value: "1건" },
          ]}
        />
      </PortalPanel>
    </div>
  ),
};

export const States: Story = {
  render: () => (
    <div className="grid max-w-3xl gap-4">
      <PortalStatePanel
        kind="empty"
        title="선택한 기간에 이용 기록이 없습니다."
        description="기간을 바꾸거나 전체 기간을 확인해 보세요."
        action={<PortalButton>기간 바꾸기</PortalButton>}
      />
      <PortalStatePanel kind="loading" title="불러오는 중입니다." />
      <PortalStatePanel
        kind="error"
        title="정보를 불러오지 못했습니다."
        description="잠시 후 다시 시도해 주세요. 선택한 조건은 그대로 유지됩니다."
        action={<PortalButton variant="primary">다시 시도</PortalButton>}
      />
      <PortalStatePanel
        kind="forbidden"
        title="이 화면을 볼 권한이 없습니다."
        description="운영할 파트너사를 선택하거나 관리자에게 권한을 요청하세요."
      />
    </div>
  ),
};

function FormExample() {
  const error = "연락처를 확인해 주세요.";
  return (
    <form className="grid max-w-xl gap-4" noValidate>
      <PortalField name="story-name" label="담당자 이름" required hint="계정에 표시되는 이름입니다.">
        <PortalInput {...portalFieldProps("story-name", { hasHint: true })} defaultValue="루프 담당자" />
      </PortalField>
      <PortalField name="story-phone" label="연락처" required error={error}>
        <PortalInput {...portalFieldProps("story-phone", { error })} defaultValue="010-1234" />
      </PortalField>
      <PortalField name="story-kind" label="문의 유형">
        <PortalSelect {...portalFieldProps("story-kind")} defaultValue="plan">
          <option value="plan">플랜</option>
          <option value="service">제휴처</option>
        </PortalSelect>
      </PortalField>
      <PortalField name="story-body" label="내용">
        <PortalTextarea {...portalFieldProps("story-body")} defaultValue="" />
      </PortalField>
    </form>
  );
}

export const Fields: Story = {
  render: () => <FormExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const phone = canvas.getByLabelText(/연락처/);
    await expect(phone).toHaveAttribute("aria-invalid", "true");
    await expect(phone).toHaveAttribute("aria-describedby", "story-phone-error");
    await expect(canvas.getByLabelText(/담당자 이름/)).toHaveAttribute("aria-describedby", "story-name-hint");
    await expect(canvas.getByRole("alert")).toHaveTextContent("연락처를 확인해 주세요.");
  },
};

function TabsExample() {
  const [value, setValue] = useState<"trend" | "usage">("trend");
  return (
    <div>
      <PortalTabs
        label="성과 보기"
        idPrefix="story-tabs"
        value={value}
        onChange={setValue}
        options={[
          { value: "trend", label: "추이" },
          { value: "usage", label: "이용 내역" },
        ]}
      />
      <div role="tabpanel" id={`story-tabs-panel-${value}`} aria-labelledby={`story-tabs-tab-${value}`} className="pt-4 pv2-body">
        {value === "trend" ? "추이 패널" : "이용 내역 패널"}
      </div>
    </div>
  );
}

export const Tabs: Story = {
  render: () => <TabsExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trend = canvas.getByRole("tab", { name: "추이" });
    trend.focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(canvas.getByRole("tab", { name: "이용 내역" })).toHaveAttribute("aria-selected", "true");
    await expect(canvas.getByRole("tabpanel")).toHaveTextContent("이용 내역 패널");
  },
};

export const FilterAndPagination: Story = {
  render: () => (
    <div className="grid max-w-5xl gap-4">
      <PortalFilterBar action="/admin/members" actions={<PortalButton type="submit" variant="primary">검색</PortalButton>}>
        <PortalSearchField name="q" label="회원·제휴처 검색" placeholder="회원·제휴처 검색" className="w-full md:w-90" />
        <PortalSelect name="status" aria-label="상태" defaultValue="" className="md:w-40">
          <option value="">전체 상태</option>
          <option value="active">운영 중</option>
        </PortalSelect>
      </PortalFilterBar>
      <PortalPagination summary="전체 84건" page={2} pageCount={9} prevHref="?page=1" nextHref="?page=3" />
      <PortalPagination summary="전체 2건" page={1} pageCount={1} />
    </div>
  ),
};

function ConfirmExample() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PortalButton variant="danger" onClick={() => setOpen(true)}>
        제휴처 삭제
      </PortalButton>
      <PortalConfirmDialog
        open={open}
        danger
        title="제휴처를 삭제할까요?"
        description="삭제한 제휴처는 복구할 수 없습니다."
        confirmLabel="삭제"
        onClose={() => setOpen(false)}
        onConfirm={() => setOpen(false)}
      />
    </>
  );
}

export const ConfirmDialog: Story = {
  render: () => <ConfirmExample />,
  play: async ({ canvasElement }) => {
    const opener = within(canvasElement).getByRole("button", { name: "제휴처 삭제" });
    await userEvent.click(opener);
    const dialog = await within(document.body).findByRole("dialog");
    await expect(dialog).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await expect(within(canvasElement).getByRole("button", { name: "제휴처 삭제" })).toHaveFocus();
  },
};
