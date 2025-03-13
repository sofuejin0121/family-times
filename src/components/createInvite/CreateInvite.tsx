import { useCallback, useState } from "react";
import { useServerStore } from "../../stores/serverSlice";
import { auth } from "../../firebase";
import { createServerInvite } from "../../utils/generateInvite";
import { UserPlus, Copy } from "lucide-react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";

export const CreateInvite = () => {
  const [open, setOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const serverId = useServerStore((state) => state.serverId);

  const handleOpen = useCallback(async () => {
    const user = auth.currentUser;
    if (!user || !serverId) {
      setError("サーバーを選択してください");
      setOpen(true);
      return;
    }

    setIsLoading(true);
    try {
      const code = await createServerInvite(serverId, user.uid);
      const params = new URLSearchParams();
      params.append("invite", code);
      const inviteUrl = `${window.location.origin}/invite?${params.toString()}`;

      setInviteCode(inviteUrl);
      setError("");
      setOpen(true);
    } catch (err) {
      setError("招待コードの作成に失敗しました");
      setOpen(true);
      console.error(err);

      toast.error("招待コードの作成に失敗しました", {
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  }, [serverId]);

  const handleClose = () => {
    setOpen(false);
    setInviteCode("");
    setError("");
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(inviteCode);

    toast.success("招待URLをコピーしました", {
      duration: 2000,
    });
  };

  return (
    <div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleOpen}
              disabled={isLoading}
              className="h-6 w-6 cursor-pointer"
            >
              <UserPlus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>メンバーを招待</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md dialog-content">
          <DialogHeader>
            <DialogTitle>招待リンクを作成</DialogTitle>
          </DialogHeader>

          {error ? (
            <p className="text-destructive">{error}</p>
          ) : (
            <>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  以下の招待URLを共有してメンバーを招待できます
                </p>
                <div className="flex items-center space-x-2">
                  <div className="grid flex-1 gap-2">
                    <Label htmlFor="invite-link" className="sr-only">
                      招待リンク
                    </Label>
                    <Input
                      id="invite-link"
                      readOnly
                      value={inviteCode}
                      className="font-mono text-sm"
                    />
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleCopyCode}
                    className="flex-shrink-0 cursor-pointer "
                    title="URLをコピー"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                この招待URLは24時間有効です
              </p>
            </>
          )}

          <DialogFooter className="sm:justify-end">
            <Button
              variant="default"
              onClick={handleClose}
              className="cursor-pointer bg-gray-900 text-white hover:bg-gray-800"
            >
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
