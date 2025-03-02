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

export const InvitePage = () => {
  const dispatch = useAppDispatch()
  const user = useAppSelector((state) => state.user.user)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isMemberSidebarOpen, setIsMemberSidebarOpen] = useState(false)

  useEffect(() => {
    const handleInvite = async () => {
      const inviteCode = searchParams.get('invite')
      if (!inviteCode || !user) return

      try {
        const serversRef = collection(db, 'servers')
        const q = query(serversRef, where(`invites.${inviteCode}`, '!=', null))

        const querySnapshot = await getDocs(q)
        if (querySnapshot.empty) return

        const serverDoc = querySnapshot.docs[0]
        const serverData = serverDoc.data()

        const invite = serverData.invites[inviteCode]
        if (new Date(invite.expiresAt.seconds * 1000) < new Date()) return

        const serverRef = doc(db, 'servers', serverDoc.id)

        let channelId
        let channelName 

        // トランザクションでサーバーメンバー追加とチャンネル作成を実行
        await runTransaction(db, async (transaction) => {
          console.log('招待処理を開始します: inviteCode=', inviteCode)

          // メンバー情報を取得して、初めての参加かどうかを確認
          const serverSnapshot = await transaction.get(serverRef)
          const serverMemberData = serverSnapshot.data()?.members || {}
          const isFirstJoin = !serverMemberData[user.uid]

          console.log('ユーザー情報:', user.uid, user.displayName)
          console.log('初回参加:', isFirstJoin)

          if (isFirstJoin) {
            // メンバーとして追加
            console.log('新規メンバーとして追加します')
            transaction.update(serverRef, {
              [`members.${user.uid}`]: {
                role: 'member',
                joinedAt: serverTimestamp(),
              },
            })
          }

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

          console.log(
            'チャンネル検索結果:',
            channelSnapshot.empty ? '存在しません' : '存在します'
          )

          // 初めての参加でチャンネルが存在しない場合のみ作成
          if (channelSnapshot.empty && isFirstJoin) {
            console.log('新規チャンネルを作成します:', channelName)

            const newChannelRef = doc(
              collection(db, 'servers', serverDoc.id, 'channels')
            )
            transaction.set(newChannelRef, {
              channelName: channelName,
              timestamp: serverTimestamp(),
              createdBy: user.uid
            })

            channelId = newChannelRef.id
            console.log('作成したチャンネルID:', channelId)
          } else if (!channelSnapshot.empty) {
            // チャンネルが既に存在する場合
            channelId = channelSnapshot.docs[0].id
            channelName = channelSnapshot.docs[0].data().channelName
            console.log('既存チャンネルを使用します:', channelId, channelName)
          }
        })

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
              createdBy: user.uid
            })
          )
        }

        navigate('/', { replace: true })
      } catch (err) {
        console.error('Error handling invite:', err)
      }
    }

    handleInvite()
  }, [searchParams, user, dispatch, navigate])

  return (
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
        />
      </div>
    </div>
  )
}
