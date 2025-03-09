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
import { useAppSelector, useAppDispatch } from "../app/hooks";
import { setChannelInfo } from '../features/channelSlice';
import { store } from "../app/store";

interface Channels {
  id: string;
  channel: DocumentData;
}

const useChannel = () => {
  const [documents, setDocuments] = useState<Channels[]>([]);
  const serverId = useAppSelector((state) => state.server.serverId);
  const dispatch = useAppDispatch();

  const collectionRef: Query<DocumentData> | null = useMemo(
    () => serverId === null ? null : query(collection(db, "servers", serverId, "channels"), orderBy("timestamp", "asc")),
    [serverId]
  );

  useEffect(() => {
    if (collectionRef) {
      onSnapshot(collectionRef, (querySnapshot) => {
        const channelsResults: Channels[] = [];
        querySnapshot.docs.forEach((doc) =>
          channelsResults.push({
            id: doc.id,
            channel: doc.data(),
          })
        );
        setDocuments(channelsResults);

        // 現在選択中のチャンネルIDを取得
        const currentChannelId = store.getState().channel.channelId;
        
        // サーバーが変更されたときに、チャンネルが選択されていない場合のみ
        // 最初のチャンネルを選択する
        if (channelsResults.length > 0) {
          dispatch(
            setChannelInfo({
              channelId: channelsResults[0].id,
              channelName: channelsResults[0].channel.channelName,
            })
          );
        } else if (currentChannelId) {
          // 選択中のチャンネルIDに対応するチャンネル名を見つける
          const selectedChannel = channelsResults.find(ch => ch.id === currentChannelId);
          if (selectedChannel) {
            dispatch(
              setChannelInfo({
                channelId: currentChannelId,
                channelName: selectedChannel.channel.channelName,
              })
            );
          }
        }
      });
    }
  }, [collectionRef, dispatch]);

  return { documents };
};

export default useChannel;
