import { createSlice } from "@reduxjs/toolkit";
import { InitialUserState } from "../Types";

const initialState: InitialUserState = {
  user: null,
};

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
    //ユーザー情報を更新
    updateUserInfo: (state, action) => {
      //既存のユーザー情報がある場合のみ更新
      if (state.user) {
        //action.payloadのユーザー情報をマージ
        state.user = {
          ...state.user, //スプレッド構文で既存のプロパティを保持
          ...action.payload, //新しいプロパティで上書き
        };
      }
    },
  },
});

export const { login, logout, updateUserInfo } = userSlice.actions;
export default userSlice.reducer;
