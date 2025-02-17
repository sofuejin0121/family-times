import { createSlice} from "@reduxjs/toolkit"
import { InitialUserState } from "../Types";

const initialState: InitialUserState = {
    user: null
}

export const userSlice = createSlice({
    name: "user",
    //initialState: initialState key: valueが同じ場合は省略できる.
    initialState,
    reducers: {
        login: (state, action) => {

            state.user = action.payload;
        },
        logout: (state) => {
            state.user = null;
        },
    },
});

export const {login, logout} = userSlice.actions
export default userSlice.reducer