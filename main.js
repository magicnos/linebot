export default {
  async fetch(request, env) {
    // POST以外は拒否
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    // リクエストボディを取得
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response("Invalid JSON", { status: 400 });
    }

    // イベント情報を取得
    const event = body.events?.[0];
    if (!event || !event.message || !event.replyToken) {
      return new Response("No valid event", { status: 200 });
    }

    // メッセージ本文とreplyTokenを取得
    const userMessage = event.message.text;
    const replyToken = event.replyToken;

    // オウム返し
    await replyTokenMessage(replyToken, userMessage, env);

    return new Response("OK", { status: 200 });
  },
};

// LINEへの返信処理
async function replyTokenMessage(replyToken, message, env) {
  const replyEndpoint = "https://api.line.me/v2/bot/message/reply";
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${env.CHANNEL_ACCESS_TOKEN}`, // ← 環境変数から取得！
  };

  const payload = {
    replyToken,
    messages: [
      {
        type: "text",
        text: message,
      },
    ],
  };

  const res = await fetch(replyEndpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  // 応答をチェック
  if (!res.ok) {
    const errorText = await res.text();
    console.error("LINE API Error:", errorText);
  }
}
