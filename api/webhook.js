import { Client } from '@line/bot-sdk';


// 環境変数からLINEアクセストークンとシークレットを取得
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

// LINEクライアントを初期化
const client = new Client(config);

// Firestore 風の関数はここでは外部関数として呼び出す想定
// 例: firestore.getDocument / firestore.updateDocument / makeUserDB など

export default async function handler(req, res) {
  // POST以外のリクエストは拒否
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  // Vercelの場合、req.bodyは生のストリームのためJSONに変換
  const body = await (async () => {
    let data = '';
    for await (const chunk of req) data += chunk;
    return JSON.parse(data);
  })();

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
            case '欠時数確認':
              // ユーザーの欠時数を取得して返信
              //await sendUserAbsence(replyToken, userId);
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
              //await replyTokenMessage(replyToken, 'フィードバック内容を詳細にLINEでお送りください。');
              //await firestore.updateDocument(`${userId}/setting`, { feedback: true }, true);
              break;

            default:
              // 設定やフィードバックの処理
              //const setting = await firestore.getDocument(`${userId}/setting`).obj;

              // フィードバック処理
              // if (setting['feedback']) {
              //   await replyTokenMessage(replyToken, 'フィードバックありがとうございました。');
              //   await firestore.updateDocument(`${userId}/setting`, { feedback: false }, true);
              //   const now = new Date();
              //   const key = `${now.getMonth()+1}/${now.getDate()} ${now.getHours()}h${now.getMinutes()}m ${userId}`;
              //   await firestore.updateDocument('feedback/all', { [key]: getMessage }, true);
              // }

              break;
          }
          break;

        case 'follow':
          // 新規フォロー時の処理
          //await replyTokenMessage(replyToken, 'ようこそ新宿山吹の時間割へ');
          //await makeUserDB(userId);
          //await setUserId(userId);
          break;

        case 'postback':
          // ポストバックデータを取得
          const postData = event.postback.data;

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
