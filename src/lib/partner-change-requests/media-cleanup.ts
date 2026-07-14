export function collectRemovedPartnerMediaUrls(
  previousMediaUrls: string[],
  nextMediaUrls: string[],
) {
  const nextMediaUrlSet = new Set(nextMediaUrls);
  return previousMediaUrls.filter((url) => !nextMediaUrlSet.has(url));
}
