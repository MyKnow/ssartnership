"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/Toast";

export default function AdminPartnerCreateToast() {
  const searchParams = useSearchParams();
  const { notify } = useToast();

  useEffect(() => {
    if (searchParams.get("created") === "partner_created") {
      notify("브랜드를 추가했습니다.");
    }
  }, [notify, searchParams]);

  return null;
}

