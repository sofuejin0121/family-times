import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth, db, provider } from '../../firebase'
import {
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  UserCredential,
} from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { FirebaseError } from 'firebase/app'

// Window型を拡張してFirebaseのrecaptchaVerifierとconfirmationResultを追加
declare global {
  interface Window {
    recaptchaVerifier: (RecaptchaVerifier & { clear: () => void }) | null
    confirmationResult: ConfirmationResult | null
  }
}

const Login = () => {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // 電話認証用の状態
  const [phoneNumber, setPhoneNumber] = useState('')
  const [formattedPhone, setFormattedPhone] = useState('')
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', ''])
  const [showOTP, setShowOTP] = useState(false)
  const [phoneLoading, setPhoneLoading] = useState(false)
  
  // 認証コード再送信のための待機時間を管理
  const [resendTimer, setResendTimer] = useState(0)
  const [canResend, setCanResend] = useState(true)

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
        // トーストでメール認証が完了していないことを通知
        toast.info(
          'メール認証が完了していません。受信したメールのリンクをクリックしてください。'
        )

        // メール認証が完了していない場合は、認証用のメールを再度送信する
        try {
          await sendEmailVerification(result.user, {
            url: `${window.location.origin}/login`,
            handleCodeInApp: false,
          })
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : '不明なエラー'
          toast.error('認証メールの送信に失敗しました: ' + errorMessage)
        }

        // トーストでメール認証が完了していないことを通知
        toast.info(
          'メールアドレス宛に認証リンクを送信しました。受信したメールのリンクをクリックしてください。'
        )

        // ログアウトさせる
        await auth.signOut()
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

  // 電話番号のフォーマット
  const formatPhoneNumber = (value: string) => {
    if (!value) return ''

    // 国コードがない場合、日本の国コードを追加
    if (!value.startsWith('+')) {
      if (value.startsWith('0')) {
        const formatted = '+81' + value.substring(1)
        console.log('電話番号フォーマット: 先頭の0を+81に置換 →', formatted)
        return formatted
      }
      const formatted = '+81' + value
      console.log('電話番号フォーマット: +81を追加 →', formatted)
      return formatted
    }
    console.log('電話番号フォーマット: 変更なし →', value)
    return value
  }

  // 電話番号の入力処理
  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value
    const value = rawValue.replace(/[^\d+]/g, '')
    console.log('電話番号入力: 元の値 =', rawValue, '整形後 =', value)
    setPhoneNumber(value)
    const formatted = formatPhoneNumber(value)
    setFormattedPhone(formatted)
  }

  // OTPコードの入力処理
  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      value = value.charAt(0)
    }

    if (value && !/^\d+$/.test(value)) {
      return
    }

    const newOtp = [...otpCode]
    newOtp[index] = value
    setOtpCode(newOtp)

    // 次の入力フィールドにフォーカスを移動
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`)
      if (nextInput) {
        nextInput.focus()
      }
    }
  }

  // OTP入力キーダウン処理
  const handleOtpKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`)
      if (prevInput) {
        prevInput.focus()
      }
    }
  }

  // reCAPTCHA初期化
  function setupRecaptcha() {
    console.log('reCAPTCHA初期化開始')
    if (!window.recaptchaVerifier) {
      try {
        // reCAPTCHAコンテナが存在することを確認
        const container = document.getElementById('recaptcha-container')
        if (!container) {
          console.error('reCAPTCHAコンテナが見つかりません')
          return false
        }
        console.log('reCAPTCHAコンテナ確認OK')

        // すでに要素が存在する場合はクリア
        if (window.recaptchaVerifier) {
          console.log('既存のreCAPTCHAをクリア')
          ;(
            window.recaptchaVerifier as unknown as { clear: () => void }
          ).clear()
          window.recaptchaVerifier = null
        }

        // 新しいreCAPTCHAを作成
        console.log('新しいreCAPTCHAを作成')
        window.recaptchaVerifier = new RecaptchaVerifier(
          auth,
          'recaptcha-container',
          {
            size: 'invisible',
            callback: () => {
              console.log('reCAPTCHA検証成功')
            },
            'expired-callback': () => {
              console.log('reCAPTCHA期限切れ')
            },
          }
        )
        console.log('reCAPTCHA初期化成功')
        return true
      } catch (error) {
        console.error('reCAPTCHA初期化エラー:', error)
        return false
      }
    }
    console.log('既存のreCAPTCHAを使用')
    return true
  }

  // タイマーを開始する関数
  const startResendTimer = () => {
    console.log('再送信タイマー開始: 60秒')
    setCanResend(false)
    setResendTimer(60) // 60秒（1分）のタイマーを設定
    
    const interval = setInterval(() => {
      setResendTimer((prevTimer) => {
        if (prevTimer <= 1) {
          console.log('再送信タイマー終了: 再送信可能状態に変更')
          clearInterval(interval)
          setCanResend(true)
          return 0
        }
        if (prevTimer % 10 === 0) {
          console.log('再送信タイマー残り:', prevTimer - 1, '秒')
        }
        return prevTimer - 1
      })
    }, 1000)

    // コンポーネントアンマウント時にタイマーをクリア
    return () => {
      console.log('タイマークリア (コンポーネントアンマウント)')
      clearInterval(interval)
    }
  }

  // 電話番号認証プロセス開始
  function startPhoneAuth(e: React.FormEvent) {
    e.preventDefault()
    console.log('電話番号認証開始:', formattedPhone)

    if (!formattedPhone || formattedPhone.length < 10) {
      console.log('電話番号エラー: 無効な電話番号', formattedPhone)
      toast.error('有効な電話番号を入力してください')
      return
    }

    // 再送信可能かチェック
    if (!canResend) {
      console.log('再送信不可: タイマー中', resendTimer, '秒')
      toast.error(`${resendTimer}秒後に再試行してください`)
      return
    }

    console.log('電話認証処理開始: ローディング状態セット')
    setPhoneLoading(true)
    const recaptchaSetup = setupRecaptcha()

    if (!recaptchaSetup) {
      console.error('reCAPTCHA初期化失敗')
      toast.error('認証の準備に失敗しました。ページを再読み込みしてください。')
      setPhoneLoading(false)
      return
    }

    const appVerifier = window.recaptchaVerifier
    console.log('電話認証: reCAPTCHA準備OK, 認証コード送信開始')

    if (appVerifier) {
      signInWithPhoneNumber(auth, formattedPhone, appVerifier)
        .then((confirmationResult) => {
          console.log('電話認証: 認証コード送信成功')
          window.confirmationResult = confirmationResult
          setPhoneLoading(false)
          setShowOTP(true)
          toast.success('認証コードが送信されました')
        })
        .catch((error) => {
          console.error('電話認証エラー:', error)
          console.log('エラーコード:', error.code, 'エラーメッセージ:', error.message)
          toast.error(
            '認証コードの送信に失敗しました。もう一度お試しください。'
          )
          setPhoneLoading(false)
          
          // エラー発生時にタイマーを開始
          console.log('エラー発生: 再送信タイマー開始')
          startResendTimer()

          // reCAPTCHAをリセット
          if (window.recaptchaVerifier) {
            try {
              console.log('reCAPTCHAリセット試行')
              ;(
                window.recaptchaVerifier as unknown as { clear: () => void }
              ).clear()
            } catch (e) {
              console.error('reCAPTCHAクリアエラー:', e)
            }
            console.log('reCAPTCHAをnullに設定')
            window.recaptchaVerifier = null
          }
        })
    } else {
      console.error('電話認証: appVerifierが見つかりません')
      toast.error(
        '認証の準備ができていません。ページを再読み込みしてください。'
      )
      setPhoneLoading(false)
    }
  }

  // OTP検証
  function verifyOtp(e: React.FormEvent) {
    e.preventDefault()

    const code = otpCode.join('')
    console.log('OTP検証開始, 入力コード:', code)
    
    if (code.length !== 6) {
      console.log('OTPエラー: コード長が不正', code.length)
      toast.error('認証コードを入力してください')
      return
    }

    console.log('OTP検証: ローディング状態セット')
    setPhoneLoading(true)

    if (!window.confirmationResult) {
      console.error('OTP検証エラー: confirmationResultが存在しません')
      toast.error('認証セッションが無効です。もう一度最初からお試しください。')
      setPhoneLoading(false)
      setShowOTP(false)
      return
    }

    console.log('OTP検証: confirmResultで検証開始')
    window.confirmationResult
      .confirm(code)
      .then(async (result: UserCredential) => {
        console.log('OTP検証成功: ユーザーID', result.user.uid)
        // Firestoreにユーザー情報を保存
        const user = result.user
        try {
          console.log('Firestore保存開始')
          await setDoc(
            doc(db, 'users', user.uid),
            {
              uid: user.uid,
              phoneNumber: user.phoneNumber,
              createdAt: new Date(),
            },
            { merge: true }
          )
          console.log('Firestore保存成功')

          // ページ遷移を少し遅らせる
          setTimeout(() => {
            console.log('プロフィールページへの遷移判定')
            if (
              !user.displayName ||
              user.displayName === '' ||
              user.displayName === '名称未設定' ||
              !user.photoURL
            ) {
              console.log('プロフィール未設定: プロフィールページへ遷移')
              navigate('/profile')
            } else {
              console.log('プロフィール設定済み: トップページへ遷移')
            }
          }, 500)
        } catch (error) {
          console.error('Firestore保存エラー:', error)
        }

        setPhoneLoading(false)
      })
      .catch((error: FirebaseError) => {
        console.error('OTP検証エラー:', error)
        console.log('エラーコード:', error.code, 'エラーメッセージ:', error.message)
        toast.error('無効な認証コードです。もう一度お試しください。')
        setPhoneLoading(false)
      })
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100">
      <div id="recaptcha-container"></div>
      <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow-md">
        <h2 className="mb-6 text-2xl font-bold">Family-Timesにログイン</h2>

        <Tabs defaultValue="login" className="mb-6 w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="login">ログイン</TabsTrigger>
            <TabsTrigger value="register">新規登録</TabsTrigger>
            <TabsTrigger value="phone">電話番号</TabsTrigger>
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

          <TabsContent value="phone">
            {!showOTP ? (
              // 電話番号入力フォーム
              <form onSubmit={startPhoneAuth} className="mt-4 space-y-4">
                <div className="space-y-2 text-left">
                  <Label htmlFor="phone" className="text-sm font-medium">
                    電話番号
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="090XXXXXXXX"
                    value={phoneNumber}
                    onChange={handlePhoneNumberChange}
                    required
                    className="text-base"
                  />
                  <p className="text-xs text-gray-500">
                    例: 090XXXXXXXX または +81 90XXXXXXXX
                  </p>
                </div>
                <Button
                  type="submit"
                  disabled={
                    phoneLoading || !phoneNumber || phoneNumber.length < 10 || !canResend
                  }
                  className="w-full"
                >
                  {phoneLoading ? '送信中...' : resendTimer > 0 
                    ? `再送信まで ${resendTimer}秒` 
                    : '認証コードを送信'}
                </Button>
                <p className="mt-2 text-xs text-gray-500">
                  ご入力いただいた電話番号にSMSで6桁の認証コードが送信されます。
                </p>
              </form>
            ) : (
              // OTP入力フォーム
              <form onSubmit={verifyOtp} className="mt-4 space-y-4">
                <div className="space-y-4">
                  <Label className="text-sm font-medium">
                    認証コードを入力してください
                  </Label>
                  <div className="flex justify-center gap-2">
                    {otpCode.map((digit, index) => (
                      <Input
                        key={index}
                        id={`otp-${index}`}
                        type="text"
                        value={digit}
                        maxLength={1}
                        className="h-12 w-10 text-center text-xl"
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                        autoFocus={index === 0}
                        inputMode="numeric"
                        pattern="[0-9]*"
                      />
                    ))}
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={phoneLoading || otpCode.join('').length !== 6}
                  className="w-full"
                >
                  {phoneLoading ? '認証中...' : '認証する'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowOTP(false)
                    setOtpCode(['', '', '', '', '', ''])
                  }}
                  className="mt-2 w-full"
                >
                  戻る
                </Button>
              </form>
            )}
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
