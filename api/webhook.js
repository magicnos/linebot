import { Client, middleware } from '@line/bot-sdk';
import express from 'express';

const app = express();

// 環境変数に設定しておく
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new Client(config);

// LINE署名チェック用ミドルウェア
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

// イベント処理（オウム返し）
async function handleEvent(event) {
  // テキストメッセージ以外は無視
  if (event.type !== 'message' || event.message.type !== 'text') return;

  // 受け取ったテキストをそのまま返信
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: `あなたはこう言いました: "${event.message.text}"`
  });
}

export default app;
