import { useEffect, useMemo, useState } from "react";
import {
  collection,
  DocumentData,
  onSnapshot,
  orderBy,
  Query,
  query,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAppSelector } from "../app/hooks";
interface Channels {

  id: string;
  channel: DocumentData;
}
const useChannel = () => {
  const [documents, setDocuments] = useState<Channels[]>([]);
  const serverId = useAppSelector((state) => state.server.serverId)

  const collectionRef: Query<DocumentData> | null = useMemo(
    () =>  serverId === null ? null : query(collection(db, "servers", serverId, "channels"),orderBy("timestamp", "asc")),
    [serverId]
  );
  useEffect(() => {
    if(collectionRef) {
      onSnapshot(collectionRef, (querySnapshot) => {
        const channelsResults: Channels[] = [];
        querySnapshot.docs.forEach((doc) =>
          channelsResults.push({
            id: doc.id,
            channel: doc.data(),
          })
        );
        setDocuments(channelsResults);
      });
    }
  }, [collectionRef]);
  return { documents };
};

export default useChannel;
