/**
 * メールアドレスによるログイン/登録フォームコンポーネント
 * @module EmailForm
 * @description メールアドレスとパスワードを使用したログインまたはアカウント登録機能を提供するフォームコンポーネント。
 * 
 * @requires react - Reactライブラリ
 * @requires react-router-dom - ルーティング機能
 * @requires @/components/ui/* - UIコンポーネント
 * @requires ./useAuth - 認証カスタムフック
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from './useAuth'

/**
 * EmailFormコンポーネントのProps型定義
 * @typedef {Object} EmailFormProps
 * @property {'login' | 'register'} mode - フォームの動作モード。'login'はログイン、'register'は新規登録
 * @property {boolean} isLoading - ローディング状態を示すフラグ
 */
interface EmailFormProps {
  mode: 'login' | 'register'
  isLoading: boolean
}

/**
 * メールアドレス認証フォームコンポーネント
 * 
 * @param {EmailFormProps} props - コンポーネントのプロパティ
 * @returns {JSX.Element} メールアドレス認証フォームのJSX
 * 
 * @example
 * ```tsx
 * // ログインフォームとして使用
 * <EmailForm mode="login" isLoading={false} />
 * 
 * // 登録フォームとして使用
 * <EmailForm mode="register" isLoading={false} />
 * ```
 */
export const EmailForm = ({
  mode,
  isLoading: parentLoading,
}: EmailFormProps) => {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const { signInWithEmail, createAccount } = useAuth(navigate)

  /**
   * フォーム送信時の処理
   * @param {React.FormEvent} e - フォームイベント
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (mode === 'login') {
      await signInWithEmail(email, password)
    } else {
      await createAccount(email, password)
      // 登録成功後はフォームをリセット
      if (!parentLoading) {
        setEmail('')
        setPassword('')
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
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
          placeholder={
            mode === 'register' ? 'パスワード (8文字以上)' : 'パスワード'
          }
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={mode === 'register' ? 8 : undefined}
        />
      </div>
      <Button type="submit" disabled={parentLoading} className="w-full">
        {parentLoading
          ? mode === 'login'
            ? 'ログイン中...'
            : '登録中...'
          : mode === 'login'
            ? 'ログイン'
            : 'アカウント作成'}
      </Button>

      {mode === 'register' && (
        <p className="mt-2 text-xs text-gray-500">
          アカウント作成後、ご入力いただいたメールアドレスに認証リンクが送信されます。
          認証完了後にログインできます。
        </p>
      )}
    </form>
  )
}
