import { Timestamp } from "firebase/firestore";

interface Server {
  name: string;
  members: {
    [userId: string]: {
      role: "admin" | "member";
      joinedAt: Timestamp;
    };
  };
  invites: {
    [inviteCode: string]: {
      createdBy: string;
      createdAt: Timestamp;
      expiresAt: Timestamp;
      active: boolean;
    };
  };
}

export type { Server };
