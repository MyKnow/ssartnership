export type MMUser = {
  id: string;
  username: string;
  nickname?: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  is_bot?: boolean;
};

export class MattermostApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "MattermostApiError";
    this.status = status;
  }
}

export type StudentChannelConfig = {
  teamName: string;
  channelName: string;
};

export type SelectableStudentMatch = {
  year: number;
  senderToken: string;
  user: MMUser;
  channelConfig: StudentChannelConfig;
};
