import { mmFetch, toMattermostApiError } from "./client.ts";
import type { MMUser } from "./types.ts";

export async function getUserImage(
  token: string,
  userId: string,
): Promise<{ contentType: string; base64: string } | null> {
  const response = await mmFetch(`/api/v4/users/${userId}/image`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    return null;
  }
  const contentType = response.headers.get("content-type") ?? "image/png";
  const buffer = Buffer.from(await response.arrayBuffer());
  return { contentType, base64: buffer.toString("base64") };
}

export async function getUserById(token: string, userId: string) {
  const response = await mmFetch(`/api/v4/users/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.ok) {
    return (await response.json()) as MMUser;
  }
  if (response.status === 404) {
    return null;
  }
  throw toMattermostApiError(response, "MM 사용자 조회 실패");
}

export async function getUserByUsername(token: string, username: string) {
  const safe = username.replace(/^@/, "").trim();
  const response = await mmFetch(`/api/v4/users/username/${safe}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.ok) {
    return (await response.json()) as MMUser;
  }
  if (response.status === 404) {
    return null;
  }
  throw toMattermostApiError(response, "MM 사용자 조회 실패");
}
