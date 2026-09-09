import { MockPartnerRepository } from "@/lib/repositories/mock/partner-repository.mock";
import { MockNotificationRepository } from "@/lib/repositories/mock/notification-repository.mock";
import { MockPartnerFavoriteRepository } from "@/lib/repositories/mock/partner-favorite-repository.mock";
import { MockPartnerReviewRepository } from "@/lib/repositories/mock/partner-review-repository.mock";
import { MockAdPackageRepository } from "@/lib/repositories/mock/ad-package-repository.mock";
import {
  MOCK_PARTNER_BENEFIT_USAGE_CONTEXTS,
  MockPartnerBenefitUsageRepository,
} from "@/lib/repositories/mock/partner-benefit-usage-repository.mock";
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
import {
  createUnavailableDataAccessProxy,
  selectRuntimeDataAccess,
} from "@/lib/runtime-data-access";

export const repositoryDataAccess = selectRuntimeDataAccess({
  capability: "admin",
});

function createActiveRepository<T extends object>(
  createMockRepository: () => T,
  createSupabaseRepository: () => T,
) {
  if (repositoryDataAccess.source === "mock") {
    return createMockRepository();
  }
  if (repositoryDataAccess.source === "supabase") {
    return createSupabaseRepository();
  }
  return createUnavailableDataAccessProxy<T>(repositoryDataAccess);
}

const repository = createActiveRepository<PartnerRepository>(
  () => new MockPartnerRepository(),
  () => new SupabasePartnerRepository(),
);

const reviewRepository = createActiveRepository<PartnerReviewRepository>(
  () => new MockPartnerReviewRepository(),
  () => new SupabasePartnerReviewRepository(),
);

const activeNotificationRepository = createActiveRepository<NotificationRepository>(
  () => new MockNotificationRepository(),
  () => new SupabaseNotificationRepository(),
);

const favoriteRepository = createActiveRepository<PartnerFavoriteRepository>(
  () => new MockPartnerFavoriteRepository(),
  () => new SupabasePartnerFavoriteRepository(),
);

const activeAdPackageRepository = createActiveRepository<AdPackageRepository>(
  () => new MockAdPackageRepository(),
  () => new SupabaseAdPackageRepository(),
);

const activePartnerBenefitUsageRepository =
  createActiveRepository<PartnerBenefitUsageRepository>(
    () =>
      new MockPartnerBenefitUsageRepository(
        MOCK_PARTNER_BENEFIT_USAGE_CONTEXTS,
      ),
    () => new SupabasePartnerBenefitUsageRepository(),
  );

export const partnerRepository = repository;
export const partnerReviewRepository = reviewRepository;
export const notificationRepository = activeNotificationRepository;
export const partnerFavoriteRepository = favoriteRepository;
export const adPackageRepository = activeAdPackageRepository;
export const partnerBenefitUsageRepository = activePartnerBenefitUsageRepository;
