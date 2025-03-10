import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, doc,updateDoc } from "firebase/firestore";
import { db } from "../firebase";
interface Users {
  uid: string;
  photoURL: string;
  photoId?: string;
  photoExtension?: string;
  email: string;
  displayName: string;
}
const useUsers = () => {
  const [documents, setDocuments] = useState<Users[]>([]);

  const UsersRef = useMemo(() => query(collection(db, "users")), []);
  useEffect(() => {
    if (UsersRef) {
      onSnapshot(UsersRef, (querySnapshot) => {
        const UsersResults: Users[] = [];
        querySnapshot.docs.forEach((doc) =>
          UsersResults.push({
            uid: doc.data().uid,
            photoURL: doc.data().photoURL,
            photoId: doc.data().photoId,
            photoExtension: doc.data().photoExtension,
            displayName: doc.data().displayName,
            email: doc.data().email,
          })
        );
        setDocuments(UsersResults);
      });
    }
  }, [UsersRef]);
  // ユーザー情報を更新する
  //uid: 更新するユーザーのuid
  //userData: 更新するユーザーのデータ
  //Partial<Users>は、Usersの型の一部を更新することを許可する 
  const updateUser = async (uid: string, userData: Partial<Users>) => {
    try {
      const userRef = doc(db, "users", uid);
      await updateDoc(userRef, userData);
      return true;
    }catch (error) {
      console.error("ユーザー情報の更新に失敗しました:", error);
      return false;
    }
  }
  return { documents, updateUser};
};

export default useUsers;
