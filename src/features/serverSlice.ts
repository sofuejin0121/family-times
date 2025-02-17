import { createSlice} from "@reduxjs/toolkit"
import { InitialServerState } from "../Types";

const initialState: InitialServerState = {
    serverId: null,
    serverName: null,
}

export const serverSlice = createSlice({
    name: "servers",
    //initialState: initialState key: valueが同じ場合は省略できる.
    initialState,
    reducers: {
        setServerInfo: (state, action) => {
            state.serverId = action.payload.serverId
            state.serverName = action.payload.serverName
        }
    },
});

export const {setServerInfo} = serverSlice.actions
export default serverSlice.reducer