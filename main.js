import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getFirestore,
  getDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";


const CHANNEL_ACCESS_TOKEN =
'G4T1pSCV/EOV78nbEp9R3FGrAG+a3u3oBRJ5ZlvTrwqpaoTP+EvoupeqHumqdo47Rc3T0MElZqVwLwzDpImzrGfBW/SHHNASZ7zd6/r9JC2hvvTU221y8uePzocgjb8ndAOOej2Sr4ZzfPjIzDlewwdB04t89/1O/w1cDnyilFU=';

let db, auth;



// DB初期化処理
async function initFirebase(){
  // Firebase初期化
  const firebaseConfig = {
    apiKey: "AIzaSyBdp66vY1UQJWQNpUaq_GBd-zcNnZXTXgg",
    authDomain: "linebot-799ed.firebaseapp.com",
    projectId: "linebot-799ed"
  };

  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth();

  // 匿名ログイン
  await signInAnonymously(auth);
}


// Firestoreからデータ取得(コレクション/ドキュメント)
async function getData(path1, path2){
  const docRef = doc(db, path1, path2);
  const snap = await getDoc(docRef);

  if (snap.exists()){
    return snap.data(); 
  }else{
    return null;
  }
}


export default {
  async fetch(request, env){
    const url = new URL(request.url);
    // ✅ イベント情報を取得（メッセージがない場合は無視）
    const event = body.events?.[0];
    if (!event || !event.message || !event.replyToken) {
      return new Response("No valid event", { status: 200 });
    }

    // ✅ メッセージ本文を取得
    const userMessage = event.message.text;

    // ✅ LINEの返信APIを呼び出し
    const replyEndpoint = "https://api.line.me/v2/bot/message/reply";
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${CHANNEL_ACCESS_TOKEN}`, // ←環境変数からトークンを取得に切り替える
    };

    replyTokenMessage('死ね');

    return new Response("OK", { status: 200 });
  },
};


// 返信
async function replyTokenMessage(message){

  const payload = {
    replyToken: event.replyToken,
    messages: [
      {
        type: "text",
        text: message,
      },
    ],
  };

  const res = await fetch(replyEndpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  await res.text();
}