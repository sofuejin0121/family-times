import "./ChatHeader.scss";
import SearchIcon from "@mui/icons-material/Search";

interface Props {
  channelName: string | null;
  onSearchMessage: React.Dispatch<React.SetStateAction<string>>;
}
const ChatHeader = (props: Props) => {
  const { channelName, onSearchMessage } = props;

  return (
    <div className="chatHeader">
      <div className="chatHeaderLeft">
        <h3>
          <span className="chatHeaderHash">#</span>
          {channelName}
        </h3>
      </div>
      <div className="chatHeaderRight">
        <div className="chatHeaderSearch">
          <input
            type="text"
            placeholder="検索"
            onChange={(e) => onSearchMessage(e.target.value)}
          />
          <SearchIcon />
        </div>
      </div>
    </div>
  );
};

export default ChatHeader;
