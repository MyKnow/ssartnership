export type MMUser = {
  id: string;
  username: string;
  nickname?: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  is_bot?: boolean;
};

export type SelectableStudentMatch = {
  year: number;
  user: MMUser;
  directorySnapshot?: {
    mmUserId: string;
    mmUsername: string;
    displayName: string;
    campus: string | null;
    isStaff: boolean;
    sourceYears: number[];
  };
};
