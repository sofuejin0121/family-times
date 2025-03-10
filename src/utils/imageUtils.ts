import { getDownloadURL, ref } from 'firebase/storage'
import { storage } from '../firebase'
import { uploadBytes } from 'firebase/storage'
import { v4 as uuid4 } from 'uuid'

/**
 * 画像IDから画像URLを取得する関数
 * @param photoId 画像ID
 * @param extension 拡張子（オプション）
 * @returns 画像のURL
 */
export const getImageUrl = async (
  photoId: string | null,
  extension?: string | null
): Promise<string | null> => {
  // photoIdのバリデーション
  if (!photoId || photoId.trim() === '') {
    return null
  }

  // 完全なファイル名を構築
  const originalFileName = extension ? `${photoId}.${extension}` : photoId

  // AVIF形式のファイル名
  const avifFileName = `${photoId}.avif`

  // エラーログ出力用のヘルパー関数
  const logError = (error: unknown) => {
    if (error instanceof Error) {
      console.log('エラー詳細:', {
        message: error.message,
        stack: error.stack,
      })
    }
  }

  try {
    // まずAVIF形式を試す
    try {
      const avifURL = await getDownloadURL(ref(storage, avifFileName))
      return avifURL
    } catch (avifError) {
      console.log('AVIF画像が見つかりません:', avifError)
      logError(avifError)
    }

    // 次にオリジナル形式を試す
    try {
      const baseURL = await getDownloadURL(ref(storage, originalFileName))
      return baseURL
    } catch (originalError) {
      console.log('元の画像が見つかりません:', originalError)
      logError(originalError)
    }

    return null
  } catch (error) {
    logError(error)
    return null
  }
}

/**
 * サーバーやユーザーの画像をアップロードし、IDと拡張子を返す関数
 * @param file アップロードするファイル
 * @param path 保存先のパス（例: 'servers' または 'users/userId'）
 * @returns {Promise<{photoId: string, photoExtension: string}>} 画像IDと拡張子
 */
export const uploadImage = async (
  file: File,
  path: string
): Promise<{ photoId: string; photoExtension: string; fullPath: string }> => {
  // ファイル名から拡張子を抽出
  const originalFileName = file.name
  const lastDotIndex = originalFileName.lastIndexOf('.')
  const extension = lastDotIndex !== -1
    ? originalFileName.substring(lastDotIndex + 1).toLowerCase()
    : ''

  // UUIDを生成
  const photoId = uuid4()
  const photoExtension = extension

  // ストレージに保存するファイル名
  const fileName = `${photoId}.${extension}`
  const fullPath = `${path}/${fileName}`
  const fileRef = ref(storage, fullPath)

  // 画像のアップロード
  await uploadBytes(fileRef, file)

  return { photoId, photoExtension, fullPath }
}

/**
 * サーバーやユーザーの画像URLを取得する関数
 * @param photoId 画像ID
 * @param photoExtension 拡張子
 * @param path 保存先のパス（例: 'servers' または 'users/userId'）
 * @returns {Promise<string | null>} 画像URL
 */
export const getServerOrUserImageUrl = async (
  photoId: string | null,
  photoExtension: string | null,
  path?: string
): Promise<string | null> => {
  if (!photoId || !photoExtension) return null

  try {
    // パスが指定されている場合は、そのパスを使用
    const fullPath = path 
      ? `${path}/${photoId}.${photoExtension}`
      : `${photoId}.${photoExtension}`
    
    const url = await getDownloadURL(ref(storage, fullPath))
    return url
  } catch (error) {
    console.error('画像URLの取得に失敗しました:', error)
    return null
  }
} 