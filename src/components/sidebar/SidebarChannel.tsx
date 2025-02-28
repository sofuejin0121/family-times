import { useAppDispatch } from "../../app/hooks";
import { setChannelInfo } from "../../features/channelSlice";
import { DocumentData } from "firebase/firestore";

type Props = {
  id: string;
  channel: DocumentData;
  onClick?: () => void;
};

const SidebarChannel = (props: Props) => {
  const { id, channel, onClick } = props;
  const dispatch = useAppDispatch();
  
  const handleClick = () => {
    dispatch(
      setChannelInfo({
        channelId: id,
        channelName: channel.channel.channelName,
      })
    );
    if (onClick) onClick();
  };
  
  return (
    <div
      className="pl-5 mt-0.5 group"
      onClick={handleClick}
    >
      <h4 className="flex items-center p-1.5 text-gray-700 text-base cursor-pointer group-hover:text-black group-hover:bg-gray-100 group-hover:rounded-md transition-colors">
        <span className="text-xl pr-2.5 text-gray-500">#</span>
        {channel.channel.channelName}
      </h4>
    </div>
  );
};

export default SidebarChannel;
