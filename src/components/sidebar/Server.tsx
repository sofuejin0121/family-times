import { useAppDispatch } from "../../app/hooks";
import { setServerInfo } from "../../features/serverSlice";
import "./Server.scss";
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
      {imageUrl ? (
        <img src={imageUrl} alt={name} />
      ) : (
        <h3>{name}</h3>
      )}
    </div>
  );
};

export default Server;
