import { createSlice } from '@reduxjs/toolkit'
import { InitialServerState } from '../Types'

const initialState: InitialServerState = {
  serverId: null,
  serverName: null,
}

export const serverSlice = createSlice({
  name: 'servers',
  //initialState: initialState key: valueが同じ場合は省略できる.
  initialState,
  reducers: {
    setServerInfo: (state, action) => {
      state.serverId = action.payload.serverId
      state.serverName = action.payload.serverName
    },
    resetServerInfo: (state) => {
      state.serverId = null
      state.serverName = null
    },
  },
})

export const { setServerInfo, resetServerInfo } = serverSlice.actions
export default serverSlice.reducer
