"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { clearImageUploadDraft } from "@/lib/image-upload/draft.client";

export default function AdminPartnerCreateToast() {
  const searchParams = useSearchParams();
  const { notify } = useToast();

  useEffect(() => {
    if (searchParams.get("created") === "partner_created") {
      void clearImageUploadDraft("admin-partner-create-new");
      notify("제휴처를 추가했습니다.");
    }
  }, [notify, searchParams]);

  return null;
}
