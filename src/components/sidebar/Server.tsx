import { useAppDispatch } from "../../app/hooks";
import { setServerInfo } from "../../features/serverSlice";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import useChannel from "../../hooks/useChannel";
import { setChannelInfo } from "../../features/channelSlice";

type Props = {
  id: string;
  name: string;
  imageUrl: string;
  onClick?: () => void;
};

const Server = (props: Props) => {
  const { id, name, imageUrl } = props;
  const dispatch = useAppDispatch();
  const { documents: channels } = useChannel();

  const handleServerClick = () => {
    dispatch(
      setServerInfo({
        serverId: id,
        serverName: name,
      })
    );
    //そのサーバーにチャンネルが存在する場合
    if (channels.length > 0) {
      //最初のチャンネル(channels[0])を選択状態にする
      dispatch(
        setChannelInfo({
          channelId: channels[0].id,
          channelName: channels[0].channel.channelName,
        })
      );
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <div
            className="m-2 flex items-center justify-center text-white group w-12 h-12 rounded-[24px] relative bg-zinc-700 cursor-pointer transition-all duration-200 ease-in-out hover:rounded-[16px] hover:bg-indigo-500 hover:scale-105"
            onClick={handleServerClick}
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={name}
                className="w-full h-full rounded-[24px] object-cover transition-all duration-200 group-hover:rounded-[16px]"
              />
            ) : (
              <h3 className="text-white text-base">
                {name}
              </h3>
            )}
            <div className="absolute -left-[4px] top-1/2 -translate-y-1/2 w-[4px] h-5 bg-white rounded-r-sm opacity-0 transition-all duration-200 group-hover:opacity-100" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="tooltip-arrow">
          <p>{name}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default Server;
