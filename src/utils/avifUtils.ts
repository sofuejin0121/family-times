import { WorkerManager } from './workerUtils'
import { uploadImage } from './imageUtils'

// 画像ファイルをArrayBufferに変換
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

// 画像をImageDataに変換
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

// ArrayBufferをBlobURL(Data URL)に変換
export const arrayBufferToDataURL = (
  buffer: ArrayBuffer,
  mimeType: string
): string => {
  const blob = new Blob([buffer], { type: mimeType })
  return URL.createObjectURL(blob)
}

// 画像をAVIF形式に変換し、アップロードする関数
export const convertToAvifAndUpload = async (
  file: File,
  uploadPath: string
) => {
  try {
    // WorkerManagerのインスタンスを取得
    const workerManager = WorkerManager.getInstance()

    // 画像オブジェクトをImageDataに変換
    const originalUrl = URL.createObjectURL(file)
    const imageData = await imageToImageData(originalUrl)

    // Worker経由でAVIFにエンコード
    const avifBuffer = await workerManager.encodeToAvif(imageData, {
      // エンコードオプション
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

    // 変換したAVIFをBlobに変換
    const avifBlob = new Blob([avifBuffer], { type: 'image/avif' })

    // 元画像と同じファイル名で、拡張子をavifに変更
    const originalFileName = file.name
    const fileNameWithoutExt =
      originalFileName.substring(0, originalFileName.lastIndexOf('.')) ||
      originalFileName
    const avifFile = new File([avifBlob], `${fileNameWithoutExt}.avif`, {
      type: 'image/avif',
    })

    // アップロード処理
    const result = await uploadImage(avifFile, uploadPath)

    // 結果を返す
    return {
      originalUrl,
      photoId: result.photoId,
      photoExtension: result.photoExtension,
      originalSize: file.size,
      avifSize: avifBuffer.byteLength,
      width: imageData.width,
      height: imageData.height,
      fileName: `${fileNameWithoutExt}.avif`,
    }
  } catch (error) {
    console.error('Error converting to AVIF and uploading:', error)
    throw error
  }
}

// AVIFファイルをデコードしてImageDataに変換
export const decodeAvifFile = async (file: File): Promise<ArrayBuffer> => {
  const workerManager = WorkerManager.getInstance()
  const arrayBuffer = await fileToArrayBuffer(file)
  return workerManager.decodeAvif(arrayBuffer)
}
