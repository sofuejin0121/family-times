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
import { Server as ServerDoc } from "../types/server";
import { Timestamp } from "firebase/firestore";

interface Server {
  id: string;
  server: {
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
  };
}

//サーバー一覧を取得するカスタムフック
const useServer = () => {
  //サーバー情報を格納するstate
  const [documents, setDocuments] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true); // ローディング状態を追加@imageUtils.ts 
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
    if (collectionRef === null) {
      setLoading(false);
      return;
    }

    setLoading(true); // データ取得開始時にローディング状態をtrueに設定

    const unsubscribe = onSnapshot(
      collectionRef,
      (querySnapshot) => {
        const serverResults: Server[] = [];
        querySnapshot.docs.forEach((doc) => {
          const data = doc.data() as ServerDoc;
          serverResults.push({
            id: doc.id,
            server: {
              name: data.name,
              imageUrl: data.imageUrl,
              photoId: data.photoId,
              photoExtension: data.photoExtension,
              createdAt: data.createdAt,
              createdBy: data.createdBy,
              members: data.members,
            },
          });
        });
        setDocuments(serverResults);
        setLoading(false); // データ取得完了時にローディング状態をfalseに設定
      },
      (error) => {
        console.error("Error fetching servers:", error);
        setLoading(false); // エラー時もローディング状態をfalseに設定
      }
    );

    return () => unsubscribe();
  }, [collectionRef]);

  return { documents, loading }; // loadingステータスを返す
};

export default useServer;
