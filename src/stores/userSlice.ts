import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface User {
  uid: string
  email: string
  photo: string
  photoId?: string
  photoExtension?: string
  displayName: string
}

interface UserState {
  user: User | null
  isAuthChecking: boolean
  login: (user: User) => void
  logout: () => void
  startAuthCheck: () => void
  finishAuthCheck: () => void
  updateUserInfo: (info: {
    displayName?: string
    photo?: string
    photoId?: string
    photoExtension?: string
  }) => void
}

export const useUserStore = create<UserState>()(
  devtools(
    (set) => ({
      user: null,
      isAuthChecking: true,

      login: (user) => set({ user, isAuthChecking: false }),
      logout: () => set({ user: null, isAuthChecking: false }),
      startAuthCheck: () => set({ isAuthChecking: true }),
      finishAuthCheck: () => set({ isAuthChecking: false }),
      updateUserInfo: (info) =>
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                displayName: info.displayName || state.user.displayName,
                photo: info.photo || state.user.photo,
                photoId: info.photoId || state.user.photoId,
                photoExtension:
                  info.photoExtension || state.user.photoExtension,
              }
            : null,
        })),
    }),
    { name: 'user-store' }
  )
)
