import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

export const InviteRedirect = () => {
  const { inviteCode } = useParams()
  const navigate = useNavigate()

  useEffect(() => {
    if (inviteCode) {
      console.log('受け取った招待コード（生）:', inviteCode)
      
      // URLデコードして処理
      try {
        const decodedCode = decodeURIComponent(inviteCode)
        console.log('デコードされた招待コード:', decodedCode)
        
        // 招待コードを抽出する関数
        const extractInviteCode = (input: string): string => {
          // パターン1: URLに?invite=XXXが含まれる場合
          if (input.includes('?invite=')) {
            const match = input.match(/[?&]invite=([^&]+)/)
            if (match && match[1]) return match[1]
          }
          
          // パターン2: /invite/XXXの形式の場合
          if (input.includes('/invite/')) {
            // URLの場合は、/invite/の後ろの部分を抽出
            const parts = input.split('/invite/')
            if (parts.length > 1) {
              // ?や#がある場合は、それより前の部分だけ取る
              const code = parts[1].split(/[?#]/)[0]
              if (code) return code
            }
          }
          
          // パターン3: 入れ子になったURLの場合 (/invite/http://...)
          if (input.includes('://')) {
            try {
              // URLとして解析を試みる
              const urlObj = new URL(input)
              // クエリパラメータをチェック
              if (urlObj.searchParams.has('invite')) {
                return urlObj.searchParams.get('invite') || input
              }
            } catch (e) {
              // URL解析に失敗した場合は無視して次の処理へ
              console.log('URL解析失敗:', e)
            }
          }
          
          // 抽出できなかった場合は入力をそのまま返す
          return input
        }
        
        // 招待コードを抽出
        const cleanCode = extractInviteCode(decodedCode)
        console.log('抽出された招待コード:', cleanCode)
        
        // クリーンな招待コードでリダイレクト
        navigate(`/invite?invite=${cleanCode}`, { replace: true })
      } catch (e) {
        console.error('招待コードの処理中にエラーが発生しました:', e)
        navigate('/', { replace: true })
      }
    } else {
      navigate('/', { replace: true })
    }
  }, [inviteCode, navigate])

  return (
    <div className="flex h-svh w-full items-center justify-center">
      <div className="text-center">
        <p className="mb-2">リダイレクト中...</p>
        <p className="text-sm text-gray-500">招待コードを処理しています</p>
      </div>
    </div>
  )
}
