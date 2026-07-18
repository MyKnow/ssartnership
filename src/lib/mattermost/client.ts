import { getMattermostBaseUrl } from "@/lib/mattermost-senders/config";
import type { MattermostSenderCredentials } from "@/lib/mattermost-senders/crypto";

const DEFAULT_TIMEOUT_MS = 10_000;

export type MattermostApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limited"
  | "unavailable"
  | "timeout"
  | "invalid_response"
  | "request_rejected";

export class MattermostApiError extends Error {
  readonly code: MattermostApiErrorCode;
  readonly status: number | null;

  constructor(code: MattermostApiErrorCode, status: number | null = null) {
    super(code);
    this.name = "MattermostApiError";
    this.code = code;
    this.status = status;
  }
}

export type MattermostUser = {
  id: string;
  username: string;
  nickname: string;
  firstName: string;
  lastName: string;
  deleteAt: number;
};

export type MattermostUserImage = {
  contentType: string;
  bytes: Buffer;
};

type MattermostApiUser = {
  id?: unknown;
  username?: unknown;
  nickname?: unknown;
  first_name?: unknown;
  last_name?: unknown;
  delete_at?: unknown;
};

function toMattermostUser(value: unknown): MattermostUser {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new MattermostApiError("invalid_response");
  }

  const user = value as MattermostApiUser;
  if (typeof user.id !== "string" || !user.id || typeof user.username !== "string") {
    throw new MattermostApiError("invalid_response");
  }
  if (
    user.delete_at !== undefined
    && (typeof user.delete_at !== "number" || !Number.isFinite(user.delete_at))
  ) {
    // Lifecycle changes are destructive. A malformed explicit value must not
    // be silently interpreted as an active account.
    throw new MattermostApiError("invalid_response");
  }

  return {
    id: user.id,
    username: user.username,
    nickname: typeof user.nickname === "string" ? user.nickname : "",
    firstName: typeof user.first_name === "string" ? user.first_name : "",
    lastName: typeof user.last_name === "string" ? user.last_name : "",
    deleteAt: user.delete_at ?? 0,
  };
}

function getResponseErrorCode(response: Response): MattermostApiErrorCode {
  if (response.status === 401) return "unauthorized";
  if (response.status === 403) return "forbidden";
  if (response.status === 404) return "not_found";
  if (response.status === 429) return "rate_limited";
  if (response.status >= 500) return "unavailable";
  return "request_rejected";
}

function readToken(response: Response) {
  const token = response.headers.get("Token")
    ?? response.headers.get("token")
    ?? response.headers.get("Authorization")?.replace(/^Bearer\s+/i, "")
    ?? "";
  return token.trim();
}

function toPathSegment(value: string) {
  return encodeURIComponent(value.trim());
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new MattermostApiError("invalid_response", response.status);
  }
}

export class MattermostAuthenticatedSession {
  private readonly client: MattermostClient;
  private readonly token: string;
  readonly user: MattermostUser;

  constructor(
    client: MattermostClient,
    token: string,
    user: MattermostUser,
  ) {
    this.client = client;
    this.token = token;
    this.user = user;
  }

  getUserById(userId: string) {
    return this.client.getUserById(this.token, userId);
  }

  getUserByUsername(username: string) {
    return this.client.getUserByUsername(this.token, username);
  }

  getUserImage(userId: string) {
    return this.client.getUserImage(this.token, userId);
  }

  getTeamByName(teamName: string) {
    return this.client.getTeamByName(this.token, teamName);
  }

  getChannelByName(teamId: string, channelName: string) {
    return this.client.getChannelByName(this.token, teamId, channelName);
  }

  getChannelMember(channelId: string, userId: string) {
    return this.client.getChannelMember(this.token, channelId, userId);
  }

  listChannelMemberUserIds(channelId: string, page = 0, perPage = 200) {
    return this.client.listChannelMemberUserIds(this.token, channelId, page, perPage);
  }

  sendDirectMessage(targetUserId: string, message: string) {
    return this.client.sendDirectMessage(this.token, this.user.id, targetUserId, message);
  }
}

export class MattermostClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(
    baseUrl = getMattermostBaseUrl(),
    timeoutMs = DEFAULT_TIMEOUT_MS,
  ) {
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
  }

  async withAuthenticatedSender<T>(
    credentials: MattermostSenderCredentials,
    operation: (session: MattermostAuthenticatedSession) => Promise<T>,
  ) {
    const { token, user } = await this.login(credentials);
    try {
      return await operation(new MattermostAuthenticatedSession(this, token, user));
    } finally {
      await this.logout(token);
    }
  }

  private async request(path: string, init: RequestInit = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...(init.headers ?? {}),
        },
        cache: "no-store",
      });
    } catch (error) {
      if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
        throw new MattermostApiError("timeout");
      }
      throw new MattermostApiError("unavailable");
    } finally {
      clearTimeout(timeout);
    }
  }

  private async login(credentials: MattermostSenderCredentials) {
    const response = await this.request("/api/v4/users/login", {
      method: "POST",
      body: JSON.stringify({
        login_id: credentials.loginId,
        password: credentials.password,
      }),
    });
    if (!response.ok) {
      throw new MattermostApiError(getResponseErrorCode(response), response.status);
    }

    const token = readToken(response);
    if (!token) {
      throw new MattermostApiError("invalid_response", response.status);
    }
    return {
      token,
      user: toMattermostUser(await parseJson(response)),
    };
  }

  private async logout(token: string) {
    try {
      await this.request("/api/v4/users/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // Cleanup is best effort. The session token is never retained or logged.
    }
  }

  async getUserById(token: string, userId: string) {
    const response = await this.request(`/api/v4/users/${toPathSegment(userId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new MattermostApiError(getResponseErrorCode(response), response.status);
    }
    return toMattermostUser(await parseJson(response));
  }

  async getUserByUsername(token: string, username: string) {
    const response = await this.request(
      `/api/v4/users/username/${toPathSegment(username.replace(/^@/, ""))}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok) {
      throw new MattermostApiError(getResponseErrorCode(response), response.status);
    }
    return toMattermostUser(await parseJson(response));
  }

  async getUserImage(token: string, userId: string): Promise<MattermostUserImage> {
    const response = await this.request(`/api/v4/users/${toPathSegment(userId)}/image`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new MattermostApiError(getResponseErrorCode(response), response.status);
    }
    return {
      contentType: response.headers.get("content-type")?.split(";")[0]?.trim() || "image/png",
      bytes: Buffer.from(await response.arrayBuffer()),
    };
  }

  async getTeamByName(token: string, teamName: string) {
    const response = await this.request(`/api/v4/teams/name/${toPathSegment(teamName)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new MattermostApiError(getResponseErrorCode(response), response.status);
    }
    const payload = await parseJson(response);
    const id = payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as { id?: unknown }).id
      : null;
    if (typeof id !== "string" || !id) {
      throw new MattermostApiError("invalid_response", response.status);
    }
    return { id };
  }

  async getChannelByName(token: string, teamId: string, channelName: string) {
    const response = await this.request(
      `/api/v4/teams/${toPathSegment(teamId)}/channels/name/${toPathSegment(channelName)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok) {
      throw new MattermostApiError(getResponseErrorCode(response), response.status);
    }
    const payload = await parseJson(response);
    const id = payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as { id?: unknown }).id
      : null;
    if (typeof id !== "string" || !id) {
      throw new MattermostApiError("invalid_response", response.status);
    }
    return { id };
  }

  async getChannelMember(token: string, channelId: string, userId: string) {
    const response = await this.request(
      `/api/v4/channels/${toPathSegment(channelId)}/members/${toPathSegment(userId)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new MattermostApiError(getResponseErrorCode(response), response.status);
    }
    return { userId };
  }

  async listChannelMemberUserIds(
    token: string,
    channelId: string,
    page: number,
    perPage: number,
  ) {
    if (!Number.isSafeInteger(page) || page < 0 || !Number.isSafeInteger(perPage) || perPage < 1 || perPage > 200) {
      throw new MattermostApiError("request_rejected");
    }

    const response = await this.request(
      `/api/v4/channels/${toPathSegment(channelId)}/members?page=${page}&per_page=${perPage}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok) {
      throw new MattermostApiError(getResponseErrorCode(response), response.status);
    }

    const payload = await parseJson(response);
    if (!Array.isArray(payload)) {
      throw new MattermostApiError("invalid_response", response.status);
    }

    const userIds = payload.map((member) => {
      if (!member || typeof member !== "object" || Array.isArray(member)) {
        throw new MattermostApiError("invalid_response", response.status);
      }
      const userId = (member as { user_id?: unknown }).user_id;
      if (typeof userId !== "string" || !userId) {
        throw new MattermostApiError("invalid_response", response.status);
      }
      return userId;
    });

    return [...new Set(userIds)];
  }

  async sendDirectMessage(
    token: string,
    senderUserId: string,
    targetUserId: string,
    message: string,
  ) {
    const channelResponse = await this.request("/api/v4/channels/direct", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify([senderUserId, targetUserId]),
    });
    if (!channelResponse.ok) {
      throw new MattermostApiError(getResponseErrorCode(channelResponse), channelResponse.status);
    }
    const channelPayload = await parseJson(channelResponse);
    const channelId = channelPayload && typeof channelPayload === "object" && !Array.isArray(channelPayload)
      ? (channelPayload as { id?: unknown }).id
      : null;
    if (typeof channelId !== "string" || !channelId) {
      throw new MattermostApiError("invalid_response", channelResponse.status);
    }

    const postResponse = await this.request("/api/v4/posts", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ channel_id: channelId, message }),
    });
    if (!postResponse.ok) {
      throw new MattermostApiError(getResponseErrorCode(postResponse), postResponse.status);
    }
    const postPayload = await parseJson(postResponse);
    const postId = postPayload && typeof postPayload === "object" && !Array.isArray(postPayload)
      ? (postPayload as { id?: unknown }).id
      : null;
    if (typeof postId !== "string" || !postId) {
      throw new MattermostApiError("invalid_response", postResponse.status);
    }
    return { id: postId };
  }
}
