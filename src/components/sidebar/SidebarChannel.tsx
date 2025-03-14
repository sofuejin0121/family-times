import { useChannelStore } from '../../stores/channelSlice'
import { DocumentData } from 'firebase/firestore'

type Props = {
  id: string
  channel: DocumentData
  onClick?: () => void
}

const SidebarChannel = (props: Props) => {
  const { id, channel, onClick } = props

  const handleClick = () => {
    useChannelStore.getState().setChannelInfo({
      channelId: id,
      channelName: channel.channel.channelName,
    })
    if (onClick) onClick()
  }

  return (
    <div className="group mt-0.5 pl-5" onClick={handleClick}>
      <h4 className="flex cursor-pointer items-center p-1.5 text-base text-gray-700 transition-colors group-hover:rounded-md group-hover:bg-gray-100 group-hover:text-black">
        <span className="pr-2.5 text-xl text-gray-500">#</span>
        {channel.channel.channelName}
      </h4>
    </div>
  )
}

export default SidebarChannel
