import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { Timestamp } from 'firebase/firestore'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Map, { Marker, Popup, NavigationControl, useMap } from 'react-map-gl'
import MapboxLanguage from '@mapbox/mapbox-gl-language'
import 'mapbox-gl/dist/mapbox-gl.css'
import { getImageUrl } from '../../utils/imageUtils'

// Mapboxのアクセストークン（環境変数から取得するか、ここに直接記述）
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN

// カスタムマーカーコンポーネント
const CustomMarker = ({
  imageUrl,
  count,
  onClick,
}: {
  imageUrl: string
  count: number
  onClick: () => void
}) => {
  return (
    <div className="relative h-10 w-10 cursor-pointer" onClick={onClick}>
      <div className="absolute inset-0 overflow-hidden rounded-full border-2 border-white bg-white shadow-md">
        <img src={imageUrl} alt="" className="h-10 w-10 object-cover" />
      </div>
      {count > 1 && (
        <div className="absolute -top-1 -right-1 z-10 flex h-5.5 w-5.5 items-center justify-center rounded-full border-2 border-white bg-red-500 text-xs font-bold text-white shadow">
          {count}
        </div>
      )}
    </div>
  )
}

interface MapViewProps {
  messages: {
    id: string
    latitude?: number
    longitude?: number
    photoURL?: string
    photoId?: string | null
    photoExtension?: string | null
    message?: string | null
    timestamp?: Timestamp
    user?: {
      displayName?: string
    }
  }[]
}

// 位置情報をキーとしてメッセージをグループ化する関数
const groupMessagesByLocation = (messages: MapViewProps['messages']) => {
  const groups: { [key: string]: MapViewProps['messages'] } = {}

  messages.forEach((message) => {
    if (message.latitude && message.longitude) {
      // 小数点3桁（約100m）に精度を下げる
      const locationKey = `${message.latitude.toFixed(3)},${message.longitude.toFixed(3)}`
      if (!groups[locationKey]) {
        groups[locationKey] = []
      }
      groups[locationKey].push(message)
    }
  })

  // 各グループ内でメッセージを日時順にソート（最新が先頭）
  Object.keys(groups).forEach((key) => {
    groups[key].sort((a, b) => {
      const timeA = a.timestamp?.toMillis() || 0
      const timeB = b.timestamp?.toMillis() || 0
      return timeB - timeA // 降順（最新が先頭）
    })
  })

  return groups
}

const MapView = ({ messages }: MapViewProps) => {
  const [imageUrls, setImageUrls] = useState<{ [key: string]: string }>({})
  const [popupInfo, setPopupInfo] = useState<{
    longitude: number
    latitude: number
    messages: MapViewProps['messages']
  } | null>(null)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const mapRef = useRef(null)
  const { map } = useMap()
  useEffect(() => {
    if (map) {
      const language = new MapboxLanguage({
        defaultLanguage: 'ja',
      })
      map.addControl(language)
    }
  }, [map])
  // モバイル検出
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // 写真付きメッセージのみをフィルタリング
  const geoMessagesWithPhotos = useMemo(
    () =>
      messages.filter(
        (message) =>
          message.latitude &&
          message.longitude &&
          (message.photoId || message.photoURL)
      ),
    [messages]
  )

  // 位置情報でメッセージをグループ化
  const locationGroups = useMemo(
    () => groupMessagesByLocation(geoMessagesWithPhotos),
    [geoMessagesWithPhotos]
  )

  // 初期表示位置を計算
  const initialViewState = useMemo(() => {
    if (geoMessagesWithPhotos.length > 0) {
      const latest = geoMessagesWithPhotos[geoMessagesWithPhotos.length - 1]
      return {
        longitude: latest.longitude,
        latitude: latest.latitude,
        zoom: 13,
      }
    }
    return {
      longitude: 139.6917, // 東京
      latitude: 35.6895,
      zoom: 13,
    }
  }, [geoMessagesWithPhotos])

  // 画像の並列読み込み
  useEffect(() => {
    const preloadImages = async () => {
      // 画像IDの配列を作成（重複なし）
      const photoIdsWithExt = Array.from(
        new Set(
          geoMessagesWithPhotos
            .filter((msg) => msg.photoId && !imageUrls[msg.photoId])
            .map((msg) => ({
              photoId: msg.photoId!,
              photoExtension: msg.photoExtension
            }))
        )
      )

      if (photoIdsWithExt.length === 0) return

      // 複数の画像を並列で読み込む
      const promises = photoIdsWithExt.map(async ({ photoId, photoExtension }) => {
        try {
          const url = await getImageUrl(photoId, photoExtension)
          return url ? { photoId, url } : null
        } catch (error) {
          console.error(`Error loading image ${photoId}:`, error)
          return null
        }
      })

      // すべての画像を並列で読み込み
      const results = await Promise.all(promises)

      // 結果をimageUrlsに追加
      const newUrls = results
        .filter((result) => result !== null)
        .reduce(
          (acc, result) => {
            if (result) {
              acc[result.photoId] = result.url
            }
            return acc
          },
          {} as Record<string, string>
        )

      // 一度にすべての画像URLを更新
      setImageUrls((prev) => ({ ...prev, ...newUrls }))
    }

    preloadImages()
  }, [geoMessagesWithPhotos, imageUrls])

  // スライドショーの操作関数
  const nextSlide = useCallback(() => {
    if (!popupInfo) return
    setCurrentSlideIndex((prev) =>
      prev < popupInfo.messages.length - 1 ? prev + 1 : 0
    )
  }, [popupInfo])

  const prevSlide = useCallback(() => {
    if (!popupInfo) return
    setCurrentSlideIndex((prev) =>
      prev > 0 ? prev - 1 : popupInfo.messages.length - 1
    )
  }, [popupInfo])

  // ポップアップを開く関数
  const openPopup = useCallback(
    (locationKey: string, lat: number, lng: number) => {
      setPopupInfo({
        longitude: lng,
        latitude: lat,
        messages: locationGroups[locationKey],
      })
      setCurrentSlideIndex(0)

      // マップの中心を移動
      if (map) {
        map.flyTo({
          center: [lng, lat],
          zoom: 15,
          duration: 1000,
        })
      }
    },
    [locationGroups, map]
  )

  return geoMessagesWithPhotos.length > 0 ? (
    <div className="relative flex h-full w-full flex-col">
      <div className="flex-grow">
        <Map
          id="map"
          reuseMaps
          ref={mapRef}
          mapboxAccessToken={MAPBOX_TOKEN}
          initialViewState={initialViewState}
          style={{ width: '100%', height: '100%', minHeight: '300px' }}
          attributionControl={!isMobile}
          renderWorldCopies={false}
          mapStyle="mapbox://styles/mapbox/outdoors-v11
"
        >
          {/* ナビゲーションコントロール */}
          {!isMobile && <NavigationControl position="top-right" />}

          {/* マーカーの表示 */}
          {Object.entries(locationGroups).map(
            ([locationKey, messagesAtLocation]) => {
              const [lat, lng] = locationKey.split(',').map(Number)
              const count = messagesAtLocation.length
              const latestMessage = messagesAtLocation[0]

              // 最新メッセージの画像URL
              const imageUrl =
                latestMessage.photoURL ||
                (latestMessage.photoId && imageUrls[latestMessage.photoId]) ||
                ''

              return (
                <Marker
                  key={locationKey}
                  longitude={lng}
                  latitude={lat}
                  anchor="center"
                  onClick={(e) => {
                    e.originalEvent.stopPropagation()
                    openPopup(locationKey, lat, lng)
                  }}
                >
                  <CustomMarker
                    imageUrl={imageUrl}
                    count={count}
                    onClick={() => openPopup(locationKey, lat, lng)}
                  />
                </Marker>
              )
            }
          )}

          {/* ポップアップ */}
          {popupInfo && (
            <Popup
              longitude={popupInfo.longitude}
              latitude={popupInfo.latitude}
              anchor="bottom"
              closeOnClick={false}
              onClose={() => setPopupInfo(null)}
              maxWidth="300px"
              closeButton={false}
            >
              <div className="relative">
                <button
                  onClick={() => setPopupInfo(null)}
                  className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-xl text-gray-700 shadow-md transition-all hover:bg-gray-100 hover:text-gray-800 hover:scale-110"
                >
                  ×
                </button>
                <div className="pt-4">
                  <div
                    className="relative touch-pan-y"
                    onTouchStart={(e) => {
                      const touch = e.touches[0]
                      e.currentTarget.dataset.touchStartX =
                        touch.clientX.toString()
                    }}
                    onTouchEnd={(e) => {
                      const touchEnd = e.changedTouches[0]
                      const touchStartX = Number(
                        e.currentTarget.dataset.touchStartX || 0
                      )
                      const diffX = touchEnd.clientX - touchStartX

                      if (Math.abs(diffX) > 50) {
                        if (diffX > 0) {
                          prevSlide()
                        } else {
                          nextSlide()
                        }
                        e.stopPropagation()
                      }
                    }}
                  >
                    {popupInfo.messages[currentSlideIndex].photoId &&
                    imageUrls[popupInfo.messages[currentSlideIndex].photoId!] ? (
                      <img
                        src={
                          imageUrls[
                            popupInfo.messages[currentSlideIndex].photoId!
                          ]
                        }
                        alt=""
                        className="mb-2 h-auto max-h-[200px] w-full rounded object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <div className="mb-2 flex h-[150px] w-full items-center justify-center rounded bg-gray-100">
                        <p className="text-gray-500">画像なし</p>
                      </div>
                    )}

                    <p className="text-sm">
                      {popupInfo.messages[currentSlideIndex].message ||
                        '画像が投稿されました'}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {popupInfo.messages[currentSlideIndex].user?.displayName ||
                        '匿名ユーザー'}{' '}
                      -{' '}
                      {popupInfo.messages[currentSlideIndex].timestamp?.toDate?.()
                        ? popupInfo.messages[currentSlideIndex].timestamp
                            .toDate()
                            .toLocaleString()
                        : ''}
                    </p>
                  </div>

                  {popupInfo.messages.length > 1 && (
                    <div
                      className="mt-2 flex items-center justify-between"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          prevSlide()
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="text-xs text-gray-500">
                        {currentSlideIndex + 1} / {popupInfo.messages.length}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          nextSlide()
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </Popup>
          )}
        </Map>
      </div>

      {/* サムネイル一覧 - 位置ごとにグループ化 */}
      <div className="mt-2 flex h-24 touch-pan-x gap-2 overflow-x-auto rounded-lg bg-gray-50 p-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {Object.entries(locationGroups).map(
          ([locationKey, messagesAtLocation]) => {
            const [lat, lng] = locationKey.split(',').map(Number)
            const latestMessage = messagesAtLocation[0]
            const count = messagesAtLocation.length

            // 表示する画像のURL
            const imageUrl =
              latestMessage.photoURL ||
              (latestMessage.photoId && imageUrls[latestMessage.photoId])

            return (
              <div
                key={locationKey}
                className="relative flex-shrink-0 cursor-pointer touch-manipulation select-none"
                onClick={() => openPopup(locationKey, lat, lng)}
                role="button"
                tabIndex={0}
              >
                {imageUrl ? (
                  <>
                    <img
                      src={imageUrl}
                      alt=""
                      className="h-20 w-20 rounded-lg border-2 border-white object-cover shadow-sm"
                      loading="lazy"
                    />
                    {count > 1 && (
                      <div className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white ring-2 ring-white">
                        {count}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-lg border-2 border-white bg-gray-200 shadow-sm">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-gray-400"
                    >
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    {count > 1 && (
                      <div className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white ring-2 ring-white">
                        {count}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          }
        )}
      </div>
    </div>
  ) : (
    <div className="flex h-full items-center justify-center">
      <p className="text-gray-500">位置情報付きの投稿がありません</p>
    </div>
  )
}

export default MapView
