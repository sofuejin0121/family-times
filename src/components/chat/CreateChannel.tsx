import { useState } from 'react'
import { useServerStore } from '../../stores/serverSlice'
import { addDoc, collection } from 'firebase/firestore'
import { db } from '../../firebase'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import AddIcon from '@mui/icons-material/Add'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export const CreateChannel = () => {
  const [channelName, setChannelName] = useState('')
  const [open, setOpen] = useState(false)
  const serverId = useServerStore((state) => state.serverId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!channelName || !serverId) return

    try {
      await addDoc(collection(db, 'servers', serverId, 'channels'), {
        channelName: channelName,
        timestamp: new Date(),
      })
      setChannelName('')
      setOpen(false)
    } catch (error) {
      console.log('チャンネル作成に失敗しました:', error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start px-2"
              >
                <AddIcon fontSize="small" />
              </Button>
              <TooltipContent>
                <p>チャンネルを作成</p>
              </TooltipContent>
            </TooltipTrigger>
          </Tooltip>
        </TooltipProvider>
      </DialogTrigger>
      <DialogContent className="border border-gray-200 bg-white text-black">
        <DialogHeader>
          <DialogTitle>チャンネルを作成</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Input
              id="channel-name"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              placeholder="チャンネル名"
              required
              className="border border-gray-300 bg-white text-black"
            />
          </div>

          <DialogFooter className="mt-4 flex justify-end gap-2">
            <Button
              variant="default"
              type="submit"
              disabled={!channelName}
              className="cursor-pointer bg-black text-white"
            >
              作成
            </Button>
            <Button
              type="button"
              variant="link"
              onClick={() => setOpen(false)}
              className="cursor-pointer border-none text-gray-700"
            >
              キャンセル
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
