import React, { useState, useEffect, FC } from 'react'
import { requestNotificationPermission } from '../firebase'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const NotificationPrompt: FC = () => {
  const [isPWA, setIsPWA] = useState<boolean>(false)
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallPrompt, setShowInstallPrompt] = useState<boolean>(false)
  const [installable, setInstallable] = useState<boolean>(false)

  useEffect(() => {
    // PWAとしてインストールされているか確認
    const checkIfPWA = (): void => {
      const isPWAInstalled: boolean =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        window.matchMedia('(display-mode: minimal-ui)').matches ||
        (window.navigator as unknown as { standalone: boolean }).standalone ===
          true

      setIsPWA(isPWAInstalled)

      // PWAがインストールされていない場合、インストール可能と判断
      if (!isPWAInstalled) {
        setInstallable(true)
      }
    }

    checkIfPWA()

    // インストールプロンプトイベントをキャプチャ
    const handleBeforeInstallPrompt = (e: Event): void => {
      // プロンプトの自動表示を防止
      e.preventDefault()
      // イベントを保存
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      // インストールプロンプトを表示
      setShowInstallPrompt(true)
      // インストール可能フラグを設定
      setInstallable(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // アプリがインストールされたときのイベント
    window.addEventListener('appinstalled', () => {
      console.log('PWAがインストールされました')
      setIsPWA(true)
      setInstallable(false)
      setShowInstallPrompt(false)
    })

    // display-modeの変更を監視
    const mediaQuery = window.matchMedia('(display-mode: standalone)')
    const handleDisplayModeChange = () => {
      checkIfPWA()
    }

    // 新しいAPIと古いAPIの両方をサポート
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleDisplayModeChange)
    } else {
      mediaQuery.addListener(handleDisplayModeChange)
    }

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      )
      window.removeEventListener('appinstalled', () => {
        console.log('PWAのインストールイベントリスナーを削除しました')
      })

      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleDisplayModeChange)
      } else {
        mediaQuery.removeListener(handleDisplayModeChange)
      }
    }
  }, [])

  // PWAをインストールする関数
  const installPWA = async (): Promise<void> => {
    if (!deferredPrompt) return

    // インストールプロンプトを表示
    await deferredPrompt.prompt()

    // ユーザーの選択を待機
    const { outcome } = await deferredPrompt.userChoice
    console.log(`ユーザーの選択: ${outcome}`)

    // インストールが受け入れられた場合
    if (outcome === 'accepted') {
      setIsPWA(true)
      setInstallable(false)
    }

    // deferredPromptをクリア
    setDeferredPrompt(null)
    setShowInstallPrompt(false)
  }

  // 通知を有効化する関数
  const enableNotifications = async (): Promise<void> => {
    const result = await requestNotificationPermission()
    if (result) {
      console.log('通知が有効化されました')
    } else {
      console.log('通知の有効化に失敗しました')
    }
  }

  // PWAではなく、インストール可能な場合にインストールプロンプトを表示
  if (!isPWA && installable && showInstallPrompt) {
    return (
      <div className="notification-prompt fixed top-0 right-0 left-0 z-50 flex items-center justify-between bg-blue-500 p-4 text-white">
        <p className="font-medium">
          アプリをインストールして通知を受け取りましょう
        </p>
        <button
          onClick={installPWA}
          className="rounded-md bg-white px-4 py-2 font-medium text-blue-500 transition-colors hover:bg-blue-100"
        >
          アプリをインストール
        </button>
      </div>
    )
  }

  // PWAとしてインストール済みで、通知許可がまだの場合に通知プロンプトを表示
  if (isPWA && Notification.permission !== 'granted') {
    return (
      <div className="notification-prompt fixed top-0 right-0 left-0 z-50 flex items-center justify-between bg-blue-500 p-4 text-white">
        <p className="font-medium">
          通知を有効にして最新情報を受け取りましょう
        </p>
        <button
          onClick={enableNotifications}
          className="rounded-md bg-white px-4 py-2 font-medium text-blue-500 transition-colors hover:bg-blue-100"
        >
          通知を有効化
        </button>
      </div>
    )
  }

  return null
}

export default NotificationPrompt
