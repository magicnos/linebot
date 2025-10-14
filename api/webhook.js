import { Client, middleware } from '@line/bot-sdk';
import express from 'express';

const app = express();

// 環境変数に設定しておく
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new Client(config);

// LINEの署名チェック
app.post('/api/webhook', middleware(config), async (req, res) => {
  try {
    const events = req.body.events;
    const promises = events.map(handleEvent);
    await Promise.all(promises);
    res.status(200).send('OK');
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

// イベント処理
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null); // テキスト以外は無視
  }

  // 受け取ったテキストをそのまま返信
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: `あなたはこう言いました: "${event.message.text}"`
  });
}

export default app;