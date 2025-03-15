import { encode, decode } from '@jsquash/avif'

// Web Workerの型定義
const ctx: Worker = self as unknown as Worker

// メインスレッドからのメッセージを処理
ctx.addEventListener('message', async (event) => {
  try {
    const { type, imageData, options, buffer, id } = event.data

    let result

    if (type === 'encode') {
      // AVIFへのエンコード処理
      result = await encode(imageData, options)
    } else if (type === 'decode') {
      // AVIFのデコード処理
      result = await decode(buffer)
    } else {
      throw new Error(`Unknown operation type: ${type}`)
    }

    // 成功したら結果をメインスレッドに送り返す
    ctx.postMessage(
      {
        success: true,
        result,
        id,
      },
      result instanceof ImageData ? [result.data.buffer] : [result]
    )
  } catch (error) {
    // エラーが発生した場合はエラーメッセージを送り返す
    ctx.postMessage({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      id: event.data.id,
    })
  }
})

// 初期化メッセージ
ctx.postMessage({ status: 'ready' })
