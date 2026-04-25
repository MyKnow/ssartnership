"use client";

import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import Button from "./Button";
import Modal from "./Modal";

function ModalDemo({
  title,
  description,
  bodyClassName,
  panelClassName,
}: {
  title: string;
  description?: string;
  bodyClassName?: string;
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="flex min-h-[32rem] items-end justify-center rounded-panel bg-surface-inset p-4 sm:items-center">
      <Button variant="secondary" onClick={() => setOpen(true)}>
        모달 열기
      </Button>
      <Modal
        open={open}
        title={title}
        description={description}
        onClose={() => setOpen(false)}
        bodyClassName={bodyClassName}
        panelClassName={panelClassName}
      >
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            파트너 공지, 안내 문구, 간단한 확인 플로우를 점검하기 위한 기본 모달입니다.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              닫기
            </Button>
            <Button onClick={() => setOpen(false)}>확인</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

const meta = {
  title: "UI/Modal",
  component: ModalDemo,
  args: {
    title: "제휴처 상태 변경",
    description: "노출 상태를 변경하면 홈과 상세 페이지에 즉시 반영됩니다.",
  },
} satisfies Meta<typeof ModalDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const DenseBody: Story = {
  args: {
    title: "리뷰 삭제 확인",
    description: "삭제 이후에는 관리자 로그에서만 이력을 확인할 수 있습니다.",
    bodyClassName: "space-y-3",
  },
};

export const WidePanel: Story = {
  args: {
    title: "공지 미리보기",
    description: "관리자 작성 폼과 실제 노출 간격을 확인하기 위한 예시입니다.",
    panelClassName: "max-w-2xl",
  },
};
