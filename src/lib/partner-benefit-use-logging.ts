export function buildPartnerBenefitUseLogProperties(input: {
  benefitId?: string | null;
  benefit?: string | null;
  useCount?: number | null;
}) {
  const benefitId = input.benefitId?.trim();
  const benefit = input.benefit?.trim();

  return {
    ...(benefitId ? { benefitId } : {}),
    ...(benefit ? { benefit } : {}),
    ...(Number.isSafeInteger(input.useCount) && input.useCount! >= 1
      ? { useCount: input.useCount }
      : {}),
  };
}
