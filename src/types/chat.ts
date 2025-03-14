import { serverTimestamp } from 'firebase/firestore'

// ユーザー情報の型定義
export interface User {
  uid: string
  email?: string
  photoURL?: string
  displayName?: string
}

// メッセージ情報の型定義
export interface MessageData {
  message: string | null
  timestamp: ReturnType<typeof serverTimestamp>
  user: User | null
  photoId: string | null
  photoExtension?: string | null
  imageWidth?: number | null
  imageHeight?: number | null
  latitude?: number | null
  longitude?: number | null
  replyTo?: {
    messageId: string
    message: string | null
    displayName: string | null
    photoId: string | null
    photoExtension?: string | null
  }
  reactions?: {
    [key: string]: {
      messageId: string
      message: string | null
      displayName: string | null
      photoId: string | null
      photoExtension?: string | null
    }
  }
}

export interface ChatProps {
  isMemberSidebarOpen: boolean
  setIsMemberSidebarOpen: (isOpen: boolean) => void
  isMobileMenuOpen: boolean
  setIsMobileMenuOpen: (isOpen: boolean) => void
  isMapMode: boolean
  setIsMapMode: (isMapMode: boolean) => void
  setIsImageDialogOpen: (isOpen: boolean) => void
}
export interface ReplyInfo {
  messageId: string
  message: string | null
  displayName: string | null
  photoId: string | null
  photoExtension?: string | null
}
