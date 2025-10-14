import { Client } from '@line/bot-sdk';
import { json } from 'micro';

// 環境変数で設定
const config = {
  channelAccessToken: 'G4T1pSCV/EOV78nbEp9R3FGrAG+a3u3oBRJ5ZlvTrwqpaoTP+EvoupeqHumqdo47Rc3T0MElZqVwLwzDpImzrGfBW/SHHNASZ7zd6/r9JC2hvvTU221y8uePzocgjb8ndAOOej2Sr4ZzfPjIzDlewwdB04t89/1O/w1cDnyilFU=',
  channelSecret: 'f9ee4927cac57f57ba2c1c5eabb8a3da'
};

const client = new Client(config);

// Vercelサーバレス関数
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const body = await json(req);
  const events = body.events;

  await Promise.all(events.map(async (event) => {
    const replyToken = event.replyToken;
    const userId = event.source.userId;

    switch (event.type){
      case 'message':
        const getMessage = event.message?.text || '';

        switch(getMessage) {
          case '欠時数確認':
            // Firestore連携関数呼び出し
            //sendUserAbsence(replyToken, userId);
            break;

          case 'ヘルプ':
            const helpText = 'Q.\nボタンの色を変えたら文字が見えなくなった場合の対処法など...';
            // await client.replyMessage(replyToken, { type: 'text', text: helpText });
            break;

          default:
            // ここでオウム返し
            await client.replyMessage(replyToken, { type: 'text', text: getMessage });
            break;
        }
        break;

      case 'follow':
        await client.replyMessage(replyToken, { type: 'text', text: 'ようこそ新宿山吹の時間割へ' });
        //makeUserDB(userId); // GASでやっていたユーザー作成処理
        //setUserId(userId);  // 同上
        break;

      case 'postback':
        const postData = event.postback.data;
        const array = postData.split(',');

        switch(array[0]) {
          case '1': // 時間割登録など
            //addTimetableControl(replyToken, userId, array[1], array[2]);
            break;

          case '2': // 欠時数編集
            //sendAbsenceFlex(userId, replyToken);
            break;

          default:
            break;
        }
        break;

      default:
        break;
    }
  }));

  res.status(200).send('OK');
}
