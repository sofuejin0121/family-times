/**
 * 画像変換・アップロードのためのユーティリティ関数群
 *
 * このファイルには、画像データを様々な形式に変換したり、
 * AVIF形式（新しい高圧縮画像フォーマット）に変換してアップロードする
 * 関数が含まれています。
 */

// 必要なユーティリティをインポート
import { WorkerManager } from './workerUtils' // Web Worker管理クラス
import { uploadImage } from './imageUtils' // 画像アップロード関数

/**
 * 画像ファイルをArrayBufferに変換する関数
 *
 * ArrayBufferとは？
 * - 生のバイナリデータを格納するためのJavaScriptオブジェクト
 * - 画像のピクセルデータなどを表現するのに使われる
 *
 * @param file 変換するファイルオブジェクト
 * @returns Promise<ArrayBuffer> 変換されたArrayBuffer
 */
export const fileToArrayBuffer = (file: File): Promise<ArrayBuffer> => {
  // Promiseを返す
  // Promise: 非同期処理の結果を表すオブジェクト
  return new Promise((resolve, reject) => {
    // FileReaderオブジェクトを作成
    // FileReader: ファイルの内容を読み込むためのブラウザAPI
    const reader = new FileReader()

    // ファイル読み込み完了時の処理
    reader.onload = () => {
      // 読み込み結果がArrayBufferかチェック
      if (reader.result instanceof ArrayBuffer) {
        // 成功時：変換されたArrayBufferを返す
        resolve(reader.result)
      } else {
        // 失敗時：エラーを返す
        reject(new Error('Failed to convert file to ArrayBuffer'))
      }
    }

    // ファイル読み込みエラー時の処理
    reader.onerror = reject

    // ファイルをArrayBufferとして読み込む
    // これにより非同期でファイル読み込みが開始される
    reader.readAsArrayBuffer(file)
  })
}

/**
 * 画像URLからImageDataオブジェクトに変換する関数
 *
 * ImageDataとは？
 * - Canvas APIで使用するピクセルデータの形式
 * - 画像の各ピクセルのRGBA値を含む
 * - 画像処理や変換に使用される
 *
 * @param src 画像のURL（ローカルURLも可）
 * @returns Promise<ImageData> 画像のピクセルデータ
 */
export const imageToImageData = async (src: string): Promise<ImageData> => {
  return new Promise((resolve, reject) => {
    // 新しいImageオブジェクトを作成
    const img = new Image()

    // 画像読み込み完了時の処理
    img.onload = () => {
      // Canvas要素を作成（画像を描画するための仮想キャンバス）
      const canvas = document.createElement('canvas')

      // キャンバスのサイズを画像と同じサイズに設定
      canvas.width = img.width
      canvas.height = img.height

      // 2D描画コンテキストを取得
      const ctx = canvas.getContext('2d')

      // コンテキストが取得できなかった場合
      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }

      // 画像をキャンバスに描画
      ctx.drawImage(img, 0, 0)

      // キャンバスからピクセルデータ（ImageData）を取得
      const imageData = ctx.getImageData(0, 0, img.width, img.height)

      // ImageDataを返す
      resolve(imageData)
    }

    // 画像読み込みエラー時の処理
    img.onerror = () => reject(new Error('Failed to load image'))

    // 画像のURLを設定（これにより画像の読み込みが開始される）
    img.src = src
  })
}

/**
 * ArrayBufferからデータURLを作成する関数
 *
 * データURLとは？
 * - blobURL: ブラウザメモリ内のデータを参照するURL
 * - メモリ上のデータを直接参照できるため、ファイルをディスクに保存せずに表示できる
 *
 * @param buffer バイナリデータ（ArrayBuffer）
 * @param mimeType データの種類（例: 'image/avif', 'image/jpeg'）
 * @returns string 作成されたBlobURL
 */
export const arrayBufferToDataURL = (
  buffer: ArrayBuffer,
  mimeType: string
): string => {
  // ArrayBufferからBlobオブジェクトを作成
  // Blob: Binary Large OBject（バイナリデータの塊）
  const blob = new Blob([buffer], { type: mimeType })

  // BlobからURLを作成して返す
  // このURLはブラウザ内でのみ有効（例: blob:https://example.com/1234-5678）
  return URL.createObjectURL(blob)
}

/**
 * 画像をAVIF形式に変換し、アップロードする関数
 *
 * AVIF形式とは？
 * - AOMediaが開発した新しい画像フォーマット
 * - JPEGやPNGより高い圧縮率と画質を実現
 * - ウェブサイトの読み込み速度を向上させる
 *
 * @param file アップロードする画像ファイル
 * @param uploadPath アップロード先のパス
 * @returns 変換・アップロード結果の情報（元URL、サイズ、寸法など）
 */
export const convertToAvifAndUpload = async (
  file: File,
  uploadPath: string
) => {
  try {
    // ステップ1: WorkerManagerのインスタンスを取得
    // Web Workerを使うことで、メインスレッドをブロックせずに変換処理を実行
    const workerManager = WorkerManager.getInstance()

    // ステップ2: ファイルをブラウザで表示できるURLに変換（プレビュー用）
    const originalUrl = URL.createObjectURL(file)

    // ステップ3: 画像をImageData形式に変換（ピクセルデータの取得）
    const imageData = await imageToImageData(originalUrl)

    // ステップ4: Web Worker経由でAVIF形式にエンコード（変換）
    const avifBuffer = await workerManager.encodeToAvif(imageData, {
      // エンコードオプション
      cqLevel: 30, // 画質レベル（低いほど高画質、高いほど圧縮率が高い）
      cqAlphaLevel: -1, // アルファチャンネル（透明度）の画質（-1は自動）
      denoiseLevel: 0, // ノイズ除去レベル
      tileColsLog2: 0, // タイル列数（ログ2）
      tileRowsLog2: 0, // タイル行数（ログ2）
      speed: 8, // エンコード速度（0-10, 高いほど速いが低画質）
      subsample: 1, // クロマサブサンプリング
      chromaDeltaQ: false, // 色差成分の差分量子化
      sharpness: 0, // シャープネス
      tune: 0, // チューニングモード
    })

    // ステップ5: 変換したAVIFデータからBlobを作成
    const avifBlob = new Blob([avifBuffer], { type: 'image/avif' })

    // ステップ6: 元画像と同じファイル名で、拡張子をavifに変更
    const originalFileName = file.name

    // ファイル名から拡張子を除いた部分を取得
    const fileNameWithoutExt =
      originalFileName.substring(0, originalFileName.lastIndexOf('.')) ||
      originalFileName

    // 新しいFile（AVIF形式）を作成
    const avifFile = new File([avifBlob], `${fileNameWithoutExt}.avif`, {
      type: 'image/avif',
    })

    // ステップ7: 変換したAVIF画像をアップロード
    const result = await uploadImage(avifFile, uploadPath)

    // ステップ8: 処理結果を返す
    return {
      originalUrl, // 元画像のURL（プレビュー用）
      photoId: result.photoId, // アップロードされた画像のID
      photoExtension: result.photoExtension, // 拡張子
      originalSize: file.size, // 元画像のサイズ（バイト）
      avifSize: avifBuffer.byteLength, // AVIF画像のサイズ（バイト）
      width: imageData.width, // 画像の幅
      height: imageData.height, // 画像の高さ
      fileName: `${fileNameWithoutExt}.avif`, // ファイル名
    }
  } catch (error) {
    // エラーが発生した場合
    console.error('Error converting to AVIF and uploading:', error)
    throw error // エラーを呼び出し元に伝播
  }
}

/**
 * AVIFファイルをデコード（復号）して表示可能な形式に変換する関数
 *
 * @param file デコードするAVIFファイル
 * @returns Promise<ArrayBuffer> デコードされたイメージデータ
 */
export const decodeAvifFile = async (file: File): Promise<ArrayBuffer> => {
  // WorkerManagerのインスタンスを取得
  const workerManager = WorkerManager.getInstance()

  // ファイルをArrayBufferに変換
  const arrayBuffer = await fileToArrayBuffer(file)

  // Web Worker経由でAVIFをデコード
  return workerManager.decodeAvif(arrayBuffer)
}
