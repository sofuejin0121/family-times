import "./Login.scss";
import { Button } from "@mui/material";
import { auth, db, provider } from "../../firebase";
import { signInWithPopup } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
const Login = () => {
  const signIn = async() => {
    const credential = await signInWithPopup(auth, provider).catch((err) => {
      alert(err.message);
    });
    if(credential) {
      const user = credential.user
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        photoURL: user.photoURL,
        email:  user.email,
        displayName: user.displayName,
      });
    }
  };

  return (
    <div className="login">
      <div className="loginLogo">
        <img src="./discordIcon.png" alt="" />
      </div>

      <Button onClick={signIn}>ログイン</Button>
    </div>
  );
};

export default Login;
