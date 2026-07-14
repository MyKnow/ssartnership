"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Button from "@/components/ui/Button";
import Surface from "@/components/ui/Surface";
import { useToast } from "@/components/ui/Toast";

type MattermostProfileSyncResponse = {
  ok?: boolean;
  updated?: boolean;
  imageSkipped?: boolean;
  message?: string;
};

function getResponseMessage(payload: MattermostProfileSyncResponse | null) {
  return payload?.message?.trim() || "MM 프로필을 동기화하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

export default function CertificationMattermostSyncAction() {
  const router = useRouter();
  const { notify } = useToast();
  const [syncing, setSyncing] = useState(false);

  const syncProfile = async () => {
    if (syncing) {
      return;
    }

    setSyncing(true);
    try {
      const response = await fetch("/api/mm/profile-sync", {
        method: "POST",
        credentials: "same-origin",
      });
      const payload = (await response
        .json()
        .catch(() => null)) as MattermostProfileSyncResponse | null;

      if (!response.ok || !payload?.ok) {
        notify(getResponseMessage(payload));
        return;
      }

      if (payload.imageSkipped) {
        notify("이름과 MM 아이디는 반영됐지만 MM 프로필 사진을 처리하지 못했습니다.");
      } else if (payload.updated) {
        notify("MM 프로필의 최신 정보를 반영했습니다.");
      } else {
        notify("이미 최신 MM 프로필 정보입니다.");
      }
      router.refresh();
    } catch {
      notify("MM 프로필을 동기화하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Surface
      level="inset"
      padding="lg"
      className="flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">Mattermost 프로필</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          MM에서 변경한 이름, MM 아이디, 트랙, 프로필 사진을 지금 바로 반영합니다.
        </p>
      </div>
      <Button
        variant="secondary"
        className="w-full shrink-0 sm:w-auto"
        loading={syncing}
        loadingText="동기화 중"
        onClick={syncProfile}
      >
        MM 프로필 동기화
      </Button>
    </Surface>
  );
}
