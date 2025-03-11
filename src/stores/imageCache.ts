import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getImageUrl as fetchImageUrl } from '@/utils/imageUtils'

interface ImageCacheState {
  // キャッシュの型定義: キーはパス/ID/拡張地の組み合わせ、値はURL
  cache: Record<
    string,
    {
      url: string
      timestamp: number // キャッシュのタイムスタンプ
    }
  >
  // 画像URLをキャッシュから取得または新たに取得する関数
  getImageUrl: (
    photoId: string | null,
    extension: string | null,
    path: string
  ) => Promise<string | null>
  // URLを直接キャッシュに追加する関数
  cacheUrl: (
    photoId: string | null,
    extension: string | null,
    path: string | null,
    url: string
  ) => void
  // キャッシュを削除する関数
  invalidateCache: (
    photoId: string | null,
    extension: string | null,
    path: string | null
  ) => void
  // 古いキャッシュをクリアする関数
  clearOldCache: (maxAgeMs?: number) => void
}
// キャッシュのキーを生成する関数を修正
const getCacheKey = (
  photoId: string,
  path: string
) => {
  return `${path}/${photoId}`
}
// デフォルトのキャッシュ有効期限(24時間)
const DEFAULT_CACHE_MAX_AGE = 24 * 60 * 60 * 1000

// Zustandのストアの作成
export const useImageCache = create<ImageCacheState>()(
  persist(
    (set, get) => ({
      cache: {},
      // 画像URLを取得する関数を修正
      getImageUrl: async (photoId, extension, path) => {
        if (!photoId || photoId.trim() === '') {
          return null
        }
        const cacheKey = getCacheKey(photoId, path)
        const cachedItem = get().cache[cacheKey]

        // キャッシュがあり、有効期限内である場合はキャッシュを返す
        if (
          cachedItem &&
          Date.now() - cachedItem.timestamp < DEFAULT_CACHE_MAX_AGE
        ) {
          console.log('Image cache hit:', cacheKey)
          return cachedItem.url
        }

        // キャッシュがない場合または期限切れの場合はAPIから取得
        console.log('Image cache miss:', cacheKey)
        try {
          const url = await fetchImageUrl(photoId, extension, path)

          // 取得に成功したらキャッシュを更新
          if (url) {
            set((state) => ({
              cache: {
                ...state.cache,
                [cacheKey]: {
                  url,
                  timestamp: Date.now(),
                },
              },
            }))
          }
          return url
        } catch (error) {
          console.error('Error fetching image:', error)
          // エラーの場合、期限切れでも古いキャッシュを返す
          return cachedItem?.url || null
        }
      },
      // URLを直接キャッシュに追加する関数を修正
      cacheUrl: (photoId, _extension, path, url) => {
        const cacheKey = getCacheKey(photoId ?? '', path ?? '')
        set((state) => ({
          cache: {
            ...state.cache,
            [cacheKey]: {
              url,
              timestamp: Date.now(),
            },
          },
        }))
      },
      // 特定のキャッシュを無効化する関数を修正
      invalidateCache: (photoId, _extension, path) => {
        const cacheKey = getCacheKey(photoId ?? '', path ?? '')
        set((state) => {
          const newCache = { ...state.cache }
          delete newCache[cacheKey]
          return { cache: newCache }
        })
      },
      // 古いキャッシュをクリアする関数
      clearOldCache: (maxAgeMs = DEFAULT_CACHE_MAX_AGE) => {
        const now = Date.now()
        set((state) => {
          const newCache = { ...state.cache }
          Object.keys(newCache).forEach((key) => {
            if (now - newCache[key].timestamp > maxAgeMs) {
              delete newCache[key]
            }
          })
          return { cache: newCache }
        })
      },
    }),
    {
      name: 'image-cache', //localStorageのキー
      partialize: (state) => ({ cache: state.cache }), // 保存する状態の一部
    }
  )
)

// アプリ起動時に古いキャッシュをクリアする
export const initializeImageCache = () => {
  // アプリ起動時に1週間以上前のキャッシュを削除
  useImageCache.getState().clearOldCache(7 * 24 * 60 * 60 * 1000)
}
