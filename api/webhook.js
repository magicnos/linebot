import { Client, middleware } from '@line/bot-sdk';
import express from 'express';

const app = express();

// 環境変数
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new Client(config);

// --- Webhookエンドポイント ---
app.post('/api/webhook', middleware(config), async (req, res) => {
  try {
    const events = req.body.events;
    await Promise.all(events.map(handleEvent));
    res.status(200).send('OK');
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

// --- イベント処理 ---
async function handleEvent(event) {
  // テキストメッセージ以外は無視
  if (event.type !== 'message' || event.message.type !== 'text') return;

  // テキストをreplyTokenで返信する関数を呼ぶ
  await replyText(event.replyToken, event.message.text);
}

// --- オウム返し関数 ---
async function replyText(replyToken, text) {
  try {
    await client.replyMessage(replyToken, {
      type: 'text',
      text: `あなたはこう言いました: "${text}"`
    });
  } catch (err) {
    console.error('返信エラー:', err);
  }
}

export default app;
