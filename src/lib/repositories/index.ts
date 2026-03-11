import { MockPartnerRepository } from "@/lib/repositories/mock/partner-repository.mock";
import { SupabasePartnerRepository } from "@/lib/repositories/supabase/partner-repository.supabase";
import type { PartnerRepository } from "@/lib/repositories/partner-repository";

const dataSource = process.env.NEXT_PUBLIC_DATA_SOURCE;

const repository: PartnerRepository =
  dataSource === "supabase"
    ? new SupabasePartnerRepository()
    : new MockPartnerRepository();

export const partnerRepository = repository;
