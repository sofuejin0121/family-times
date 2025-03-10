import { Timestamp } from "firebase/firestore";

export interface Server {
  name: string;
  imageUrl?: string;
  photoId?: string;
  photoExtension?: string;
  createdAt: Timestamp;
  createdBy: string;
  members: {
    [key: string]: {
      role: string;
      joinedAt: Timestamp;
    };
  };
  invites?: {
    [key: string]: {
      createdAt: Timestamp;
      createdBy: string;
      uses: number;
    };
  };
}
