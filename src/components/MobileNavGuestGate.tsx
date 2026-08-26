"use client";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";

export type MobileNavGuestDestination = "coupons" | "profile";

const GUEST_DESTINATION_CONFIG = {
  coupons: {
    title: "쿠폰함은 로그인 후 이용할 수 있어요",
    description:
      "로그인하면 발급받은 쿠폰과 사용 내역을 확인하고 선택한 화면으로 바로 이동합니다.",
    loginLabel: "로그인하고 쿠폰함 보기",
    returnTo: "/coupons",
  },
  profile: {
    title: "내 정보를 확인하려면 로그인해 주세요",
    description:
      "로그인하면 인증 정보와 계정 설정을 확인하고 선택한 화면으로 바로 이동합니다.",
    loginLabel: "로그인하고 내 정보 보기",
    returnTo: "/certification",
  },
} as const;

export default function MobileNavGuestGate({
  destination,
  onClose,
}: {
  destination: MobileNavGuestDestination | null;
  onClose: () => void;
}) {
  const config = GUEST_DESTINATION_CONFIG[destination ?? "coupons"];
  const loginHref = `/auth/login?returnTo=${encodeURIComponent(config.returnTo)}`;
  const signupHref = `/auth/signup?returnTo=${encodeURIComponent(config.returnTo)}`;

  return (
    <Modal
      open={destination !== null}
      title={config.title}
      description={config.description}
      onClose={onClose}
      panelClassName="mx-2 max-w-md px-5 py-6 sm:mx-0 sm:p-6"
      titleClassName="text-ko-title"
      bodyClassName="mt-5"
    >
      <div
        data-mobile-nav-guest-gate
        className="grid min-w-0 gap-2 sm:grid-cols-2"
      >
        <Button className="w-full" href={loginHref} prefetch={false}>
          {config.loginLabel}
        </Button>
        <Button
          className="w-full"
          href={signupHref}
          prefetch={false}
          variant="secondary"
        >
          회원가입
        </Button>
      </div>
    </Modal>
  );
}
