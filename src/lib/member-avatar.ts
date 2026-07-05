export type MemberAvatarInput = {
  avatarUrl?: string | null;
  avatarBase64?: string | null;
  avatarContentType?: string | null;
};

export type ResolvedMemberAvatar =
  | { kind: "redirect"; url: string }
  | {
      kind: "image";
      body: ArrayBuffer;
      byteLength: number;
      contentType: string;
    }
  | { kind: "missing" }
  | { kind: "unsupported" }
  | { kind: "invalid" };

const ALLOWED_IMAGE_CONTENT_TYPE_PATTERN =
  /^image\/(?:avif|gif|jpe?g|png|webp)$/i;

export function normalizeMemberAvatarUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function resolveMemberAvatarSource(
  input: MemberAvatarInput,
): ResolvedMemberAvatar {
  const avatarUrl = normalizeMemberAvatarUrl(input.avatarUrl);
  if (!input.avatarBase64 && avatarUrl) {
    return { kind: "redirect", url: avatarUrl };
  }

  if (!input.avatarBase64 || !input.avatarContentType) {
    return { kind: "missing" };
  }

  if (!ALLOWED_IMAGE_CONTENT_TYPE_PATTERN.test(input.avatarContentType)) {
    return { kind: "unsupported" };
  }

  try {
    const binary = Buffer.from(input.avatarBase64, "base64");
    const body = binary.buffer.slice(
      binary.byteOffset,
      binary.byteOffset + binary.byteLength,
    );

    return {
      kind: "image",
      body,
      byteLength: body.byteLength,
      contentType: input.avatarContentType,
    };
  } catch {
    return { kind: "invalid" };
  }
}
