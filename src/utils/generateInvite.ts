import { doc, serverTimestamp, Timestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

export const geneteInviteCode = () => {
  // ランダムな8文字の文字列を生成
  return Math.random().toString(36).substring(2, 10);
};
//Firestoreにサーバー情報を保存する
export const createServerInvite = async (
  serverId: string,
  createdBy: string
): Promise<string> => {
  const inviteCode = geneteInviteCode();
  const serverRef = doc(db, "servers", serverId);
  //24時間有効な招待リンク
  const expiresAt = Timestamp.fromDate(
    new Date(Date.now() + 24 * 60 * 60 * 1000)
  );

  try {
    await updateDoc(serverRef, {
      [`invites.${inviteCode}`]: {
        createdBy,
        createdAt: serverTimestamp(),
        expiresAt,
        active: true,
      },
    });
    return inviteCode;
  } catch (error) {
    console.error("招待コード作成エラー", error);
    throw error;
  }
};
