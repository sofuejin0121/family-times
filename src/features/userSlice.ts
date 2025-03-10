import { createSlice, createAction } from "@reduxjs/toolkit";
import { InitialUserState } from "../Types";

interface UserState {
  user: {
    uid: string
    email: string
    photo: string
    photoId?: string
    photoExtension?: string
    displayName: string
  } | null
  isLoading: boolean
}

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
      if (state.user) {
        state.user = {
          ...state.user,
          displayName: action.payload.displayName || state.user.displayName,
          photo: action.payload.photo || state.user.photo,
          photoId: action.payload.photoId || state.user.photoId,
          photoExtension: action.payload.photoExtension || state.user.photoExtension,
        };
      }
    },
  },
});

export const { login, logout, startAuthCheck, finishAuthCheck } = userSlice.actions;
export default userSlice.reducer;

export const updateUserInfo = createAction<{
  displayName?: string
  photo?: string
  photoId?: string
  photoExtension?: string
}>('user/updateUserInfo')
