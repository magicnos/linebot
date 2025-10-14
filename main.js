import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getFirestore,
  getDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";


const CHANNEL_ACCESS_TOKEN =
'G4T1pSCV/EOV78nbEp9R3FGrAG+a3u3oBRJ5ZlvTrwqpaoTP+EvoupeqHumqdo47Rc3T0MElZqVwLwzDpImzrGfBW/SHHNASZ7zd6/r9JC2hvvTU221y8uePzocgjb8ndAOOej2Sr4ZzfPjIzDlewwdB04t89/1O/w1cDnyilFU=';

let db, auth, userId;



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
  async fetch(request, env) {
    const url = new URL(request.url);

    // LINEのWebhook以外へのアクセス確認用
    if (url.pathname !== "/webhook") {
      return new Response("LINE Bot is running!", { status: 200 });
    }

    // Webhookイベント受信
    const body = await request.json();
    const event = body.events?.[0];

    if (!event) return new Response("No event", { status: 200 });

    // LINEの返信APIに送信
    const replyToken = event.replyToken;
    const message = event.message?.text || "";

    await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        replyToken: replyToken,
        messages: [{ type: "text", text: `あなたのメッセージ: ${message}` }],
      }),
    });

    return new Response("OK", { status: 200 });
  },
};





// メインの処理
async function main(){
  // DB初期化
  await initFirebase();
  // liff初期化とuserId取得
  userId = await firstLiff();

  // ユーザーの時間割情報と欠時数情報を取得
  const timetableData = await getData(userId, 'timetable');
  const absenceData = await getData(userId, 'absence');

  // 時間割に時間割を表示
  setTimetable(timetableData);

  // 欠時数時間割に欠時数と欠時変更ボタンを設置
  setButton(timetableData, absenceData);

  // 時間割モーダル表示と内容セット
  initModal();
  attachCellEvents();

  // 今日の曜日に赤枠をつける
  highlightToday();
  // 本日欠席機能
  todayAbsence();
}


main();