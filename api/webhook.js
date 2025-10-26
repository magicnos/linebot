import { Client } from '@line/bot-sdk';
import admin from 'firebase-admin';


const changeMonth = 10;
const changeDay = 9;



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
                  await updateDocument(`users/${userId}/setting`, { feedback: true });
                  break;
                  
                default:
                  const setting = await getDocument(`${userId}/setting`);
                  if (setting['feedback']) {
                    await replyTokenMessage(replyToken, 'フィードバックありがとうございました。');
                    await updateDocument(`users/${userId}/setting`, { feedback: false });
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
    const allUser = await getDocument('userId/all');
    const allUserId = { [Object.keys(allUser).length]: userId };

    // Firestore内でまとめて作成
    await Promise.all([
      updateDocument(`${userId}/setting`, setting),
      updateDocument(`${userId}/timetable`, timetable),
      updateDocument(`${userId}/absence`, absence),
      updateDocument(`${userId}/absence2`, absence),
      updateDocument('userId/all', allUserId),
    ]);

    console.log(`新しいユーザー ${userId} の初期データを作成しました`);
  }catch (err){
    console.error('createNewUserDataエラー:', err);
  }
}

// 欠時数をテキストで送信
async function sendUserAbsence(userId, replyToken){
  // const [absenceDoc, absence2Doc, timetableDoc, settingDoc] = await Promise.all([
  //   getDocument(`${userId}/absence`),
  //   getDocument(`${userId}/absence2`),
  //   getDocument(`${userId}/timetable`),
  //   getDocument(`${userId}/setting`)
  // ]);

  const doc = await getDocument(`users/${userId}`);
  const absenceDoc = doc.absence['firstSemester'];
  const absence2Doc = doc.absence['secondSemester'];
  const timetableDoc = doc.timetable;
  const settingDoc = doc.setting;

  let sendText1 = '', sendText2 = '', sendText3 = '';


  // 前期のみ
  sendText1 += '=======前期のみ=======\n';
  for (let i = 0; i < 30; i++){
    if (i % 6 == 0){
      sendText1 += `${i !== 0 ? '\n' : ''}${'月火水木金'[Math.floor(i / 6)]}曜\n`;
    }
    sendText1 += `${(i % 6) * 2 + 1}-${(i % 6) * 2 + 2}限 `;
    const className = timetableDoc[i + 101];
    if (absenceDoc[className] === undefined){
      sendText1 += '\n';
    }else{
      sendText1 += `${className} : ${absenceDoc[className]}\n`;
    }
  }
  let sum1 = 0;
  for (const key in absenceDoc){
    sum1 += Number(absenceDoc[key]);
  }
  sendText1 += `\n総欠時 : ${sum1}\n===================`;


  // 後期のみ
  sendText2 += '=======後期のみ=======\n';
  for (let i = 0; i < 30; i++){
    if (i % 6 == 0){
      sendText2 += `${i !== 0 ? '\n' : ''}${'月火水木金'[Math.floor(i / 6)]}曜\n`;
    }
    sendText2 += `${(i % 6) * 2 + 1}-${(i % 6) * 2 + 2}限 `;
    const className = timetableDoc[i + 101];
    if (absenceDoc[className] === undefined){
      sendText2 += '\n';
    }else{
      sendText2 += `${className} : ${absence2Doc[className]}\n`;
    }
  }
  let sum2 = 0;
  for (const key in absence2Doc){
    sum2 += Number(absence2Doc[key]);
  }
  sendText2 += `\n総欠時 : ${sum2}\n===================`;


  // 年間合計
  sendText3 += '=======年間合計=======\n';
  for (let i = 0; i < 30; i++){
    if (i % 6 == 0){
      sendText3 += `${i !== 0 ? '\n' : ''}${'月火水木金'[Math.floor(i / 6)]}曜\n`;
    }
    sendText3 += `${(i % 6) * 2 + 1}-${(i % 6) * 2 + 2}限 `;
    const className = timetableDoc[i + 101];
    if (absenceDoc[className] === undefined){
      sendText3 += '\n';
    }else{
      sendText3 += `${className} : ${ Number(absenceDoc[className]) + Number(absence2Doc[className]) }\n`;
    }
  }
  let sum3 = 0;
  for (const key in absenceDoc){
    sum3 += Number(absenceDoc[key]);
  }
  for (const key in absence2Doc){
    sum3 += Number(absence2Doc[key]);
  }
  sendText3 += `\n総欠時 : ${sum3}\n===================`;

  // 送信
  switch (settingDoc.absenceText){
    case 1:
      await replyTokenMessage(replyToken, sendText1);
      break;
    case 2:
      await replyTokenMessage(replyToken, sendText2);
      break;
    case 3:
      if (checkHalf()){
        await replyTokenMessage(replyToken, sendText1);
      }else{
        await replyTokenMessage(replyToken, sendText2);
      }
      break;
    case 4:
      await replyTokenMessage(replyToken, sendText3);
      break;
    case 5:
      await replyTokenMessage(replyToken, `${sendText1}\n\n${sendText2}`);
      break;
    case 6:
      await replyTokenMessage(replyToken, `${sendText1}\n\n${sendText2}\n\n${sendText3}`);
      break;
    default:
      break;
  }
}

// 前期後期判定
function checkHalf(){
  const now = new Date();
  const month = now.getMonth() + 1; // 1~12
  const day = now.getDate(); // 1〜31

  if (month <= 3) return false; // 1~3月は後期
  if (month < changeMonth) return true; // changeMonthより前なら前期
  if (month > changeMonth) return false; // changeMonthより後なら後期
  if (day <= changeDay) return true; // changeMonthの月かつchangeDay以下なら前期
  return false; // あと後期
}