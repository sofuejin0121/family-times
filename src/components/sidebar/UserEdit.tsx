import React from "react";
import {
  Modal,
  Box,
  Typography,
  Avatar,
  Button,
  TextField,
} from "@mui/material";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import useUsers from "../../hooks/useUsers";
import { useState } from "react";
import { useRef } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../../firebase";
import { auth } from "../../firebase";
import { updateProfile } from "firebase/auth";
import { updateUserInfo } from "../../features/userSlice";
// モーダルのスタイル定義
const style = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 400,
  bgcolor: "#36393f", // Discord風の暗い背景色
  border: "1px solid #202225",
  boxShadow: 24,
  p: 4,
  color: "white", // テキストを白色に
  borderRadius: "5px", // 角を丸く
};
interface UserEditProps {
  isOpen: boolean;
  onClose: () => void;
}
const UserEdit = (props: UserEditProps) => {
  const { isOpen, onClose } = props;
  const user = useAppSelector((state) => state.user.user);
  //Reduxからディスパッチ取得
  const dispatch = useAppDispatch();
  const { updateUser } = useUsers();
  //表示名の状態管理(初期値は現在のユーザー名)
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  //プロフィール画像URLの状態管理
  const [photoURL, setPhotoURL] = useState(user?.photo || "");
  //画像アップロード中かどうかの状態
  const [isUploading, setIsUploading] = useState(false);
  //ファイル入力要素への参照
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !user) return null;

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const storageRef = ref(storage, `users/${user.uid}/${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      //状態を更新
      setPhotoURL(downloadURL);
    } catch (error) {
      console.error("画像のアップロードに失敗しました:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    //現在ログインしているユーザーがいなければ何もしない
    if (!auth.currentUser) return;

    try {
      //Firebase認証のプロフィールを更新
      await updateProfile(auth.currentUser, {
        displayName,
        photoURL: photoURL || undefined,
      });
      
      // Firestoreのユーザー情報も更新
      const updateResult = await updateUser(user.uid, {
        displayName,
        photoURL: photoURL || "",
      });
      
      if (updateResult) {
        // 成功時はReduxステートも更新
        dispatch(updateUserInfo({
          displayName: displayName,
          photo: photoURL || user.photo, // 新しい画像URLまたは既存の画像URL
        }));
        
        // モーダルを閉じる
        onClose();
      } else {
        console.error("ユーザー情報の更新に失敗しました");
      }
    } catch (error) {
      console.error("プロファイル更新エラー:", error);
    }
  };

  //ログアウト処理
  const handleLogout = async () => {
    auth.signOut();
    onClose();
  };
  return (
    <Modal open={isOpen} onClose={onClose}>
      <Box sx={style}>
        <Typography variant="h6">ユーザー情報の編集</Typography>
        <form onSubmit={handleSubmit}>
          <Box>
            <Avatar
              src={photoURL || user.photo}
              alt="プロフィール画像"
              sx={{
                width: 100,
                height: 100,
                mb: 2,
                position: "relative",
                "&::after": isUploading
                  ? {
                      content: '"アップロード中..."',
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: "rgba(0,0,0,0.7)",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      borderRadius: "50%",
                      fontSize: "12px",
                    }
                  : {},
              }}
            />
            {/* 画像変更ボタン */}
            <Button
              variant="contained"
              color="primary"
              size="small"
              onClick={() => fileInputRef.current?.click()}
              sx={{
                backgroundColor: "#4e5d94",
                "&:hover": { backgroundColor: "#5865f2" },
              }}
            >
              画像変更
            </Button>
            {/* ファイル入力要素 */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              style={{ display: "none" }}
              accept="image/*"
            />
            {/* 表示入力フォーム */}
            <TextField
              label="表示名"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              fullWidth
              required
              margin="normal"
              variant="outlined"
              sx={{
                "& .MuiOutlinedInput-root": {
                  color: "white",
                  "& fieldset": { borderColor: "#40444b" },
                  "&:hover fieldset": { borderColor: "#5d6269" },
                  "&.Mui-focused fieldset": { borderColor: "#5865f2" },
                },
                "& .MuiInputLabel-root": { color: "#b9bbbe" },
              }}
            />
            {/* ボタングループ */}
            <Box
              sx={{ display: "flex", justifyContent: "space-between", mt: 2 }}
            >
              <Button variant="contained" color="primary" type="submit">
                保存
              </Button>
              <Button variant="contained" color="error" onClick={onClose}>
                キャンセル
              </Button>
              <Button variant="contained"  color="error" onClick={handleLogout}>
                ログアウト
              </Button>
            </Box>
          </Box>
        </form>
      </Box>
    </Modal>
  );
};

export default UserEdit;
