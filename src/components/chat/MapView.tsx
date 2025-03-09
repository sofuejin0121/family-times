import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'
import { useEffect, useState, useRef } from 'react'
import { Timestamp } from 'firebase/firestore'
import { getDownloadURL, ref } from 'firebase/storage'
import { storage } from '../../firebase'
// 画像付きマーカーの作成関数
const createImageMarkerIcon = (imageUrl: string) => {
  // 画像URLをエンコード
  const encodedUrl = encodeURI(imageUrl)
  // マーカーアイコンのHTMLを生成
  return L.divIcon({
    html: `
      <div style="width: 40px; height: 40px; border-radius: 50%; overflow: hidden; border: 2px solid white; box-shadow: 0 1px 5px rgba(0,0,0,0.3); background-color: white;">
        <img src="${encodedUrl}" style="width: 100%; height: 100%; object-fit: cover; filter: none;" alt="" onerror="this.style.display='none';" />
      </div>
    `,
    className: 'photo-marker', // CSSクラス名を追加
    iconSize: [40, 40], //アイコンのサイズ
    iconAnchor: [20, 20], // 画像の中心を基準点に
    popupAnchor: [0, -20], // ポップアップの位置調整
  })
}

// テキストメッセージ用の洗練されたマーカー
const createTextMarker = () => {
  return L.divIcon({
    html: `
      <div style="width: 36px; height: 36px; border-radius: 50%; background-color: #f0f0f0; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3); display: flex; justify-content: center; align-items: center;">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #666;">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      </div>
    `,
    className: 'text-marker', // CSSクラス名を追加
    iconSize: [36, 36], //アイコンのサイズ
    iconAnchor: [18, 18], //アイコンの中心点
    popupAnchor: [0, -18], //ポップアップの位置調整
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
  // 地図を制御するためのReact LeafletのuseMapフックを使用
  const map = useMap()
  // 緯度と経度が変更されたときに地図を更新
  useEffect(() => {
    if (map) {
      // 地図の表示位置を指定の緯度経度に変更し、ズームレベルを15に設定
      map.setView([lat, lng], 15)
    }
  }, [lat, lng, map])
  return null
}

const MapView = ({ messages }: MapViewProps) => {
  // MapContainerが表示された後にマーカーが正しく表示されるよう対応
  // マップが準備できたかどうかの状態
  const [mapReady, setMapReady] = useState(false)
  // 画像URLをキャッシュするためのstate（同じ画像を何度も読み込まないため）
  const [imageUrls, setImageUrls] = useState<{ [key: string]: string }>({})
  // 選択された位置を保存するstate(マップの中心に表示する場所)
  const [selectedLocation, setSelectedLocation] = useState<
    [number, number] | null
  >(null)
  // マーカーの参照を保存するためのref
  const markerRefs = useRef<{ [key: string]: L.Marker }>({})
  // 地図の参照を保存するためのref
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    // コンポーネントのマウント時にLeafletのデフォルトアイコンを設定
    L.Icon.Default.mergeOptions({
      iconUrl: icon, // デフォルトのアイコンURL
      shadowUrl: iconShadow, // シャドウのURL
      iconSize: [25, 41], // アイコンのサイズ
      iconAnchor: [12, 41], // アイコンの中心点
    })

    // マップを表示したらすぐにマーカーも表示できるよう少し遅延させる
    const timer = setTimeout(() => {
      setMapReady(true) // マップが準備できたことを示す
    }, 300)

    return () => clearTimeout(timer)
  }, [])

  // 位置情報がある投稿だけをフィルタリング
  const geoMessages = messages.filter(
    (message) => message.latitude && message.longitude
  )

  // 画像URLを取得する関数
  const getImageUrl = async (photoId: string) => {
    // すでにURLをキャッシュしている場合はそれを返す
    if (imageUrls[photoId]) {
      return imageUrls[photoId]
    }

    try {
      const imageRef = ref(storage, photoId)
      const url = await getDownloadURL(imageRef)
      // URLをキャッシュに追加
      setImageUrls((prev) => ({ ...prev, [photoId]: url }))
      return url
    } catch (error) {
      console.error('画像URLの取得に失敗しました:', error)
      return null
    }
  }

  // メッセージに画像URLを読み込む
  useEffect(() => {
    // 画像URLを読み込む関数
    const loadImages = async () => {
      //位置情報付きメッセージ（geoMessages配列）の各メッセージを1つずつ処理
      for (const message of geoMessages) {
        // 画像IDがある場合は画像URLを読み込む
        if (message.photoId) {
          await getImageUrl(message.photoId)
        }
      }
    }

    // マップが準備できたら画像URLを読み込む
    if (mapReady) {
      loadImages()
    }
  }, [geoMessages, mapReady])

  // 初期表示位置を計算
  const defaultCenter =
    geoMessages.length > 0
      ? [
          geoMessages[geoMessages.length - 1].latitude, // 最新のメッセージの緯度
          geoMessages[geoMessages.length - 1].longitude, // 最新のメッセージの経度
        ]
      : [35.6895, 139.6917] // 東京

  // ポップアップを閉じて地図を移動する関数
  const closePopupAndMove = async (
    messageId: string, // メッセージのID
    latitude: number, // 緯度
    longitude: number // 経度
  ) => {
    if (!mapRef.current) return // マップが準備できていない場合は何もしない

    // まず地図上のすべてのポップアップを強制的に閉じる
    mapRef.current.closePopup()

    // 地図を移動
    setSelectedLocation([latitude, longitude])

    // 新しいマーカーのポップアップを開く(移動が完了するのを待つ)
    await new Promise((resolve) => setTimeout(resolve, 150)) // 150ミリ秒待ってからポップアップを開く
    // 指定されたメッセージのマーカーを取得し、ポップアップを開く
    const targetMarker = markerRefs.current[messageId] // メッセージIDに対応するマーカーを取得
    if (targetMarker) {
      targetMarker.openPopup() // マーカーのポップアップを開く
    }
  }

  return geoMessages.length > 0 ? (
    <div className="relative flex h-full w-full flex-col">
      <div className="flex-grow">
        <MapContainer
          center={defaultCenter as [number, number]} // マップの中心位置を設定
          zoom={13} // マップのズームレベルを設定
          className="z-0 h-full w-full rounded-lg shadow-md"
          style={{ minHeight: '300px' }}
          whenReady={() => setMapReady(true)} // マップが準備できたらマップの準備が完了したことを示す
          preferCanvas={true}
          ref={(map) => {
            if (map) {
              setMapReady(true) // マップが準備できたらマップの準備が完了したことを示す
              mapRef.current = map // マップの参照を保存
            }
          }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          {/* 選択された位置がある場合は地図を移動 */}
          {selectedLocation && (
            <MapController
              lat={selectedLocation[0]} // 選択された位置の緯度
              lng={selectedLocation[1]} // 選択された位置の経度
            />
          )}
          {/* マップが準備できている場合はマーカーを表示 */}
          {mapReady &&
            geoMessages.map((message) => (
              <Marker
                key={message.id}
                position={[message.latitude!, message.longitude!]} // マーカーの位置を設定
                icon={
                  // 投稿写真がある場合は画像付きマーカーを表示
                  message.photoURL ||
                  (message.photoId && imageUrls[message.photoId!])
                    ? createImageMarkerIcon(
                        message.photoURL ||
                          (message.photoId && imageUrls[message.photoId!]) ||
                          ''
                      )
                    : createTextMarker() // 投稿写真がない場合はテキストマーカーを表示
                }
                ref={(markerRef) => {
                  if (markerRef) {
                    markerRefs.current[message.id] = markerRef // マーカーの参照を保存
                  }
                }}
              >
                {/* マーカーをクリックしたときにポップアップを表示 */}
                <Popup>
                  <div className="max-w-[250px] text-center">
                    {/* 投稿写真がある場合は表示 */}
                    {(message.photoURL ||
                      (message.photoId && imageUrls[message.photoId!])) && (
                      <img
                        src={
                          message.photoURL ||
                          (message.photoId && imageUrls[message.photoId!]) ||
                          ''
                        }
                        alt=""
                        className="mb-2 h-auto max-h-[200px] w-full rounded object-contain"
                        loading="lazy" //画像を遅延読み込み
                      />
                    )}
                    <p className="text-sm">
                      {message.message || '画像が投稿されました'}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {message.user?.displayName || '匿名ユーザー'} -{' '}
                      {message.timestamp?.toDate?.()
                        ? message.timestamp.toDate().toLocaleString()
                        : ''}
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}
        </MapContainer>
      </div>

      {/* サムネイル一覧を追加 */}
      <div className="mt-2 flex h-24 touch-pan-x gap-2 overflow-x-auto rounded-lg bg-gray-50 p-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {geoMessages.map((message) => {
          // 表示する画像のURLを決定
          const imageUrl =
            message.photoURL || (message.photoId && imageUrls[message.photoId])
          return (
            <div
              key={message.id}
              className="flex-shrink-0 cursor-pointer touch-manipulation select-none"
              onClick={(e) => {
                e.preventDefault() //イベントのデフォルト動作を防止
                e.stopPropagation() //イベントの親要素への伝播を防止
                // クリックされたメッセージの位置にマップを移動
                if (mapReady && message.latitude && message.longitude) {
                  closePopupAndMove(
                    message.id,
                    message.latitude,
                    message.longitude
                  )
                }
              }}
              onTouchStart={(e) => {
                e.preventDefault() //イベントのデフォルト動作を防止
                e.stopPropagation() //イベントの親要素への伝播を防止
                // タッチされたメッセージの位置にマップを移動
                if (mapReady && message.latitude && message.longitude) {
                  closePopupAndMove(
                    message.id,
                    message.latitude,
                    message.longitude
                  )
                }
              }}
              role="button" //ボタンの役割を指定
              tabIndex={0} //フォーカス可能な要素にする(キーボード操作可能)
            >
              {/* 画像がある場合は画像サムネイル、ない場合はテキストアイコン */}
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt=""
                  className="h-20 w-20 rounded-lg border-2 border-white object-cover shadow-sm"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-lg border-2 border-white bg-gray-200 shadow-sm">
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
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  ) : (
    // 位置情報付きの投稿がない場合はメッセージを表示
    <div className="flex h-full items-center justify-center">
      <p className="text-gray-500">位置情報付きの投稿がありません</p>
    </div>
  )
}

export default MapView
