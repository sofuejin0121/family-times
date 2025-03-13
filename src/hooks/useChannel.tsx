import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  DocumentData,
  onSnapshot,
  orderBy,
  Query,
  query,
} from "firebase/firestore";
import { db } from "../firebase";
import { useChannelStore } from '../stores/channelSlice';
import { useServerStore } from '../stores/serverSlice';

interface Channels {
  id: string;
  channel: DocumentData;
}

const useChannel = () => {
  const [documents, setDocuments] = useState<Channels[]>([]);
  const serverId = useServerStore((state) => state.serverId);
  const currentChannelId = useChannelStore((state) => state.channelId);
  const setChannelInfo = useChannelStore((state) => state.setChannelInfo);
  
  // 前回のサーバーIDを記録するためのref
  const prevServerIdRef = useRef<string | null>(null);

  const collectionRef: Query<DocumentData> | null = useMemo(
    () => serverId === null ? null : query(collection(db, "servers", serverId, "channels"), orderBy("timestamp", "asc")),
    [serverId]
  );

  // サーバーIDが変更されたかどうかを検出
  useEffect(() => {
    // サーバーIDが変更された場合
    if (serverId !== prevServerIdRef.current) {
      // チャンネル情報をリセット
      useChannelStore.getState().resetChannelInfo();
      // 現在のサーバーIDを保存
      prevServerIdRef.current = serverId;
    }
  }, [serverId]);

  useEffect(() => {
    if (collectionRef) {
      const unsubscribe = onSnapshot(collectionRef, (querySnapshot) => {
        const channelsResults: Channels[] = [];
        querySnapshot.docs.forEach((doc) =>
          channelsResults.push({
            id: doc.id,
            channel: doc.data(),
          })
        );
        setDocuments(channelsResults);
        
        // チャンネルが存在し、かつチャンネルが選択されていない場合は
        // 最初のチャンネルを選択する
        if (channelsResults.length > 0 && !currentChannelId) {
          setChannelInfo({
            channelId: channelsResults[0].id,
            channelName: channelsResults[0].channel.channelName,
          });
        } else if (currentChannelId) {
          // 現在のサーバーに選択中のチャンネルIDが存在するか確認
          const selectedChannel = channelsResults.find(ch => ch.id === currentChannelId);
          if (selectedChannel) {
            // 存在する場合は情報を更新
            setChannelInfo({
              channelId: currentChannelId,
              channelName: selectedChannel.channel.channelName,
            });
          } else if (channelsResults.length > 0) {
            // 存在しない場合は最初のチャンネルを選択
            setChannelInfo({
              channelId: channelsResults[0].id,
              channelName: channelsResults[0].channel.channelName,
            });
          }
        }
      });

      return () => unsubscribe();
    }
  }, [collectionRef, currentChannelId, setChannelInfo]);

  return { documents };
};

export default useChannel;
