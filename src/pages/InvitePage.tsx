// pages/InvitePage.tsx
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { setServerInfo } from "../features/serverSlice";
import Sidebar from "../components/sidebar/Sidebar";
import Chat from "../components/chat/Chat";

export const InvitePage = () => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.user.user);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handleInvite = async () => {
      const inviteCode = searchParams.get("invite");
      if (!inviteCode || !user) return;

      try {
        const serversRef = collection(db, "servers");
        const q = query(serversRef, where(`invites.${inviteCode}`, "!=", null));

        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) return;

        const serverDoc = querySnapshot.docs[0];
        const serverData = serverDoc.data();

        const invite = serverData.invites[inviteCode];
        if (new Date(invite.expiresAt.seconds * 1000) < new Date()) return;

        const serverRef = doc(db, "servers", serverDoc.id);
        await updateDoc(serverRef, {
          [`members.${user.uid}`]: {
            role: "member",
            joinedAt: serverTimestamp(),
          },
        });

        dispatch(
          setServerInfo({
            serverId: serverDoc.id,
            serverName: serverData.name,
          })
        );
      } catch (err) {
        console.error("Error handling invite:", err);
      }
    };

    handleInvite();
  }, [searchParams, user, dispatch]);

  return (
    <div className="App">
      <Sidebar />
      <Chat />
    </div>
  );
};
