import { auth, db, provider } from "../../firebase";
import { signInWithPopup } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";

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
    <div className="flex flex-col justify-center items-center w-full h-screen gap-[30px]">
      <div className="loginLogo">
        <img src="./discordIcon.png" alt="" className="object-cover h-[150px]" />
      </div>

      <Button 
        variant="default" 
        className="w-[200px]  text-[#eff2f5] font-extrabold cursor-pointer" 
        onClick={signIn}
      >
        ログイン
      </Button>
    </div>
  );
};

export default Login;
