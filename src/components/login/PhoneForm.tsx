/**
 * @fileoverview 電話番号認証フォームコンポーネント
 *
 * このコンポーネントは以下の機能を提供します:
 * - 電話番号入力フォーム
 * - Firebase Phone Authenticationを使用した電話番号認証
 * - 認証コード(OTP)入力フォーム
 * - 認証成功後のユーザー情報保存
 *
 * @requires react - Reactライブラリ
 * @requires react-router-dom - ルーティング用ライブラリ
 * @requires firebase/auth - Firebase認証機能
 * @requires @/components/ui/* - UIコンポーネント
 * @requires sonner - トースト通知ライブラリ
 */

import { useState, useEffect } from 'react'
import { NavigateFunction } from 'react-router-dom'
import { auth } from '../../firebase'
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  UserCredential,
} from 'firebase/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { useAuth } from './useAuth'

/**
 * PhoneFormコンポーネントのProps型定義
 * @typedef {Object} PhoneFormProps
 * @property {NavigateFunction} navigate - ページ遷移用の関数
 */
interface PhoneFormProps {
  navigate: NavigateFunction
}

/**
 * 電話番号認証フォームコンポーネント
 *
 * @param {PhoneFormProps} props - コンポーネントのプロパティ
 * @returns {JSX.Element} 電話番号認証フォームのJSX
 *
 * @example
 * ```tsx
 * <PhoneForm navigate={navigate} />
 * ```
 */
export const PhoneForm = ({ navigate }: PhoneFormProps) => {
  // 電話番号関連のstate
  const [phoneNumber, setPhoneNumber] = useState('')
  const [formattedPhone, setFormattedPhone] = useState('')

  // OTP(ワンタイムパスワード)関連のstate
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', ''])
  const [showOTP, setShowOTP] = useState(false)
  const [phoneLoading, setPhoneLoading] = useState(false)

  // 再送信制御用のstate
  const [resendTimer, setResendTimer] = useState(0)
  const [canResend, setCanResend] = useState(true)

  // カスタムフック
  const { saveUserToFirestore, handleSuccessfulLogin } = useAuth(navigate)

  /**
   * 電話番号を国際形式にフォーマットする
   *
   * @param {string} value - 入力された電話番号
   * @returns {string} フォーマットされた電話番号
   */
  const formatPhoneNumber = (value: string) => {
    if (!value) return ''

    // 国コードがない場合、日本の国コードを追加
    if (!value.startsWith('+')) {
      if (value.startsWith('0')) {
        return '+81' + value.substring(1)
      }
      return '+81' + value
    }
    return value
  }

  /**
   * 電話番号入力時のハンドラー
   *
   * @param {React.ChangeEvent<HTMLInputElement>} e - 入力イベント
   */
  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value
    const value = rawValue.replace(/[^\d+]/g, '') // 数字と+記号以外を削除
    setPhoneNumber(value)
    setFormattedPhone(formatPhoneNumber(value))
  }

  /**
   * OTPコード入力時のハンドラー
   *
   * @param {number} index - 入力フィールドのインデックス
   * @param {string} value - 入力された値
   */
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

  /**
   * OTP入力フィールドのキーダウンハンドラー
   *
   * @param {number} index - 入力フィールドのインデックス
   * @param {React.KeyboardEvent<HTMLInputElement>} e - キーボードイベント
   */
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

  /**
   * reCAPTCHA初期化処理
   *
   * @returns {boolean} 初期化成功の場合true
   */
  function setupRecaptcha() {
    // ステップ1: reCAPTCHAが未設定の場合のみ処理を行う

    if (!window.recaptchaVerifier) {
      try {
        // reCAPTCHAコンテナが存在することを確認
        // ステップ2: HTMLに必要な要素があるか確認
        const container = document.getElementById('recaptcha-container')
        if (!container) {
          return false
        }
        // ステップ3: 古いreCAPTCHAが存在する場合はクリーンアップ
        if (window.recaptchaVerifier) {
          // すでに要素が存在する場合はクリア
          ;(
            window.recaptchaVerifier as unknown as { clear: () => void }
          ).clear()
          window.recaptchaVerifier = null
        }
        // ステップ4: 新しいreCAPTCHAを設定
        // 新しいreCAPTCHAを作成
        window.recaptchaVerifier = new RecaptchaVerifier(
          auth,
          'recaptcha-container',
          {
            size: 'invisible',
            callback: () => {},
            'expired-callback': () => {},
          }
        )
        return true
      } catch (error) {
        console.error('reCAPTCHA初期化エラー:', error)
        return false
      }
    }
    return true
  }

  /**
   * 再送信タイマーを開始する
   */
  const startResendTimer = () => {
    setCanResend(false)
    setResendTimer(60) // 60秒（1分）のタイマーを設定
  }

  // タイマー処理用のuseEffect
  useEffect(() => {
    if (resendTimer <= 0) return

    const interval = setInterval(() => {
      setResendTimer((prevTimer) => {
        if (prevTimer <= 1) {
          clearInterval(interval)
          setCanResend(true)
          return 0
        }
        return prevTimer - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [resendTimer])

  /**
   * 電話番号認証プロセスを開始する
   *
   * @param {React.FormEvent} e - フォームイベント
   */
  function startPhoneAuth(e: React.FormEvent) {
    e.preventDefault()

    if (!formattedPhone || formattedPhone.length < 10) {
      toast.error('有効な電話番号を入力してください')
      return
    }

    // 再送信可能かチェック
    if (!canResend) {
      toast.error(`${resendTimer}秒後に再試行してください`)
      return
    }

    setPhoneLoading(true)
    const recaptchaSetup = setupRecaptcha()

    if (!recaptchaSetup) {
      toast.error('認証の準備に失敗しました。ページを再読み込みしてください。')
      setPhoneLoading(false)
      return
    }

    const appVerifier = window.recaptchaVerifier

    if (appVerifier) {
      signInWithPhoneNumber(auth, formattedPhone, appVerifier)
        .then((confirmationResult) => {
          window.confirmationResult = confirmationResult
          setPhoneLoading(false)
          setShowOTP(true)
          toast.success('認証コードが送信されました')
        })
        .catch(() => {
          toast.error(
            '認証コードの送信に失敗しました。もう一度お試しください。'
          )
          setPhoneLoading(false)

          // エラー発生時にタイマーを開始
          startResendTimer()

          // reCAPTCHAをリセット
          if (window.recaptchaVerifier) {
            try {
              ;(
                window.recaptchaVerifier as unknown as { clear: () => void }
              ).clear()
            } catch (e) {
              console.error('reCAPTCHAクリアエラー:', e)
            }
            window.recaptchaVerifier = null
          }
        })
    } else {
      toast.error(
        '認証の準備ができていません。ページを再読み込みしてください。'
      )
      setPhoneLoading(false)
    }
  }

  /**
   * OTPコードを検証する
   *
   * @param {React.FormEvent} e - フォームイベント
   */
  function verifyOtp(e: React.FormEvent) {
    e.preventDefault()

    const code = otpCode.join('')

    if (code.length !== 6) {
      toast.error('認証コードを入力してください')
      return
    }

    setPhoneLoading(true)

    if (!window.confirmationResult) {
      toast.error('認証セッションが無効です。もう一度最初からお試しください。')
      setPhoneLoading(false)
      setShowOTP(false)
      return
    }

    window.confirmationResult
      .confirm(code)
      .then(async (result: UserCredential) => {
        // Firestoreにユーザー情報を保存
        const user = result.user
        const success = await saveUserToFirestore(user)

        if (success) {
          handleSuccessfulLogin(user)
        }

        setPhoneLoading(false)
      })
      .catch(() => {
        toast.error('無効な認証コードです。もう一度お試しください。')
        setPhoneLoading(false)
      })
  }

  return (
    <>
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
              phoneLoading ||
              !phoneNumber ||
              phoneNumber.length < 10 ||
              !canResend
            }
            className="w-full"
          >
            {phoneLoading
              ? '送信中...'
              : resendTimer > 0
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
    </>
  )
}
