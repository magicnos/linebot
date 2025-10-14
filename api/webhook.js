import { Client } from '@line/bot-sdk';
import { json } from 'micro';


// linebotSDK?を初期化
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};
const client = new Client(config);





export default async function handler(req, res) {

  const body = await json(req);
  const events = body.events || [];

  // 受信イベントごとに処理
  await Promise.all(
    events.map(async (event) => {
      if (event.type === 'message' && event.message.type === 'text') {
        const replyToken = event.replyToken;
        const userMessage = event.message.text;

        // オウム返し
        try {
          await client.replyMessage(replyToken, {
            type: 'text',
            text: userMessage,
          });
        } catch (err) {
          console.error('Reply failed:', err);
        }
      }
    })
  );

  res.status(200).send('OK');
}

