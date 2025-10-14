import line from '@line/bot-sdk';
import admin from 'firebase-admin';


// linebot初期化
const client = new line.Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
});


// firestore初期化
const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_KEY.replace(/\\n/g, '\n')
);
admin.initializeApp({credential: admin.credential.cert(serviceAccount),});
const db = admin.firestore(); // Firestore インスタンス取得



export default async function handler(req, res){
  // POST以外のリクエストは拒否
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  let body;
  if (req.body && req.body.events){
    // JSON化済みならそのまま使う
    body = req.body;
  }else{
    // 違うならパース
    let data = '';
    for await (const chunk of req) data += chunk;
    body = JSON.parse(data);
  }

  const events = body.events || [];

  // 複数イベントに対応するためループ
  await Promise.all(
    events.map(async (event) => {
      const replyToken = event.replyToken;
      const userId = event.source.userId;

      switch (event.type) {
        case 'message':
          const getMessage = event.message?.text || '';

          switch (getMessage) {
            case '欠時数をテキストで表示':
              // ユーザーの欠時数を取得して返信
              await sendUserAbsence(userId, replyToken);
              break;

            case 'ヘルプ':
              let text = '';
              text += 'Q.\n授業の名前が見つかりません。\n';
              text += 'A.\nLINEというアプリを使っている構造上、授業の名前を一部省略して表示しています。誰でもどの授業か分かるように努めていますが、もし自分が探している授業がどれか分からなかった場合、フィードバックでお伝えください。\n\n\n';
              text += '\n\n';
              text += 'Version 2.3.0\n最近の更新内容\n・時間割関係及び欠時数関係の処理を、時間割アプリとして変更\n・応答速度の大幅な向上\n・一部機能の統合、削除';
              await replyTokenMessage(replyToken, text);
              break;

            case 'フィードバック':
              await replyTokenMessage(replyToken, 'フィードバック内容を詳細にLINEでお送りください。');
              await updateDocument(`${userId}/setting`, { feedback: true });
              break;

            default:
              // 設定やフィードバックの処理
              const setting = await getDocument(`${userId}/setting`);

              // フィードバック処理
              if (setting['feedback']) {
                await replyTokenMessage(replyToken, 'フィードバックありがとうございました。');
                await updateDocument(`${userId}/setting`, { feedback: false });
                const now = new Date();
                const key = `${now.getMonth()+1}/${now.getDate()} ${now.getHours()}h${now.getMinutes()}m ${userId}`;
                await updateDocument('feedback/all', { [key]: getMessage });
              }

              break;
          }
          break;

        case 'follow':
          // 新規フォロー時の処理
          await replyTokenMessage(replyToken, 'ようこそ新宿山吹の時間割へ');
          //await makeUserDB(userId);
          //await setUserId(userId);
          break;

        case 'postback':
          break;

        default:
          break;
      }
    })
  );

  // LINEに必ず 200 OK を返す
  res.status(200).send('OK');
}



// replyToken返信
async function replyTokenMessage(replyToken, text) {
  await client.replyMessage(replyToken, { type: 'text', text });
}


// DB取得
async function getDocument(path){
  const docRef = db.doc(path);
  const docSnap = await docRef.get();
  return docSnap.data(); // オブジェクトで返却
}


// DB更新(部分更新)
async function updateDocument(path, data) {
  const docRef = db.doc(path);
  await docRef.set(data, {merge: true});
}


// 欠時数をテキストで送信
async function sendUserAbsence(userId, replyToken){
  const absenceDoc = await getDocument(`${userId}/absence`);
  const timetableDoc = await getDocument(`${userId}/timetable`);

  let sendText = '';

  // 整形
  for (let i = 0; i < 30; i++){
    // 曜日
    if (i % 6 == 0){
      if (i != 0){
        sendText += `\n${'月火水木金'[Math.floor(i/6)]}曜\n`;
      }else{
        sendText += `${'月火水木金'[Math.floor(i/6)]}曜\n`;
      }
    }
    // 時限
    sendText += String((i%6)*2+1) + '-' + String((i%6)*2+2) + '限 ';
    // 授業名と欠時数
    if (absenceDoc[timetableDoc[i+101]] === undefined){
      sendText += '\n';
    }else{
      sendText += `${timetableDoc[i+101]} : ${absenceDoc[timetableDoc[i+101]]}\n`;
    }
  }

  // 総欠時を追加
  const absence = Object.values(absenceDoc);
  let sum = 0;
  for (const i of absence){
    sum += i;
  }
  sendText += `\n総欠時 : ${sum}`;

  // 送信
  await replyTokenMessage(replyToken, sendText);
}