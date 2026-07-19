"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { clearImageUploadDraft } from "@/lib/image-upload/draft.client";
import { PARTNER_CARD_CREATE_DRAFT_KEY } from "@/lib/partner-card-form/draft";

export default function AdminPartnerCreateToast() {
  const searchParams = useSearchParams();
  const { notify } = useToast();

  useEffect(() => {
    if (searchParams.get("created") === "partner_created") {
      void clearImageUploadDraft(PARTNER_CARD_CREATE_DRAFT_KEY);
      notify("제휴처를 추가했습니다.");
    }
  }, [notify, searchParams]);

  return null;
}
