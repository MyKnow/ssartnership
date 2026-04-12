"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";

export default function PartnerLoginSetupToast({
  show,
}: {
  show: boolean;
}) {
  const { notify } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (!show) {
      return;
    }

    notify("초기 설정이 완료되었습니다.");
    router.replace("/partner/login");
  }, [notify, router, show]);

  return null;
}
