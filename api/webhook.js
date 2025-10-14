import { Client, middleware } from '@line/bot-sdk';
import { json } from 'micro';


const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new Client(config);

// Vercelではサーバレス関数として直接エクスポート
export default async function handler(req, res) {

  // イベント処理
  const body = await json(req);
  const events = body.events;
  await Promise.all(events.map(handleEvent));

  // LINEに返すHTTPステータスは必ず200
  res.status(200).send('OK');
}

// オウム返し関数
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return;
  await replyText(event.replyToken, event.message.text);
}

// replyToken返信
async function replyText(replyToken, text) {
  await client.replyMessage(replyToken, {
    type: 'text',
    text: text
  });
}
