/**
 * 招待リンクのリダイレクト処理を行うコンポーネント
 * 
 * @description
 * このコンポーネントは、以下の機能を提供します:
 * - URLパラメータから招待コードを取得
 * - 招待コードの形式を正規化(複数のURL形式に対応)
 * - 正規化した招待コードで/inviteページにリダイレクト
 * 
 * @example
 * 以下のような複数のURL形式に対応:
 * - /invite/ABCD123 
 * - /invite?invite=ABCD123
 * - /invite/http://example.com/invite?invite=ABCD123
 * 
 * @param {object} props - Reactコンポーネントのプロパティ(このコンポーネントは props を使用しません)
 * @returns {JSX.Element} リダイレクト中の表示を行うJSX
 */
import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

export const InviteRedirect = () => {
  // react-router-domのフック
  const { inviteCode } = useParams() // URLパラメータから招待コードを取得
  const navigate = useNavigate() // 画面遷移用のフック

  useEffect(() => {
    if (inviteCode) {
      console.log('受け取った招待コード（生）:', inviteCode)
      
      // URLデコードして処理
      try {
        const decodedCode = decodeURIComponent(inviteCode)
        console.log('デコードされた招待コード:', decodedCode)
        
        /**
         * 招待コードを抽出する関数
         * @param {string} input - 処理する招待コード文字列
         * @returns {string} 正規化された招待コード
         */
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
        // replace: trueは履歴を置き換える(戻るボタンでこの画面に戻れないようにする)
        navigate(`/invite?invite=${cleanCode}`, { replace: true })
      } catch (e) {
        console.error('招待コードの処理中にエラーが発生しました:', e)
        navigate('/', { replace: true })
      }
    } else {
      navigate('/', { replace: true })
    }
  }, [inviteCode, navigate]) // inviteCodeまたはnavigateが変更されたときに再実行

  return (
    <div className="flex h-svh w-full items-center justify-center">
      <div className="text-center">
        <p className="mb-2">リダイレクト中...</p>
        <p className="text-sm text-gray-500">招待コードを処理しています</p>
      </div>
    </div>
  )
}
