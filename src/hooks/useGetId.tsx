import { collection, query, onSnapshot} from "firebase/firestore";
import { db } from "../firebase";
import { useChannelStore } from "../stores/channelSlice";
import { useServerStore } from "../stores/serverSlice";
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
  const channelId = useChannelStore((state) => state.channelId);
  const serverId = useServerStore((state) => state.serverId);
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
