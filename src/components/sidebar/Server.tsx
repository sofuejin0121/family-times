import { useAppDispatch } from "../../app/hooks";
import { setServerInfo } from "../../features/serverSlice";
import "./Server.scss";
type Props = {
  id: string;
  name: string;
  onClick?: () => void;
};
const Server = (props: Props) => {
  const { id, name } = props;
  const dispatch = useAppDispatch();

  return (
    <div
      className="serverIcon"
      onClick={() =>
        dispatch(
          setServerInfo({
            serverId: id,
            serverName: name,
          })
        )
      }
    >
      <h3>{name}</h3>
    </div>
  );
};

export default Server;
