import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from './useAuth'

interface EmailFormProps {
  mode: 'login' | 'register'
  isLoading: boolean
}

export const EmailForm = ({
  mode,
  isLoading: parentLoading,
}: EmailFormProps) => {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const { signInWithEmail, createAccount } = useAuth(navigate)

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
