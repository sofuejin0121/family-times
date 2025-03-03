import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// デフォルトマーカーアイコンを設定
const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapDialogProps {
  isOpen: boolean;
  onClose: () => void;
  messages: {
    id: string;
    latitude?: number;
    longitude?: number;
    timestamp: any;
    photoURL?: string;
    message?: string;
    user: {
      displayName: string;
    };
  }[];
}

const MapDialog = ({ isOpen, onClose, messages }: MapDialogProps) => {
  // 位置情報がある投稿だけをフィルタリング
  const geoMessages = messages.filter(
    (message) => message.latitude && message.longitude
  );
  
  // 初期表示位置を計算（位置情報付きメッセージがある場合は最新の投稿位置、なければ東京）
  const defaultCenter = geoMessages.length > 0
    ? [geoMessages[geoMessages.length - 1].latitude, geoMessages[geoMessages.length - 1].longitude]
    : [35.6895, 139.6917]; // 東京

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[90vw] md:max-w-[70vw] h-[80vh] p-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="text-xl font-semibold">位置情報マップ</DialogTitle>
        </DialogHeader>
        
        <div className="h-[calc(100%-60px)] w-full">
          {geoMessages.length > 0 ? (
            <MapContainer
              center={defaultCenter as [number, number]}
              zoom={13}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              
              {geoMessages.map((message) => (
                <Marker
                  key={message.id}
                  position={[message.latitude!, message.longitude!]}
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
                        {message.user.displayName} - {message.timestamp?.toDate().toLocaleString()}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">位置情報付きの投稿がありません</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MapDialog; 