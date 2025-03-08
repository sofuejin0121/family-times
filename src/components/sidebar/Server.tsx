import { useAppDispatch } from '../../app/hooks'
import { setServerInfo } from '../../features/serverSlice'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import useChannel from '../../hooks/useChannel'
import { setChannelInfo } from '../../features/channelSlice'

type Props = {
  id: string
  name: string
  imageUrl: string
  onClick?: () => void
}

const Server = (props: Props) => {
  const { id, name, imageUrl } = props
  const dispatch = useAppDispatch()
  const { documents: channels } = useChannel()

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

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <div
            className="group relative m-2 flex h-12 w-12 cursor-pointer items-center justify-center rounded-[24px] bg-zinc-700 text-white transition-all duration-200 ease-in-out hover:scale-105 hover:rounded-[16px] hover:bg-indigo-500"
            onClick={handleServerClick}
          >
            {imageUrl ? (
              <img
                src={imageUrl}
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
  )
}

export default Server
