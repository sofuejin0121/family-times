import { useState } from 'react'
import { NavigateFunction } from 'react-router-dom'
import { auth, db, provider } from '../../firebase'
import {
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  User,
} from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { toast } from 'sonner'

export const useAuth = (navigate: NavigateFunction) => {
  const [isLoading, setIsLoading] = useState(false)

  // エラーハンドリングのユーティリティ関数
  const handleError = (error: unknown, defaultMessage: string) => {
    const errorMessage = error instanceof Error ? error.message : defaultMessage
    toast.error(errorMessage)
    console.error(error)
    return errorMessage
  }

  // Googleログイン処理
  const signInWithGoogle = async () => {
    try {
      const credential = await signInWithPopup(auth, provider)
      if (credential) {
        await saveUserToFirestore(credential.user)
      }
    } catch (error) {
      handleError(error, 'Googleログインに失敗しました')
    }
  }

  // メール/パスワードでログイン
  const signInWithEmail = async (email: string, password: string) => {
    if (!email || !password) {
      toast.error('メールアドレスとパスワードを入力してください')
      return
    }

    setIsLoading(true)

    try {
      const result = await signInWithEmailAndPassword(auth, email, password)

      // メール認証が完了しているか確認
      if (!result.user.emailVerified) {
        toast.info(
          'メール認証が完了していません。受信したメールのリンクをクリックしてください。'
        )

        // メール認証メールを再送信
        try {
          await sendEmailVerification(result.user, {
            url: `${window.location.origin}/login`,
            handleCodeInApp: false,
          })
          toast.info(
            'メールアドレス宛に認証リンクを送信しました。受信したメールのリンクをクリックしてください。'
          )
        } catch (error) {
          handleError(error, '認証メールの送信に失敗しました')
        }

        // ログアウトさせる
        await auth.signOut()
      }
      // ログイン成功時はFirebase Auth状態変更イベントで自動的に処理されます
    } catch (error) {
      handleError(error, 'ログインに失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  // 新規アカウント作成（メール認証付き）
  const createAccount = async (email: string, password: string) => {
    if (!email || !password) {
      toast.error('メールアドレスとパスワードを入力してください')
      return
    }

    if (password.length < 8) {
      toast.error('パスワードは8文字以上で入力してください')
      return
    }

    setIsLoading(true)

    try {
      // アカウント作成
      const credential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      )
      const newUser = credential.user

      // メール認証リンクを送信
      try {
        await sendEmailVerification(newUser, {
          url: `${window.location.origin}/login`,
          handleCodeInApp: false,
        })

        toast.success(
          'アカウントを作成しました。メールアドレス宛に送信された認証リンクをクリックして登録を完了してください。'
        )

        // ユーザーをログアウト
        await auth.signOut()

        toast('登録したメールアドレスを確認してください', {
          description: '認証リンクのクリックでログイン可能になります',
          duration: 6000,
        })
      } catch (error) {
        handleError(
          error,
          '認証メールの送信に失敗しました。管理者にお問い合わせください。'
        )
        await auth.signOut()
      }
    } catch (error) {
      handleError(error, 'アカウント作成に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  // Firestoreにユーザー情報を保存
  const saveUserToFirestore = async (user: User) => {
    try {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          uid: user.uid,
          photoURL: user.photoURL,
          email: user.email,
          displayName: user.displayName,
          phoneNumber: user.phoneNumber,
          createdAt: new Date(),
        },
        { merge: true }
      )

      return true
    } catch (error) {
      handleError(error, 'ユーザー情報の保存に失敗しました')
      return false
    }
  }

  // ログイン成功後の処理
  const handleSuccessfulLogin = (user: User) => {
    // プロフィール設定状態に基づいてリダイレクト
    setTimeout(() => {
      if (
        !user.displayName ||
        user.displayName === '' ||
        user.displayName === '名称未設定' ||
        !user.photoURL
      ) {
        navigate('/profile')
      }
      // それ以外はデフォルトリダイレクト（このケースではコンポーネントに何もしない）
    }, 500)
  }

  return {
    isLoading,
    signInWithGoogle,
    signInWithEmail,
    createAccount,
    saveUserToFirestore,
    handleSuccessfulLogin,
  }
}
