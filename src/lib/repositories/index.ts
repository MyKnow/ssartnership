import { MockPartnerRepository } from "@/lib/repositories/mock/partner-repository.mock";
import { SupabasePartnerRepository } from "@/lib/repositories/supabase/partner-repository.supabase";
import type { PartnerRepository } from "@/lib/repositories/partner-repository";

const dataSource = process.env.NEXT_PUBLIC_DATA_SOURCE;
const hasSupabaseEnv =
  !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

const repository: PartnerRepository =
  dataSource === "mock" || !hasSupabaseEnv
    ? new MockPartnerRepository()
    : new SupabasePartnerRepository();

export const partnerRepository = repository;
