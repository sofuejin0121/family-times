import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { useState } from "react";
import { useAppSelector } from "../../app/hooks";
import { addDoc, collection } from "firebase/firestore";
import { db } from "../../firebase";
import { Box, Button, Modal, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";

// モーダルのスタイル
const style = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 400,
  bgcolor: "#36393f", // Discordライクな背景色
  border: "none",
  borderRadius: "5px",
  boxShadow: 24,
  p: 4,
  color: "white",
} as const;

// スタイル付きのコンポーネント
const ImageUploadLabel = styled("label")({
  display: "block",
  cursor: "pointer",
  marginBottom: "1rem",
  "& img": {
    width: "100px",
    height: "100px",
    borderRadius: "50%",
    objectFit: "cover",
  },
});

const UploadPlaceholder = styled("div")({
  width: "100px",
  height: "100px",
  borderRadius: "50%",
  backgroundColor: "#202225",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#dcddde",
});

const StyledInput = styled("input")({
  width: "100%",
  padding: "10px",
  marginBottom: "1rem",
  backgroundColor: "#202225",
  border: "none",
  borderRadius: "3px",
  color: "#dcddde",
});

const ButtonGroup = styled("div")({
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
});
interface CreateServerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateServer = ({ isOpen, onClose }: CreateServerProps) => {
  const [serverName, setServerName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const user = useAppSelector((state) => state.user.user);
  //ファイルが選択された時に実行される関数
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    //選択されたファイルを取得
    const file = e.target.files?.[0];
    if (file) {
      //選択されたファイルを状態として保存
      setSelectedFile(file);
      //FireReaderを使用して画像をプレビュー
      const reader = new FileReader();
      //ファイルの読み込みが完了した時の処理を設定
      reader.onloadend = () => {
        //プレビュー用のURLとして状態に保存
        setPreviewUrl(reader.result as string);
      };
      //ファイルの読み込みを開始
      //imgタグのsrc属性で表示できる
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    //フォームのデフォルトの送信を防止
    //ページがリロードされるのを防ぐ
    e.preventDefault(); 
    if (!serverName || !user) return;

    try {
      //アップロードした画像のURLを保存する変数
      let imageUrl = "";
      //画像ファイルが選択されている場合、Firebase Storageにアップロード
      if (selectedFile) {
        const storage = getStorage(); //Firebase Storageの参照
        //ストレージのパスを生成(ユニークな名前にするために、タイムスタンプを追加)
        const storageRef = ref(
          storage,
          //保存する画像の名前とパスを設定
          // 例: "servers/1234567890_image.jpg"

          `servers/${Date.now()}_${selectedFile?.name}`
        );
        //画像をアップロード
        const snapshot = await uploadBytes(storageRef, selectedFile);
        //アップロードした画像のURLを保存
        imageUrl = await getDownloadURL(snapshot.ref);
      }

      //Firestoreにサーバー情報保存
      await addDoc(collection(db, "servers"), {
        name: serverName,
        imageUrl,
        members: {
          [user.uid]: {
            role: "admin",
            joinedAt: new Date(),
          },
        },
      });
      //フォームのリセット
      setServerName("");
      setSelectedFile(null);
      setPreviewUrl(null);
      onClose();
    } catch (error) {
      console.log("サーバー作成に失敗しました:", error);
    }
  };
  //モーダルが非表示の場合何も表示しない
  if (!isOpen) return null;

  return (
    <Modal open={isOpen} onClose={onClose}>
      <Box sx={style}>
        <Typography>サーバーを作成</Typography>
        <Box component="form" onSubmit={handleSubmit}>
          <ImageUploadLabel>
            {previewUrl ? (
              <img src={previewUrl} alt="プレビュー" />
            ) : (
              <UploadPlaceholder>
                <span>画像を選択</span>
              </UploadPlaceholder>
            )}
            <input
              type="file"
              accept="image/*" //画像ファイルのみ許可
              onChange={handleFileSelect}
              hidden
            />
          </ImageUploadLabel>

          <StyledInput
            type="text"
            value={serverName}
            onChange={(e) => setServerName(e.target.value)}
            placeholder="サーバー名"
            required
          />
          <ButtonGroup>
            <Button
              onClick={onClose}
              sx={{
                backgroundColor: "#4f545c",
                color: "white",
                "&:hover": {
                  backgroundColor: "#36939f",
                },
              }}
            >
              キャンセル
            </Button>
            <Button
              type="submit"
              sx={{
                backgroundColor: "#7289da",
                color: "white",
                "&:hover": {
                  backgroundColor: "#677bc4",
                },
              }}
            >
              作成
            </Button>
          </ButtonGroup>
        </Box>
      </Box>
    </Modal>
  );
};
