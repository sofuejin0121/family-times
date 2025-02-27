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
    <div className="w-60 bg-white h-screen flex flex-col border-l border-gray-200">
      <div className=" pl-[15px] border-b border-gray-200 min-h-[77px] flex items-center">
        <h3 className="text-black">メンバーリスト</h3>
      </div>

      <div className="flex-grow overflow-y-auto scrollbar-thin scrollbar-track-gray-100 scrollbar-thumb-gray-300 scrollbar-thumb-rounded hover:scrollbar-thumb-gray-400">
        {users
          .filter((user) => uniqueIds.includes(user.uid))
          .map((user) => (
            <div className="flex items-center p-[10px_15px]" key={user.uid}>
              <img src={user.photoURL} className="w-[50px] mr-[10px]" />
              <div className="flex items-center gap-[5px]">
                <h4 className="text-black">{user.displayName}</h4>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};

export default MemberSidebar;
