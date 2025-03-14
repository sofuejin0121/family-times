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
import { useUserStore } from '../stores/userSlice'
import { useServerStore } from '../stores/serverSlice'
import { useChannelStore } from '../stores/channelSlice'
import { AppSidebar } from '../components/sidebar/AppSidebar'
import Chat from '../components/chat/Chat'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from '../components/ui/dialog'
import { Button } from '../components/ui/button'
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react'

export const InvitePage = () => {
  const user = useUserStore((state) => state.user)
  // URLパラメータを取得するためのフック
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isMemberSidebarOpen, setIsMemberSidebarOpen] = useState(false)
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false)
  // const [isAlreadyJoinedModal, setIsAlreadyJoinedModal] = useState(false)
  const [joinedServerName, setJoinedServerName] = useState('')
  const [joinedChannelName, setJoinedChannelName] = useState('')
  //参加処理が進行中かどうかを示す(true => 処理中)
  const [isProcessing, setIsProcessing] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  //コンポーネントがマウントされているかどうかを示す
  const [isComponentMounted, setIsComponentMounted] = useState(true)

  const redirectToHome = () => {
    console.log('redirectToHome関数が呼び出されました')
    navigate('/', { replace: true })
  }

  useEffect(() => {
    console.log('InvitePage useEffect が実行されました')

    const handleInvite = async () => {
      console.log('handleInvite 関数が開始されました')
      // URLから招待コードを取得（例: ?invite=abc123）
      const inviteCode = searchParams.get('invite')

      console.log('取得した招待コード:', inviteCode)
      console.log('現在のユーザー:', user)

      if (!inviteCode || !user) {
        console.log('招待コードまたはユーザーが見つかりません')
        setErrorMessage('無効な招待コードまたはログインが必要です')
        setIsProcessing(false)
        return
      }

      setIsProcessing(true)
      setErrorMessage(null)

      try {
        console.log('Firestoreクエリを実行します')
        const serversRef = collection(db, 'servers')
        const q = query(serversRef, where(`invites.${inviteCode}`, '!=', null))

        const querySnapshot = await getDocs(q)
        console.log(
          'クエリ結果:',
          querySnapshot.empty
            ? '結果なし'
            : `${querySnapshot.size}件のサーバーが見つかりました`
        )

        // 招待コードに一致するサーバーが見つからない場合
        if (querySnapshot.empty) {
          console.log('招待コードに該当するサーバーが見つかりませんでした')
          setErrorMessage('招待コードが見つかりませんでした')
          setIsProcessing(false)
          return
        }
        // 最初に見つかったサーバードキュメント
        const serverDoc = querySnapshot.docs[0]
        // サーバードキュメントのデータ
        const serverData = serverDoc.data()
        console.log('サーバー情報:', {
          id: serverDoc.id,
          name: serverData.name,
        })

        const invite = serverData.invites[inviteCode]
        console.log('招待情報:', invite)

        // 招待コードの有効期限が切れている場合
        if (new Date(invite.expiresAt.seconds * 1000) < new Date()) {
          // Firestoreのタイムスタンプはsecondsフィールドを持つので、
          // それをJavaScriptのDate形式に変換して現在時刻と比較
          console.log('招待コードの有効期限が切れています')
          setErrorMessage('招待コードの有効期限が切れています')
          setIsProcessing(false)
          return
        }

        const serverRef = doc(db, 'servers', serverDoc.id)

        console.log('サーバーのメンバー情報を確認します')
        const serverSnapshot = await runTransaction(db, async (transaction) => {
          return await transaction.get(serverRef)
        })
        // トランザクションを使ってサーバー情報を取得
        // トランザクションは複数の操作を一つの単位として実行する仕組み
        const serverMemberData = serverSnapshot.data()?.members || {}
        const isAlreadyJoined = !!serverMemberData[user.uid]
        // ユーザーがすでにサーバーに参加しているかチェック
        // !!演算子は値を真偽値に変換（存在すればtrue、存在しなければfalse）
        console.log(
          'ユーザーの参加状況:',
          isAlreadyJoined ? 'すでに参加済み' : '未参加'
        )

        if (isAlreadyJoined) {
          console.log('すでに参加済みのサーバーです')

          useServerStore.getState().setServerInfo({
            serverId: serverDoc.id,
            serverName: serverData.name,
          })

          setIsProcessing(false)

          redirectToHome()
          return
        }

        let channelId
        let channelName

        console.log('新規参加の処理を開始します')

        await runTransaction(db, async (transaction) => {
          console.log('トランザクションを開始します')

          const serverSnapshot = await transaction.get(serverRef)
          // トランザクション内でサーバー情報を取得
          const serverMemberData = serverSnapshot.data()?.members || {}

          const isFirstJoin = !serverMemberData[user.uid]
          // 初回参加かどうか（ユーザーIDがメンバーリストに存在しなければ初回参加）
          if (isFirstJoin) {
            transaction.update(serverRef, {
              [`members.${user.uid}`]: {
                role: 'member',
                joinedAt: serverTimestamp(),
              },
            })
          }

          channelName = `times-${user.displayName}`

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
            channelId = channelSnapshot.docs[0].id
            channelName = channelSnapshot.docs[0].data().channelName
            // 既存のチャンネル情報を取得
          }

          console.log('トランザクションが完了しました')
        })

        console.log('チャンネル情報:', { id: channelId, name: channelName })

        // 1. まず必要なデータを設定
        setJoinedServerName(serverData.name)
        setJoinedChannelName(channelName || '')

        // 2. Reduxの更新
        useServerStore.getState().setServerInfo({
          serverId: serverDoc.id,
          serverName: serverData.name,
        })

        if (channelId && channelName) {
          useChannelStore.getState().setChannelInfo({
            channelId: channelId,
            channelName: channelName,
          })
        }

        // 3. 処理完了を示す
        setIsProcessing(false)

        // 4. コンポーネントがマウントされている場合のみモーダルを表示
        if (isComponentMounted) {
          setIsSuccessModalOpen(true)
          console.log('モーダルの表示を設定しました')
        }
      } catch (err) {
        console.error('エラーの詳細:', err)
        setErrorMessage('サーバー参加処理中にエラーが発生しました')
        setIsProcessing(false)
      } finally {
        console.log('処理が完了しました')
      }
    }

    handleInvite()

    return () => {
      console.log('InvitePage がアンマウントされます')
      if (window.location.pathname === '/invite') {
        console.log('招待ページからホームに戻ります')
        redirectToHome()
      }
      setIsComponentMounted(false)
    }
  }, [searchParams, user, navigate, isComponentMounted, redirectToHome])

  useEffect(() => {
    console.log('モーダルの状態が変更されました:', isSuccessModalOpen)
  }, [isSuccessModalOpen])

  // useEffect(() => {
  //   console.log('状態変更を検知: isAlreadyJoinedModal =', isAlreadyJoinedModal);
  // }, []);

  // console.log('現在の状態:', {
  //   isProcessing,
  //   errorMessage,
  //   isSuccessModalOpen,
  //   isAlreadyJoinedModal
  // })

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

  if (errorMessage) {
    return (
      <div className="flex h-svh w-full flex-col items-center justify-center bg-white">
        <div className="max-w-md rounded-lg bg-white p-8 text-center shadow-lg">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="mt-4 text-xl font-semibold">エラーが発生しました</h2>
          <p className="mt-2 text-gray-700">{errorMessage}</p>
          <Button className="mt-6" onClick={redirectToHome}>
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

      {isSuccessModalOpen && (
        <Dialog
          open={isSuccessModalOpen}
          onOpenChange={(open) => {
            console.log('モーダル表示状態が変更されました:', open)
            if (isComponentMounted) {
              setIsSuccessModalOpen(open)
              if (!open) {
                console.log('モーダルが閉じられました、ホームに移動します')
                redirectToHome()
              }
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-center">
                サーバー参加完了
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center py-6">
              <CheckCircle className="mb-4 h-16 w-16 text-green-500" />
              <p className="text-center text-lg">
                <span className="font-bold">{joinedServerName}</span>{' '}
                に参加しました
              </p>
              {joinedChannelName && (
                <p className="mt-2 text-sm text-gray-500">
                  チャンネル{' '}
                  <span className="font-medium">{joinedChannelName}</span>{' '}
                  が作成されました
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                className="w-full"
                onClick={() => {
                  setIsSuccessModalOpen(false)
                  redirectToHome()
                }}
              >
                ホームに戻る
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
