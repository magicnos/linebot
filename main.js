const CHANNEL_ACCESS_TOKEN =
'G4T1pSCV/EOV78nbEp9R3FGrAG+a3u3oBRJ5ZlvTrwqpaoTP+EvoupeqHumqdo47Rc3T0MElZqVwLwzDpImzrGfBW/SHHNASZ7zd6/r9JC2hvvTU221y8uePzocgjb8ndAOOej2Sr4ZzfPjIzDlewwdB04t89/1O/w1cDnyilFU='



export default {
  async fetch(request, env){

    // リクエストのJSONボディを取得
    const body = await request.json();

    // イベント情報を取得（メッセージがない場合は無視）
    const event = body.events?.[0];
    if (!event || !event.message || !event.replyToken) {
      return new Response("No valid event", { status: 200 });
    }

    // メッセージ本文を取得
    const userMessage = event.message.text;

    // replyToken
    const replyToken = event.replyToken;

    // 返信
    replyTokenMessage(replyToken, userMessage);

    return new Response("OK", { status: 200 });
  },
};


// 返信
async function replyTokenMessage(replyToken, message){

  const replyEndpoint = "https://api.line.me/v2/bot/message/reply";
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
  };

  const payload = {
    replyToken,
    messages: [
      {
        type: "text",
        text: message, // オウム返し
      },
    ],
  };

  // LINEに返信
  const res = await fetch(replyEndpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  await res.text();
}