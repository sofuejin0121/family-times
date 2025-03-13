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
import { useUserStore } from "../stores/userSlice";
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
  const [loading, setLoading] = useState(true); // ローディング状態
  const user = useUserStore((state) => state.user);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false); // 初期ロード完了フラグを追加
  
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
      setInitialLoadComplete(true); // 初期ロード完了をマーク
      return;
    }

    // サーバー切り替え時に初期ロードが完了していれば、ローディング状態を変更しない
    if (!initialLoadComplete) {
      setLoading(true); // 初回のみローディング状態をtrueに設定
    }

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
        setLoading(false);
        setInitialLoadComplete(true); // データ取得完了時に初期ロード完了をマーク
      },
      (error) => {
        console.error("Error fetching servers:", error);
        setLoading(false);
        setInitialLoadComplete(true); // エラー時も初期ロード完了をマーク
      }
    );

    return () => unsubscribe();
  }, [collectionRef, initialLoadComplete]);

  return { documents, loading, initialLoadComplete }; // 初期ロード完了フラグも返す
};

export default useServer;
