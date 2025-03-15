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

/**
 * 画像ファイルをAVIF形式に変換してアップロードする関数
 *
 * AVIF形式とは:
 * - 新世代の画像圧縮形式で、JPEGやPNGよりも高圧縮・高画質
 * - Webサイトの表示速度向上に役立つ
 *
 * @param file アップロードする画像ファイル（ユーザーが選択したファイル）
 * @param path 保存先のパス（例: 'users/profile' や 'posts/images'など）
 * @returns 画像に関する情報（ID、拡張子、サイズなど）を含むオブジェクト
 */
export const uploadWithAvifConversion = async (
  file: File,
  path: string
): Promise<{
  photoId: string // 生成された一意の画像ID
  photoExtension: string // 画像の拡張子（avifまたは元の拡張子）
  width: number | null // 画像の幅（変換失敗時はnull）
  height: number | null // 画像の高さ（変換失敗時はnull）
  originalSize: number // 元の画像サイズ（バイト）
  avifSize: number // 変換後のサイズ（バイト）
}> => {
  try {
    // ステップ1: ファイルが画像かどうかをチェック
    // file.typeはMIMEタイプ（例: 'image/jpeg', 'image/png'など）
    if (!file.type.startsWith('image/')) {
      // 画像でない場合はエラーを投げる
      throw new Error('Not an image file')
    }

    // ステップ2: すでにAVIF形式かどうかをチェック
    if (file.type === 'image/avif') {
      // すでにAVIF形式ならそのままアップロード
      // uploadImage関数は別の場所で定義された画像アップロード用の関数
      const result = await uploadImage(file, path)

      // 結果を返す（サイズ情報など）
      return {
        photoId: result.photoId, // 生成されたID
        photoExtension: result.photoExtension, // 拡張子
        width: null, // 画像の幅（測定していないのでnull）
        height: null, // 画像の高さ（測定していないのでnull）
        originalSize: file.size, // 元のファイルサイズ
        avifSize: file.size, // AVIFサイズ（変換なしなので同じ）
      }
    }

    // ステップ3: Web Workerの初期化
    // Web Workerとは: メインスレッドをブロックせずに重い処理を実行するための仕組み
    // AVIF変換は処理負荷が高いのでWeb Workerを使用
    const workerManager = WorkerManager.getInstance()
    workerManager.initWorker()

    // ステップ4: 選択されたファイルをブラウザ内で表示できるURLに変換
    // URLオブジェクトを作成して後でイメージオブジェクトで読み込めるようにする
    const imageUrl = URL.createObjectURL(file)

    // ステップ5: 画像を読み込んで幅と高さを取得
    // Imageオブジェクトを作成して画像を読み込む
    const img = new Image()
    await new Promise((resolve, reject) => {
      // 画像ロード完了時の処理
      img.onload = resolve
      // エラー発生時の処理
      img.onerror = reject
      // 画像のソースを設定（先ほど作成したURL）
      img.src = imageUrl
    })

    // ステップ6: 画像をキャンバスに描画してピクセルデータを取得
    // canvasとは: ブラウザ上で画像処理を行うためのHTML要素
    const canvas = document.createElement('canvas')
    canvas.width = img.width // キャンバスの幅を画像と同じに
    canvas.height = img.height // キャンバスの高さを画像と同じに

    // 2D描画コンテキストを取得
    const ctx = canvas.getContext('2d')

    // コンテキストが取得できなかった場合はエラー
    if (!ctx) {
      throw new Error('Failed to get canvas context')
    }

    // 画像をキャンバスに描画
    ctx.drawImage(img, 0, 0)

    // 描画した画像のピクセルデータを取得
    // ImageDataは画像の生データ（ピクセル単位のRGBA値）
    const imageData = ctx.getImageData(0, 0, img.width, img.height)

    // ステップ7: 使い終わったオブジェクトURLを解放
    // メモリリークを防ぐため
    URL.revokeObjectURL(imageUrl)

    // ステップ8: Web Worker経由でAVIF形式に変換
    // workerManager.encodeToAvifはWeb Workerを使って画像をAVIF形式に変換する
    const avifBuffer = await workerManager.encodeToAvif(imageData, {
      // 画質と圧縮の設定
      cqLevel: 30, // 画質レベル（0-63, 数値が小さいほど高画質だが大きいファイルになる）
      cqAlphaLevel: -1, // アルファチャンネル（透明部分）の画質（-1は自動）
      speed: 8, // エンコード速度（0-10, 高いほど速いが低画質になる傾向）
    })

    // ステップ9: 変換したAVIFデータからBlobを作成
    // Blobとは: バイナリデータを扱うためのオブジェクト
    const avifBlob = new Blob([avifBuffer], { type: 'image/avif' })

    // ステップ10: ファイル名用にランダムなIDを生成
    // uuid4は他のファイルとぶつからない一意のIDを生成する関数
    const photoId = uuid4()

    // ステップ11: BlobからFileオブジェクトを作成
    // Fileオブジェクトはアップロードに必要
    const avifFile = new File([avifBlob], `${photoId}.avif`, {
      type: 'image/avif',
    })

    // ステップ12: Firebase Storageにアップロード
    // uploadImage関数でファイルをクラウドストレージにアップロード
    const uploadResult = await uploadImage(avifFile, path)

    // ステップ13: 結果を返す
    return {
      photoId: uploadResult.photoId, // 生成されたID
      photoExtension: 'avif', // 拡張子はavifに固定（変換したため）
      width: img.width, // 画像の幅
      height: img.height, // 画像の高さ
      originalSize: file.size, // 元のファイルサイズ
      avifSize: avifBuffer.byteLength, // 変換後のサイズ
    }
  } catch (error) {
    // エラーが発生した場合の処理

    // エラー内容をコンソールに出力
    console.error('AVIF変換・アップロードエラー:', error)

    // ステップ14: エラー時は元のファイル形式でアップロードを試みる
    // AVIF変換に失敗しても、元の形式でアップロードすることでユーザー体験を確保
    console.log('元の形式でアップロードを試みます')
    const result = await uploadImage(file, path)

    // 変換に失敗した場合の結果を返す
    return {
      photoId: result.photoId, // 生成されたID
      photoExtension: result.photoExtension, // 元の拡張子
      width: null, // 幅は取得できなかったのでnull
      height: null, // 高さは取得できなかったのでnull
      originalSize: file.size, // 元のファイルサイズ
      avifSize: file.size, // 変換できなかったので元のサイズと同じ
    }
  } finally {
    // ステップ15: 処理が完了したらWeb Workerを終了
    // finally句は成功・失敗にかかわらず実行される
    // リソース解放のためWorkerを終了
    WorkerManager.getInstance().terminateWorker()
  }
}
