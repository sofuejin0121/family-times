import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../../firebase";
import { useAppSelector } from "../../app/hooks";

export const JoinServer = () => {
  // 入力された招待コードの状態管理
  const [inviteCode, setInviteCode] = useState("");
  //エラーメッセージの状態管理
  const [error, setError] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  //ページ遷移用のhook
  const navigate = useNavigate();
  const serverId = useAppSelector((state) => state.server.serverId);

  //サーバー参加処理
  const handleJoin = async () => {
    //サーバーの情報の取得
    if (!serverId) {
      setError("サーバーIDが無効です");
      return;
    }

    //currentUserのnullチェック
    const user = auth.currentUser;
    if (!user) {
      setError("ログインが必要です");
      return;
    }
    if (!inviteCode.trim()) {
      setError("招待コードを入力してください");
      return;
    }
    setIsLoading(true);
    setError("");

    try {
      const serverRef = doc(db, "servers", serverId);
      const serverDoc = await getDoc(serverRef);

      //サーバーが存在しない場合
      if (!serverDoc.exists()) {
        setError("サーバーが見つかりません");
        return;
      }
      const serverData = serverDoc.data();
      const invite = serverData.invites[inviteCode];

      //招待コードが存在しない場合
      if (!invite) {
        setError("無効な招待コードです");
        return;
      }
      //招待リンクの有効期限切れの場合
      if (new Date(invite.expiresAt.seconds * 1000) < new Date()) {
        setError("招待リンクの有効期限が切れています");
        return;
      }
      // メンバーとして追加
      await updateDoc(serverRef, {
        [`members.${user.uid}`]: {
          role: "member",
          joinedAt: serverTimestamp(),
        },
      });
      //サーバーページに遷移
      navigate("/");
    } catch (err) {
      setError("エラーが発生しました");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="join-server">
      <input
        type="text"
        value={inviteCode}
        onChange={(e) => setInviteCode(e.target.value)}
        placeholder="招待コードを入力"
        disabled={isLoading}
      />
      <button onClick={handleJoin} disabled={isLoading}>
        {isLoading ? "参加中" : "参加する"}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
};
