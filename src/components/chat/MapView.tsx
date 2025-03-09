import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'
import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { Timestamp } from 'firebase/firestore'
import { getDownloadURL, ref } from 'firebase/storage'
import { storage } from '../../firebase'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// 画像付きマーカーの作成関数（枚数表示付き）
const createImageMarkerIcon = (imageUrl: string, count: number = 1) => {
  // 画像URLをエンコード
  const encodedUrl = encodeURI(imageUrl)
  // マーカーアイコンのHTMLを生成
  // 直接HTMLとインラインスタイルを文字列として渡す必要がある
  return L.divIcon({
    html: `
      <div style="position: relative; width: 40px; height: 40px;">
        ${
          count > 1
            ? `
          <div style="
            position: absolute;     
            top: -4px;             
            right: -4px;           
            z-index: 2;            /* 重なり順：数字を前面に */
            background-color: #ff4757;  /* 背景色：赤 */
            color: white;          
            border-radius: 50%;    
            width: 22px;           
            height: 22px;          
            display: flex;         
            align-items: center;   
            justify-content: center; 
            font-size: 12px;       
            font-weight: bold;     
            border: 2px solid white; 
            box-shadow: 0 1px 3px rgba(0,0,0,0.3); 
          ">${count}</div>
        `
            : ''
        }

        <div style="
          position: absolute;     
          top: 0;                /* 上端に配置 */
          left: 0;               /* 左端に配置 */
          width: 100%;           
          height: 100%;         
          border-radius: 50%;    
          overflow: hidden;      /* はみ出た部分を隠す */
          border: 2px solid white; 
          box-shadow: 0 1px 5px rgba(0,0,0,0.3); 
          background-color: white; 
        ">
          <img 
            src="${encodedUrl}"   /* 画像のURL */
            style="
              width: 100%;        
              height: 100%;       
              object-fit: cover;  
              filter: none;       
            " 
            alt=""               
            onerror="this.style.display='none';"  
          />
        </div>
      </div>
    `,
    className: 'photo-marker',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
  })
}

interface MapViewProps {
  messages: {
    id: string
    latitude?: number
    longitude?: number
    photoURL?: string
    photoId?: string
    message?: string | null
    timestamp?: Timestamp
    user?: {
      displayName?: string
    }
  }[]
}

// 地図制御用のコンポーネント
const MapController = ({ lat, lng }: { lat: number; lng: number }) => {
  const map = useMap()
  useEffect(() => {
    if (map) {
      map.setView([lat, lng], 15)
    }
  }, [lat, lng, map])
  return null
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
  const [mapReady, setMapReady] = useState(false)
  const [imageUrls, setImageUrls] = useState<{ [key: string]: string }>({})
  const [selectedLocation, setSelectedLocation] = useState<
    [number, number] | null
  >(null)
  const markerRefs = useRef<{ [key: string]: L.Marker }>({})
  const mapRef = useRef<L.Map | null>(null)

  // スライドショー用の状態
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [activeLocationMessages, setActiveLocationMessages] = useState<
    MapViewProps['messages']
  >([])

  // モバイル検出を追加
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    L.Icon.Default.mergeOptions({
      iconUrl: icon,
      shadowUrl: iconShadow,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
    })

    const timer = setTimeout(() => {
      setMapReady(true)
    }, 300)

    return () => clearTimeout(timer)
  }, [])

  // メモ化によるパフォーマンス最適化
  // 位置情報がある投稿だけをフィルタリング - 依存配列を指定して必要なときだけ再計算
  const geoMessages = useMemo(() => 
    messages.filter((message) => message.latitude && message.longitude),
    [messages]
  )

  // サムネイル一覧も写真のみに制限
  const geoMessagesWithPhotos = useMemo(() => 
    messages.filter((message) => 
      message.latitude && 
      message.longitude && 
      (message.photoId || message.photoURL)
    ),
    [messages]
  )

  // 位置情報でメッセージをグループ化 - 写真付きのみ
  const locationGroups = useMemo(() => 
    groupMessagesByLocation(geoMessagesWithPhotos),
    [geoMessagesWithPhotos]
  )
  
  // スライドショーの操作関数をメモ化
  const nextSlide = useCallback(() => {
    setCurrentSlideIndex((prev) =>
      prev < activeLocationMessages.length - 1 ? prev + 1 : 0
    )
  }, [activeLocationMessages.length])

  const prevSlide = useCallback(() => {
    setCurrentSlideIndex((prev) =>
      prev > 0 ? prev - 1 : activeLocationMessages.length - 1
    )
  }, [activeLocationMessages.length])
  
  // ポップアップを開く関数をメモ化
  const openLocationPopup = useCallback((locationKey: string, lat: number, lng: number) => {
    const marker = markerRefs.current[locationKey]
    if (marker) {
      marker.openPopup()
      setSelectedLocation([lat, lng])
      setActiveLocationMessages(locationGroups[locationKey])
      setCurrentSlideIndex(0)
    }
  }, [locationGroups])
  
  // マーカーアイコンの生成関数をメモ化
  const createImageMarkerIconMemo = useCallback((imageUrl: string, count: number = 1) => {
    return createImageMarkerIcon(imageUrl, count)
  }, [])
  
  // 初期表示位置を計算
  const defaultCenter =
    geoMessages.length > 0
      ? [
          geoMessages[geoMessages.length - 1].latitude,
          geoMessages[geoMessages.length - 1].longitude,
        ]
      : [35.6895, 139.6917] // 東京

  // 画像の読み込みを高速化
  useEffect(() => {
    const preloadImages = async () => {
      // 画像IDの配列を作成（重複なし）
      const photoIds = Array.from(
        new Set(
          geoMessages
            .filter(msg => msg.photoId && !imageUrls[msg.photoId])
            .map(msg => msg.photoId!)
        )
      );
      
      if (photoIds.length === 0) return;
      
      // 複数の画像を並列で読み込む（これが最も効果的な最適化）
      const promises = photoIds.map(async (photoId) => {
        try {
          const imageRef = ref(storage, photoId);
          const url = await getDownloadURL(imageRef);
          return { photoId, url };
        } catch (error) {
          console.error(`Error loading image ${photoId}:`, error);
          return null;
        }
      });
      
      // すべての画像を並列で読み込み
      const results = await Promise.all(promises);
      
      // 結果をimageUrlsに追加
      const newUrls = results
        .filter(result => result !== null)
        .reduce((acc, result) => {
          if (result) {
            acc[result.photoId] = result.url;
          }
          return acc;
        }, {} as Record<string, string>);
      
      // 一度にすべての画像URLを更新
      setImageUrls(prev => ({ ...prev, ...newUrls }));
    };
    
    if (mapReady) {
      preloadImages();
    }
  }, [geoMessages, mapReady]);

  // MapContainerコンポーネントをメモ化
  const MemoizedMapContainer = useMemo(() => (
    <MapContainer
      center={defaultCenter as [number, number]}
      zoom={13}
      className="z-0 h-full w-full rounded-lg shadow-md"
      style={{ minHeight: '300px' }}
      whenReady={() => setMapReady(true)}
      preferCanvas={true}
      renderer={L.canvas()}
      zoomAnimation={!isMobile}
      markerZoomAnimation={!isMobile}
      ref={(map) => {
        if (map) {
          setMapReady(true)
          mapRef.current = map
        }
      }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {selectedLocation && (
        <MapController
          lat={selectedLocation[0]}
          lng={selectedLocation[1]}
        />
      )}
      {/* マーカーの表示 */}
      {Object.entries(locationGroups).map(
        ([locationKey, messagesAtLocation]) => {
          const [lat, lng] = locationKey.split(',').map(Number)
          const count = messagesAtLocation.length
          const latestMessage = messagesAtLocation[0] // 最新のメッセージ

          // 最新メッセージの画像URL
          const imageUrl =
            latestMessage.photoURL ||
            (latestMessage.photoId && imageUrls[latestMessage.photoId]) ||
            ''

          return (
            <Marker
              key={locationKey}
              position={[lat, lng]}
              icon={createImageMarkerIconMemo(imageUrl, count)}
              ref={(markerRef) => {
                if (markerRef) {
                  markerRefs.current[locationKey] = markerRef
                }
              }}
              eventHandlers={{
                click: () => {
                  setActiveLocationMessages(messagesAtLocation)
                  setCurrentSlideIndex(0)
                },
              }}
            >
              <Popup>
                {activeLocationMessages.length > 0 && (
                  <div className="max-w-[250px] text-center">
                    <div 
                      className="relative touch-pan-y"
                      onTouchStart={(e) => {
                        const touch = e.touches[0];
                        e.currentTarget.dataset.touchStartX = touch.clientX.toString();
                      }}
                      onTouchEnd={(e) => {
                        const touchEnd = e.changedTouches[0];
                        const touchStartX = Number(e.currentTarget.dataset.touchStartX || 0);
                        const diffX = touchEnd.clientX - touchStartX;
                        
                        if (Math.abs(diffX) > 50) {
                          if (diffX > 0) {
                            prevSlide();
                          } else {
                            nextSlide();
                          }
                          e.stopPropagation();
                        }
                      }}
                    >
                      {activeLocationMessages[currentSlideIndex]
                        .photoId &&
                      imageUrls[
                        activeLocationMessages[currentSlideIndex].photoId!
                      ] ? (
                        <img
                          src={
                            imageUrls[
                              activeLocationMessages[currentSlideIndex]
                                .photoId!
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
                        {activeLocationMessages[currentSlideIndex]
                          .message || '画像が投稿されました'}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {activeLocationMessages[currentSlideIndex].user
                          ?.displayName || '匿名ユーザー'}{' '}
                        -{' '}
                        {activeLocationMessages[
                          currentSlideIndex
                        ].timestamp?.toDate?.()
                          ? activeLocationMessages[
                              currentSlideIndex
                            ].timestamp
                              .toDate()
                              .toLocaleString()
                          : ''}
                      </p>
                    </div>

                    {activeLocationMessages.length > 1 && (
                      <div className="mt-2 flex items-center justify-between" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            prevSlide();
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <span className="text-xs text-gray-500">
                          {currentSlideIndex + 1} / {activeLocationMessages.length}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            nextSlide();
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </Popup>
            </Marker>
          )
        }
      )}
    </MapContainer>
  ), [mapReady, selectedLocation, locationGroups, imageUrls, activeLocationMessages, currentSlideIndex, nextSlide, prevSlide, isMobile])

  return geoMessages.length > 0 ? (
    <div className="relative flex h-full w-full flex-col">
      <div className="flex-grow">
        {MemoizedMapContainer}
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
                onClick={() => openLocationPopup(locationKey, lat, lng)}
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
