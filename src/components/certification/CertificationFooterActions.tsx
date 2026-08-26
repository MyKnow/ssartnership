"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRightStartOnRectangleIcon,
  KeyIcon,
  TrashIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import {
  CertificationSettingRow,
  CertificationSettingsGroup,
} from "@/components/certification/CertificationSettingsList";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { buildMemberGateHref } from "@/lib/member-required-gates";
import { getMemberAccountDeletionNavigation } from "@/lib/site-navigation";

export default function CertificationFooterActions({
  canChangeProfilePhoto = false,
  returnTo = "/certification",
}: {
  canChangeProfilePhoto?: boolean;
  returnTo?: string;
}) {
  const { notify } = useToast();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutConfirmationOpen, setLogoutConfirmationOpen] = useState(false);
  const { deletionHref } = getMemberAccountDeletionNavigation(returnTo);

  const logOut = async () => {
    if (loggingOut) {
      return;
    }
    setLoggingOut(true);
    try {
      const response = await fetch("/api/mm/logout", { method: "POST" });
      if (!response.ok) {
        notify("로그아웃에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      setLogoutConfirmationOpen(false);
      notify("로그아웃되었습니다.");
      router.replace("/");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <>
      <CertificationSettingsGroup title="보안">
        {canChangeProfilePhoto ? (
          <CertificationSettingRow
            icon={<UserCircleIcon className="h-5 w-5" />}
            title="본인 사진"
            description="인증 카드에 표시할 본인 사진을 변경합니다."
            href={buildMemberGateHref("profile-photo", returnTo)}
            prefetch={false}
          />
        ) : null}
        <CertificationSettingRow
          icon={<KeyIcon className="h-5 w-5" />}
          title="비밀번호"
          description="현재 계정의 비밀번호를 변경합니다."
          href={buildMemberGateHref("change-password", returnTo)}
          prefetch={false}
        />
        <CertificationSettingRow
          icon={<ArrowRightStartOnRectangleIcon className="h-5 w-5" />}
          title="로그아웃"
          description="이 기기에서 로그아웃합니다."
          className="md:hidden"
          onClick={() => setLogoutConfirmationOpen(true)}
        />
      </CertificationSettingsGroup>

      <CertificationSettingsGroup title="계정">
        <CertificationSettingRow
          icon={<TrashIcon className="h-5 w-5" />}
          title="회원 탈퇴"
          description="혜택 이용을 포기하고 탈퇴합니다."
          tone="danger"
          href={deletionHref}
          prefetch={false}
        />
      </CertificationSettingsGroup>

      <Modal
        open={logoutConfirmationOpen}
        title="로그아웃하시겠습니까?"
        description="이 기기에서 현재 계정의 세션을 종료합니다."
        onClose={() => {
          if (!loggingOut) {
            setLogoutConfirmationOpen(false);
          }
        }}
        bodyClassName="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
      >
        <Button
          variant="secondary"
          disabled={loggingOut}
          onClick={() => setLogoutConfirmationOpen(false)}
        >
          취소
        </Button>
        <Button
          onClick={() => void logOut()}
          loading={loggingOut}
          loadingText="로그아웃 중"
        >
          로그아웃
        </Button>
      </Modal>
    </>
  );
}
