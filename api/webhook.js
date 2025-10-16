import { Client } from '@line/bot-sdk';
import admin from 'firebase-admin';


// linebot初期化
const client = new Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
});


// firestore初期化
const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_KEY
    .replace(/\r?\n/g, '\\n')  // まず全改行を \n に置換
    .trim()                     // 先頭/末尾の空白・改行を削除
);
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore(); // Firestore インスタンス取得



export default async function handler(req, res) {
  try {
    // POST以外のリクエストは拒否
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    let body;
    if (req.body && req.body.events) {
      // JSON化済みならそのまま使う
      body = req.body;
    } else {
      // 違うならパース
      let data = '';
      for await (const chunk of req) data += chunk;
      body = JSON.parse(data);
    }

    const events = body.events || [];

    // 複数イベントに対応するためループ
    await Promise.all(
      events.map(async (event) => {
        try {
          const replyToken = event.replyToken;
          const userId = event.source.userId;

          switch (event.type) {
            case 'message':
              const getMessage = event.message?.text || '';

              switch (getMessage){
                case '欠時数をテキストで表示':
                  await sendUserAbsence(userId, replyToken);
                  break;

                case 'ヘルプ':
                  let text = '';
                  text += 'Q.\n登録したい授業が見つかりません。\n';
                  text += 'A.\nLINEというアプリを使っている構造上、授業の名前を一部省略して表示しています。誰でもどの授業か分かるように努めていますが、探している授業がどれか分からなかった場合、フィードバックでお伝えください。';
                  await replyTokenMessage(replyToken, text);
                  break;

                case 'フィードバック':
                  await replyTokenMessage(replyToken, 'フィードバック内容を詳細にLINEでお送りください。');
                  await updateDocument(`${userId}/setting`, { feedback: true });
                  break;
                  
                default:
                  const setting = await getDocument(`${userId}/setting`);
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
              await createNewUserData(userId);
              await replyTokenMessage(replyToken, 'ようこそ新宿山吹の時間割へ');
              break;

            default:
              // ここランダムでメッセージ送ってもいいね
              break;
          }
        } catch (eventError) {
          console.error('イベント処理中のエラー:', eventError);
        }
      })
    );

    res.status(200).send('OK');
  }catch (err){
    console.error('Webhook全体のエラー:', err);
    res.status(500).send('Internal Server Error');
  }
}

// replyToken返信
async function replyTokenMessage(replyToken, text) {
  try {
    await client.replyMessage(replyToken, { type: 'text', text });
  } catch (err) {
    console.error('replyTokenMessageエラー:', err);
  }
}

// DB取得
async function getDocument(path) {
  try {
    const docRef = db.doc(path);
    const docSnap = await docRef.get();
    return docSnap.data() || {};
  } catch (err) {
    console.error('getDocumentエラー:', err);
    return {};
  }
}

// DB更新(部分更新)
async function updateDocument(path, data) {
  try {
    const docRef = db.doc(path);
    await docRef.set(data, { merge: true });
  } catch (err) {
    console.error('updateDocumentエラー:', err);
  }
}

// 新しいユーザーのデータをFirestoreに作成
async function createNewUserData(userId){
  try {
    const timetable = {};
    for (let i = 101; i < 131; i++){
      timetable[i] = '空きコマ';
    }
    const absence = {};
    const setting = { feedback: false };

    // Firestore内でまとめて作成
    await Promise.all([
      updateDocument(`${userId}/setting`, setting),
      updateDocument(`${userId}/timetable`, timetable),
      updateDocument(`${userId}/absence`, absence),
      updateDocument(`${userId}/absence2`, absence),
    ]);

    console.log(`新しいユーザー ${userId} の初期データを作成しました`);
  }catch (err){
    console.error('createNewUserDataエラー:', err);
  }
}

// 欠時数をテキストで送信
async function sendUserAbsence(userId, replyToken) {
  const [absenceDoc, absence2Doc, timetableDoc] = await Promise.all([
    getDocument(`${userId}/absence`),
    getDocument(`${userId}/absence2`),
    getDocument(`${userId}/timetable`)
  ]);

  let sendText = '';

  // 前期のみ
  sendText += '=======前期のみ=======\n';
  for (let i = 0; i < 30; i++){
    if (i % 6 == 0){
      sendText += `${i !== 0 ? '\n' : ''}${'月火水木金'[Math.floor(i / 6)]}曜\n`;
    }
    sendText += `${(i % 6) * 2 + 1}-${(i % 6) * 2 + 2}限 `;
    const className = timetableDoc[i + 101];
    if (absenceDoc[className] === undefined){
      sendText += '\n';
    }else{
      sendText += `${className} : ${absenceDoc[className]}\n`;
    }
  }
  let sum1 = 0;
  for (const key in absenceDoc){
    sum1 += Number(absenceDoc[key]);
  }
  sendText += `\n総欠時 : ${sum1}\n`;
  sendText += '===================';

  // 後期のみ
  sendText += '\n\n=======後期のみ=======\n';
  for (let i = 0; i < 30; i++){
    if (i % 6 == 0){
      sendText += `${i !== 0 ? '\n' : ''}${'月火水木金'[Math.floor(i / 6)]}曜\n`;
    }
    sendText += `${(i % 6) * 2 + 1}-${(i % 6) * 2 + 2}限 `;
    const className = timetableDoc[i + 101];
    if (absenceDoc[className] === undefined){
      sendText += '\n';
    }else{
      sendText += `${className} : ${absence2Doc[className]}\n`;
    }
  }
  let sum2 = 0;
  for (const key in absence2Doc){
    sum2 += Number(absence2Doc[key]);
  }
  sendText += `\n総欠時 : ${sum2}\n`;
  sendText += '===================';

  // 年間合計
  sendText += '\n\n=======年間合計=======\n';
  for (let i = 0; i < 30; i++){
    if (i % 6 == 0){
      sendText += `${i !== 0 ? '\n' : ''}${'月火水木金'[Math.floor(i / 6)]}曜\n`;
    }
    sendText += `${(i % 6) * 2 + 1}-${(i % 6) * 2 + 2}限 `;
    const className = timetableDoc[i + 101];
    if (absenceDoc[className] === undefined){
      sendText += '\n';
    }else{
      sendText += `${className} : ${ Number(absenceDoc[className]) + Number(absence2Doc[className]) }\n`;
    }
  }
  let sum3 = 0;
  for (const key in absenceDoc){
    sum3 += Number(absenceDoc[key]);
  }
  for (const key in absence2Doc){
    sum3 += Number(absence2Doc[key]);
  }
  sendText += `\n総欠時 : ${sum3}\n`;
  sendText += '===================';


  // 送信
  await replyTokenMessage(replyToken, sendText);
}
