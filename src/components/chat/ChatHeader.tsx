import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { Menu } from 'lucide-react'
import { Users } from 'lucide-react'
import { useAppSelector } from '../../app/hooks'
interface Props {
    channelName: string | null
    onSearchMessage: React.Dispatch<React.SetStateAction<string>>
    onToggleMemberSidebar: () => void
    onToggleMobileMenu: () => void
}

const ChatHeader = (props: Props) => {
    const {
        channelName,
        onSearchMessage,
        onToggleMemberSidebar,
        onToggleMobileMenu,
    } = props
    const serverId = useAppSelector((state) => state.server.serverId)
    const isServerSelected = Boolean(serverId)

    return (
        <div className="flex min-h-[77px] w-full items-center justify-between border-b border-gray-200">
            <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={onToggleMobileMenu}
            >
                <Menu className="h-5 w-5" />
            </Button>
            <div>
                {isServerSelected ? (
                    <h3 className="text-black">
                        <span className="pr-[7px] text-[#7b7c85]">#</span>
                        {channelName}
                    </h3>
                ) : (
                    <></>
                )}
            </div>
            {isServerSelected ? (
                <div className="flex items-center gap-[13px] pr-[15px] text-[#7b7c85]">
                    <div className="flex items-center rounded-[3px] p-[3px]">
                        <Input
                            type="text"
                            placeholder="検索"
                            onChange={(e) => onSearchMessage(e.target.value)}
                            className="w-[120px] md:w-auto"
                        />
                    </div>

                    {/* モバイル用メンバーリストトグルボタン */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="md:hidden"
                        onClick={onToggleMemberSidebar}
                    >
                        <Users className="h-5 w-5" />
                    </Button>
                </div>
            ) : (
                <></>
            )}
        </div>
    )
}

export default ChatHeader
