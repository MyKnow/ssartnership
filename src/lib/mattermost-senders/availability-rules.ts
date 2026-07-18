function positiveSafeGenerations(values: readonly number[]) {
  return values.filter(
    (generation) => Number.isSafeInteger(generation) && generation > 0 && generation <= 99,
  );
}

export function getMattermostSenderGenerationOptions(input: {
  activeSenderGenerations: readonly number[];
  configuredSenderGenerations?: readonly number[];
  selectableSenderGenerations?: readonly number[];
}) {
  return [
    0,
    ...new Set([
      ...positiveSafeGenerations(input.activeSenderGenerations),
      ...positiveSafeGenerations(input.configuredSenderGenerations ?? []),
      ...positiveSafeGenerations(input.selectableSenderGenerations ?? []),
    ]),
  ].sort((left, right) => left - right);
}

export function isMattermostSenderGenerationAvailable(
  generation: number,
  activeSenderGenerations: readonly number[],
) {
  if (!Number.isSafeInteger(generation) || generation < 0) {
    return false;
  }

  const hasActiveGeneration = activeSenderGenerations.some(
    (activeGeneration) => Number.isSafeInteger(activeGeneration) && activeGeneration > 0,
  );

  return generation === 0
    ? hasActiveGeneration
    : activeSenderGenerations.includes(generation);
}
