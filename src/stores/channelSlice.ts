import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface ChannelState {
  channelId: string | null
  channelName: string | null
  createdBy: string | null
  setChannelInfo: (info: {
    channelId: string
    channelName: string
  }) => void
  resetChannelInfo: () => void
}

export const useChannelStore = create<ChannelState>()(
  devtools(
    (set) => ({
      channelId: null,
      channelName: null,
      createdBy: null,
      setChannelInfo: (info) =>
        set({
          channelId: info.channelId,
          channelName: info.channelName,
        }),
      resetChannelInfo: () =>
        set({
          channelId: null,
          channelName: null,
        }),
    }),
    { name: 'channel-store' }
  )
)
