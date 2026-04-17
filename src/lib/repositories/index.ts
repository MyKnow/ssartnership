import { MockPartnerRepository } from "@/lib/repositories/mock/partner-repository.mock";
import { MockPartnerReviewRepository } from "@/lib/repositories/mock/partner-review-repository.mock";
import { SupabasePartnerRepository } from "@/lib/repositories/supabase/partner-repository.supabase";
import { SupabasePartnerReviewRepository } from "@/lib/repositories/supabase/partner-review-repository.supabase";
import type { PartnerRepository } from "@/lib/repositories/partner-repository";
import type { PartnerReviewRepository } from "@/lib/repositories/partner-review-repository";

const dataSource = process.env.NEXT_PUBLIC_DATA_SOURCE;
const hasSupabaseEnv =
  !!process.env.SUPABASE_URL &&
  (!!process.env.SUPABASE_ANON_KEY || !!process.env.SUPABASE_SERVICE_ROLE_KEY);

const repository: PartnerRepository =
  dataSource === "mock" || !hasSupabaseEnv
    ? new MockPartnerRepository()
    : new SupabasePartnerRepository();

const reviewRepository: PartnerReviewRepository =
  dataSource === "mock" || !hasSupabaseEnv
    ? new MockPartnerReviewRepository()
    : new SupabasePartnerReviewRepository();

export const partnerRepository = repository;
export const partnerReviewRepository = reviewRepository;
