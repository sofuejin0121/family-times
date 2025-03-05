import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'
import { Timestamp } from 'firebase/firestore'
import { useEffect } from 'react'

// デフォルトマーカーアイコンを設定
const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

L.Marker.prototype.options.icon = DefaultIcon

interface MapDialogProps {
  isOpen: boolean
  onClose: () => void
  messages: {
    id: string
    latitude?: number
    longitude?: number
    timestamp: Timestamp
    photoURL?: string
    message?: string
    user: {
      displayName: string
    }
  }[]
}

// ZoomControlコンポーネントを作成
const ZoomControl = () => {
  const map = useMap()
  useEffect(() => {
    L.control.zoom({ position: 'bottomright' }).addTo(map)
  }, [map])
  return null
}

const MapDialog = ({ isOpen, onClose, messages }: MapDialogProps) => {
  // 位置情報がある投稿だけをフィルタリング
  const geoMessages = messages.filter(
    (message) => message.latitude && message.longitude
  )

  // 初期表示位置を計算（位置情報付きメッセージがある場合は最新の投稿位置、なければ東京）
  const defaultCenter =
    geoMessages.length > 0
      ? [
          geoMessages[geoMessages.length - 1].latitude,
          geoMessages[geoMessages.length - 1].longitude,
        ]
      : [35.6895, 139.6917] // 東京

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="h-[80vh] p-0 sm:max-w-[90vw] md:max-w-[70vw]">
        <DialogHeader className="border-b p-4">
          <DialogTitle className="text-xl font-semibold">
            位置情報マップ
          </DialogTitle>
        </DialogHeader>

        <div className="h-[calc(100%-60px)] w-full">
          {geoMessages.length > 0 ? (
            <MapContainer
              center={defaultCenter as [number, number]}
              zoom={13}
              style={{ height: '100%', width: '100%' }}
              zoomControl={false} // ズームコントロールを非表示（右下に移動するため）
            >
              {/* Googleマップライクなタイルレイヤー */}
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              />

              <ZoomControl />

              {geoMessages.map((message) => (
                <Marker
                  key={message.id}
                  position={[message.latitude!, message.longitude!]}
                >
                  <Popup className="custom-popup">
                    <div className="max-w-[200px] text-center">
                      {message.photoURL && (
                        <img
                          src={message.photoURL}
                          alt=""
                          className="mb-2 h-auto w-full rounded"
                        />
                      )}
                      <p className="text-sm">
                        {message.message || '画像が投稿されました'}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {message.user.displayName} -{' '}
                        {message.timestamp?.toDate().toLocaleString()}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-gray-500">位置情報付きの投稿がありません</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default MapDialog
