import { useCallback, useState } from "react";
import { useAppSelector } from "../../app/hooks";
import { auth } from "../../firebase";
import { createServerInvite } from "../../utils/generateInvite";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import {
  Box,
  Button,
  IconButton,
  Modal,
  Paper,
  Snackbar,
  Tooltip,
  Typography,
  Link,
} from "@mui/material";

const style = {
  position: "absolute" as const,
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 400,
  bgcolor: "background.paper",
  borderRadius: 2,
  boxShadow: 24,
  p: 4,
};

import PersonAddIcon from "@mui/icons-material/PersonAdd";
import React from "react";

export const CreateInvite = () => {
  const [open, setOpen] = React.useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showCopySuccess, setShowCopySuccess] = useState(false);
  const serverId = useAppSelector((state) => state.server.serverId);

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
    setShowCopySuccess(true);
  };

  return (
    <div>
      <Tooltip title="メンバーを招待" placement="bottom">
        <IconButton onClick={handleOpen} disabled={isLoading}>
          <PersonAddIcon />
        </IconButton>
      </Tooltip>

      <Modal
        open={open}
        onClose={handleClose}
        aria-labelledby="invite-modal-title"
      >
        <Box sx={style}>
          <Typography
            id="invite-modal-title"
            variant="h6"
            component="h2"
            sx={{ mb: 3 }}
          >
            サーバーへ招待
          </Typography>

          {error ? (
            <Typography color="error">{error}</Typography>
          ) : (
            <>
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  以下の招待URLをクリックまたは共有してメンバーを招待できます
                </Typography>

                <Paper
                  variant="outlined"
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    p: 1,
                    backgroundColor: "background.default",
                  }}
                >
                  <Link
                    href={inviteCode}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      flex: 1,
                      fontFamily: "monospace",
                      fontSize: "1rem",
                      p: 1,
                      wordBreak: "break-all",
                      color: "primary.main",
                      textDecoration: "none",
                      "&:hover": {
                        textDecoration: "underline",
                      },
                    }}
                  >
                    {inviteCode}
                  </Link>
                  <Tooltip title="URLをコピー">
                    <IconButton
                      onClick={handleCopyCode}
                      size="small"
                      sx={{ mx: 1 }}
                    >
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Paper>
              </Box>

              <Typography variant="caption" color="text.secondary">
                この招待URLは24時間有効です
              </Typography>
            </>
          )}
          <Box sx={{ mt: 3, display: "flex", justifyContent: "flex-end" }}>
            <Button onClick={handleClose}>閉じる</Button>
          </Box>
        </Box>
      </Modal>

      <Snackbar
        open={showCopySuccess}
        autoHideDuration={2000}
        onClose={() => setShowCopySuccess(false)}
        message="招待URLをコピーしました"
      />
    </div>
  );
};
