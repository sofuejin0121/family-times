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
      let cleanCode = inviteCode.trim()

      // URLから招待コードを抽出する処理を強化
      try {
        // URL形式かチェック
        if (cleanCode.includes('://') || cleanCode.startsWith('/')) {
          // 完全なURLまたは相対パスの場合
          let url

          if (cleanCode.includes('://')) {
            // 絶対URL（http://など）
            url = new URL(cleanCode)
          } else {
            // 相対パス（/invite/など）
            url = new URL(cleanCode, window.location.origin)
          }

          // inviteクエリパラメータがある場合
          if (url.searchParams.has('invite')) {
            cleanCode = url.searchParams.get('invite') || ''
          }
          // パスが/invite/XXXの形式の場合
          else if (url.pathname.startsWith('/invite/')) {
            const pathParts = url.pathname.split('/')
            if (pathParts.length >= 3 && pathParts[2]) {
              cleanCode = pathParts[2]
            }
          }
        }
        // クエリパラメータのみの形式（?invite=XXX）
        else if (cleanCode.includes('?invite=')) {
          const match = cleanCode.match(/\?invite=([^&]+)/)
          if (match && match[1]) {
            cleanCode = match[1]
          }
        }
        // /invite/XXX形式
        else if (cleanCode.startsWith('/invite/')) {
          const parts = cleanCode.split('/')
          if (parts.length >= 3 && parts[2]) {
            cleanCode = parts[2]
          }
        }
      } catch (e) {
        console.error('URL解析エラー:', e)
        // 解析に失敗した場合はそのまま使用
      }

      // 最終的に抽出されたコードを使用（空でない場合のみ）
      if (cleanCode) {
        console.log('使用する招待コード:', cleanCode)
        navigate(`/invite?invite=${cleanCode}`)
        setIsJoinServerOpen(false)
        setInviteCode('')
      }
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
