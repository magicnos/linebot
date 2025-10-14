export default {
  async fetch(request, env){
    // チャネルアクセストークン
    const CHANNEL_ACCESS_TOKEN = env.CHANNEL_ACCESS_TOKEN;

    // POST以外は拒否
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    // リクエストボディをパース
    let body;
    try {
      body = await request.json();
    }catch (e){
      return new Response("Invalid JSON", { status: 400 });
    }

    // イベント情報を取得
    const event = body.events?.[0];
    if (!event || !event.message || !event.replyToken){
      return new Response("No valid event", { status: 200 });
    }


    const replyToken = event.replyToken; // リプレイトークン
    const userId = event.source.userId; // ユーザーID

    // メッセージ内容を取得
    const getMessage = event.message.text;

    // 返信
    await replyToLine(replyToken, getMessage, CHANNEL_ACCESS_TOKEN);


    // レスポンスを返す
    return new Response("OK", { status: 200 });
  },
};


// replyTokenで返信
async function replyToLine(replyToken, message, channelAccessToken) {
  const url = "https://api.line.me/v2/bot/message/reply";

  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${channelAccessToken}`,
  };

  const body = JSON.stringify({
    replyToken,
    messages: [
      {
        type: "text",
        text: message, // そのままオウム返し
      },
    ],
  });

  const res = await fetch(url, {
    method: "POST",
    headers,
    body,
  });

  await res.text();
}
