import { FormEvent, useEffect, useRef } from 'react'
import { Send, X, Reply, Loader2 } from 'lucide-react'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import { ReplyInfo } from '../../types/chat'
import { Textarea } from '../ui/textarea'

interface ChatInputAreaProps {
  inputText: string
  setInputText: (text: string) => void
  selectedFile: File | null
  selectedFilePreview: string | null
  isUploading: boolean
  fileInputRef: React.RefObject<HTMLInputElement>
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  clearSelectedFile: () => void
  sendMessage: (e: FormEvent) => void
  channelName: string
  replyingTo: ReplyInfo | null
  cancelReply: () => void
}

const ChatInputArea = ({
  inputText,
  setInputText,
  selectedFile,
  selectedFilePreview,
  isUploading,
  fileInputRef,
  handleFileChange,
  clearSelectedFile,
  sendMessage,
  channelName,
  replyingTo,
  cancelReply,
}: ChatInputAreaProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 入力文字数が変わった時にテキストエリアの高さを自動調整
  useEffect(() => {
    if (textareaRef.current) {
      // テキストエリアの高さをリセットしてから調整（スクロールハイトを正確に計算するため）
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [inputText])

  // 入力ハンドラー
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value)
  }

  return (
    <div className="mx-4 mb-4 flex flex-col rounded-lg text-gray-400">
      {/* リプライ情報 */}
      {replyingTo && (
        <div className="mb-2 flex items-center justify-between rounded-t-md bg-gray-100 p-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="flex items-center text-gray-500">
              <Reply className="mr-1 h-3.5 w-3.5" />
              <span>返信先: </span>
            </div>
            <span className="font-medium text-gray-700">
              {replyingTo.displayName}
            </span>
            <span className="line-clamp-1 max-w-[200px] overflow-hidden text-ellipsis text-gray-500">
              {replyingTo.message || (replyingTo.photoId ? '「画像」' : '')}
            </span>
          </div>
          <button
            onClick={cancelReply}
            className="rounded-full p-1 hover:bg-gray-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 選択した画像のプレビュー */}
      {selectedFilePreview && (
        <div className="relative m-2 inline-block max-w-full">
          <img
            src={selectedFilePreview}
            alt="プレビュー"
            className="max-h-32 rounded-md object-contain p-3"
          />
          <button
            onClick={clearSelectedFile}
            className="absolute top-1 right-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-white/80 shadow-sm hover:bg-white"
          >
            <X className="h-4 w-4 text-gray-800 hover:text-gray-600" />
          </button>
        </div>
      )}

      {/* 入力フォーム */}
      <div className="flex w-full items-center justify-between p-2.5">
        <input
          type="file"
          className="hidden"
          id="file-input"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*;capture=camera"
          disabled={isUploading}
        />
        <label
          htmlFor="file-input"
          className={`flex cursor-pointer items-center justify-center border-none bg-transparent px-4 transition-colors duration-200 ${
            isUploading
              ? 'cursor-not-allowed opacity-50'
              : selectedFile // selectedFileの有無でスタイルを切り替え
                ? 'text-blue-500 hover:text-blue-600' // ファイル選択時は青色
                : 'text-gray-500 hover:text-gray-700' // 未選択時はグレー
          }`}
        >
          <AddCircleOutlineIcon
            className={`text-2xl ${isUploading ? 'opacity-50' : ''}`}
          />
        </label>
        <form
          className="flex w-full max-w-full flex-grow items-center"
          onSubmit={sendMessage}
        >
          <Textarea
            id="message-input"
            ref={textareaRef}
            className="box-border max-h-[150px] min-h-[38px] w-full resize-none overflow-hidden border border-gray-300 bg-white break-words whitespace-pre-wrap text-black disabled:opacity-50"
            placeholder={
              channelName
                ? `${channelName}へメッセージを送信`
                : 'メッセージを送信'
            }
            onChange={handleInputChange}
            value={inputText}
            disabled={isUploading}
            rows={1}
          />
          <button
            type="submit"
            disabled={(!inputText.trim() && !selectedFile) || isUploading}
            className={`ml-2 transition-opacity duration-200 ${
              (!inputText.trim() && !selectedFile) || isUploading
                ? 'cursor-not-allowed opacity-50'
                : 'text-blue-500 hover:text-blue-600'
            }`}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send />
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

export default ChatInputArea
