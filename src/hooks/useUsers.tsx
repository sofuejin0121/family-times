import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../firebase";
interface Users {
  uid: string;
  photoURL: string;
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
            displayName: doc.data().displayName,
            email: doc.data().email,
          })
        );
        setDocuments(UsersResults);
      });
    }
  }, [UsersRef]);
  return { documents };
};

export default useUsers;
