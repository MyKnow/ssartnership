type MMUser = {
  id: string;
  username: string;
  nickname?: string;
  first_name?: string;
  last_name?: string;
  position?: string;
};

function getBaseUrl() {
  const base = process.env.MM_BASE_URL;
  if (!base) {
    throw new Error("MM_BASE_URL 환경 변수가 필요합니다.");
  }
  return base.replace(/\/$/, "");
}

async function mmFetch(path: string, init: RequestInit = {}) {
  const url = `${getBaseUrl()}${path}`;
  return fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

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

export async function getUserByUsername(token: string, username: string) {
  const safe = username.replace(/^@/, "").trim();
  const response = await mmFetch(`/api/v4/users/username/${safe}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as MMUser;
}

export async function getTeamByName(token: string, teamName: string) {
  const response = await mmFetch(`/api/v4/teams/name/${teamName}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error("MM 팀 조회 실패");
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
    throw new Error("MM 채널 조회 실패");
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
  if (!response.ok) {
    return null;
  }
  return response.json() as Promise<{ user_id: string }>;
}

export async function findUserInChannelByUsername(
  token: string,
  teamName: string,
  channelName: string,
  username: string,
) {
  const safeUsername = username.replace(/^@/, "").trim().toLowerCase();
  const directUser = await getUserByUsername(token, safeUsername);
  if (!directUser) {
    return null;
  }
  const team = await getTeamByName(token, teamName);
  const channel = await getChannelByName(token, team.id, channelName);
  const membership = await getChannelMember(token, channel.id, directUser.id);
  if (!membership) {
    return null;
  }
  return directUser;
}

export function getSenderCredentials() {
  const loginId = process.env.MM_SENDER_LOGIN_ID;
  const password = process.env.MM_SENDER_PASSWORD;
  if (!loginId || !password) {
    throw new Error("MM_SENDER_LOGIN_ID/MM_SENDER_PASSWORD 환경 변수가 필요합니다.");
  }
  return { loginId, password };
}
