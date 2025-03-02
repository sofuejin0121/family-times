import { useState } from 'react'
import { auth, db, provider } from '../../firebase'
import {
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
} from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Googleログイン処理
  const signInWithGoogle = async () => {
    try {
      const credential = await signInWithPopup(auth, provider)
      if (credential) {
        const user = credential.user
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          photoURL: user.photoURL,
          email: user.email,
          displayName: user.displayName,
        })
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : '不明なエラー'
      toast.error(errorMessage)
    }
  }

  // メール/パスワードでログイン
  const signInWithEmail = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !password) {
      toast.error('メールアドレスとパスワードを入力してください')
      return
    }

    setIsLoading(true)

    try {
      const result = await signInWithEmailAndPassword(auth, email, password)

      // メール認証が完了しているか確認
      if (!result.user.emailVerified) {
        // 未認証の場合はログアウトさせる
        await auth.signOut()
        toast.error(
          'メールアドレスの認証が完了していません。受信したメールのリンクをクリックしてください。'
        )

        // 再度認証メールを送信するオプションを提供
        toast.info(
          '認証メールが届いていない場合は、アカウント作成をもう一度お試しください。'
        )
        return
      }

      // ログイン成功時はFirebase Auth状態変更イベントで自動的に処理されます
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : '不明なエラー'
      toast.error('ログインに失敗しました: ' + errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  // 新規アカウント作成（メール認証付き）
  const createAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('アカウント作成処理開始')

    if (!email || !password) {
      console.log(
        'バリデーションエラー: メールアドレスまたはパスワードが未入力'
      )
      toast.error('メールアドレスとパスワードを入力してください')
      return
    }

    if (password.length < 8) {
      console.log('バリデーションエラー: パスワードが8文字未満')
      toast.error('パスワードは8文字以上で入力してください')
      return
    }

    setIsLoading(true)
    console.log('ローディング状態設定: true')

    try {
      console.log('アカウント作成開始')
      // アカウント作成
      // これは認証用のメールを送信するのみで、ログイン自体は行っていない
      const credential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      )
      const newUser = credential.user
      console.log('アカウント作成成功:', newUser.uid)

      // Firestoreへの書き込みをスキップ - 認証後のプロフィール設定時に行う
      // 現時点ではログインしていないので、権限がなくfirestoreに保存できないので、認証後のプロフィール設定時に保存する

      // メール認証リンクを送信
      try {
        console.log('認証メール送信開始')
        await sendEmailVerification(newUser, {
          url: `${window.location.origin}/login`,
          handleCodeInApp: false,
        })
        console.log('認証メール送信成功')

        toast.success(
          'アカウントを作成しました。メールアドレス宛に送信された認証リンクをクリックして登録を完了してください。'
        )

        // ユーザーをログアウト
        console.log('ユーザーログアウト開始')
        await auth.signOut()
        console.log('ユーザーログアウト完了')

        // フォームをリセット
        setEmail('')
        setPassword('')
        console.log('フォームリセット完了')

        toast('登録したメールアドレスを確認してください', {
          description: '認証リンクのクリックでログイン可能になります',
          duration: 6000,
        })
      } catch (emailError) {
        console.error('メール送信エラー:', emailError)
        toast.error(
          '認証メールの送信に失敗しました。管理者にお問い合わせください。'
        )
        await auth.signOut()
      }
    } catch (error: unknown) {
      console.error('アカウント作成エラー:', error)
      const errorMessage =
        error instanceof Error ? error.message : '不明なエラー'
      toast.error('アカウント作成に失敗しました: ' + errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100">
      <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow-md">
        <h2 className="mb-6 text-2xl font-bold">Family-Timesにログイン</h2>

        <Tabs defaultValue="login" className="mb-6 w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">ログイン</TabsTrigger>
            <TabsTrigger value="register">新規登録</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={signInWithEmail} className="mt-4 space-y-4">
              <div className="space-y-2">
                <Input
                  type="email"
                  placeholder="メールアドレス"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Input
                  type="password"
                  placeholder="パスワード"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full"
                variant="default"
              >
                {isLoading ? 'ログイン中...' : 'ログイン'}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register">
            <p className="mb-4 text-sm text-gray-600">
              ※メールが届かない場合は、迷惑メールフォルダを確認するか、別のメールアドレスをお試しください。
            </p>
            <form onSubmit={createAccount} className="mt-4 space-y-4">
              <div className="space-y-2">
                <Input
                  type="email"
                  placeholder="メールアドレス"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Input
                  type="password"
                  placeholder="パスワード (8文字以上)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? '登録中...' : 'アカウント作成'}
              </Button>
              <p className="mt-2 text-xs text-gray-500">
                アカウント作成後、ご入力いただいたメールアドレスに認証リンクが送信されます。
                認証完了後にログインできます。
              </p>
            </form>
          </TabsContent>
        </Tabs>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white px-2 text-gray-500">または</span>
          </div>
        </div>

        {/* Googleログイン */}
        <Button
          onClick={signInWithGoogle}
          variant="outline"
          className="w-full cursor-pointer border-gray-300 text-gray-700 transition-colors hover:bg-gray-50"
        >
          <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"
            />
          </svg>
          Googleでログイン
        </Button>
      </div>
    </div>
  )
}

export default Login
