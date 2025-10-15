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

              switch (getMessage) {
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

                case 'test':
                  const userIdAll = [
                    "U608a22b1006112f008bea962d3a2674f",
                    "U7a2f3c40c2f33c23a1824d7711e75728",
                    "U1ba43ae551c5427cf4490d4d7783bf0b",
                    "Ubab759dd82b261a4c3d0aac9fa813413",
                    "U4c09b69537f4f06baf7777695562eadf",
                    "U6a35add32bfedd672166cd0aa23368b5"
                  ];

                  for (let i = 0; i < userIdAll.length; i++){
                    const absence = await getDocument(`${userIdAll[i]}/absence`);
                    const kari = Object.key(absence)
                    const absence2 = {};
                    for (let k = 0; k < kari.length; k++){
                      absence2[kari[k]] = absence[kari[k]];
                    }
                    await updateDocument(`${userIdAll[i]}/absence2`, absence2);
                  }
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
              await replyTokenMessage(replyToken, 'ようこそ新宿山吹の時間割へ');
              await createNewUserData(userId);
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
  const [absenceDoc, timetableDoc] = await Promise.all([
    getDocument(`${userId}/absence`),
    getDocument(`${userId}/timetable`)
  ]);

  let sendText = '';

  for (let i = 0; i < 30; i++){
    if (i % 6 == 0){
      sendText += `${i !== 0 ? '\n' : ''}${'月火水木金'[Math.floor(i / 6)]}曜\n`;
    }
    sendText += `${(i % 6) * 2 + 1}-${(i % 6) * 2 + 2}限 `;
    if (absenceDoc[timetableDoc[i + 101]] === undefined){
      sendText += '\n';
    }else{
      sendText += `${timetableDoc[i + 101]} : ${absenceDoc[timetableDoc[i + 101]]}\n`;
    }
  }

  const sum = Object.values(absenceDoc).reduce((a, b) => a + b, 0);
  sendText += `\n総欠時 : ${sum}`;

  await replyTokenMessage(replyToken, sendText);
}
