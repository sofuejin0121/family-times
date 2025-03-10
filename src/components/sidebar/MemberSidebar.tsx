import { useMemo, useCallback, useState, useEffect } from 'react'
import useUsers from '../../hooks/useUsers'
import useServer from '../../hooks/useServer'
import { useAppSelector } from '../../app/hooks'
import { Avatar, AvatarImage } from '../ui/avatar'
import { Sidebar, SidebarContent, SidebarHeader } from '@/components/ui/sidebar'
import { getImageUrl } from '@/utils/imageUtils'

const MemberSidebar = () => {
  const { documents: users } = useUsers()
  const serverId = useAppSelector((state) => state.server.serverId)
  const { documents: servers } = useServer()

  // サーバー情報の取得を最適化
  const server = useMemo(() => {
    return servers.find((server) => server.id === serverId)
  }, [servers, serverId])

  // メンバーIDの取得を最適化
  const uniqueIds = useMemo(() => {
    return Object.keys(server?.server.members || {})
  }, [server?.server.members])

  // メンバーのフィルタリングを最適化
  const filteredUsers = useMemo(() => {
    return users.filter((user) => uniqueIds.includes(user.uid))
  }, [users, uniqueIds])

  // 画像URLのキャッシュ用state
  const [userPhotoUrlMap, setUserPhotoUrlMap] = useState<{
    [key: string]: string
  }>({})

  // 画像URL取得関数
  const fetchUserPhoto = useCallback(
    async (user: {
      uid: string
      photoId?: string | null
      photoExtension?: string | null
      photoURL?: string
    }) => {
      if (!user.photoId || !user.photoExtension) {
        return user.photoURL || null
      }

      try {
        const url = await getImageUrl(
          user.photoId,
          user.photoExtension,
          'users'
        )
        return url || user.photoURL
      } catch (error) {
        console.error(`ユーザー ${user.uid} の画像取得に失敗:`, error)
        return user.photoURL
      }
    },
    []
  )

  // 画像URLの一括取得とキャッシュ
  useEffect(() => {
    let isMounted = true
    const abortController = new AbortController()

    const fetchPhotos = async () => {
      const newPhotoUrls: { [key: string]: string } = {}

      // 既存のキャッシュを保持しつつ、新しいURLのみを取得
      const usersToFetch = filteredUsers.filter(
        (user) => !userPhotoUrlMap[user.uid]
      )

      if (usersToFetch.length === 0) return

      try {
        await Promise.all(
          usersToFetch.map(async (user) => {
            if (!isMounted) return
            const url = await fetchUserPhoto(user)
            if (url) {
              newPhotoUrls[user.uid] = url
            }
          })
        )

        if (isMounted) {
          setUserPhotoUrlMap((prev) => ({
            ...prev,
            ...newPhotoUrls,
          }))
        }
      } catch (error) {
        console.error('画像URLの取得中にエラーが発生しました:', error)
      }
    }

    fetchPhotos()

    return () => {
      isMounted = false
      abortController.abort()
    }
  }, [filteredUsers, fetchUserPhoto, userPhotoUrlMap])

  return (
    <Sidebar
      collapsible="none"
      className="flex h-screen w-full flex-col border-l border-gray-200"
      side="right"
    >
      <SidebarHeader className="flex min-h-[77px] items-center justify-center border-b border-gray-200 pl-[15px]">
        <h3 className="font-semibold text-black">メンバーリスト</h3>
      </SidebarHeader>

      <SidebarContent className="scrollbar-thin scrollbar-track-gray-100 scrollbar-thumb-gray-300 scrollbar-thumb-rounded hover:scrollbar-thumb-gray-400 flex-grow overflow-y-auto">
        {filteredUsers.map((user) => (
          <div className="flex items-center p-[10px_15px]" key={user.uid}>
            <Avatar className="h-11 w-11">
              <AvatarImage
                src={userPhotoUrlMap[user.uid] || user.photoURL}
                className="object-cover"
              />
            </Avatar>
            <div className="flex items-center gap-[5px]">
              <h4 className="p-2 text-black">{user.displayName}</h4>
            </div>
          </div>
        ))}
      </SidebarContent>
    </Sidebar>
  )
}

export default MemberSidebar
