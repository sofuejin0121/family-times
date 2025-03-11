import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { setServerInfo } from '../../features/serverSlice'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import useChannel from '../../hooks/useChannel'
import { setChannelInfo } from '../../features/channelSlice'
import { useEffect, useState } from 'react'
import { getCachedImageUrl } from '../../utils/imageUtils'
import { Edit, Trash, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { toast } from 'sonner'
import { EditServerDialog } from './EditServerDialog'

type Props = {
  id: string
  name: string
  photoId?: string | null
  photoExtension?: string | null
  onClick?: () => void
}

const Server = (props: Props) => {
  const { id, name, photoId, photoExtension } = props
  const [serverImageUrl, setServerImageUrl] = useState<string | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const dispatch = useAppDispatch()
  const { documents: channels } = useChannel()
  const navigate = useNavigate()
  const user = useAppSelector((state) => state.user.user)
  const [isServerOwner, setIsServerOwner] = useState(false)

  // サーバーの所有者かどうかを確認
  useEffect(() => {
    const checkServerOwnership = async () => {
      if (!user?.uid) return

      try {
        const serverDoc = await getDoc(doc(db, 'servers', id))
        if (serverDoc.exists()) {
          const serverData = serverDoc.data()
          setIsServerOwner(serverData.createdBy === user.uid)
        }
      } catch (error) {
        console.error('サーバー情報の取得に失敗しました:', error)
      }
    }

    checkServerOwnership()
  }, [id, user?.uid])

  // 画像URLを取得
  useEffect(() => {
    const fetchImageUrl = async () => {
      if (photoId && photoExtension) {
        try {
          const url = await getCachedImageUrl(
            photoId,
            photoExtension,
            'servers'
          )
          if (url) {
            setServerImageUrl(url)
          }
        } catch (error) {
          console.error('サーバー画像の取得に失敗しました:', error)
          setServerImageUrl(null)
        }
      } else {
        setServerImageUrl(null)
      }
    }
    fetchImageUrl()
  }, [photoId, photoExtension])

  const handleServerClick = () => {
    dispatch(
      setServerInfo({
        serverId: id,
        serverName: name,
      })
    )
    //そのサーバーにチャンネルが存在する場合
    if (channels.length > 0) {
      //最初のチャンネル(channels[0])を選択状態にする
      dispatch(
        setChannelInfo({
          channelId: channels[0].id,
          channelName: channels[0].channel.channelName,
        })
      )
    }
  }

  const handleEditServer = () => {
    setIsEditDialogOpen(true)
  }

  const handleDeleteServer = async () => {
    if (!isServerOwner) {
      toast.error('サーバーの削除権限がありません')
      return
    }

    if (
      window.confirm(
        '本当にこのサーバーを削除しますか？この操作は元に戻せません。'
      )
    ) {
      try {
        await deleteDoc(doc(db, 'servers', id))
        toast.success('サーバーを削除しました')
        navigate('/')
      } catch (error) {
        console.error('サーバー削除エラー:', error)
        toast.error('サーバーの削除に失敗しました')
      }
    }
  }

  const handleLeaveServer = async () => {
    if (isServerOwner) {
      toast.error(
        'サーバーのオーナーは退出できません。サーバーを削除するか、オーナー権限を譲渡してください。'
      )
      return
    }

    if (window.confirm('本当にこのサーバーから退出しますか？')) {
      try {
        const serverRef = doc(db, 'servers', id)
        const serverDoc = await getDoc(serverRef)

        if (serverDoc.exists() && user?.uid) {
          const serverData = serverDoc.data()
          const members = { ...serverData.members }

          // 自分をメンバーから削除
          if (members[user.uid]) {
            delete members[user.uid]
            await updateDoc(serverRef, { members })
            toast.success('サーバーを退出しました')
            navigate('/')
          }
        }
      } catch (error) {
        console.error('サーバー退出エラー:', error)
        toast.error('サーバーからの退出に失敗しました')
      }
    }
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <div
                className="group relative m-2 flex h-12 w-12 cursor-pointer items-center justify-center rounded-[24px] bg-zinc-700 text-white transition-all duration-200 ease-in-out hover:scale-105 hover:rounded-[16px] hover:bg-indigo-500"
                onClick={handleServerClick}
              >
                {serverImageUrl ? (
                  <img
                    src={serverImageUrl}
                    alt={name}
                    className="h-full w-full rounded-[24px] object-cover transition-all duration-200 group-hover:rounded-[16px]"
                  />
                ) : (
                  <h3 className="text-base text-white">{name}</h3>
                )}
                <div className="absolute top-1/2 -left-[4px] h-5 w-[4px] -translate-y-1/2 rounded-r-sm bg-white opacity-0 transition-all duration-200 group-hover:opacity-100" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="tooltip-arrow">
              <p>{name}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-56">
        <ContextMenuItem onClick={handleEditServer}>
          <Edit className="mr-2 h-4 w-4" />
          <span>サーバーを編集</span>
        </ContextMenuItem>

        {isServerOwner && (
          <ContextMenuItem onClick={handleEditServer}>
            <Edit className="mr-2 h-4 w-4" />
            <span>サーバーを編集</span>
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        {isServerOwner ? (
          <ContextMenuItem
            onClick={handleDeleteServer}
            className="text-red-500 focus:text-red-500"
          >
            <Trash className="mr-2 h-4 w-4" />
            <span>サーバーを削除</span>
          </ContextMenuItem>
        ) : (
          <ContextMenuItem
            onClick={handleLeaveServer}
            className="text-red-500 focus:text-red-500"
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>サーバーから退出</span>
          </ContextMenuItem>
        )}
      </ContextMenuContent>

      {/* サーバー編集ダイアログ */}
      <EditServerDialog
        isOpen={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        serverId={id}
        serverName={name}
        serverPhotoId={photoId}
        serverPhotoExtension={photoExtension}
      />
    </ContextMenu>
  )
}

export default Server
