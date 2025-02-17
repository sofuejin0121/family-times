import { useEffect, useMemo, useState } from "react";
import {
  collection,
  DocumentData,
  onSnapshot,
  Query,
  query,
} from "firebase/firestore";
import { db } from "../firebase";
interface Server {
  id: string;
  docData: DocumentData;
}
const useServer = () => {
  const [documents, setDocuments] = useState<Server[]>([]);

  const collectionRef: Query<DocumentData> = useMemo(() =>
    query(collection(db, "servers")), []
  );
  useEffect(() => {
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
