import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { useChannelStore } from './channelSlice'

interface ServerState {
  serverId: string | null
  serverName: string | null
  setServerInfo: (info: { serverId: string; serverName: string }) => void
  resetServerInfo: () => void
}

export const useServerStore = create<ServerState>()(
  devtools(
    (set) => ({
      serverId: null,
      serverName: null,

      setServerInfo: (info) => {
        // チャンネル情報をリセット
        useChannelStore.getState().resetChannelInfo()

        // サーバー情報を設定
        set({
          serverId: info.serverId,
          serverName: info.serverName,
        })
      },

      resetServerInfo: () => {
        // チャンネル情報もリセット
        useChannelStore.getState().resetChannelInfo()

        // サーバー情報をリセット
        set({
          serverId: null,
          serverName: null,
        })
      },
    }),
    { name: 'server-store' }
  )
)
