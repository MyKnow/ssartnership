import { logServerError } from "./server-log.ts";

export type PartnerShellCompaniesLoad<T> = {
  companies: T[];
  /** The summaries failed to load; never present this as "no companies". */
  unavailable: boolean;
};

/**
 * The partner portal shell still renders when the company summaries cannot be
 * read, but without company names and company-scoped navigation. `unavailable`
 * lets the shell show an inline notice instead of silently degrading.
 */
export async function loadPartnerShellCompanies<T>(
  companyIds: readonly string[],
  load: (companyIds: string[]) => Promise<T[]>,
): Promise<PartnerShellCompaniesLoad<T>> {
  try {
    return { companies: await load([...companyIds]), unavailable: false };
  } catch (error) {
    logServerError("[partner-layout] company summaries unavailable", error, {
      companyCount: companyIds.length,
    });
    return { companies: [], unavailable: true };
  }
}
