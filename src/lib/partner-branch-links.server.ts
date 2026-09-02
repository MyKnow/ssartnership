import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/server";

const PARTNER_BRANCH_WRITE_BATCH_SIZE = 100;

export type PartnerBranchLinkSource =
  | "admin"
  | "partner_portal"
  | "registration";

export type PartnerBranchLinkInput = {
  branchKey: string;
  branchCode: string | null;
  name: string;
  address: string;
  branchType: string;
  campusSlugs: string[];
  mapUrl: string | null;
  phone: string | null;
  memo: string | null;
};

type StoredBranchIdRow = {
  id: string;
  branch_key: string;
};

function splitIntoBatches<T>(values: readonly T[], size: number) {
  const batches: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    batches.push(values.slice(index, index + size));
  }
  return batches;
}

function deduplicateBranches(branches: readonly PartnerBranchLinkInput[]) {
  const branchByKey = new Map<string, PartnerBranchLinkInput>();
  const latestMemoByKey = new Map<string, string | null>();

  for (const branch of branches) {
    if (!branchByKey.has(branch.branchKey)) {
      branchByKey.set(branch.branchKey, branch);
    }
    latestMemoByKey.set(branch.branchKey, branch.memo);
  }

  return {
    branches: [...branchByKey.values()],
    latestMemoByKey,
  };
}

async function loadStoredBranchIds({
  supabase,
  companyId,
  brandProfileId,
  branchKeys,
}: {
  supabase: ReturnType<typeof getSupabaseAdminClient>;
  companyId: string;
  brandProfileId: string;
  branchKeys: string[];
}) {
  const { data, error } = await supabase
    .from("partner_company_branches")
    .select("id,branch_key")
    .eq("company_id", companyId)
    .eq("brand_profile_id", brandProfileId)
    .in("branch_key", branchKeys);
  if (error) {
    throw new Error(error.message);
  }

  return new Map(
    ((data ?? []) as StoredBranchIdRow[]).map((row) => [row.branch_key, row.id]),
  );
}

async function ensureStoredBranchIds({
  supabase,
  companyId,
  brandProfileId,
  branches,
}: {
  supabase: ReturnType<typeof getSupabaseAdminClient>;
  companyId: string;
  brandProfileId: string;
  branches: PartnerBranchLinkInput[];
}) {
  const branchKeys = branches.map((branch) => branch.branchKey);
  let storedIds = await loadStoredBranchIds({
    supabase,
    companyId,
    brandProfileId,
    branchKeys,
  });

  // A concurrent request can win one row in a batch and abort the rest of the
  // insert on the unique index. Reload and retry only the rows that still do
  // not exist so the common path stays batched without losing race recovery.
  for (let attempt = 0; attempt < 3 && storedIds.size < branches.length; attempt += 1) {
    const missingBranches = branches.filter(
      (branch) => !storedIds.has(branch.branchKey),
    );
    const { error } = await supabase.from("partner_company_branches").insert(
      missingBranches.map((branch) => ({
        company_id: companyId,
        brand_profile_id: brandProfileId,
        branch_key: branch.branchKey,
        branch_code: branch.branchCode,
        name: branch.name,
        address: branch.address,
        branch_type: branch.branchType,
        campus_slugs: branch.campusSlugs,
        map_url: branch.mapUrl,
        phone: branch.phone,
        memo: branch.memo,
        is_active: true,
      })),
    );
    if (error && error.code !== "23505") {
      throw new Error(error.message);
    }
    storedIds = await loadStoredBranchIds({
      supabase,
      companyId,
      brandProfileId,
      branchKeys,
    });
  }

  if (storedIds.size !== branches.length) {
    throw new Error("제휴 지점 연결 정보를 저장하지 못했습니다.");
  }
  return storedIds;
}

export async function persistPartnerBranchLinks({
  supabase,
  partnerId,
  companyId,
  brandProfileId,
  source,
  branches,
}: {
  supabase: ReturnType<typeof getSupabaseAdminClient>;
  partnerId: string;
  companyId: string | null;
  brandProfileId: string | null;
  source: PartnerBranchLinkSource;
  branches: readonly PartnerBranchLinkInput[];
}) {
  if (!companyId || !brandProfileId || branches.length === 0) {
    return;
  }

  const prepared = deduplicateBranches(branches);
  for (const batch of splitIntoBatches(
    prepared.branches,
    PARTNER_BRANCH_WRITE_BATCH_SIZE,
  )) {
    const storedIds = await ensureStoredBranchIds({
      supabase,
      companyId,
      brandProfileId,
      branches: batch,
    });
    const { error } = await supabase.from("partner_offer_branches").upsert(
      batch.map((branch) => ({
        partner_id: partnerId,
        branch_id: storedIds.get(branch.branchKey)!,
        status: "active",
        source,
        memo: prepared.latestMemoByKey.get(branch.branchKey) ?? null,
      })),
      { onConflict: "partner_id,branch_id" },
    );
    if (error) {
      throw new Error(error.message);
    }
  }
}
