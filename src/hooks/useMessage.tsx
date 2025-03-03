import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAppSelector } from "../app/hooks";

interface Reaction {
  emoji: string;
  users: string[]; //リアクションしたユーザーのuid配列
}

interface Messages {
  id: string;
  photoId: string;
  photoURL: string;
  timestamp: Timestamp;
  message: string;
  imageWidth?: number;
  imageHeight?: number;
  latitude?: number;
  longitude?: number;
  user: {
    uid: string;
    photo: string;
    email: string;
    displayName: string;
  };
  reactions: {
    [key: string]: Reaction; //絵文字をkeyとしたリアクションデータ
  };
}

const useMessage = () => {
  const [subDocuments, setSubDocuments] = useState<Messages[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const channelId = useAppSelector((state) => state.channel.channelId);
  const serverId = useAppSelector((state) => state.server.serverId);

  useEffect(() => {
    if (serverId !== null && channelId !== null) {
      setIsLoading(true);
      const collectionRef = collection(
        db,
        "servers",
        serverId,
        "channels",
        String(channelId),
        "messages"
      );
      const collectionRefOrderBy = query(
        collectionRef,
        orderBy("timestamp", "asc")
      );

      const unsubscribe = onSnapshot(collectionRefOrderBy, (snapshot) => {
        const results: Messages[] = [];
        snapshot.docs.forEach((doc) => {
          results.push({
            id: doc.id,
            timestamp: doc.data().timestamp,
            message: doc.data().message,
            user: doc.data().user,
            photoId: doc.data().photoId,
            photoURL: doc.data().photoURL,
            imageWidth: doc.data().imageWidth,
            imageHeight: doc.data().imageHeight,
            latitude: doc.data().latitude,
            longitude: doc.data().longitude,
            reactions: doc.data().reactions || {},
          });
        });
        setSubDocuments(results);
        setIsLoading(false);
      });
      
      return () => unsubscribe();
    }
  }, [channelId, serverId]);

  return { subDocuments, isLoading };
};

export default useMessage;
