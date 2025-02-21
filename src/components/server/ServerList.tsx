import { useState } from "react"
import { CreateInvite } from "../createInvite/CreateInvite";
import useServer from "../../hooks/useServer";
import { JoinServer } from "../sidebar/JoinServer";
import Server from "../sidebar/Server";


const ServerList = () => {
    //選択されているサーバーを表示するための表示
    const {documents: servers} = useServer();
    const [selectedServer, setSelectedServer] = useState<string | null>(null);

    return (
        <div className="server-layout">
            {/* サーバーリストを表示 */}
            <div className="server-list">
                {servers.map((server) => (
                    <Server key={server.id} id={server.id} name={server.docData.name} onClick={() => setSelectedServer(server.id)}/>
                ))}
            </div>
            {/* サーバーの詳細とアクション部分 */}
            <div className="server-details">
                {selectedServer && (
                    <>
                        <h2>サーバー設定</h2>
                        {/* 招待コード生成 */}
                        <CreateInvite/>
                    </>
                )}
            </div>

            {/* サーバー参加用のモーダルページ */}
            <div className="join-server-selection">
                <JoinServer />
            </div>
        </div>
    )
}

export default ServerList