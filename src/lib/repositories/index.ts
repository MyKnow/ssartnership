import { MockPartnerRepository } from "@/lib/repositories/mock/partner-repository.mock";
import { MockNotificationRepository } from "@/lib/repositories/mock/notification-repository.mock";
import { MockPartnerFavoriteRepository } from "@/lib/repositories/mock/partner-favorite-repository.mock";
import { MockPartnerReviewRepository } from "@/lib/repositories/mock/partner-review-repository.mock";
import { MockAdPackageRepository } from "@/lib/repositories/mock/ad-package-repository.mock";
import { MockPartnerBenefitUsageRepository } from "@/lib/repositories/mock/partner-benefit-usage-repository.mock";
import { SupabasePartnerRepository } from "@/lib/repositories/supabase/partner-repository.supabase";
import { SupabaseNotificationRepository } from "@/lib/repositories/supabase/notification-repository.supabase";
import { SupabasePartnerFavoriteRepository } from "@/lib/repositories/supabase/partner-favorite-repository.supabase";
import { SupabasePartnerReviewRepository } from "@/lib/repositories/supabase/partner-review-repository.supabase";
import { SupabaseAdPackageRepository } from "@/lib/repositories/supabase/ad-package-repository.supabase";
import { SupabasePartnerBenefitUsageRepository } from "@/lib/repositories/supabase/partner-benefit-usage-repository.supabase";
import type { PartnerRepository } from "@/lib/repositories/partner-repository";
import type { NotificationRepository } from "@/lib/repositories/notification-repository";
import type { PartnerFavoriteRepository } from "@/lib/repositories/partner-favorite-repository";
import type { PartnerReviewRepository } from "@/lib/repositories/partner-review-repository";
import type { AdPackageRepository } from "@/lib/repositories/ad-package-repository";
import type { PartnerBenefitUsageRepository } from "@/lib/repositories/partner-benefit-usage-repository";

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

const activeNotificationRepository: NotificationRepository =
  dataSource === "mock" || !hasSupabaseEnv
    ? new MockNotificationRepository()
    : new SupabaseNotificationRepository();

const favoriteRepository: PartnerFavoriteRepository =
  dataSource === "mock" || !hasSupabaseEnv
    ? new MockPartnerFavoriteRepository()
    : new SupabasePartnerFavoriteRepository();

const activeAdPackageRepository: AdPackageRepository =
  dataSource === "mock" || !hasSupabaseEnv
    ? new MockAdPackageRepository()
    : new SupabaseAdPackageRepository();

const activePartnerBenefitUsageRepository: PartnerBenefitUsageRepository =
  dataSource === "mock" || !hasSupabaseEnv
    ? new MockPartnerBenefitUsageRepository()
    : new SupabasePartnerBenefitUsageRepository();

export const partnerRepository = repository;
export const partnerReviewRepository = reviewRepository;
export const notificationRepository = activeNotificationRepository;
export const partnerFavoriteRepository = favoriteRepository;
export const adPackageRepository = activeAdPackageRepository;
export const partnerBenefitUsageRepository = activePartnerBenefitUsageRepository;
