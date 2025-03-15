/**
 * メッセージ送信機能を提供するReactカスタムフック
 *
 * カスタムフックとは？
 * - React のロジックを再利用可能な関数として切り出したもの
 * - コンポーネントから独立した形で複雑な処理を管理できる
 * - 名前が「use」で始まるのが命名規則
 */

// 必要なライブラリと型をインポート
import { useState, useCallback, RefObject, FormEvent } from 'react' // React のフック関連
import { addDoc, collection, serverTimestamp } from 'firebase/firestore' // Firebase データベース操作用
import { db } from '../../../firebase' // Firebase 初期化済みインスタンス
import { toast } from 'sonner' // 通知表示ライブラリ
import { uploadWithAvifConversion } from '../../../utils/imageUtils' // 画像変換アップロード関数
import * as Sentry from '@sentry/react' // エラー監視サービス
import { User, MessageData, ReplyInfo } from '../../../types/chat' // 型定義

/**
 * カスタムフックに渡す引数の型定義
 * TypeScript の interface で型の構造を定義
 */
interface UseMessageSendingProps {
  serverId: string | null // メッセージを送信するサーバーのID
  channelId: string | null // メッセージを送信するチャンネルのID
  user: User | null // 現在ログイン中のユーザー情報
  fileInputRef: RefObject<HTMLInputElement> // ファイル選択入力要素への参照
  replyingTo: ReplyInfo | null // 返信中のメッセージ情報
  setReplyingTo: (reply: ReplyInfo | null) => void // 返信情報を設定する関数
  setRepliedMessageId: (id: string | null) => void // 返信済みメッセージIDを設定する関数
  scrollToBottom: () => void // チャット画面を一番下までスクロールする関数
}

/**
 * メッセージ送信機能を集約したカスタムフック
 *
 * このフックは以下の機能を提供:
 * 1. テキストメッセージの管理
 * 2. 画像の選択、プレビュー、アップロード
 * 3. 画像のEXIFデータからの位置情報取得
 * 4. メッセージの送信処理
 *
 * @param props フックの設定オプション
 * @returns メッセージ機能に関する状態と関数
 */
export const useMessageSending = ({
  serverId,
  channelId,
  user,
  fileInputRef,
  replyingTo,
  setReplyingTo,
  setRepliedMessageId,
  scrollToBottom,
}: UseMessageSendingProps) => {
  // 各種の状態(state)をuseStateフックで定義

  // メッセージ入力テキスト
  const [inputText, setInputText] = useState<string>('')

  // 画像アップロード中かどうか
  const [isUploading, setIsUploading] = useState(false)

  // 選択された画像ファイル
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  // 選択された画像のプレビューURL
  const [selectedFilePreview, setSelectedFilePreview] = useState<string | null>(
    null
  )

  // 画像の幅と高さ
  const [fileImageDimensions, setFileImageDimensions] = useState<{
    width: number
    height: number
  } | null>(null)

  // 画像から抽出した位置情報（緯度・経度）
  const [imageLocation, setImageLocation] = useState<{
    latitude: number
    longitude: number
  } | null>(null)

  /**
   * 選択されたファイルをクリアする関数
   *
   * useCallbackとは？
   * - 関数をメモ化するReactのフック
   * - 依存配列が変更されない限り、同じ関数インスタンスが再利用される
   * - パフォーマンス最適化のために使用
   */
  const clearSelectedFile = useCallback(() => {
    if (selectedFilePreview) {
      // プレビュー用のURLを破棄
      // URL.revokeObjectURL: 作成されたオブジェクトURLを解放するブラウザAPI
      URL.revokeObjectURL(selectedFilePreview)
    }
    // 各状態をリセット
    setSelectedFile(null)
    setSelectedFilePreview(null)
    setFileImageDimensions(null)

    // ファイル選択入力フィールドをクリア
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [selectedFilePreview, fileInputRef]) // 依存配列: これらが変わったときだけ関数を再作成

  /**
   * ファイル選択時のイベントハンドラ
   *
   * - ファイルサイズのチェック
   * - プレビュー表示の設定
   * - EXIFデータからの位置情報抽出
   *
   * @param e 入力変更イベント
   */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // ファイルが選択された場合
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      console.log('選択されたファイル:', file.name, file.type, file.size)

      // ファイルサイズのチェック（5MB制限）
      const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
      // ファイルサイズが5MBを超える場合はエラー
      if (file.size > MAX_FILE_SIZE) {
        // トースト通知でエラーを表示
        toast.error('ファイルサイズが大きすぎます (最大: 5MB)', {
          duration: 3000, // 3秒間表示
        })
        e.target.value = '' // 入力フィールドをクリア
        return
      }

      // 選択したファイルを状態に保存
      setSelectedFile(file)

      // プレビュー用のURLを作成
      // URL.createObjectURL: ファイルオブジェクトからブラウザ内URLを生成
      const previewURL = URL.createObjectURL(file)
      setSelectedFilePreview(previewURL)

      // 画像のサイズ（幅と高さ）を取得
      const img = new Image() // 新しいイメージオブジェクトを作成
      img.onload = () => {
        // 画像読み込み完了時に実行
        setFileImageDimensions({
          width: img.width,
          height: img.height,
        })
      }
      img.src = previewURL // 画像のロード開始

      // 画像のEXIFメタデータ処理
      try {
        // exifrライブラリを動的インポート
        // 動的インポート: 必要になった時点でライブラリを読み込む仕組み
        const exifr = await import('exifr')

        // 全メタデータを取得（GPS情報を含む）
        const allMetadata = await exifr.default.parse(file, { gps: true })
        console.log('すべてのメタデータ:', allMetadata)

        // 緯度経度がメタデータに含まれている場合
        if (
          typeof allMetadata?.latitude === 'number' &&
          typeof allMetadata?.longitude === 'number'
        ) {
          const locationData = {
            latitude: allMetadata.latitude,
            longitude: allMetadata.longitude,
          }

          // NaN(Not a Number)チェック
          // 数値として不正な値が入っていないか確認
          if (isNaN(locationData.latitude) || isNaN(locationData.longitude)) {
            // Sentryにエラーログを送信（モニタリングサービス）
            Sentry.captureMessage(
              'EXIFから取得した位置情報にNaNが含まれています',
              {
                level: 'warning',
                extra: {
                  // 追加情報
                  locationData,
                  allMetadata,
                  fileInfo: {
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    lastModified: file.lastModified,
                  },
                  userAgent: navigator.userAgent,
                  platform: navigator.platform,
                  isAndroid: /android/i.test(navigator.userAgent),
                },
              }
            )
            console.error(
              'EXIFから取得した位置情報にNaNが含まれています:',
              locationData,
              allMetadata
            )
            setImageLocation(null) // 不正な値なので位置情報をクリア
          } else {
            console.log('exifrから直接緯度経度を取得:', locationData)
            setImageLocation(locationData) // 位置情報を状態に保存
            toast.success('写真から位置情報を取得しました')
          }
        }
      } catch (error) {
        console.error('メタデータ取得エラー:', error)
        // Sentryにエラーログを送信
        Sentry.captureException(error, {
          extra: {
            fileInfo: {
              name: file.name,
              type: file.type,
              size: file.size,
              lastModified: file.lastModified,
            },
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            isAndroid: /android/i.test(navigator.userAgent),
          },
        })
        setImageLocation(null) // エラー時は位置情報をクリア
      }

      // メッセージ入力欄にフォーカスを当てる
      document.getElementById('message-input')?.focus()
    }
  }

  /**
   * メッセージ送信処理を行う関数
   *
   * - テキストメッセージ送信
   * - 画像のアップロードとAVIF変換
   * - Firestoreへの保存
   *
   * @param e フォーム送信イベント
   */
  const sendMessage = async (e: FormEvent) => {
    // フォームのデフォルト送信動作をキャンセル
    e.preventDefault()

    // アップロード中状態に設定
    setIsUploading(true)

    try {
      // 画像関連の変数を初期化
      let photoId = null
      let photoExtension = null
      let imageWidth = null
      let imageHeight = null
      let locationData = null // EXIF位置情報用

      // 画像がある場合の処理
      if (selectedFile) {
        // AVIF形式に変換してアップロード
        // uploadWithAvifConversionが呼び出されると、以下の処理が行われる
        // 1. `WorkerManager.getInstance()`でWorkerManagerの単一インスタンスを取得 (workerUtils)
        // 2. `workerManager.encodeToAvif()`で画像データと変換オプションをWorkerに送信
        // 3. Web Worker (avifWorker) が画像データを受け取り、AVIFエンコードを実行
        // 4. エンコード完了後、Web Workerが結果をメインスレッドに返送
        // 5. `workerManager`が結果を受け取り、登録されたPromiseを解決
        // 6. `uploadWithAvifConversion`が変換された画像データが返される
        const result = await uploadWithAvifConversion(selectedFile, 'messages')
        photoId = result.photoId
        photoExtension = result.photoExtension

        // 画像サイズの取得
        if (fileImageDimensions) {
          imageWidth = fileImageDimensions.width
          imageHeight = fileImageDimensions.height
        }

        // 位置情報の取得
        if (imageLocation) {
          locationData = {
            latitude: imageLocation.latitude,
            longitude: imageLocation.longitude,
          }
          console.log('メッセージに位置情報を追加:', locationData)
        }
      }

      // Firestoreに保存するメッセージデータの作成
      const messageData: MessageData = {
        message: inputText || null, // テキストがない場合はnull
        timestamp: serverTimestamp(), // サーバー側のタイムスタンプ
        user: user, // 送信者情報
        photoId: photoId, // 画像ID
        photoExtension: photoExtension, // 画像拡張子
      }

      // 画像の幅が存在する場合のみ追加
      if (imageWidth !== null) {
        messageData.imageWidth = imageWidth
      }

      // 画像の高さが存在する場合のみ追加
      if (imageHeight !== null) {
        messageData.imageHeight = imageHeight
      }

      // 位置情報が存在する場合のみ追加
      if (locationData) {
        messageData.latitude = locationData.latitude
        messageData.longitude = locationData.longitude
      }

      // リプライ情報がある場合は追加
      if (replyingTo) {
        messageData.replyTo = {
          messageId: replyingTo.messageId,
          message: replyingTo.message,
          displayName: replyingTo.displayName,
          photoId: replyingTo.photoId,
          photoExtension: replyingTo.photoExtension,
        }
      }

      // Firestoreにメッセージを保存
      if (serverId && channelId) {
        // Firestoreのサブコレクションへの参照を作成してドキュメント追加
        await addDoc(
          collection(
            db,
            'servers',
            serverId,
            'channels',
            String(channelId),
            'messages'
          ),
          messageData
        )
        console.log('メッセージを保存しました:', messageData)
      } else {
        console.error('サーバーIDまたはチャンネルIDが無効です')
        toast.error('メッセージの保存に失敗しました')
      }

      // 送信後の後処理
      // 入力フィールドをクリア
      setInputText('')
      clearSelectedFile()
      setImageLocation(null)

      // リプライ情報をクリア
      setReplyingTo(null)
      setRepliedMessageId(null)

      // 処理終了
      setIsUploading(false)

      // 新しいメッセージが見えるようにスクロール
      scrollToBottom()
    } catch (error) {
      // エラー処理
      console.error('メッセージの送信に失敗しました:', error)
      toast.error('メッセージの送信に失敗しました')
      setIsUploading(false)
    } finally {
      // try/catchの結果に関わらず実行される処理
      setIsUploading(false)
    }
  }

  // カスタムフックから返す値と関数
  return {
    inputText, // 入力テキスト
    setInputText, // 入力テキストを設定する関数
    selectedFile, // 選択されたファイル
    selectedFilePreview, // ファイルのプレビューURL
    fileImageDimensions, // 画像のサイズ情報
    imageLocation, // 画像の位置情報
    isUploading, // アップロード中かどうか
    handleFileChange, // ファイル選択時の処理関数
    clearSelectedFile, // ファイル選択をクリアする関数
    sendMessage, // メッセージ送信関数
  }
}
