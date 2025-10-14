import { Client, middleware } from '@line/bot-sdk';
import { json } from 'micro';


const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new Client(config);

// Vercelではサーバレス関数として直接エクスポート
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  // ミドルウェア的に署名チェック
  const signature = req.headers['x-line-signature'];
  const body = await json(req);

  // LINE署名の検証
  try {
    middleware(config)(req, res, () => {}); // 空関数でmiddlewareを通す
  } catch (err) {
    console.error(err);
    res.status(401).send('Invalid signature');
    return;
  }

  // イベント処理
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
