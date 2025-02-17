import { configureStore} from "@reduxjs/toolkit";
import  userReducer  from "../features/userSlice";
import  channelReducer  from "../features/channelSlice";
import serverReducer from "../features/serverSlice"
export const store = configureStore({
    reducer: {
        user: userReducer,
        channel: channelReducer,
        server: serverReducer,
    },
})
//storeの中のdispatchの型(typeof)をAppDispatchに入れる
export type AppDispatch = typeof store.dispatch
//storeが現在持っている型(状態)
export type RootState = ReturnType<typeof store.getState> 