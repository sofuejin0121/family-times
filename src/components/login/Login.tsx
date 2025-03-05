import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RecaptchaVerifier, ConfirmationResult } from 'firebase/auth'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from './useAuth'
import { EmailForm } from './EmailForm'
import { PhoneForm } from './PhoneForm'

// Window型を拡張してFirebaseのrecaptchaVerifierとconfirmationResultを追加
declare global {
  interface Window {
    recaptchaVerifier: (RecaptchaVerifier & { clear: () => void }) | null
    confirmationResult: ConfirmationResult | null
  }
}

const Login = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('login')

  const { signInWithGoogle, isLoading } = useAuth(navigate)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100">
      <div id="recaptcha-container"></div>
      <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow-md">
        <h2 className="mb-6 text-2xl font-bold">Family-Timesにログイン</h2>

        <Tabs
          defaultValue="login"
          className="mb-6 w-full"
          value={activeTab}
          onValueChange={setActiveTab}
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="login">ログイン</TabsTrigger>
            <TabsTrigger value="register">新規登録</TabsTrigger>
            <TabsTrigger value="phone">電話番号</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <EmailForm mode="login" isLoading={isLoading} />
          </TabsContent>

          <TabsContent value="register">
            <p className="mb-4 text-sm text-gray-600">
              ※メールが届かない場合は、迷惑メールフォルダを確認するか、別のメールアドレスをお試しください。
            </p>
            <EmailForm mode="register" isLoading={isLoading} />
          </TabsContent>

          <TabsContent value="phone">
            <PhoneForm navigate={navigate} />
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
