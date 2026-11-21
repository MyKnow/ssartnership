function getSafeFileExtension(name: string) {
  const suffix = name.trim().toLowerCase().match(/\.([a-z0-9]{1,8})$/)?.[1];
  return suffix ? `.${suffix}` : ".source";
}

export function buildStagingPath(id: string, fileName: string) {
  return `staging/${id}${getSafeFileExtension(fileName)}`;
}

export function buildProcessedPath(id: string) {
  return `processed/${id}.webp`;
}
