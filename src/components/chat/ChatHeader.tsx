import SearchIcon from "@mui/icons-material/Search";
import { Input } from "../ui/input";

interface Props {
  channelName: string | null;
  onSearchMessage: React.Dispatch<React.SetStateAction<string>>;
}
const ChatHeader = (props: Props) => {
  const { channelName, onSearchMessage } = props;

  return (
    <div className="flex items-center justify-between w-full min-h-[77px] border-b">
      <div className="pl-[15px]">
        <h3 className="text-black">
          <span className="text-[#7b7c85] pr-[7px]">#</span>
          {channelName}
        </h3>
      </div>
      <div className="pr-[15px] flex items-center gap-[13px] text-[#7b7c85]">
        <div className="flex items-center p-[3px] rounded-[3px]">
          <Input
            type="text"
            placeholder="検索"
            onChange={(e) => onSearchMessage(e.target.value)}
          />
          <SearchIcon className="cursor-pointer" />
        </div>
      </div>
    </div>
  );
};

export default ChatHeader;
