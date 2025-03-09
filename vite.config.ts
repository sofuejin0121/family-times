import path from 'path'
import { defineConfig, loadEnv } from 'vite' // Viteの設定を定義するための関数とenv変数を読み込むための関数
import react from '@vitejs/plugin-react' // ReactをサポートするViteプラグイン
import tailwindcss from '@tailwindcss/vite' // TailwindCSSをサポートするViteプラグイン
import netlifyPlugin from '@netlify/vite-plugin-react-router' // Netlifyデプロイ用のReact Routerプラグイン
import { VitePWA } from 'vite-plugin-pwa' // Progressive Web App(PWA)機能を追加するプラグイン
import fs from 'fs' // ファイルシステム操作のためのNode.jsモジュール
import { Plugin } from 'vite' // Viteプラグインの型定義
import { sentryVitePlugin } from '@sentry/vite-plugin'

/**
 * Firebase Messaging Service Workerを処理するカスタムプラグイン
 * このプラグインは環境変数をService Workerファイルに注入します
 *
 * @param env - 環境変数のオブジェクト
 * @returns Viteプラグインオブジェクト
 */
function firebaseMessagingSwPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'vite-plugin-firebase-messaging-sw', // プラグイン名
    configureServer(server) {
      // 開発サーバー実行時の設定
      // ミドルウェアを追加してService Workerファイルへのリクエストを処理
      server.middlewares.use((req, res, next) => {
        if (req.url === '/firebase-messaging-sw.js') {
          try {
            // ソースファイルを読み込む
            let swSource = fs.readFileSync(
              'src/firebase-messaging-sw.js',
              'utf-8'
            )

            // 環境変数とプレースホルダーのマッピング
            const envReplacements = {
              FIREBASE_API_KEY_PLACEHOLDER: env.VITE_apiKey, // Firebase APIキー
              FIREBASE_AUTH_DOMAIN_PLACEHOLDER: env.VITE_authDomain, // Firebase認証ドメイン
              FIREBASE_PROJECT_ID_PLACEHOLDER: env.VITE_projectId, // FirebaseプロジェクトID
              FIREBASE_STORAGE_BUCKET_PLACEHOLDER: env.VITE_storageBucket, // Firebaseストレージバケット
              FIREBASE_MESSAGING_SENDER_ID_PLACEHOLDER:
                env.VITE_messagingSenderId, // Firebaseメッセージング送信者ID
              FIREBASE_APP_ID_PLACEHOLDER: env.VITE_appId, // FirebaseアプリID
            }

            // 環境変数をService Workerファイル内のプレースホルダーに置換
            for (const [placeholder, value] of Object.entries(
              envReplacements
            )) {
              swSource = swSource.replace(
                new RegExp(placeholder, 'g'), // グローバルフラグで全ての一致を置換
                value || '' // 値がない場合は空文字列を使用
              )
            }

            // レスポンスヘッダーを設定してJavaScriptとして送信
            res.setHeader('Content-Type', 'application/javascript')
            // キャッシュを無効化するヘッダーを追加
            res.setHeader(
              'Cache-Control',
              'no-store, no-cache, must-revalidate, proxy-revalidate'
            )
            res.setHeader('Pragma', 'no-cache')
            res.setHeader('Expires', '0')
            res.setHeader('Surrogate-Control', 'no-store')
            res.end(swSource)
          } catch (error) {
            console.error('Service Worker提供エラー:', error)
            next(error) // エラーが発生した場合は次のミドルウェアに処理を委譲
          }
        } else {
          next() // Service Worker以外のリクエストは次のミドルウェアに処理を委譲
        }
      })
    },
    // ビルド完了時の処理
    closeBundle: {
      sequential: true, // 順次実行を保証
      handler: async () => {
        try {
          console.log('Firebase Messaging Service Workerの処理を開始します')

          // ソースファイルを読み込む
          const swSource = fs.readFileSync(
            'src/firebase-messaging-sw.js',
            'utf-8'
          )

          // 環境変数マッピング（開発サーバーと同じ設定）
          const envReplacements = {
            FIREBASE_API_KEY_PLACEHOLDER: env.VITE_apiKey,
            FIREBASE_AUTH_DOMAIN_PLACEHOLDER: env.VITE_authDomain,
            FIREBASE_PROJECT_ID_PLACEHOLDER: env.VITE_projectId,
            FIREBASE_STORAGE_BUCKET_PLACEHOLDER: env.VITE_storageBucket,
            FIREBASE_MESSAGING_SENDER_ID_PLACEHOLDER:
              env.VITE_messagingSenderId,
            FIREBASE_APP_ID_PLACEHOLDER: env.VITE_appId,
          }

          // 環境変数を置換
          let swOutput = swSource
          for (const [placeholder, value] of Object.entries(envReplacements)) {
            swOutput = swOutput.replace(
              new RegExp(placeholder, 'g'),
              value || ''
            )
            console.log(
              `置換: ${placeholder} -> ${value ? '値が設定されました' : '値なし'}`
            )
          }

          // 出力ディレクトリが存在しない場合は作成
          if (!fs.existsSync('dist')) {
            fs.mkdirSync('dist', { recursive: true }) // recursive: trueで親ディレクトリも必要に応じて作成
          }

          // 処理したService Workerファイルを出力ディレクトリに書き込む
          fs.writeFileSync('dist/firebase-messaging-sw.js', swOutput)
          console.log('Firebase Messaging Service Workerの処理が完了しました')
        } catch (error) {
          console.error(
            'Firebase Messaging Service Workerの処理中にエラーが発生しました:',
            error
          )
        }
      },
    },
  }
}

/**
 * Vite設定を定義
 * 関数形式を使用することで、環境変数にアクセスできるようになります
 */
export default defineConfig(({ mode }) => {
  // 現在の実行モード（development/production）に基づいて環境変数をロード
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(), // Reactサポートを有効化
      tailwindcss(), // TailwindCSSサポートを有効化
      netlifyPlugin(), // Netlifyデプロイサポートを有効化
      VitePWA({
        registerType: 'autoUpdate', // Service Workerの自動更新を有効化
        injectRegister: 'auto', // Service Worker登録スクリプトを自動挿入
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'], // キャッシュするファイルパターン
          // firebase-messaging-sw.jsは独自に処理するため、Workboxの処理から除外
          globIgnores: ['**/firebase-messaging-sw.js'],
        },
        manifest: {
          // PWAのマニフェスト設定（アプリのアイコンなど）
          icons: [
            {
              src: '/homeicon_512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: '/homeicon_192.png',
              sizes: '192x192',
              type: 'image/png',
            },
          ],
        },
        devOptions: {
          enabled: true, // 開発モードでもPWA機能を有効化
        },
      }),
      firebaseMessagingSwPlugin(env), // 環境変数をFirebase Messaging SWプラグインに渡す
      sentryVitePlugin({
        authToken: process.env.SENTRY_AUTH_TOKEN,
        org: 'cnn-lh',
        project: 'javascript-react',
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'), // @エイリアスをsrcディレクトリに設定（インポート時に@/componentsのように使用可能）
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: 'index.html', // ビルドのエントリーポイントを指定
        },
      },
      sourcemap: true,
    },
  }
})
