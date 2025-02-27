import React, { useState, useRef } from "react";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import useUsers from "../../hooks/useUsers";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage, auth } from "../../firebase";
import { updateProfile } from "firebase/auth";
import { updateUserInfo } from "../../features/userSlice";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Avatar, AvatarImage } from "../ui/avatar";
import { cn } from "../../lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface UserEditProps {
  isOpen: boolean;
  onClose: () => void;
}

const UserEdit = (props: UserEditProps) => {
  const { isOpen, onClose } = props;
  const user = useAppSelector((state) => state.user.user);
  const dispatch = useAppDispatch();
  const { updateUser } = useUsers();
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [photoURL, setPhotoURL] = useState(user?.photo || "");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

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
      setPhotoURL(downloadURL);
    } catch (error) {
      console.error("画像のアップロードに失敗しました:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!auth.currentUser) return;

    try {
      await updateProfile(auth.currentUser, {
        displayName,
        photoURL: photoURL || undefined,
      });

      const updateResult = await updateUser(user.uid, {
        displayName,
        photoURL: photoURL || "",
      });

      if (updateResult) {
        // 成功時はReduxステートも更新
        dispatch(
          updateUserInfo({
            displayName: displayName,
            photo: photoURL || user.photo, // 新しい画像URLまたは既存の画像URL
          })
        );

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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#36393f] text-white border-none sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>ユーザー情報の編集</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col items-center gap-2">
            <div className="relative group">
              <Avatar
                className={cn(
                  "w-[100px] h-[100px] mb-2 relative",
                  isUploading &&
                    "after:content-['アップロード中...'] after:absolute after:inset-0 after:bg-black/70 after:flex after:justify-center after:items-center after:rounded-full after:text-xs"
                )}
              >
                <AvatarImage
                  src={photoURL || user.photo}
                  alt="プロフィール"
                  className="object-cover"
                />
              </Avatar>

              {/* ホバー時に表示されるオーバーレイ */}
              <div
                className="absolute inset-0 bg-black/70 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <span className="text-white text-sm font-medium">画像変更</span>
              </div>
            </div>

            {/* ファイル入力要素 */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept="image/*"
            />

            {/* 表示入力フォーム */}
            <Label htmlFor="display-name">表示名</Label>
            <Input
              id="display-name"
              placeholder="表示名"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="bg-[#202225] border-[#40444b] hover:border-[#5d6269] focus:border-[#5865f2] text-white"
            />
          </div>

          <DialogFooter className="flex justify-between mt-4 gap-2">
            <Button
              variant="secondary"
              type="submit"
              className="cursor-pointer"
            >
              保存
            </Button>
            <Button
              variant="link"
              onClick={onClose}
              className="text-white hover:text-white cursor-pointer"
            >
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={handleLogout}
              className="cursor-pointer"
            >
              ログアウト
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default UserEdit;
