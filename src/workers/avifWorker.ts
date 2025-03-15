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
      // resultには画像のバイナリデータ（ArrayBuffer）が入る
    } else if (type === 'decode') {
      /**
       * AVIF形式の画像をデコード（復号）
       *
       * - buffer: AVIF画像のバイナリデータ（ArrayBuffer）
       * - decode関数は@jsquash/avifライブラリの関数
       * - 結果はImageData（ピクセルデータ）
       */
      result = await decode(buffer)
      // resultにはピクセルデータ（ImageData）が入る
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
     * - 第2引数: 転送リスト（重要）
     *   - 大きなデータを効率的に送信するための仕組み
     *   - 通常、スレッド間でデータを送るとコピーが作られるが、転送リストに指定すると
     *     データの所有権だけが移動し、コピーが作られない（高速・省メモリ）
     *   - 転送されたオブジェクトはWorker側ではもう使えなくなる
     *
     * この条件分岐の意味：
     * - result instanceof ImageData： resultがImageDataオブジェクトの場合
     *   - [result.data.buffer]： ImageDataの内部にあるピクセルデータのバッファだけを転送
     *   - ImageDataオブジェクト自体はコピーされるが、大きなデータ部分（バッファ）は転送される
     * - それ以外（ArrayBufferの場合）：
     *   - [result]： ArrayBuffer全体を転送
     *
     * 転送リストに指定したオブジェクトは、メッセージ本体（第1引数）の中に
     * 同じオブジェクトとして存在している必要がある。
     * JavaScriptエンジンが内部的に「同じオブジェクト」かを参照で判断し、
     * 該当箇所を特定して転送処理を行う。
     */
    ctx.postMessage(
      {
        success: true,
        result, // ここにエンコード/デコード結果が入っている
        id,
      },
      // 転送リスト - メインスレッドに効率的にデータを渡すため
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
    // エラーの場合は転送リストなし（特に大きなデータを送信しないため）
  }
})

/**
 * 初期化完了のメッセージをメインスレッドに送信
 *
 * - Worker起動直後にメインスレッドにWorkerの準備完了を通知
 * - メインスレッドはこのメッセージを受け取ってからWorkerを使い始められる
 */
ctx.postMessage({ status: 'ready' })
// 初期化メッセージには転送リストなし（特に大きなデータを送信しないため）
