/**
 * Web Workerを使って画像変換処理を管理するクラス
 *
 * Web Workerとは？
 * - ブラウザのメインスレッドとは別のスレッドで重い処理を実行する仕組み
 * - メインスレッドがブロックされないため、UIがフリーズしない
 * - 特に画像処理のような重い処理に適している
 */

// リクエストを識別するためのカウンター
// 各リクエストに一意のIDを割り当てて、後で結果を対応づけるために使用
let requestId = 0

// Web Workerを管理するためのシングルトンクラス
// シングルトンとは？: アプリケーション内で1つだけインスタンスを持つデザインパターン
export class WorkerManager {
  // クラスの唯一のインスタンスを保持する静的変数
  private static instance: WorkerManager

  // Web Workerのインスタンス
  // 初期状態ではnull（まだ作成されていない）
  private worker: Worker | null = null

  // リクエストIDとそれに対応するコールバック関数を管理するMap
  // Map<キーの型, 値の型>の形式で定義
  private callbacks = new Map<
    number, // キー: リクエストID（数値）
    {
      // 値: リクエストの成功・失敗時に呼び出す関数
      resolve: (data: ArrayBuffer | PromiseLike<ArrayBuffer>) => void // 成功時のコールバック
      reject: (error: Error) => void // 失敗時のコールバック
    }
  >()

  /**
   * プライベートコンストラクター
   * 外部からnew演算子でインスタンス化できないようにする（シングルトンパターン）
   */
  private constructor() {
    // 何もしない（初期化コード）
  }

  /**
   * WorkerManagerの唯一のインスタンスを取得するメソッド
   *
   * 使用例:
   * const manager = WorkerManager.getInstance();
   *
   * @returns WorkerManagerのインスタンス
   */
  public static getInstance(): WorkerManager {
    // インスタンスがまだ作られていなければ新しく作成
    if (!WorkerManager.instance) {
      WorkerManager.instance = new WorkerManager()
    }
    // 既存または新しく作成したインスタンスを返す
    return WorkerManager.instance
  }

  /**
   * Web Workerを初期化するメソッド
   * まだWorkerが作成されていない場合に新しいWorkerを作成する
   */
  public initWorker() {
    // 既にWorkerが存在する場合は何もしない（重複初期化防止）
    if (this.worker) return

    // 新しいWeb Workerを作成
    // URL()は実際のWorkerのコードがあるファイルのパスを指定
    // import.meta.urlは現在のモジュールのURLを表す
    this.worker = new Worker(
      new URL('../workers/avifWorker.ts', import.meta.url),
      { type: 'module' } // ESモジュールとして読み込む
    )

    /**
     * Workerからメッセージを受け取った時の処理を設定
     *
     * メッセージの構造:
     * - id: リクエストID
     * - success: 処理が成功したかどうか
     * - result: 成功時の結果データ
     * - error: 失敗時のエラーメッセージ
     * - status: Workerのステータス情報
     */
    this.worker.onmessage = (event) => {
      // Workerから受け取ったデータを分解
      const { id, success, result, error, status } = event.data

      // 初期化完了メッセージの場合
      if (status === 'ready') {
        console.log('AVIF Worker is ready')
        return
      }

      // IDに対応するコールバックを取得
      const callback = this.callbacks.get(id)
      if (callback) {
        if (success) {
          // 成功時: resolveメソッドを呼び出して結果を返す
          callback.resolve(result)
        } else {
          // 失敗時: rejectメソッドを呼び出してエラーを返す
          callback.reject(new Error(error))
        }
        // 使用済みのコールバックをMapから削除（メモリリーク防止）
        this.callbacks.delete(id)
      } else {
        // 対応するコールバックが見つからない場合（通常起きないはず）
        console.warn('No callback found for request ID:', id)
      }
    }

    /**
     * Workerでエラーが発生した時の処理
     * 主にWorkerの読み込みや実行に関するエラーをキャッチする
     */
    this.worker.onerror = (error) => {
      console.error('Worker error:', error)
    }
  }

  /**
   * Web Workerを終了するメソッド
   * 使い終わったWorkerのリソースを解放する
   */
  public terminateWorker() {
    if (this.worker) {
      // Workerを終了
      this.worker.terminate()
      // Workerへの参照をクリア
      this.worker = null
      // すべてのコールバックをクリア
      this.callbacks.clear()
    }
  }

  /**
   * 画像をAVIF形式に変換するメソッド
   *
   * @param imageData 変換する画像データ（Canvas APIのImageData）
   * @param options 変換オプション（品質設定など）
   * @returns Promise<ArrayBuffer> AVIF形式のバイナリデータ
   */
  public encodeToAvif(
    imageData: ImageData,
    options: unknown = {} // デフォルトは空のオブジェクト
  ): Promise<ArrayBuffer> {
    // Workerが初期化されていなければ初期化
    this.initWorker()

    // 一意のリクエストIDを生成
    const id = requestId++

    // Promiseを返す
    // Promiseとは: 非同期処理の結果を表すオブジェクト
    return new Promise((resolve, reject) => {
      // Workerがない場合（初期化に失敗した場合）
      if (!this.worker) {
        reject(new Error('Worker is not initialized'))
        return
      }

      // コールバックをMapに登録
      // このPromiseの成功・失敗時に呼び出される関数を保存
      this.callbacks.set(id, { resolve, reject })

      /**
       * Workerにメッセージを送信
       *
       * 送信内容:
       * - type: 操作タイプ（'encode'=エンコード）
       * - imageData: 変換する画像データ
       * - options: 変換オプション
       * - id: リクエストID
       *
       * 第2引数の[imageData.data.buffer]はtransferableオブジェクト
       * - データをコピーせずに所有権だけをWorkerに移すことでパフォーマンスを向上
       * - 一度転送するとメインスレッドからはアクセスできなくなる
       */
      this.worker.postMessage(
        {
          type: 'encode',
          imageData,
          options,
          id,
        },
        [imageData.data.buffer] // バッファをWorkerに転送
      )
    })
  }

  /**
   * AVIF形式の画像をデコード（復号）するメソッド
   *
   * @param buffer デコードするAVIFデータ（ArrayBuffer）
   * @returns Promise<ArrayBuffer> デコードされた画像データ
   */
  public decodeAvif(buffer: ArrayBuffer): Promise<ArrayBuffer> {
    // Workerが初期化されていなければ初期化
    this.initWorker()

    // 一意のリクエストIDを生成
    const id = requestId++

    // Promiseを返す
    return new Promise((resolve, reject) => {
      // Workerがない場合（初期化に失敗した場合）
      if (!this.worker) {
        reject(new Error('Worker is not initialized'))
        return
      }

      // コールバックをMapに登録
      this.callbacks.set(id, { resolve, reject })

      /**
       * Workerにメッセージを送信
       *
       * 送信内容:
       * - type: 操作タイプ（'decode'=デコード）
       * - buffer: デコードするAVIFデータ
       * - id: リクエストID
       */
      this.worker.postMessage(
        {
          type: 'decode',
          buffer,
          id,
        },
        [buffer] // バッファをWorkerに転送
      )
    })
  }
}
