import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import netlifyPlugin from '@netlify/vite-plugin-react-router'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'fs'
import { Plugin } from 'vite'

// Firebase Messaging SWを処理するカスタムプラグイン
function firebaseMessagingSwPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'vite-plugin-firebase-messaging-sw',
    configureServer(server) {
      // 開発サーバーでService Workerを提供
      server.middlewares.use((req, res, next) => {
        if (req.url === '/firebase-messaging-sw.js') {
          try {
            // ソースファイルを読み込む
            let swSource = fs.readFileSync(
              'src/firebase-messaging-sw.js',
              'utf-8'
            )

            // 環境変数マッピング
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
            for (const [placeholder, value] of Object.entries(envReplacements)) {
              swSource = swSource.replace(
                new RegExp(placeholder, 'g'),
                value || ''
              )
            }

            res.setHeader('Content-Type', 'application/javascript')
            res.end(swSource)
          } catch (error) {
            console.error('Service Worker提供エラー:', error)
            next(error)
          }
        } else {
          next()
        }
      })
    },
    closeBundle: {
      sequential: true,
      handler: async () => {
        try {
          console.log('Firebase Messaging Service Workerの処理を開始します')

          // ソースファイルを読み込む
          const swSource = fs.readFileSync(
            'src/firebase-messaging-sw.js',
            'utf-8'
          )

          // 環境変数マッピング
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

          // 出力ディレクトリに書き込む
          if (!fs.existsSync('dist')) {
            fs.mkdirSync('dist', { recursive: true })
          }

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

// configを関数形式に変更して環境変数にアクセスできるようにする
export default defineConfig(({ mode }) => {
  // 環境変数をロード
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      tailwindcss(),
      netlifyPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          // firebase-messaging-sw.jsを無視する - 別処理
          globIgnores: ['**/firebase-messaging-sw.js'],
        },
        manifest: {
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
          enabled: true,
        },
      }),
      firebaseMessagingSwPlugin(env), // 環境変数をプラグインに渡す
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: 'index.html',
        },
      },
    },
  }
})
