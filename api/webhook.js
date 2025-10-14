import line from "@line/bot-sdk";
import { writeData, readData } from "./firestore.js";

const client = new Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

export default async function handler(req, res){
  if (req.method !== "POST") return res.status(405).end();

  const events = req.body.events;

  // 複数イベントを順次処理
  for (const event of events){
    const userId = event.source.userId;
    const replyToken = event.replyToken;

    switch (event.type){
      case 'message':
        if (event.message.type != 'text') return;

        const getMessage = event.message.text;
        await replyTokenMessage(replyToken, getMessage);


        break;

      case 'follow':
        break;

      case 'postback':
        break;

      default:
        break;
    }
  
  }

  res.status(200).end();
}



// replyToken返信
async function replyTokenMessage(replyToken, message){
  await client.replyMessage(replyToken, {
    type: "text",
    text: message,
  });
}




        // // Firestoreに保存
        // await writeData("messages", userId, { latest: text, time: Date.now() });

        // // Firestoreからデータ取得
        // const stored = await readData("messages", userId);