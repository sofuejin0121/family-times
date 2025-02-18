import { collection, query, onSnapshot} from "firebase/firestore";
import { db } from "../firebase";
import { useAppSelector } from "../app/hooks";
import { useEffect, useState } from "react";

interface GetIds {
    user :{
        uid: string
        photo: string
        displayName: string
    }
}

const useGetId = () => {
  const [documents, setDocuments] = useState<GetIds[]>([]);
  const channelId = useAppSelector((state) => state.channel.channelId);
  const serverId = useAppSelector((state) => state.server.serverId);
  useEffect(() => {
    if (serverId !== null && channelId !== null) {
      const getIdRef = query(
        collection(
          db,
          "servers",
          serverId,
          "channels",
          String(channelId),
          "messages"
        )
      );
      onSnapshot(getIdRef, (snapshot) => {
        const idResults: GetIds[] = [];
        snapshot.docs.forEach((doc) => {
          idResults.push({
            user: doc.data().user
          });
        });
        setDocuments(idResults);
      });
    }
  }, [channelId, serverId]);
  return { documents };
};
export default useGetId;
