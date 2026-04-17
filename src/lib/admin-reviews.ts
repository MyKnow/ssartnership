import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  getPartnerReviewAuthorRoleLabel,
  maskPartnerReviewAuthorName,
} from "@/lib/partner-reviews";

export type AdminReviewSort = "latest" | "oldest";
export type AdminReviewStatusFilter = "all" | "visible" | "hidden";
export type AdminReviewRatingFilter = "all" | "1" | "2" | "3" | "4" | "5";

export type AdminReviewFilters = {
  sort: AdminReviewSort;
  status: AdminReviewStatusFilter;
  companyId: string;
  partnerId: string;
  rating: AdminReviewRatingFilter;
  imagesOnly: boolean;
  memberQuery: string;
};

export type AdminReviewCompanyOption = {
  id: string;
  name: string;
  slug: string;
};

export type AdminReviewPartnerOption = {
  id: string;
  name: string;
  companyId: string | null;
  companyName: string | null;
  companySlug: string | null;
};

export type AdminReviewRecord = {
  id: string;
  partnerId: string;
  partnerName: string;
  companyId: string | null;
  companyName: string | null;
  companySlug: string | null;
  memberId: string;
  memberName: string;
  memberUsername: string | null;
  memberYear: number | null;
  memberCampus: string | null;
  rating: number;
  title: string;
  body: string;
  images: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deletedByMemberId: string | null;
  authorMaskedName: string;
  authorRoleLabel: string;
  isHidden: boolean;
  imageCount: number;
};

export type AdminReviewCounts = {
  totalCount: number;
  visibleCount: number;
  hiddenCount: number;
};

export type AdminReviewPageData = {
  counts: AdminReviewCounts;
  reviews: AdminReviewRecord[];
  companies: AdminReviewCompanyOption[];
  partners: AdminReviewPartnerOption[];
  filters: AdminReviewFilters;
};

type AdminReviewRow = {
  id: string;
  partner_id: string;
  member_id: string;
  rating: number;
  title: string;
  body: string;
  images: string[] | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by_member_id: string | null;
  hidden_at: string | null;
  partner?: {
    id: string;
    name: string;
    company_id: string | null;
    company?: {
      id: string;
      name: string;
      slug: string;
    } | null;
  } | {
    id: string;
    name: string;
    company_id: string | null;
    company?: {
      id: string;
      name: string;
      slug: string;
    } | null;
  }[] | null;
  member?: {
    id: string;
    display_name: string | null;
    mm_username: string | null;
    year: number | null;
    campus: string | null;
  } | {
    id: string;
    display_name: string | null;
    mm_username: string | null;
    year: number | null;
    campus: string | null;
  }[] | null;
};

type AdminReviewPartnerRow = {
  id: string;
  name: string;
  company_id: string | null;
  company?:
    | {
        id: string;
        name: string;
        slug: string;
      }
    | {
        id: string;
        name: string;
        slug: string;
      }[]
    | null;
};

function getSingleRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? value[0] ?? null : value;
}

const REVIEW_SELECT =
  "id,partner_id,member_id,rating,title,body,images,created_at,updated_at,deleted_at,deleted_by_member_id,hidden_at,partner:partners(id,name,company_id,company:partner_companies(id,name,slug)),member:members!partner_reviews_member_id_fkey(id,display_name,mm_username,year,campus)";

function parseBooleanParam(value: string | string[] | undefined) {
  const input = Array.isArray(value) ? value[0] : value;
  return input === "1" || input === "true";
}

function parseQueryParam(value: string | string[] | undefined) {
  const input = Array.isArray(value) ? value[0] : value;
  return typeof input === "string" ? input.trim() : "";
}

export function normalizeAdminReviewSort(value: string | null | undefined): AdminReviewSort {
  return value === "oldest" ? "oldest" : "latest";
}

export function normalizeAdminReviewStatusFilter(
  value: string | null | undefined,
): AdminReviewStatusFilter {
  if (value === "visible" || value === "hidden") {
    return value;
  }
  return "all";
}

export function normalizeAdminReviewRatingFilter(
  value: string | null | undefined,
): AdminReviewRatingFilter {
  if (value === "1" || value === "2" || value === "3" || value === "4" || value === "5") {
    return value;
  }
  return "all";
}

export function parseAdminReviewFilters(input: Record<string, string | string[] | undefined>): AdminReviewFilters {
  return {
    sort: normalizeAdminReviewSort(parseQueryParam(input.sort)),
    status: normalizeAdminReviewStatusFilter(parseQueryParam(input.status)),
    companyId: parseQueryParam(input.companyId),
    partnerId: parseQueryParam(input.partnerId),
    rating: normalizeAdminReviewRatingFilter(parseQueryParam(input.rating)),
    imagesOnly: parseBooleanParam(input.imagesOnly),
    memberQuery: parseQueryParam(input.memberQuery),
  };
}

export function serializeAdminReviewFilters(filters: AdminReviewFilters) {
  const params = new URLSearchParams();
  if (filters.sort !== "latest") {
    params.set("sort", filters.sort);
  }
  if (filters.status !== "all") {
    params.set("status", filters.status);
  }
  if (filters.companyId) {
    params.set("companyId", filters.companyId);
  }
  if (filters.partnerId) {
    params.set("partnerId", filters.partnerId);
  }
  if (filters.rating !== "all") {
    params.set("rating", filters.rating);
  }
  if (filters.imagesOnly) {
    params.set("imagesOnly", "true");
  }
  if (filters.memberQuery) {
    params.set("memberQuery", filters.memberQuery);
  }
  return params.toString();
}

function mapAdminReviewRow(row: AdminReviewRow): AdminReviewRecord {
  const partner = getSingleRelation(row.partner);
  const company = getSingleRelation(partner?.company);
  const member = getSingleRelation(row.member);
  const memberName = member?.display_name ?? "익명";
  const memberUsername = member?.mm_username ?? null;
  const memberYear = member?.year ?? null;
  const memberCampus = member?.campus ?? null;
  return {
    id: row.id,
    partnerId: row.partner_id,
    partnerName: partner?.name ?? "알 수 없음",
    companyId: company?.id ?? partner?.company_id ?? null,
    companyName: company?.name ?? null,
    companySlug: company?.slug ?? null,
    memberId: row.member_id,
    memberName,
    memberUsername,
    memberYear,
    memberCampus,
    rating: row.rating,
    title: row.title,
    body: row.body,
    images: row.images ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    deletedByMemberId: row.deleted_by_member_id,
    authorMaskedName: maskPartnerReviewAuthorName(memberName),
    authorRoleLabel: getPartnerReviewAuthorRoleLabel(memberYear),
    isHidden: row.hidden_at !== null,
    imageCount: (row.images ?? []).length,
  };
}

function applyAdminReviewFilters(
  reviews: AdminReviewRecord[],
  filters: AdminReviewFilters,
) {
  const memberQuery = filters.memberQuery.trim().toLowerCase();
  const ratingValue = filters.rating === "all" ? null : Number(filters.rating);

  return reviews.filter((review) => {
    if (filters.status === "visible" && review.isHidden) {
      return false;
    }
    if (filters.status === "hidden" && !review.isHidden) {
      return false;
    }
    if (filters.companyId && review.companyId !== filters.companyId) {
      return false;
    }
    if (filters.partnerId && review.partnerId !== filters.partnerId) {
      return false;
    }
    if (ratingValue !== null && review.rating !== ratingValue) {
      return false;
    }
    if (filters.imagesOnly && review.imageCount === 0) {
      return false;
    }
    if (memberQuery) {
      const searchable = `${review.memberName} ${review.memberUsername ?? ""} ${review.partnerName} ${review.companyName ?? ""}`.toLowerCase();
      if (!searchable.includes(memberQuery)) {
        return false;
      }
    }
    return true;
  });
}

async function fetchAllAdminReviewRows(sort: AdminReviewSort) {
  const supabase = getSupabaseAdminClient();
  const rows: AdminReviewRow[] = [];
  const pageSize = 100;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("partner_reviews")
      .select(REVIEW_SELECT)
      .is("deleted_at", null)
      .order("created_at", { ascending: sort === "oldest" })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(error.message);
    }

    const pageRows = (data ?? []) as unknown as AdminReviewRow[];
    rows.push(...pageRows);
    if (pageRows.length < pageSize) {
      break;
    }
    offset += pageSize;
  }

  return rows.map(mapAdminReviewRow);
}

export async function getAdminReviewCounts(): Promise<AdminReviewCounts> {
  const supabase = getSupabaseAdminClient();
  const [totalResult, visibleResult, hiddenResult] = await Promise.all([
    supabase
      .from("partner_reviews")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
    supabase
      .from("partner_reviews")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .is("hidden_at", null),
    supabase
      .from("partner_reviews")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .not("hidden_at", "is", null),
  ]);

  return {
    totalCount: totalResult.error ? 0 : totalResult.count ?? 0,
    visibleCount: visibleResult.error ? 0 : visibleResult.count ?? 0,
    hiddenCount: hiddenResult.error ? 0 : hiddenResult.count ?? 0,
  };
}

export async function getAdminReviewPageData(
  input: AdminReviewFilters,
): Promise<AdminReviewPageData> {
  const supabase = getSupabaseAdminClient();
  const [companiesResult, partnersResult, counts, reviews] = await Promise.all([
    supabase
      .from("partner_companies")
      .select("id,name,slug")
      .order("name", { ascending: true }),
    supabase
      .from("partners")
      .select("id,name,company_id,company:partner_companies(id,name,slug)")
      .order("name", { ascending: true }),
    getAdminReviewCounts(),
    fetchAllAdminReviewRows(input.sort),
  ]);

  const companies = (companiesResult.data ?? []) as AdminReviewCompanyOption[];
  const partners = ((partnersResult.data ?? []) as unknown as AdminReviewPartnerRow[]).map(
    (partner) => {
      const company = getSingleRelation(partner.company);
      return {
        id: partner.id,
        name: partner.name,
        companyId: partner.company_id ?? null,
        companyName: company?.name ?? null,
        companySlug: company?.slug ?? null,
      };
    },
  );

  const filteredReviews = applyAdminReviewFilters(reviews, input);

  return {
    counts,
    reviews: filteredReviews,
    companies,
    partners,
    filters: input,
  };
}

export function getAdminReviewSortOptions() {
  return [
    { value: "latest" as const, label: "최신순" },
    { value: "oldest" as const, label: "오래된 순" },
  ];
}

export function getAdminReviewStatusOptions() {
  return [
    { value: "all" as const, label: "전체 상태" },
    { value: "visible" as const, label: "공개" },
    { value: "hidden" as const, label: "비공개" },
  ];
}

export function getAdminReviewRatingOptions() {
  return [
    { value: "all" as const, label: "전체 별점" },
    { value: "5" as const, label: "5점" },
    { value: "4" as const, label: "4점" },
    { value: "3" as const, label: "3점" },
    { value: "2" as const, label: "2점" },
    { value: "1" as const, label: "1점" },
  ];
}
