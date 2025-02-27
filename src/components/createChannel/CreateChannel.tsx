import { useState } from "react";
import { useAppSelector } from "../../app/hooks";
import { addDoc, collection } from "firebase/firestore";
import { db } from "../../firebase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CreateChannelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateChannel = ({ isOpen, onClose }: CreateChannelProps) => {
  const [channelName, setChannelName] = useState("");
  const serverId = useAppSelector((state) => state.server.serverId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelName || !serverId) return;

    try {
      await addDoc(collection(db, "servers", serverId, "channels"), {
        channelName: channelName,
        timestamp: new Date(),
      });
      setChannelName("");
      onClose();
    } catch (error) {
      console.log("チャンネル作成に失敗しました:", error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white text-black border border-gray-200">
        <DialogHeader>
          <DialogTitle>チャンネルを作成</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="channel-name">チャンネル名</Label>
            <Input
              id="channel-name"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              placeholder="チャンネル名"
              required
              className="bg-white border border-gray-300 text-black"
            />
          </div>
          
          <DialogFooter className="flex justify-end gap-2 mt-4">
            <Button
              variant="default"
              type="submit"
              disabled={!channelName}
              className="bg-blue-500 text-white cursor-pointer"
            >
              作成
            </Button>
            <Button
              type="button"
              variant="link"
              onClick={onClose}
              className="text-gray-700 border-none cursor-pointer"
            >
              キャンセル
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}; 