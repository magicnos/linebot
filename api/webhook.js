import { Client } from '@line/bot-sdk';
import { json } from 'micro';

// 環境変数で管理
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new Client(config);

// Vercelサーバレス関数としてエクスポート
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const body = await json(req); // リクエストボディ取得
  const events = body.events;

  // 複数イベントが来てもすべて処理
  await Promise.all(events.map(handleEvent));

  // LINEに必ず200を返す
  res.status(200).send('OK');
}

// オウム返し処理
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return;
  await replyText(event.replyToken, event.message.text);
}

// replyTokenを使って返信
async function replyText(replyToken, text) {
  await client.replyMessage(replyToken, {
    type: 'text',
    text: `あなたはこう言いました: "${text}"`
  });
}
