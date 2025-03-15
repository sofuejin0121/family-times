/**
 * AVIF形式の画像エンコード・デコードを行うWeb Worker
 *
 * Web Workerとは？
 * - メインスレッド（ブラウザのUIスレッド）とは別のスレッドで実行される JavaScript
 * - 重い処理を別スレッドで実行することで、ブラウザのUIがフリーズするのを防ぐ
 * - メインスレッドとはメッセージのやり取りで通信する
 */

// @jsquashライブラリからAVIF変換機能をインポート
// @jsquashは画像圧縮のためのWebAssemblyベースのライブラリ
import { encode, decode } from '@jsquash/avif'

/**
 * Web Workerのコンテキスト（実行環境）を取得
 *
 * - Web Workerでは「self」がグローバルコンテキスト（メインスレッドでいうwindow）
 * - 「as unknown as Worker」はTypeScriptの型キャスト（型変換）構文
 * - これによってselfをWorker型として扱えるようになる
 */
const ctx: Worker = self as unknown as Worker

/**
 * メインスレッドからのメッセージを受け取るイベントリスナーを設定
 *
 * イベントリスナーとは？
 * - 特定のイベント（ここではmessage）が発生したときに実行される関数
 * - 'message'イベントはメインスレッドからpostMessageが呼ばれたときに発生
 */
ctx.addEventListener('message', async (event) => {
  try {
    // メインスレッドから送られてきたデータを分解（分割代入）
    const { type, imageData, options, buffer, id } = event.data

    // 処理結果を格納する変数
    let result

    // 操作タイプに応じて処理を分岐
    if (type === 'encode') {
      /**
       * 画像をAVIF形式にエンコード（変換）
       *
       * - imageData: Canvas APIから取得したピクセルデータ
       * - options: エンコード設定（品質レベルなど）
       * - encode関数は@jsquash/avifライブラリの関数
       * - 結果はArrayBuffer（バイナリデータ）
       */
      result = await encode(imageData, options)
    } else if (type === 'decode') {
      /**
       * AVIF形式の画像をデコード（復号）
       *
       * - buffer: AVIF画像のバイナリデータ（ArrayBuffer）
       * - decode関数は@jsquash/avifライブラリの関数
       * - 結果はImageData（ピクセルデータ）
       */
      result = await decode(buffer)
    } else {
      // 未知の操作タイプの場合はエラーを投げる
      throw new Error(`Unknown operation type: ${type}`)
    }

    /**
     * 処理成功時：結果をメインスレッドに送り返す
     *
     * ctx.postMessage(送信するデータ, [転送リスト])
     * - 第1引数: 送信するデータオブジェクト
     *   - success: 処理成功を示すフラグ
     *   - result: 処理結果（ArrayBufferまたはImageData）
     *   - id: リクエストID（どのリクエストの応答かを識別するため）
     *
     * - 第2引数: 転送リスト
     *   - ArrayBufferを「転送」するためのリスト
     *   - 「転送」とはコピーではなく所有権の移動（パフォーマンス向上）
     *   - 条件演算子（三項演算子）で結果の型に応じて異なる処理
     *     - ImageDataの場合はその内部のbufferを転送
     *     - それ以外（ArrayBuffer）の場合はそのまま転送
     */
    ctx.postMessage(
      {
        success: true,
        result,
        id,
      },
      result instanceof ImageData ? [result.data.buffer] : [result]
    )
  } catch (error) {
    /**
     * エラー発生時：エラー情報をメインスレッドに送り返す
     *
     * - success: false（処理失敗を示す）
     * - error: エラーメッセージ（Errorオブジェクトからメッセージを抽出）
     * - id: リクエストID（どのリクエストの応答かを識別するため）
     */
    ctx.postMessage({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      id: event.data.id,
    })
  }
})

/**
 * 初期化完了のメッセージをメインスレッドに送信
 *
 * - Worker起動直後にメインスレッドにWorkerの準備完了を通知
 * - メインスレッドはこのメッセージを受け取ってからWorkerを使い始められる
 */
ctx.postMessage({ status: 'ready' })
