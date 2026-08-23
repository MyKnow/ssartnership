"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowPathRoundedSquareIcon } from "@heroicons/react/24/outline";
import { CertificationSettingRow } from "@/components/certification/CertificationSettingsList";
import { useToast } from "@/components/ui/Toast";
import { buildMemberGateHref } from "@/lib/member-required-gates";

type MattermostProfileSyncResponse = {
  ok?: boolean;
  updated?: boolean;
  imageSkipped?: boolean;
  requiresProfilePhotoSubmission?: boolean;
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

      if (payload.requiresProfilePhotoSubmission) {
        notify(
          payload.imageSkipped
            ? "MM 프로필 사진을 처리하지 못했습니다. 본인 사진을 직접 제출해 주세요."
            : "MM 프로필에 사용할 사진이 없습니다. 본인 사진을 직접 제출해 주세요.",
        );
        window.location.assign(
          buildMemberGateHref(
            "profile-photo",
            `${window.location.pathname}${window.location.search}${window.location.hash}`,
          ),
        );
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
    <CertificationSettingRow
      icon={<ArrowPathRoundedSquareIcon className="h-5 w-5" />}
      title="Mattermost 프로필 동기화"
      description="MM에서 현재 이름, 아이디, 트랙, 프로필 사진을 가져옵니다."
      loading={syncing}
      loadingLabel="동기화 중"
      onClick={syncProfile}
    />
  );
}
