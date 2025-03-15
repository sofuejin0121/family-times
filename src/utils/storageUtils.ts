/**
 * Firebase Storageを使ったファイルアップロード関連の関数
 *
 * Firebase Storageとは？
 * - Googleが提供するクラウドストレージサービス
 * - 画像、動画、ファイルなどをインターネット上に保存できる
 * - Webアプリから簡単にアクセスできるように設計されている
 */

// Firebase SDKから必要な関数をインポート
import {
  ref, // ストレージ内の場所を指定するための関数
  uploadBytes, // ファイルをアップロードするための関数
  getDownloadURL, // アップロードしたファイルのURLを取得する関数
  UploadMetadata, // アップロード時に設定できるメタデータの型定義
} from 'firebase/storage'

// 設定済みのFirebase Storageインスタンスをインポート
// 別ファイル（../firebase.ts）でFirebaseの初期化が行われている
import { storage } from '../firebase'

/**
 * ArrayBufferをFirebase Cloud Storageにアップロードする関数
 *
 * ArrayBufferとは？
 * - バイナリデータを格納するためのJavaScriptのオブジェクト
 * - 画像や音声などのバイナリデータを扱う時に使用される
 *
 * @param buffer アップロードするデータのArrayBuffer（生のバイナリデータ）
 * @param path 保存先のパス（例: 'images/myImage.avif'）
 * @param metadata ファイルのメタデータ（オプション、ファイルの種類や追加情報）
 * @returns Promise<string> アップロードされたファイルのダウンロードURL
 */
export const uploadToFirebaseStorage = async (
  buffer: ArrayBuffer,
  path: string,
  metadata?: UploadMetadata // オプショナルパラメータ（?は「なくてもよい」という意味）
): Promise<string> => {
  try {
    // ステップ1: 保存先のストレージ参照を作成
    // refはFirebase Storage内の特定の場所を指す参照オブジェクトを作成
    // storageは初期化済みのFirebase Storageインスタンス
    // pathはファイルの保存先パス（例: 'images/profile.avif'）
    const storageRef = ref(storage, path)

    // ステップ2: ArrayBufferからBlobを作成
    // Blobとは：Binary Large OBject、バイナリデータの塊
    // ブラウザでファイルのようなオブジェクトを扱う時に使用
    const blob = new Blob([buffer], {
      // ContentTypeを設定（ファイルの種類を指定）
      // metadataで指定されていなければデフォルトでAVIF画像として扱う
      type: metadata?.contentType || 'image/avif',
    })

    // ステップ3: ファイルをアップロード
    // uploadBytesを使ってBlobデータをFirebase Storageにアップロード
    // 非同期処理なのでawaitで完了を待つ
    const snapshot = await uploadBytes(storageRef, blob, metadata)

    // ステップ4: アップロードされたファイルのダウンロードURLを取得
    // このURLを使って、ブラウザからファイルにアクセスできる
    // 例：https://firebasestorage.googleapis.com/v0/b/...
    const downloadURL = await getDownloadURL(snapshot.ref)

    // アップロードに成功した場合、ダウンロードURLを返す
    return downloadURL
  } catch (error) {
    // エラーが発生した場合の処理
    // エラー内容をコンソールに出力
    console.error('Error uploading file to Firebase Storage:', error)
    // エラーを再スローして、この関数を呼び出した側でも
    // エラーハンドリングができるようにする
    throw error
  }
}

/**
 * ユニークなファイル名を生成する関数
 *
 * なぜ必要？
 * - 同じ名前のファイルが上書きされるのを防ぐため
 * - タイムスタンプを含めることで、各ファイル名を一意にする
 *
 * @param originalName 元のファイル名（例: 'profile.jpg'）
 * @returns string タイムスタンプを含むユニークなファイル名（例: 'profile_1647359428976.avif'）
 */
export const generateUniqueFileName = (originalName: string): string => {
  // ステップ1: 現在のタイムスタンプを取得
  // Date.now()は1970年1月1日からの経過ミリ秒数
  // これを使うことで、ファイル名の重複を防ぐ
  const timestamp = Date.now()

  // ステップ2: 出力するファイルの拡張子を指定
  // ここではAVIF形式を使用
  const extension = '.avif'

  // ステップ3: 元のファイル名から拡張子を削除
  // 正規表現を使って、ドット以降の部分（拡張子）を削除
  // 例: 'image.jpg' → 'image'
  const baseName = originalName.replace(/\.[^/.]+$/, '')

  // ステップ4: ファイル名に使用できない文字を削除またはアンダースコアに置換
  // 正規表現 /[^a-zA-Z0-9-_]/g の意味:
  // - [^...]: カッコ内の文字以外にマッチ
  // - a-zA-Z0-9-_: アルファベット、数字、ハイフン、アンダースコア
  // - g: 全てのマッチに適用（グローバルフラグ）
  //
  // これにより、空白や特殊文字がアンダースコアに置き換えられる
  // 例: 'my photo!' → 'my_photo_'
  const sanitizedName = baseName.replace(/[^a-zA-Z0-9-_]/g, '_')

  // ステップ5: 整理したファイル名、タイムスタンプ、拡張子を組み合わせて返す
  // 例: 'profile_1647359428976.avif'
  return `${sanitizedName}_${timestamp}${extension}`
}
