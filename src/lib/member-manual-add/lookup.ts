import { findMmUserDirectoryEntryByUserId } from "@/lib/mm-directory";
import { getMattermostDisplayName } from "@/lib/mm-member-sync/snapshot";
import { mattermostSenderRepository } from "@/lib/mattermost-senders/repository";
import { getMattermostSenderRoutingTemplate } from "@/lib/mattermost-senders/routing";
import { withActiveMattermostSenderForGeneration } from "@/lib/mattermost-senders/service";
import type { MattermostUser } from "@/lib/mattermost/client";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  type ManualMemberAddYear,
  wrapManualMemberAddDbError,
} from "./shared";

const MEMBER_SELECT =
  "id,mattermost_account_id,display_name,generation,staff_source_generation,campus,password_hash,password_salt,must_change_password,updated_at";

export type DirectManualMemberProfile = {
  mattermostUserId: string;
  username: string;
  displayName: string;
  campus: null;
  isStaff: boolean;
};

export type ManualMemberResolution = {
  requestedYear: ManualMemberAddYear;
  resolvedYear: number;
  user: MattermostUser;
  profile: DirectManualMemberProfile;
};

export type ExistingMemberRecord = {
  id: string;
  mattermost_account_id: string | null;
  display_name: string | null;
  generation: number | null;
  staff_source_generation: number | null;
  campus: string | null;
  password_hash: string | null;
  password_salt: string | null;
  must_change_password: boolean | null;
  updated_at: string | null;
};

function toProfile(user: MattermostUser, isStaff: boolean): DirectManualMemberProfile {
  return {
    mattermostUserId: user.id,
    username: user.username,
    displayName: getMattermostDisplayName(user),
    campus: null,
    isStaff,
  };
}

async function getActiveSenderGenerations() {
  const metadata = await mattermostSenderRepository.listMetadata();
  return metadata
    .filter((sender) => sender.status === "active")
    .map((sender) => sender.generation)
    .sort((left, right) => right - left);
}

async function findUserInGeneration(input: {
  username: string;
  generation: number;
  isStaff: boolean;
}) {
  return withActiveMattermostSenderForGeneration(input.generation, async (session) => {
    const user = await session.getUserByUsername(input.username);
    const template = getMattermostSenderRoutingTemplate(input.generation);
    const team = await session.getTeamByName(template.teamName);
    const channel = await session.getChannelByName(team.id, template.channelName);
    const membership = await session.getChannelMember(channel.id, user.id);
    if (!membership) {
      return null;
    }
    return {
      requestedYear: input.isStaff ? 0 : input.generation,
      resolvedYear: input.generation,
      user,
      profile: toProfile(user, input.isStaff),
    } satisfies ManualMemberResolution;
  });
}

export async function resolveManualMemberResolution(
  username: string,
  requestedYear: ManualMemberAddYear,
): Promise<ManualMemberResolution | null> {
  const activeGenerations = requestedYear === 0
    ? await getActiveSenderGenerations()
    : [requestedYear];

  for (const generation of activeGenerations) {
    try {
      const result = await findUserInGeneration({
        username,
        generation,
        isStaff: requestedYear === 0,
      });
      if (result) {
        return result;
      }
    } catch (error) {
      // A student has a single authoritative Sender. Staff may be represented
      // by several cohort channels, so continue only for a safe not-found.
      if (requestedYear !== 0) {
        throw error;
      }
    }
  }
  return null;
}

export async function findExistingMemberByMmUser(userId: string) {
  const directory = await findMmUserDirectoryEntryByUserId(userId);
  if (!directory?.id) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("members")
    .select(MEMBER_SELECT)
    .eq("mattermost_account_id", directory.id)
    .maybeSingle();
  if (error) {
    throw wrapManualMemberAddDbError(
      error,
      "기존 회원 정보를 불러오지 못했습니다.",
    );
  }
  return (data as ExistingMemberRecord | null) ?? null;
}
