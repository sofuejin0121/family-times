// /home/sofue/apps/family-times/src/utils/imageUtils.ts
import { getDownloadURL, ref } from 'firebase/storage'
import { storage } from '../firebase'
import { uploadBytes } from 'firebase/storage'
import { v4 as uuid4 } from 'uuid'
import { useImageCache } from '../stores/imageCache'

/**
 * 画像IDから画像URLを取得する関数
 * @param photoId 画像ID
 * @param extension 拡張子（オプション）
 * @returns 画像のURL
 */
export const getImageUrl = async (
  photoId: string | null,
  extension: string | null,
  path: string
): Promise<string | null> => {
  // Zustandのキャッシュを使用するように修正
  // キャッシュの実装は別の関数に委譲し、この関数はそのままの形を保持
  
  // photoIdのバリデーション
  if (!photoId || photoId.trim() === '') {
    return null
  }

  // 完全なファイル名を構築
  const originalFileName = extension
    ? `${path}/${photoId}.${extension}`
    : `${path}/${photoId}`

  // AVIF形式のファイル名
  const avifFileName = `${path}/${photoId}.avif`

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
      // キャッシュに保存時にextensionを省略
      useImageCache.getState().cacheUrl(photoId, null, path, avifURL)
      return avifURL
    } catch (avifError) {
      console.log('AVIF画像が見つかりません:', avifError)
      logError(avifError)
    }

    // 次にオリジナル形式を試す
    try {
      const baseURL = await getDownloadURL(ref(storage, originalFileName))
      // キャッシュに保存時にextensionを省略
      useImageCache.getState().cacheUrl(photoId, null, path, baseURL)
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
 * キャッシュを利用して画像URLを取得する関数
 * コンポーネントからはこの関数を使用する
 */
export const getCachedImageUrl = async (
  photoId: string | null,
  extension: string | null,
  path: string
): Promise<string | null> => {
  if (!photoId) return null
  
  // Zustandのキャッシュストアから取得
  return useImageCache.getState().getImageUrl(photoId, extension, path)
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
  const extension =
    lastDotIndex !== -1
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

  // キャッシュ無効化時にextensionを省略
  useImageCache.getState().invalidateCache(photoId, null, path)

  return { photoId, photoExtension, fullPath }
}