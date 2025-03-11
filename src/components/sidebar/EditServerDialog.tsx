import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { doc, updateDoc, getDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { toast } from 'sonner'
import { uploadImage, getCachedImageUrl } from '../../utils/imageUtils'
import { X, Upload } from 'lucide-react'

interface EditServerDialogProps {
  isOpen: boolean
  onClose: () => void
  serverId: string
  serverName: string
  serverPhotoId?: string | null
  serverPhotoExtension?: string | null
}

export function EditServerDialog({
  isOpen,
  onClose,
  serverId,
  serverName,
  serverPhotoId,
  serverPhotoExtension
}: EditServerDialogProps) {
  const [name, setName] = useState(serverName)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null)

  // 現在の画像URLを取得
  useEffect(() => {
    const fetchCurrentImage = async () => {
      if (serverPhotoId && serverPhotoExtension) {
        try {
          const imageUrl = await getCachedImageUrl(serverPhotoId, serverPhotoExtension, 'servers')
          setCurrentImageUrl(imageUrl)
        } catch (error) {
          console.error('サーバー画像の取得に失敗しました:', error)
        }
      }
    }
    
    if (isOpen) {
      fetchCurrentImage()
    }
  }, [isOpen, serverPhotoId, serverPhotoExtension])

  // ダイアログが開かれたときに状態をリセット
  useEffect(() => {
    if (isOpen) {
      setName(serverName)
      setSelectedFile(null)
      setPreviewUrl(null)
    }
  }, [isOpen, serverName])

  // ファイル選択時の処理
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // ファイルサイズチェック（5MB以下）
    if (file.size > 5 * 1024 * 1024) {
      toast.error('ファイルサイズは5MB以下にしてください')
      return
    }

    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  // フォーム送信処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) {
      toast.error('サーバー名を入力してください')
      return
    }
    
    setIsLoading(true)
    
    try {
      const serverRef = doc(db, 'servers', serverId)
      const serverDoc = await getDoc(serverRef)
      
      if (!serverDoc.exists()) {
        toast.error('サーバーが見つかりません')
        return
      }
      
      const updateData: Record<string, string> = {
        name: name.trim()
      }
      
      // 画像がアップロードされた場合
      if (selectedFile) {
        const { photoId, photoExtension } = await uploadImage(selectedFile, 'servers')
        updateData.photoId = photoId
        updateData.photoExtension = photoExtension
      }
      
      await updateDoc(serverRef, updateData)
      toast.success('サーバー情報を更新しました')
      onClose()
    } catch (error) {
      console.error('サーバー更新エラー:', error)
      toast.error('サーバーの更新に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>サーバー設定</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">サーバー名</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="サーバー名を入力"
              disabled={isLoading}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="image">サーバーアイコン</Label>
            <div className="flex items-center gap-4">
              <div className="relative h-16 w-16 overflow-hidden rounded-full bg-zinc-200">
                {(previewUrl || currentImageUrl) && (
                  <img
                    src={previewUrl || currentImageUrl || ''}
                    alt="サーバーアイコンプレビュー"
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('server-image')?.click()}
                    disabled={isLoading}
                    className="cursor-pointer"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    アップロード
                  </Button>
                  
                  {(previewUrl || currentImageUrl) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedFile(null)
                        setPreviewUrl(null)
                      }}
                      disabled={isLoading}
                      className="cursor-pointer"
                    >
                      <X className="mr-2 h-4 w-4" />
                      削除
                    </Button>
                  )}
                </div>
                <Input
                  id="server-image"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={isLoading}
                />
                <span className="text-xs text-muted-foreground">
                  推奨: 512x512px (最大5MB)
                </span>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading} className="cursor-pointer">
              キャンセル
            </Button>
            <Button type="submit" disabled={isLoading} className="cursor-pointer">
              {isLoading ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}