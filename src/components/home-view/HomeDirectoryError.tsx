"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import EmptyState from "@/components/ui/EmptyState";
import Button from "@/components/ui/Button";
import MotionReveal from "@/components/ui/MotionReveal";
import HomeDirectorySectionHeader from "@/components/home-view/HomeDirectorySectionHeader";

export default function HomeDirectoryError() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const retry = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <MotionReveal>
      <section id="benefits" className="flex scroll-mt-24 flex-col gap-4 pt-7">
        <HomeDirectorySectionHeader />
        <EmptyState
          title="혜택을 불러오지 못했습니다"
          description="일시적인 연결 문제입니다. 잠시 후 다시 시도해 주세요."
          messageRole="status"
          action={
            <Button
              type="button"
              onClick={retry}
              loading={isPending}
              loadingText="다시 불러오는 중"
            >
              다시 시도
            </Button>
          }
        />
      </section>
    </MotionReveal>
  );
}
