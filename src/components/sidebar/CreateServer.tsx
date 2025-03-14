import { useState } from 'react'
import { useUserStore } from '../../stores/userSlice'
import { addDoc, collection } from 'firebase/firestore'
import { db } from '../../firebase'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { uploadImage } from '../../utils/imageUtils'

interface CreateServerProps {
  isOpen: boolean
  onClose: () => void
}

export const CreateServer = ({ isOpen, onClose }: CreateServerProps) => {
  const [serverName, setServerName] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const user = useUserStore((state) => state.user)

  //ファイルが選択された時に実行される関数
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    //選択されたファイルを取得
    const file = e.target.files?.[0]
    if (file) {
      //選択されたファイルを状態として保存
      setSelectedFile(file)
      //FireReaderを使用して画像をプレビュー
      const reader = new FileReader()
      //ファイルの読み込みが完了した時の処理を設定
      reader.onloadend = () => {
        //プレビュー用のURLとして状態に保存
        setPreviewUrl(reader.result as string)
      }
      //ファイルの読み込みを開始
      //imgタグのsrc属性で表示できる
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!serverName) return

    setIsLoading(true)
    try {
      let photoId = null
      let photoExtension = null

      if (selectedFile) {
        // 新しい画像アップロード関数を使用
        const result = await uploadImage(selectedFile, 'servers')
        photoId = result.photoId
        photoExtension = result.photoExtension
      }

      await addDoc(collection(db, 'servers'), {
        name: serverName,
        photoId,
        photoExtension,
        createdAt: new Date(),
        createdBy: user?.uid,
        members: {
          [user?.uid || '']: {
            role: 'admin',
            joinedAt: new Date(),
          },
        },
        invites: {},
      })

      setServerName('')
      setSelectedFile(null)
      setPreviewUrl(null)
      onClose()
    } catch (error) {
      console.error('Error creating server:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="dialog-content sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">サーバーを作成</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex justify-center">
            <Label htmlFor="server-image" className="cursor-pointer">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Server preview"
                  className="h-24 w-24 rounded-full border-2 border-gray-300 object-cover"
                />
              ) : (
                <div className="m-2 flex h-24 w-24 items-center justify-center rounded-full border-2 border-gray-300 bg-gray-200">
                  <span>画像を選択</span>
                </div>
              )}
              <input
                id="server-image"
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </Label>
          </div>

          <div className="space-y-2">
            <Input
              id="server-name"
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
              placeholder="サーバー名"
              required
              className="border border-gray-300 bg-white text-black"
            />
          </div>

          <DialogFooter className="mt-4 flex justify-end gap-2">
            <Button
              variant="default"
              type="submit"
              disabled={isLoading || !serverName}
              className="cursor-pointer bg-gray-900 text-white hover:bg-gray-800"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                '作成'
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="cursor-pointer border border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              キャンセル
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
