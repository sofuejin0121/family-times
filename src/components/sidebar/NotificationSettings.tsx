import { useState } from 'react'
import {
  manuallyRefreshFCMToken,
  requestNotificationPermission,
} from '@/firebase'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Bell, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

export const NotificationSettings = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  // 通知許可を要求
  const handleRequestPermission = async () => {
    setIsLoading(true)
    try {
      const result = await requestNotificationPermission()
      if (result) {
        setStatus('success')
        setMessage('通知が許可されました。')
        toast.success('通知が正常に設定されました。')
      } else {
        setStatus('error')
        setMessage('通知が拒否されました。ブラウザの設定から許可してください。')
      }
    } catch (error) {
      setStatus('error')
      setMessage('通知設定中にエラーが発生しました。')
      console.error('通知許可エラー:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // FCMトークンを手動で更新
  const handleRefreshToken = async () => {
    setIsLoading(true)
    try {
      const result = await manuallyRefreshFCMToken()
      if (result.success) {
        setStatus('success')
        setMessage(`トークンが正常に更新されました: ${result.token}`)
        toast.success('プッシュ通知トークンが更新されました。')
      } else {
        setStatus('error')
        setMessage(`トークン更新エラー: ${result.error}`)
      }
    } catch (error) {
      setStatus('error')
      setMessage('トークン更新中にエラーが発生しました。')
      console.error('トークン更新エラー:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          通知設定
        </CardTitle>
        <CardDescription>プッシュ通知の設定と管理を行います</CardDescription>
      </CardHeader>
      <CardContent>
        {status === 'success' && (
          <Alert className="mb-4 border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle>成功</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        {status === 'error' && (
          <Alert className="mb-4 border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertTitle>エラー</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div>
            <h3 className="mb-1 text-sm font-medium">通知許可</h3>
            <p className="mb-2 text-sm text-gray-500">
              ブラウザの通知許可を設定します。新しいメッセージを受け取るために必要です。
            </p>
            <Button
              onClick={handleRequestPermission}
              disabled={isLoading}
              variant="default"
              className="w-full cursor-pointer"
            >
              <Bell className="mr-2 h-4 w-4" />
              通知を許可する
            </Button>
          </div>

          <div>
            <h3 className="mb-1 text-sm font-medium">トークン更新</h3>
            <p className="mb-2 text-sm text-gray-500">
              通知が届かない場合は、トークンを更新してみてください。
            </p>
            <Button
              onClick={handleRefreshToken}
              disabled={isLoading}
              variant="default"
              className="w-full cursor-pointer"
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
              />
              通知トークンを更新
            </Button>
          </div>
        </div>
      </CardContent>
      <CardFooter className="text-xs text-gray-500">
        通知設定はこのデバイスのみに適用されます
      </CardFooter>
    </Card>
  )
}

