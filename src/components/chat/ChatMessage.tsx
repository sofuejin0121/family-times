import "./ChatMessage.scss";
import { Avatar } from "@mui/material";
import { deleteDoc, doc, Timestamp } from "firebase/firestore";
import { useAppSelector } from "../../app/hooks";
import { db, storage } from "../../firebase";
import DeleteIcon from "@mui/icons-material/Delete";
import { getDownloadURL, ref } from "firebase/storage";
import { useEffect, useState } from "react";
import Backdrop from "@mui/material/Backdrop";
import Box from "@mui/material/Box";
import Modal from "@mui/material/Modal";
import Fade from "@mui/material/Fade";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

const style = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 400,
  bgcolor: "background.paper",
  border: "2px solid #000",
  boxShadow: 24,
  p: 4,
};
type Props = {
  timestamp: Timestamp;
  message: string;
  photoId: string;
  photoURL: string;
  id: string;
  user: {
    uid: string;
    photo: string;
    email: string;
    displayName: string;
  };
};
const ChatMessage = (props: Props) => {
  const { message, timestamp, user, photoId, id } = props;
  const [fileURL, setFileURL] = useState<string>();
  const [openModal, setOpenModal] = useState<boolean>(false);
  const channelId = useAppSelector((state) => state.channel.channelId);
  const serverId = useAppSelector((state) => state.server.serverId);
  useEffect(() => {
    const fetchURL = async () => {
      const photoURL = await getDownloadURL(ref(storage, photoId));
      setFileURL(photoURL);
    };
    fetchURL();
  }, [photoId]);
  const deleteMessage = async () => {
    if (serverId !== null && channelId !== null && id !== null) {
      await deleteDoc(
        doc(
          db,
          "servers",
          serverId,
          "channels",
          String(channelId),
          "messages",
          props.id
        )
      );
      handleCloseModal();
    }
  };

  const handleOpenModal = () => {
    setOpenModal(true);
  };
  const handleCloseModal = () => {
    setOpenModal(false);
  };
  return (
    <div className="message">
      <div className="avatarContainer">
        <Avatar src={user.photo} />
      </div>
      <div className="messaegeInfo">
        <h4>
          {user?.displayName}
          <span className="messageTimestamp">
            {new Date(timestamp?.toDate()).toLocaleString()}
          </span>
        </h4>
        <p>{message}</p>
        <Button onClick={handleOpenModal}>
          <DeleteIcon />
        </Button>
        <Modal
          aria-labelledby="transition-modal-title"
          aria-describedby="transition-modal-description"
          open={openModal}
          onClose={handleCloseModal}
          closeAfterTransition
          slots={{ backdrop: Backdrop }}
          slotProps={{
            backdrop: {
              timeout: 500,
            },
          }}
        >
          <Fade in={openModal}>
            <Box sx={style}>
              <Typography
                id="transition-modal-title"
                variant="h6"
                component="h2"
              >
                メッセージを削除しますか？
              </Typography>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  mt: 2,
                }}
              >
                <Button
                  onClick={deleteMessage}
                  variant="outlined"
                  color="error"
                >
                  削除する
                </Button>
                <Button onClick={handleCloseModal} variant="outlined" color="primary">
                  戻る
                </Button>
              </Box>
            </Box>
          </Fade>
        </Modal>
        <div className="imageMessage">
          <img src={fileURL} alt="" className="images" />
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
