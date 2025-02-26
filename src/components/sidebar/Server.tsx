import { useAppDispatch } from "../../app/hooks";
import { setServerInfo } from "../../features/serverSlice";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Props = {
  id: string;
  name: string;
  imageUrl: string;
  onClick?: () => void;
};

const Server = (props: Props) => {
  const { id, name, imageUrl } = props;
  const dispatch = useAppDispatch();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <div
            className="group w-12 h-12 rounded-[24px] mb-2 relative bg-zinc-700 cursor-pointer transition-all duration-200 ease-in-out hover:rounded-[16px] hover:bg-indigo-500 hover:scale-105"
            onClick={() =>
              dispatch(
                setServerInfo({
                  serverId: id,
                  serverName: name,
                })
              )
            }
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={name}
                className="w-full h-full rounded-[24px] object-cover transition-all duration-200 group-hover:rounded-[16px]"
              />
            ) : (
              <h3 className="text-white text-lg leading-[48px] text-center m-0">
                {name}
              </h3>
            )}
            <div className="absolute -left-[4px] top-1/2 -translate-y-1/2 w-[4px] h-5 bg-white rounded-r-sm opacity-0 transition-all duration-200 group-hover:opacity-100" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>{name}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default Server;
