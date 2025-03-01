import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Menu } from "lucide-react";
import { Users } from 'lucide-react';
interface Props {
  channelName: string | null;
  onSearchMessage: React.Dispatch<React.SetStateAction<string>>;
  onToggleMemberSidebar: () => void;
  onToggleMobileMenu: () => void;

}

const ChatHeader = (props: Props) => {
  const { channelName, onSearchMessage, onToggleMemberSidebar, onToggleMobileMenu } = props;

  return (
    <div className="flex items-center justify-between w-full min-h-[77px] border-b border-gray-200">
      <div className="pl-[15px] flex items-center gap-[13px]">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onToggleMobileMenu}>
          <Users className="h-5 w-5 " />
        </Button>
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
            className="md:w-auto w-[120px]"
          />
        </div>

        {/* モバイル用メンバーリストトグルボタン */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onToggleMemberSidebar}
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};

export default ChatHeader;
