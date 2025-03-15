// リクエストIDを生成するためのカウンター
let requestId = 0

// Web Workerを管理するためのシングルトンクラス
export class WorkerManager {
  private static instance: WorkerManager
  private worker: Worker | null = null
  private callbacks = new Map<
    number,
    {
      resolve: (data: ArrayBuffer | PromiseLike<ArrayBuffer>) => void
      reject: (error: Error) => void
    }
  >()

  private constructor() {
    // プライベートコンストラクター (シングルトン)
  }

  public static getInstance(): WorkerManager {
    if (!WorkerManager.instance) {
      WorkerManager.instance = new WorkerManager()
    }
    return WorkerManager.instance
  }

  // Web Workerを初期化
  public initWorker() {
    if (this.worker) return

    // Web Workerを作成
    this.worker = new Worker(
      new URL('../workers/avifWorker.ts', import.meta.url),
      { type: 'module' }
    )

    // メッセージハンドラーを設定
    this.worker.onmessage = (event) => {
      const { id, success, result, error, status } = event.data

      // 初期化メッセージの場合
      if (status === 'ready') {
        console.log('AVIF Worker is ready')
        return
      }

      // コールバックを取得
      const callback = this.callbacks.get(id)
      if (callback) {
        if (success) {
          callback.resolve(result)
        } else {
          callback.reject(new Error(error))
        }
        this.callbacks.delete(id)
      } else {
        console.warn('No callback found for request ID:', id)
      }
    }

    // エラーハンドラーを設定
    this.worker.onerror = (error) => {
      console.error('Worker error:', error)
    }
  }

  // Web Workerを終了
  public terminateWorker() {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
      this.callbacks.clear()
    }
  }

  // 画像をAVIFに変換
  public encodeToAvif(
    imageData: ImageData,
    options: unknown = {}
  ): Promise<ArrayBuffer> {
    this.initWorker()

    const id = requestId++
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker is not initialized'))
        return
      }

      // コールバックを登録
      this.callbacks.set(id, { resolve, reject })

      // Workerにエンコード要求を送信
      this.worker.postMessage(
        {
          type: 'encode',
          imageData,
          options,
          id,
        },
        [imageData.data.buffer]
      )
    })
  }

  // AVIFをデコード
  public decodeAvif(buffer: ArrayBuffer): Promise<ArrayBuffer> {
    this.initWorker()

    const id = requestId++
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker is not initialized'))
        return
      }

      // コールバックを登録
      this.callbacks.set(id, { resolve, reject })

      // Workerにデコード要求を送信
      this.worker.postMessage(
        {
          type: 'decode',
          buffer,
          id,
        },
        [buffer]
      )
    })
  }
}
