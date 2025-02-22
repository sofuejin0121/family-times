import { useEffect, useMemo, useState } from "react";
import {
  collection,
  DocumentData,
  onSnapshot,
  Query,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAppSelector } from "../app/hooks";
interface Server {
  id: string;
  docData: DocumentData;
}
//サーバー一覧を取得するカスタムフック
const useServer = () => {
  //サーバー情報を格納するstate
  const [documents, setDocuments] = useState<Server[]>([]);
  const user = useAppSelector((state) => state.user.user);
  const collectionRef: Query<DocumentData> | null = useMemo(() => {
    if (user !== null) {
      return query(
        collection(db, "servers"),
        where(`members.${user.uid}`, "!=", null)
      );
    }
    return null;
  }, [user]);
  useEffect(() => {
    if (collectionRef === null) return;
    onSnapshot(collectionRef, (querySnapshot) => {
      const serverResults: Server[] = [];
      querySnapshot.docs.forEach((doc) =>
        serverResults.push({
          id: doc.id,
          docData: doc.data(),
        })
      );
      setDocuments(serverResults);
    });
  }, [collectionRef]);
  return { documents };
};

export default useServer;
