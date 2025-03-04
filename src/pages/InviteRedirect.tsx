import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

export const InviteRedirect = () => {
  const { inviteCode } = useParams()
  const navigate = useNavigate()

  useEffect(() => {
    if (inviteCode) {
      // URLデコードして処理
      try {
        const decodedCode = decodeURIComponent(inviteCode)
        console.log('デコードされた招待コード:', decodedCode)
        
        // URLの中に別のURLや?invite=が含まれている場合は抽出
        let cleanCode = decodedCode
        if (decodedCode.includes('?invite=')) {
          const match = decodedCode.match(/[?&]invite=([^&]+)/)
          if (match && match[1]) {
            cleanCode = match[1]
          }
        }
        
        // クエリパラメータ形式に変換してリダイレクト
        navigate(`/invite?invite=${cleanCode}`, { replace: true })
      } catch (e) {
        console.error('招待コードの処理中にエラーが発生しました:', e)
        navigate('/', { replace: true })
      }
    } else {
      navigate('/', { replace: true })
    }
  }, [inviteCode, navigate])

  // リダイレクト中の表示
  return (
    <div className="flex h-svh w-full items-center justify-center">
      <p>リダイレクト中...</p>
    </div>
  )
}
