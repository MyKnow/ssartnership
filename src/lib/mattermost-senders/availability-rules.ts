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
