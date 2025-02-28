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
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="p-8 bg-white rounded-lg shadow-md text-center">
        <h2 className="text-2xl font-bold mb-6">Family-Timesにログイン</h2>
        <Button 
          onClick={signIn}
          variant="default"
          className="bg-gray-900 text-white hover:bg-gray-800 transition-colors cursor-pointer"
        >
          Googleでログイン
        </Button>
      </div>
    </div>
  );
};

export default Login;
