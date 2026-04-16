import type { PartnerChangeRequestContext } from "@/lib/partner-change-requests";
import type { PartnerSession } from "@/lib/partner-session";

export type PartnerServiceDetailViewProps = {
  session: PartnerSession;
  context: PartnerChangeRequestContext;
  mode: "view" | "edit";
  errorMessage?: string | null;
  successMessage?: string | null;
  saveImmediateAction: (formData: FormData) => void | Promise<void>;
  createAction: (formData: FormData) => void | Promise<void>;
  cancelAction: (formData: FormData) => void | Promise<void>;
};
