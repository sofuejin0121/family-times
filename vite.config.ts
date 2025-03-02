import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import netlifyPlugin from '@netlify/vite-plugin-react-router'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
        netlifyPlugin(),
        VitePWA({
            registerType: 'autoUpdate',
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
        }),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
})
