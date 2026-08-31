import type { AdminSupabaseClient } from "../shared-types";

export type PartnerUpdateRollbackBenefitRow = {
  id: string;
  title: string;
  max_apply_count?: number | null;
  display_order?: number | null;
};

export type PartnerUpdateRollbackSnapshot = {
  company_id: string | null;
  category_id: string;
  name: string;
  location: string;
  detail_description: string | null;
  campus_slugs: string[] | null;
  map_url: string | null;
  benefit_action_type: string | null;
  benefit_action_link: string | null;
  benefit_verification_pin_hash: string | null;
  benefit_verification_pin_salt: string | null;
  reservation_link: string | null;
  inquiry_link: string | null;
  period_start: string | null;
  period_end: string | null;
  conditions: string[] | null;
  benefits: string[] | null;
  applies_to: string[] | null;
  thumbnail: string | null;
  images: string[] | null;
  tags: string[] | null;
  visibility: string | null;
  benefit_visibility: string | null;
  partner_benefits?: PartnerUpdateRollbackBenefitRow[] | null;
};

export async function rollbackPartnerUpdateMutation(input: {
  supabase: AdminSupabaseClient;
  partnerId: string;
  previousPartner: PartnerUpdateRollbackSnapshot;
}) {
  const { supabase, partnerId, previousPartner } = input;

  const { error: restorePartnerError } = await supabase
    .from("partners")
    .update({
      company_id: previousPartner.company_id,
      name: previousPartner.name,
      category_id: previousPartner.category_id,
      location: previousPartner.location,
      detail_description: previousPartner.detail_description,
      campus_slugs: previousPartner.campus_slugs ?? [],
      map_url: previousPartner.map_url,
      benefit_action_type: previousPartner.benefit_action_type,
      benefit_action_link: previousPartner.benefit_action_link,
      benefit_verification_pin_hash: previousPartner.benefit_verification_pin_hash,
      benefit_verification_pin_salt: previousPartner.benefit_verification_pin_salt,
      reservation_link: previousPartner.reservation_link,
      inquiry_link: previousPartner.inquiry_link,
      period_start: previousPartner.period_start,
      period_end: previousPartner.period_end,
      conditions: previousPartner.conditions ?? [],
      benefits: previousPartner.benefits ?? [],
      applies_to: previousPartner.applies_to ?? [],
      thumbnail: previousPartner.thumbnail,
      images: previousPartner.images ?? [],
      tags: previousPartner.tags ?? [],
      visibility: previousPartner.visibility,
      benefit_visibility: previousPartner.benefit_visibility,
    })
    .eq("id", partnerId);

  if (restorePartnerError) {
    throw new Error("partner_update_rollback_failed", {
      cause: restorePartnerError,
    });
  }

  const { error: deleteBenefitsError } = await supabase
    .from("partner_benefits")
    .delete()
    .eq("partner_id", partnerId);

  if (deleteBenefitsError) {
    throw new Error("partner_update_rollback_failed", {
      cause: deleteBenefitsError,
    });
  }

  const previousBenefits = (previousPartner.partner_benefits ?? [])
    .slice()
    .sort((left, right) => (left.display_order ?? 0) - (right.display_order ?? 0));

  if (previousBenefits.length === 0) {
    return;
  }

  const { error: restoreBenefitsError } = await supabase
    .from("partner_benefits")
    .insert(
      previousBenefits.map((benefit, displayOrder) => ({
        id: benefit.id,
        partner_id: partnerId,
        title: benefit.title,
        max_apply_count: benefit.max_apply_count ?? null,
        display_order: benefit.display_order ?? displayOrder,
      })),
    );

  if (restoreBenefitsError) {
    throw new Error("partner_update_rollback_failed", {
      cause: restoreBenefitsError,
    });
  }
}
