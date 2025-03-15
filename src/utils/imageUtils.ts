import { getDownloadURL, ref } from 'firebase/storage'
import { storage } from '../firebase'
import { uploadBytes } from 'firebase/storage'
import { v4 as uuid4 } from 'uuid'
import { useImageCache } from '../stores/imageCache'
import { WorkerManager } from '../utils/workerUtils'

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
 * 画像ファイルをArrayBufferに変換
 */
export const fileToArrayBuffer = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result)
      } else {
        reject(new Error('Failed to convert file to ArrayBuffer'))
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

/**
 * 画像をImageDataに変換
 */
export const imageToImageData = async (src: string): Promise<ImageData> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }

      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, img.width, img.height)
      resolve(imageData)
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = src
  })
}

/**
 * ArrayBufferをBlobURL(Data URL)に変換
 */
export const arrayBufferToDataURL = (
  buffer: ArrayBuffer,
  mimeType: string
): string => {
  const blob = new Blob([buffer], { type: mimeType })
  return URL.createObjectURL(blob)
}

/**
 * 画像をAVIFに変換 (Web Worker使用)
 */
export const convertToAvif = async (file: File) => {
  try {
    // WorkerManagerのインスタンスを取得
    const workerManager = WorkerManager.getInstance()

    // 画像オブジェクトをImageDataに変換（元画像の表示用）
    const originalUrl = URL.createObjectURL(file)
    const imageData = await imageToImageData(originalUrl)

    // Worker経由でAVIFにエンコード
    const avifBuffer = await workerManager.encodeToAvif(imageData, {
      // エンコードオプション（必要に応じて調整）
      cqLevel: 30,
      cqAlphaLevel: -1,
      denoiseLevel: 0,
      tileColsLog2: 0,
      tileRowsLog2: 0,
      speed: 8,
      subsample: 1,
      chromaDeltaQ: false,
      sharpness: 0,
      tune: 0,
    })

    // 変換したAVIFをBlobURLに変換して返す
    const avifUrl = arrayBufferToDataURL(avifBuffer, 'image/avif')

    return {
      originalUrl,
      avifUrl,
      originalSize: file.size,
      avifSize: avifBuffer.byteLength,
      width: imageData.width,
      height: imageData.height,
    }
  } catch (error) {
    console.error('Error converting to AVIF:', error)
    throw error
  }
}

/**
 * AVIFファイルをデコードしてImageDataに変換 (Web Worker使用)
 */
export const decodeAvifFile = async (file: File): Promise<ArrayBuffer> => {
  const workerManager = WorkerManager.getInstance()
  const arrayBuffer = await fileToArrayBuffer(file)
  return workerManager.decodeAvif(arrayBuffer)
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

export const uploadWithAvifConversion = async (
  file: File,
  path: string
): Promise<{
  photoId: string
  photoExtension: string
  width: number | null
  height: number | null
  originalSize: number
  avifSize: number
}> => {
  try {
    // 画像タイプチェック
    if (!file.type.startsWith('image/')) {
      throw new Error('Not an image file')
    }

    // AVIF形式かどうかをチェック
    if (file.type === 'image/avif') {
      // 既にAVIF形式の場合は直接アップロード
      const result = await uploadImage(file, path)
      return {
        photoId: result.photoId,
        photoExtension: result.photoExtension,
        width: null,
        height: null,
        originalSize: file.size,
        avifSize: file.size,
      }
    }

    // WorkerManagerを初期化
    const workerManager = WorkerManager.getInstance()
    workerManager.initWorker()

    // 画像をImageDataに変換するためのオブジェクトURL作成
    const imageUrl = URL.createObjectURL(file)

    // 画像をImageDataに変換
    const img = new Image()
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
      img.src = imageUrl
    })

    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      throw new Error('Failed to get canvas context')
    }

    ctx.drawImage(img, 0, 0)
    const imageData = ctx.getImageData(0, 0, img.width, img.height)

    // オブジェクトURLをクリーンアップ
    URL.revokeObjectURL(imageUrl)

    // Web Worker経由でAVIF形式に変換
    const avifBuffer = await workerManager.encodeToAvif(imageData, {
      // エンコード設定
      cqLevel: 30, // 画質レベル (0-63, 低いほど高画質)
      cqAlphaLevel: -1, // アルファチャンネルの画質 (-1でcqLevelと同じ)
      speed: 8, // エンコード速度 (0-10, 高いほど速いが低画質)
    })

    // AVIFバッファからBlobを作成
    const avifBlob = new Blob([avifBuffer], { type: 'image/avif' })
    const photoId = uuid4()

    // アップロード用のAVIFファイルを作成
    const avifFile = new File([avifBlob], `${photoId}.avif`, {
      type: 'image/avif',
    })

    // Firebase Storageにアップロード
    const uploadResult = await uploadImage(avifFile, path)

    return {
      photoId: uploadResult.photoId,
      photoExtension: 'avif', // 拡張子はAVIFに固定
      width: img.width,
      height: img.height,
      originalSize: file.size,
      avifSize: avifBuffer.byteLength,
    }
  } catch (error) {
    console.error('AVIF変換・アップロードエラー:', error)

    // エラー時は元のファイルを直接アップロード
    console.log('元の形式でアップロードを試みます')
    const result = await uploadImage(file, path)

    return {
      photoId: result.photoId,
      photoExtension: result.photoExtension,
      width: null,
      height: null,
      originalSize: file.size,
      avifSize: file.size, // エラー時は同じサイズを返す
    }
  } finally {
    // WorkerManagerを終了
    WorkerManager.getInstance().terminateWorker()
  }
}
