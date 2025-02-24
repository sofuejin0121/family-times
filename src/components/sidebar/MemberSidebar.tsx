import "./MemberSidebar.scss";
import useUsers from "../../hooks/useUsers";
import useServer from "../../hooks/useServer";
import { useAppSelector } from "../../app/hooks";
const MemberSidebar = () => {
  const { documents: users } = useUsers();
  const serverId = useAppSelector((state) => state.server.serverId);
  const { documents: servers } = useServer();
  // 現在選択しているサーバーのドキュメントを取得する
  const server = servers.find((server) => server.id === serverId);
  // 取得した単一のserver docからObject.keysを使って、membersオブジェクトのkeyの配列を取得する（これがuniqueIds）
  const uniqueIds = Object.keys(server?.docData.members || {});
  return (
    <div className="memberList">
      <div className="memberListHeader">
        <h3>メンバーリスト</h3>
      </div>

      {users
        .filter((user) => uniqueIds.includes(user.uid))
        .map((user) => (
          <div className="memberAccount">
            <img src={user.photoURL} />
            <div className="memberName">
              <h4>{user.displayName}</h4>
            </div>
          </div>
        ))}
    </div>
  );
};

export default MemberSidebar;
