import { createSlice } from "@reduxjs/toolkit";
import { InitialUserState } from "../Types";

const initialState: InitialUserState = {
  user: null,
  isAuthChecking: true, //認証状態確認中フラグ
};

export const userSlice = createSlice({
  name: "user",
  //initialState: initialState key: valueが同じ場合は省略できる.
  initialState,
  reducers: {
    login: (state, action) => {
      state.user = action.payload;
      state.isAuthChecking = false;
    },
    logout: (state) => {
      state.user = null;
      state.isAuthChecking = false;
    },
    //認証状態確認開始
    startAuthCheck: (state) => {
      state.isAuthChecking = true;
    },
    //認証状態確認終了
    finishAuthCheck: (state) => {
      state.isAuthChecking = false;
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

export const { login, logout, updateUserInfo,startAuthCheck,finishAuthCheck  } = userSlice.actions;
export default userSlice.reducer;
