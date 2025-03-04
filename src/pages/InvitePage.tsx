import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { setServerInfo } from '../features/serverSlice'
import { setChannelInfo } from '../features/channelSlice'
import { AppSidebar } from '../components/sidebar/AppSidebar'
import Chat from '../components/chat/Chat'
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle } from '../components/ui/dialog'
import { Button } from '../components/ui/button'
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react'

export const InvitePage = () => {
  const dispatch = useAppDispatch()
  const user = useAppSelector((state) => state.user.user)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isMemberSidebarOpen, setIsMemberSidebarOpen] = useState(false)
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false)
  const [isAlreadyJoinedModal, setIsAlreadyJoinedModal] = useState(false)
  const [joinedServerName, setJoinedServerName] = useState('')
  const [joinedChannelName, setJoinedChannelName] = useState('')
  const [isProcessing, setIsProcessing] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  console.log('InvitePage コンポーネントがレンダリングされました')

  // URLが確実に元に戻るようにするためのヘルパー関数を追加
  const redirectToHome = () => {
    // replaceオプションを使用して履歴を置き換え、戻るボタンで招待ページに戻らないようにする
    navigate('/', { replace: true })
  }

  useEffect(() => {
    console.log('InvitePage useEffect が実行されました')
    
    const handleInvite = async () => {
      console.log('handleInvite 関数が開始されました')
      
      const inviteCode = searchParams.get('invite')
      console.log('取得した招待コード:', inviteCode)
      console.log('現在のユーザー:', user)
      
      if (!inviteCode || !user) {
        console.log('招待コードまたはユーザーが見つかりません')
        setErrorMessage('無効な招待コードまたはログインが必要です')
        setIsProcessing(false)
        return
      }

      // 処理開始時にローディング状態をtrueに
      setIsProcessing(true)
      setErrorMessage(null)

      try {
        console.log('Firestoreクエリを実行します')
        const serversRef = collection(db, 'servers')
        const q = query(serversRef, where(`invites.${inviteCode}`, '!=', null))

        const querySnapshot = await getDocs(q)
        console.log('クエリ結果:', querySnapshot.empty ? '結果なし' : `${querySnapshot.size}件のサーバーが見つかりました`)
        
        if (querySnapshot.empty) {
          console.log('招待コードに該当するサーバーが見つかりませんでした')
          setErrorMessage('招待コードが見つかりませんでした')
          setIsProcessing(false)
          return
        }

        const serverDoc = querySnapshot.docs[0]
        const serverData = serverDoc.data()
        console.log('サーバー情報:', { id: serverDoc.id, name: serverData.name })

        const invite = serverData.invites[inviteCode]
        console.log('招待情報:', invite)
        
        if (new Date(invite.expiresAt.seconds * 1000) < new Date()) {
          console.log('招待コードの有効期限が切れています')
          setErrorMessage('招待コードの有効期限が切れています')
          setIsProcessing(false)
          return
        }

        const serverRef = doc(db, 'servers', serverDoc.id)

        // メンバー情報を確認
        console.log('サーバーのメンバー情報を確認します')
        const serverSnapshot = await runTransaction(db, async (transaction) => {
          return await transaction.get(serverRef)
        })
        
        const serverMemberData = serverSnapshot.data()?.members || {}
        const isAlreadyJoined = !!serverMemberData[user.uid]
        console.log('ユーザーの参加状況:', isAlreadyJoined ? 'すでに参加済み' : '未参加')

        // すでに参加している場合の処理を修正
        if (isAlreadyJoined) {
          console.log('すでに参加済みの処理を実行します')
          
          // サーバー情報をセット
          dispatch(
            setServerInfo({
              serverId: serverDoc.id,
              serverName: serverData.name,
            })
          )
          
          setJoinedServerName(serverData.name)
          
          // 先にローディング状態を解除してからモーダルを表示
          setIsProcessing(false)
          
          // すでに参加済みのモーダルを表示
          setIsAlreadyJoinedModal(true)
          console.log('参加済みモーダルを表示します')
          
          // タイムアウトのみをここで設定し、リダイレクトはモーダルの onOpenChange で処理
          setTimeout(() => {
            console.log('タイムアウト経過、ホームに移動します')
            redirectToHome()
          }, 2500) // 少し長めの時間に設定
          
          return // 必ずここでreturnする
        }

        let channelId
        let channelName

        // 新規参加の処理
        console.log('新規参加の処理を開始します')
        
        // トランザクションでサーバーメンバー追加とチャンネル作成を実行
        await runTransaction(db, async (transaction) => {
          console.log('トランザクションを開始します')
          
          // メンバー情報を取得して、初めての参加かどうかを確認
          const serverSnapshot = await transaction.get(serverRef)
          const serverMemberData = serverSnapshot.data()?.members || {}
          const isFirstJoin = !serverMemberData[user.uid]

          if (isFirstJoin) {
            // メンバーとして追加
            transaction.update(serverRef, {
              [`members.${user.uid}`]: {
                role: 'member',
                joinedAt: serverTimestamp(),
              },
            })
          }
          
          // 自動で作成するテキストチャンネルにはプレフィックスにtimes-を付ける
          channelName = `times-${user.displayName}`

          // ユーザーのチャンネルがすでに作成済みかチェック
          const channelsRef = collection(
            db,
            'servers',
            serverDoc.id,
            'channels'
          )
          const channelQuery = query(
            channelsRef,
            where('createdBy', '==', user.uid)
          )
          const channelSnapshot = await getDocs(channelQuery)

          // 初めての参加でチャンネルが存在しない場合のみ作成
          if (channelSnapshot.empty && isFirstJoin) {
            const newChannelRef = doc(
              collection(db, 'servers', serverDoc.id, 'channels')
            )
            transaction.set(newChannelRef, {
              channelName: channelName,
              timestamp: serverTimestamp(),
              createdBy: user.uid,
            })

            channelId = newChannelRef.id
          } else if (!channelSnapshot.empty) {
            // チャンネルが既に存在する場合
            channelId = channelSnapshot.docs[0].id
            channelName = channelSnapshot.docs[0].data().channelName
          }
          
          console.log('トランザクションが完了しました')
        })

        console.log('チャンネル情報:', { id: channelId, name: channelName })

        // サーバー名とチャンネル名を保存（モーダル表示用）
        setJoinedServerName(serverData.name)
        setJoinedChannelName(channelName || '')

        dispatch(
          setServerInfo({
            serverId: serverDoc.id,
            serverName: serverData.name,
          })
        )

        if (channelId && channelName) {
          dispatch(
            setChannelInfo({
              channelId: channelId,
              channelName: channelName,
              createdBy: user.uid,
            })
          )
        }

        // 成功モーダルを表示
        setIsSuccessModalOpen(true)
        console.log('参加成功モーダルを表示します')
        
        // モーダル表示後、遅延してホームページへ移動
        setTimeout(() => {
          console.log('ホームページにリダイレクトします')
          redirectToHome()
        }, 1500)
      } catch (err) {
        console.error('エラーの詳細:', err)
        setErrorMessage('サーバー参加処理中にエラーが発生しました')
      } finally {
        // processAfterJoin関数内でisProcessingをfalseにしている場合は、ここではスキップ
        if (isProcessing) {
          console.log('処理が完了しました、ローディング状態をfalseに設定します')
          setIsProcessing(false)
        }
      }
    }

    handleInvite()
    
    // コンポーネントがアンマウントされる際に、URLが招待URLのままなら強制的にホームにリダイレクト
    return () => {
      console.log('InvitePage がアンマウントされます')
      if (window.location.pathname === '/invite') {
        console.log('招待ページからホームに戻ります')
        redirectToHome()
      }
    }
  }, [searchParams, user, dispatch, navigate])

  console.log('現在の状態:', { 
    isProcessing, 
    errorMessage, 
    isSuccessModalOpen, 
    isAlreadyJoinedModal 
  })

  // ローディング表示またはエラー表示を追加
  if (isProcessing) {
    return (
      <div className="flex h-svh w-full items-center justify-center bg-white">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-blue-500" />
          <p className="mt-4 text-gray-600">サーバーに参加中...</p>
        </div>
      </div>
    )
  }

  // エラーメッセージがある場合の表示
  if (errorMessage) {
    return (
      <div className="flex h-svh w-full flex-col items-center justify-center bg-white">
        <div className="max-w-md rounded-lg bg-white p-8 text-center shadow-lg">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="mt-4 text-xl font-semibold">エラーが発生しました</h2>
          <p className="mt-2 text-gray-700">{errorMessage}</p>
          <Button 
            className="mt-6" 
            onClick={redirectToHome}
          >
            ホームに戻る
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div
        className="flex h-screen w-full overflow-hidden"
        style={{ width: '100%' }}
      >
        <AppSidebar
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
        />
        <div className="min-w-0 flex-1">
          <Chat
            isMemberSidebarOpen={isMemberSidebarOpen}
            setIsMemberSidebarOpen={setIsMemberSidebarOpen}
            isMobileMenuOpen={isMobileMenuOpen}
            setIsMobileMenuOpen={setIsMobileMenuOpen}
            isMapMode={false}
            setIsMapMode={() => {}}
            setIsImageDialogOpen={() => {}}
          />
        </div>
      </div>

      {/* 参加成功モーダル */}
      <Dialog 
        open={isSuccessModalOpen} 
        onOpenChange={(open) => {
          setIsSuccessModalOpen(open)
          // モーダルが閉じられたときにURLを確実にリセット
          if (!open) redirectToHome()
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">サーバー参加完了</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-6">
            <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
            <p className="text-center text-lg">
              <span className="font-bold">{joinedServerName}</span> に参加しました
            </p>
            {joinedChannelName && (
              <p className="text-sm text-gray-500 mt-2">
                チャンネル <span className="font-medium">{joinedChannelName}</span> が作成されました
              </p>
            )}
          </div>
          <DialogFooter>
            <Button 
              className="w-full" 
              onClick={redirectToHome}
            >
              ホームに戻る
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* すでに参加済みモーダル */}
      <Dialog 
        open={isAlreadyJoinedModal} 
        onOpenChange={(open) => {
          setIsAlreadyJoinedModal(open)
          // モーダルが閉じられたときにURLを確実にリセット
          if (!open) {
            console.log('参加済みモーダルが閉じられました、ホームにリダイレクトします')
            redirectToHome()
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">サーバーに移動</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-6">
            <p className="text-center text-lg">
              あなたはすでに <span className="font-bold">{joinedServerName}</span> に参加しています
            </p>
            <p className="text-sm text-gray-500 mt-2">
              ホーム画面に移動します
            </p>
          </div>
          <DialogFooter>
            <Button 
              className="w-full" 
              onClick={() => {
                console.log('ホームに戻るボタンがクリックされました')
                setIsAlreadyJoinedModal(false) // これによりonOpenChangeも発火する
              }}
            >
              ホームに戻る
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
