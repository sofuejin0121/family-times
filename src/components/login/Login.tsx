import { useState, useEffect } from "react";
import { auth, db, provider } from "../../firebase";
import { 
  signInWithPopup, 
  sendSignInLinkToEmail, 
  isSignInWithEmailLink, 
  signInWithEmailLink 
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const Login = () => {
  const [email, setEmail] = useState("");
  const [isSendingLink, setIsSendingLink] = useState(false);
  const [isSigningInWithLink, setIsSigningInWithLink] = useState(false);

  // メールリンク認証の処理を確認
  useEffect(() => {
    // URLがメール認証リンクかチェック
    if (isSignInWithEmailLink(auth, window.location.href)) {
      // ローカルストレージからメールアドレスを取得
      let email = window.localStorage.getItem('emailForSignIn');
      
      // メールアドレスがない場合は入力を求める
      if (!email) {
        email = window.prompt('認証に使用したメールアドレスを入力してください');
      }

      if (email) {
        setIsSigningInWithLink(true);
        // メールリンクでサインイン
        signInWithEmailLink(auth, email, window.location.href)
          .then(async (result) => {
            // ローカルストレージからメールアドレスを削除
            window.localStorage.removeItem('emailForSignIn');
            
            // ユーザー情報をFirestoreに保存
            const user = result.user;
            await setDoc(doc(db, 'users', user.uid), {
              uid: user.uid,
              photoURL: user.photoURL || null,
              email: user.email,
              displayName: user.displayName || user.email?.split('@')[0] || '名称未設定',
            });
            
            // ブラウザ履歴からリンクパラメータを削除
            window.history.replaceState({}, document.title, window.location.pathname);
          })
          .catch((error) => {
            toast.error("ログインに失敗しました: " + error.message);
          })
          .finally(() => {
            setIsSigningInWithLink(false);
          });
      }
    }
  }, []);

  const signIn = async() => {
    const credential = await signInWithPopup(auth, provider).catch((err) => {
      toast.error(err.message);
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

  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast.error("メールアドレスを入力してください");
      return;
    }

    setIsSendingLink(true);

    // メールリンク送信の設定
    const actionCodeSettings = {
      url: window.location.origin,
      handleCodeInApp: true,
    };

    try {
      // メールにログインリンクを送信
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      
      // ローカルストレージにメールアドレスを保存
      window.localStorage.setItem('emailForSignIn', email);
      
      toast.success(`${email} にログインリンクを送信しました`);
      setEmail("");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "不明なエラー";
      toast.error("エラーが発生しました: " + errorMessage);
    } finally {
      setIsSendingLink(false);
    }
  };

  if (isSigningInWithLink) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
        <div className="p-8 bg-white rounded-lg shadow-md text-center">
          <h2 className="text-2xl font-bold mb-6">ログイン中...</h2>
          <p>しばらくお待ちください</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="p-8 bg-white rounded-lg shadow-md text-center w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6">Family-Timesにログイン</h2>
        
        {/* Magic Linkログイン */}
        <form onSubmit={sendMagicLink} className="mb-6">
          <h3 className="text-lg font-medium mb-3">メールリンクでログイン</h3>
          <div className="flex flex-col space-y-3">
            <Input 
              type="email"
              placeholder="メールアドレス" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button 
              type="submit"
              disabled={isSendingLink}
              className="w-full"
            >
              {isSendingLink ? "送信中..." : "ログインリンクを送信"}
            </Button>
          </div>
        </form>
        
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">または</span>
          </div>
        </div>
        
        {/* Googleログイン */}
        <Button 
          onClick={signIn}
          variant="outline"
          className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"
            />
          </svg>
          Googleでログイン
        </Button>
      </div>
    </div>
  );
};

export default Login;
