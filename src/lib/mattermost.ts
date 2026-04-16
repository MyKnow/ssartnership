export type {
  MMUser,
  SelectableStudentMatch,
  StudentChannelConfig,
} from "@/lib/mattermost/types";
export { MattermostApiError } from "@/lib/mattermost/types";
export { getStudentChannelConfig, getSenderCredentials } from "@/lib/mattermost/config";
export {
  loginWithPassword,
  getMe,
} from "@/lib/mattermost/auth";
export {
  createDirectChannel,
  sendPost,
  getTeamByName,
  getChannelByName,
  getChannelMember,
  listChannelMembers,
  findUserInChannelByUserId,
  findUserInChannelByUsername,
} from "@/lib/mattermost/channels";
export {
  getUserImage,
  getUserById,
  getUserByUsername,
} from "@/lib/mattermost/users";
export {
  resolveSelectableMemberByUsername,
  resolveSelectableStudentByUsername,
} from "@/lib/mattermost/resolver";
