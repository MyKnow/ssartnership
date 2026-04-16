import { mmFetch, toMattermostApiError } from "./client.ts";
import type { StudentChannelConfig } from "./types.ts";
import { getUserById, getUserByUsername, getUserImage } from "./users.ts";

export { getUserImage };

export async function createDirectChannel(
  token: string,
  userId: string,
  targetUserId: string,
) {
  const response = await mmFetch("/api/v4/channels/direct", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify([userId, targetUserId]),
  });
  if (!response.ok) {
    throw new Error("DM 채널 생성 실패");
  }
  return response.json() as Promise<{ id: string }>;
}

export async function sendPost(
  token: string,
  channelId: string,
  message: string,
) {
  const response = await mmFetch("/api/v4/posts", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ channel_id: channelId, message }),
  });
  if (!response.ok) {
    throw new Error("메시지 전송 실패");
  }
  return response.json() as Promise<{ id: string }>;
}

export async function getTeamByName(token: string, teamName: string) {
  const response = await mmFetch(`/api/v4/teams/name/${teamName}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw toMattermostApiError(response, "MM 팀 조회 실패");
  }
  return response.json() as Promise<{ id: string }>;
}

export async function getChannelByName(
  token: string,
  teamId: string,
  channelName: string,
) {
  const response = await mmFetch(
    `/api/v4/teams/${teamId}/channels/name/${channelName}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!response.ok) {
    throw toMattermostApiError(response, "MM 채널 조회 실패");
  }
  return response.json() as Promise<{ id: string }>;
}

export async function getChannelMember(
  token: string,
  channelId: string,
  userId: string,
) {
  const response = await mmFetch(
    `/api/v4/channels/${channelId}/members/${userId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (response.ok) {
    return response.json() as Promise<{ user_id: string }>;
  }
  if (response.status === 404) {
    return null;
  }
  throw toMattermostApiError(response, "MM 채널 멤버 조회 실패");
}

export async function listChannelMembers(
  token: string,
  channelId: string,
  page = 0,
  perPage = 200,
) {
  const response = await mmFetch(
    `/api/v4/channels/${channelId}/members?page=${page}&per_page=${perPage}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!response.ok) {
    throw toMattermostApiError(response, "MM 채널 멤버 목록 조회 실패");
  }
  return response.json() as Promise<Array<{ user_id?: string; userId?: string }>>;
}

export async function findUserInChannelByUserId(
  token: string,
  userId: string,
  channelConfig: StudentChannelConfig,
) {
  const directUser = await getUserById(token, userId);
  if (!directUser) {
    return null;
  }
  const channel = await getChannelByName(
    token,
    (await getTeamByName(token, channelConfig.teamName)).id,
    channelConfig.channelName,
  );
  const membership = await getChannelMember(token, channel.id, directUser.id);
  if (!membership) {
    return null;
  }
  return directUser;
}

export async function findUserInChannelByUsername(
  token: string,
  username: string,
  channelConfig: StudentChannelConfig,
) {
  const safeUsername = username.replace(/^@/, "").trim().toLowerCase();
  const directUser = await getUserByUsername(token, safeUsername);
  if (!directUser) {
    return null;
  }
  const channel = await getChannelByName(
    token,
    (await getTeamByName(token, channelConfig.teamName)).id,
    channelConfig.channelName,
  );
  const membership = await getChannelMember(token, channel.id, directUser.id);
  if (!membership) {
    return null;
  }
  return directUser;
}
