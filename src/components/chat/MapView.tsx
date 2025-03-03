import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import { useEffect, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
// 画像付きマーカーの作成関数 (画像のみのシンプルな実装に変更)
const createImageMarkerIcon = (imageUrl: string) => {
  const encodedUrl = encodeURI(imageUrl);
  return L.divIcon({
    html: `
      <div style="width: 40px; height: 40px; border-radius: 50%; overflow: hidden; border: 2px solid white; box-shadow: 0 1px 5px rgba(0,0,0,0.3); background-color: white;">
        <img src="${encodedUrl}" style="width: 100%; height: 100%; object-fit: cover; filter: none;" alt="" onerror="this.style.display='none';" />
      </div>
    `,
    className: 'photo-marker',
    iconSize: [40, 40],
    iconAnchor: [20, 20], // 画像の中心を基準点に
    popupAnchor: [0, -20] // ポップアップの位置調整
  });
};

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
    className: 'text-marker',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18]
  });
};

interface MapViewProps {
  messages: {
    id: string;
    latitude?: number;
    longitude?: number;
    photoURL?: string;
    message?: string | null;
    timestamp?: Timestamp;
    user?: {
      displayName?: string;
    };
  }[];
}
const MapView = ({ messages }: MapViewProps) => {
  // MapContainerが表示された後にマーカーが正しく表示されるよう対応
  const [mapReady, setMapReady] = useState(false);
  
  useEffect(() => {
    // コンポーネントのマウント時にLeafletのデフォルトアイコンを設定
    L.Icon.Default.mergeOptions({
      iconUrl: icon,
      shadowUrl: iconShadow,
      iconSize: [25, 41],
      iconAnchor: [12, 41]
    });
    
    // マップを表示したらすぐにマーカーも表示できるよう少し遅延させる
    const timer = setTimeout(() => {
      setMapReady(true);
    }, 300);
    
    return () => clearTimeout(timer);
  }, []);

  // 位置情報がある投稿だけをフィルタリング
  const geoMessages = messages.filter(
    (message) => message.latitude && message.longitude
  );
  
  // 初期表示位置を計算
  const defaultCenter = geoMessages.length > 0
    ? [geoMessages[geoMessages.length - 1].latitude, geoMessages[geoMessages.length - 1].longitude]
    : [35.6895, 139.6917]; // 東京
    
  return geoMessages.length > 0 ? (
    <div className="w-full h-full relative">
      <MapContainer
        center={defaultCenter as [number, number]}
        zoom={13}
        className="w-full h-full rounded-lg shadow-md z-0"
        style={{ minHeight: '300px' }}
        whenReady={() => setMapReady(true)}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {mapReady && geoMessages.map((message) => (
          <Marker
            key={message.id}
            position={[message.latitude!, message.longitude!]}
            icon={message.photoURL 
              ? createImageMarkerIcon(message.photoURL)
              : createTextMarker()}
          >
            <Popup>
              <div className="text-center max-w-[200px]">
                {message.photoURL && (
                  <img
                    src={message.photoURL}
                    alt=""
                    className="w-full h-auto rounded mb-2"
                  />
                )}
                <p className="text-sm">{message.message || '画像が投稿されました'}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {message.user?.displayName || '匿名ユーザー'} - {message.timestamp?.toDate?.() ? message.timestamp.toDate().toLocaleString() : ''}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  ) : (
    <div className="flex items-center justify-center h-full">
      <p className="text-gray-500">位置情報付きの投稿がありません</p>
    </div>
  );
};

export default MapView; 