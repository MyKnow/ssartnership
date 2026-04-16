import { mmFetch } from "./client.ts";
import type { MMUser } from "./types.ts";

export async function loginWithPassword(loginId: string, password: string) {
  const response = await mmFetch("/api/v4/users/login", {
    method: "POST",
    body: JSON.stringify({ login_id: loginId, password }),
  });

  if (!response.ok) {
    throw new Error("MM 로그인 실패");
  }

  const user = (await response.json()) as MMUser;
  const token =
    response.headers.get("Token") ||
    response.headers.get("token") ||
    response.headers.get("Authorization")?.replace("Bearer ", "") ||
    "";

  if (!token) {
    throw new Error("MM 토큰을 가져올 수 없습니다.");
  }

  return { token, user };
}

export async function getMe(token: string) {
  const response = await mmFetch("/api/v4/users/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error("MM 사용자 조회 실패");
  }
  return (await response.json()) as MMUser;
}
