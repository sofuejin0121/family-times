import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { auth, db, storage } from '@/firebase'
import { doc, setDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { updateProfile } from 'firebase/auth'
import { login } from '@/features/userSlice'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Loader2 } from 'lucide-react'

const NewUserProfile = () => {
  const user = useAppSelector((state) => state.user.user)
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const [redirectPath, setRedirectPath] = useState('/')

  // URLパラメーターからリダイレクト先を取得
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search)
    const redirectTo = searchParams.get('redirectTo')
    if (redirectTo) {
      // redirectToには完全なパス（クエリパラメータ含む）が入っているはず
      setRedirectPath(redirectTo)
    }
  }, [location])
  const [displayName, setDisplayName] = useState(user?.displayName || '')
  const [photoURL] = useState(user?.photo || '')
  const [isLoading, setIsLoading] = useState(false)
  const [previewURL, setPreviewURL] = useState<string | null>(
    user?.photo || null
  )

  // 画像ロード状態を管理する新しいstate
  const [isImageLoading, setIsImageLoading] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // プロフィール画像選択処理
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // ローディング状態を開始
      setIsImageLoading(true)
      
      // プレビュー表示用のURL生成
      const reader = new FileReader()
      reader.onload = () => {
        // 画像読み込みに少し時間がかかっているように見せるため、
        // 実際のロードよりも少し遅延させると、UXが向上します
        setTimeout(() => {
          setPreviewURL(reader.result as string)
          setIsImageLoading(false) // ローディング状態を終了
        }, 500)
      }
      reader.onerror = () => {
        toast.error('画像の読み込みに失敗しました')
        setIsImageLoading(false)
      }
      reader.readAsDataURL(file)
    }
  }

  // プロフィール画像クリック時の処理
  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  // プロフィール設定を保存
  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!displayName.trim()) {
      toast.error('表示名を入力してください')
      return
    }

    setIsLoading(true)

    try {
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error('ユーザーが見つかりません')
      }

      let updatedPhotoURL = photoURL

      // 新しいプロフィール画像がある場合はアップロード
      if (fileInputRef.current?.files?.[0]) {
        const file = fileInputRef.current.files[0]
        const storageRef = ref(storage, `profile_images/${currentUser.uid}`)
        await uploadBytes(storageRef, file)
        updatedPhotoURL = await getDownloadURL(storageRef)
      }

      // Firebase Authのプロフィールを更新
      await updateProfile(currentUser, {
        displayName: displayName,
        photoURL: updatedPhotoURL,
      })

      // Firestoreのユーザー情報を保存 - setDocを使用して新規作成または更新
      await setDoc(doc(db, 'users', currentUser.uid), {
        uid: currentUser.uid,
        displayName: displayName,
        photoURL: updatedPhotoURL,
        email: currentUser.email,
      })

      // Redux状態を更新
      dispatch(
        login({
          uid: currentUser.uid,
          photo: updatedPhotoURL,
          email: currentUser.email,
          displayName: displayName,
        })
      )

      toast.success('プロフィールを設定しました')
      navigate(redirectPath) // 保存したリダイレクト先に遷移
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : '不明なエラー'
      toast.error('プロフィールの設定に失敗しました: ' + errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-4 w-full">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
        <h2 className="mb-6 text-center text-2xl font-bold">
          プロフィール設定
        </h2>
        <p className="mb-6 text-center text-gray-600">
          Family-Timesでの表示名とプロフィール画像を設定してください
        </p>

        <form onSubmit={saveProfile} className="space-y-6">
          {/* プロフィール画像 */}
          <div className="flex flex-col items-center">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            <div className="relative h-24 w-24">
              {isImageLoading ? (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gray-100">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <Avatar
                  className="h-24 w-24 cursor-pointer transition-opacity hover:opacity-80"
                  onClick={handleAvatarClick}
                >
                  <AvatarImage src={previewURL || undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                    {displayName ? displayName.charAt(0).toUpperCase() : 'U'}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
            <p className="mt-2 text-sm text-gray-500">
              {isImageLoading ? '読み込み中...' : 'クリックして画像を変更'}
            </p>
          </div>

          {/* 表示名入力 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">表示名</label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="表示名を入力してください"
              required
            />
          </div>

          {/* ボタン */}
          <div className="flex flex-col space-y-3 pt-2">
            <Button 
              type="submit" 
              disabled={isLoading || isImageLoading} 
              className="w-full cursor-pointer"
            >
              {isLoading ? (
                <span className="flex items-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  保存中...
                </span>
              ) : (
                'プロフィールを保存'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default NewUserProfile
