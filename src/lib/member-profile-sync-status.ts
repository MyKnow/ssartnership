export type MemberProfileSyncStatus =
  | "updated"
  | "unchanged"
  | "profilePhotoSkipped"
  | "updatedWithProfilePhotoSkipped";

export function resolveMemberProfileSyncStatus(input: {
  updated: boolean;
  imageSkipped: boolean;
}): MemberProfileSyncStatus {
  if (input.imageSkipped) {
    return input.updated
      ? "updatedWithProfilePhotoSkipped"
      : "profilePhotoSkipped";
  }

  return input.updated ? "updated" : "unchanged";
}
