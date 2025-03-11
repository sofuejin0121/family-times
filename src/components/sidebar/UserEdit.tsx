import React, { useState, useRef } from "react";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import useUsers from "../../hooks/useUsers";
import { auth } from "../../firebase";
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
import { Loader2 } from "lucide-react";
import { uploadImage, getCachedImageUrl } from "../../utils/imageUtils";

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
  const [photoId, setPhotoId] = useState(user?.photoId || "");
  const [photoExtension, setPhotoExtension] = useState(user?.photoExtension || "");
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
      // 新しい画像アップロード関数を使用
      const result = await uploadImage(file, `users/${user.uid}`);
      
      // 画像URLを取得して表示用に設定
      const url = await getCachedImageUrl(
        result.photoId, 
        result.photoExtension, 
        `users`
      );
      
      if (url) {
        setPhotoURL(url);
      }
      
      // 画像IDと拡張子を保存
      setPhotoId(result.photoId);
      setPhotoExtension(result.photoExtension);
    } catch (error) {
      console.error("画像のアップロードに失敗しました:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName) return;
    setIsUploading(true);

    try {
      // Firebaseの認証プロフィールを更新
      const currentUser = auth.currentUser;
      if (currentUser) {
        await updateProfile(currentUser, {
          displayName: displayName,
          photoURL: photoURL, // 表示用のURLは従来通り
        });
      }

      // Firestoreのユーザー情報を更新
      await updateUser(user.uid, {
        displayName: displayName,
        photoURL: photoURL,
        photoId: photoId,
        photoExtension: photoExtension,
      });

      // Reduxストアのユーザー情報を更新
      dispatch(
        updateUserInfo({
          displayName: displayName,
          photo: photoURL,
          photoId: photoId,
          photoExtension: photoExtension,
        })
      );

      onClose();
    } catch (error) {
      console.error("プロフィールの更新に失敗しました:", error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md dialog-content">
        <DialogHeader>
          <DialogTitle>プロフィール編集</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* アバター画像 */}
          <div className="flex justify-center">
            <div
              className="relative cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Avatar className={cn("h-24 w-24", isUploading && "opacity-50")}>
                <AvatarImage src={photoURL} className="object-cover" />
              </Avatar>
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full opacity-0 hover:opacity-100 transition-opacity">
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
          </div>

          {/* 表示名入力フォーム */}
          <div className="space-y-2">
            <Label htmlFor="display-name" className="mb-2">
              表示名
            </Label>
            <Input
              id="display-name"
              placeholder="表示名"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="bg-white border border-gray-300 text-black"
            />
          </div>

          <DialogFooter className="flex justify-end gap-2 mt-6">
            <Button
              variant="default"
              type="submit"
              disabled={isUploading || !displayName}
              className="bg-gray-900 text-white hover:bg-gray-800 cursor-pointer"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "保存"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isUploading}
              className="border border-gray-300 text-gray-700 hover:bg-gray-100 cursor-pointer"
            >
              キャンセル
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default UserEdit;
