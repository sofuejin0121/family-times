import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { PlusCircle, LogIn } from 'lucide-react'

interface NoServerViewProps {
  onCreateServer: () => void
}

const NoServerView = ({ onCreateServer }: NoServerViewProps) => {
  const [isJoinServerOpen, setIsJoinServerOpen] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const navigate = useNavigate()

  const handleJoinServer = () => {
    if (inviteCode.trim()) {
      const cleanCode = inviteCode.trim()
      let finalInviteCode = cleanCode

      try {
        // 完全なURLが入力された場合の処理
        if (cleanCode.includes('://')) {
          // URLを解析
          const url = new URL(cleanCode)
          
          // URLにinviteクエリパラメータがある場合
          if (url.searchParams.has('invite')) {
            finalInviteCode = url.searchParams.get('invite') || cleanCode
            console.log('URLから抽出した招待コード:', finalInviteCode)
          } 
          // '/invite/' パス形式の場合
          else if (url.pathname.includes('/invite/')) {
            const pathParts = url.pathname.split('/invite/')
            if (pathParts.length > 1 && pathParts[1]) {
              // パスの後半部分を取得（クエリパラメータがある場合は除外）
              finalInviteCode = pathParts[1].split(/[?#]/)[0]
              console.log('パスから抽出した招待コード:', finalInviteCode)
            }
          }
        }
        // クエリパラメータだけが入力された場合
        else if (cleanCode.includes('?invite=')) {
          const match = cleanCode.match(/[?&]invite=([^&]+)/)
          if (match && match[1]) {
            finalInviteCode = match[1]
            console.log('クエリパラメータから抽出した招待コード:', finalInviteCode)
          }
        }
        // '/invite/' パス形式だけの場合
        else if (cleanCode.startsWith('/invite/')) {
          const pathParts = cleanCode.split('/invite/')
          if (pathParts.length > 1 && pathParts[1]) {
            finalInviteCode = pathParts[1].split(/[?#]/)[0]
            console.log('パス文字列から抽出した招待コード:', finalInviteCode)
          }
        }
      } catch (e) {
        console.error('招待コード処理エラー:', e)
        // エラーの場合は入力されたコードをそのまま使用
      }

      // 最終的に抽出されたコードを直接クエリパラメータとして使用
      console.log('最終的に使用する招待コード:', finalInviteCode)
      navigate(`/invite?invite=${finalInviteCode}`)
      setIsJoinServerOpen(false)
      setInviteCode('')
    }
  }

  return (
    <div className="flex h-svh w-full flex-col items-center justify-center">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
        <h2 className="mb-6 text-center text-2xl font-bold text-gray-800">
          サーバーがありません
        </h2>
        <p className="mb-8 text-center text-gray-600">
          サーバーを作成するか、既存のサーバーに参加してください
        </p>
        <div className="flex flex-col space-y-4">
          <Button
            onClick={onCreateServer}
            variant="default"
            className="hover:text-grey-700 w-full cursor-pointer py-6"
          >
            <PlusCircle className="mr-2 h-5 w-5" />
            サーバーを作成
          </Button>
          <Button
            onClick={() => setIsJoinServerOpen(true)}
            variant="outline"
            className="w-full py-6"
          >
            <LogIn className="mr-2 h-5 w-5" />
            招待コードで参加
          </Button>
        </div>
      </div>

      {/* 招待コード入力ダイアログ */}
      <Dialog open={isJoinServerOpen} onOpenChange={setIsJoinServerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>サーバーに参加</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col space-y-4 py-4">
            <p className="text-sm text-gray-500">
              サーバーの招待コードを入力してください
            </p>
            <div className="flex items-center justify-center space-x-2">
              <Input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="招待コード"
                className="flex-1"
              />
              <Button onClick={handleJoinServer} className="cursor-pointer">
                参加
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default NoServerView
