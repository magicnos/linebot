let CHANNEL_ACCESS_TOKEN;


// JWTトークンを生成してアクセストークンを取得
async function getAccessToken(env){
  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: env.FIREBASE_CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encoder = new TextEncoder();
  const headerBase64 = btoa(JSON.stringify(header));
  const payloadBase64 = btoa(JSON.stringify(payload));
  const toSign = `${headerBase64}.${payloadBase64}`;

  const privateKeyPEM = env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");
  const key = await crypto.subtle.importKey(
    "pkcs8",
    str2ab(privateKeyPEM),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(toSign));
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  const jwt = `${toSign}.${signatureBase64}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  return data.access_token;
}

// PEM形式文字列をArrayBufferに変換
function str2ab(str){
  const b64 = str
    .replace(/-----[^-]+-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(b64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return buffer;
}

// firestore関数を定義
const firestore = {
  // ドキュメントを取得
  async getDocument(env, collection, docId) {
    const accessToken = await getAccessToken(env);
    const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  },

  // ドキュメントを作成または更新
  async updateDocument(env, collection, docId, data) {
    const accessToken = await getAccessToken(env);
    const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}/${docId}?currentDocument.exists=true`;

    // Firestore形式に変換
    const fields = {};
    for (const key in data) {
      fields[key] = { stringValue: String(data[key]) };
    }

    const body = JSON.stringify({ fields });
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body,
    });

    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  },
};





export default {
  async fetch(request, env){
    // チャネルアクセストークン
    CHANNEL_ACCESS_TOKEN = env.CHANNEL_ACCESS_TOKEN;

    // POST以外は拒否
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    // リクエストボディをパース
    const body = await request.json();

    // イベント情報を取得
    const events = body.events;
    if (!events || events.length === 0) {
      return new Response("No events", { status: 200 });
    }

    // 各イベントを順に処理
    for (const event of events) {

      const replyToken = event.replyToken; // リプレイトークン
      const userId = event.source.userId; // ユーザーID

      // LINEで送られてきたメッセージイベントによって分岐
      switch (event.type){
        case 'message':

          const getMessage = event.message?.text || ''; // テキスト内容を取得 nullやundefinedでもエラーにならないように

          switch (getMessage){
            case '欠時数確認':
              sendUserAbsence(userId, replyToken);
              break;

            case 'ヘルプ':
              const text =
              'Q.\nボタンの色を変えたらボタンの文字が見えなくなりました。どうしたらいいですか。\nA.\n半角テキストで、「colorCode」と送信すると、設定から自分でカラーコードを変更する時の状態にできます。\n\n\nQ.\n授業の名前がみつかりません。\nA.\nLINEというアプリを使っている構造上、授業の名前が長すぎると、名前を全て描画できなくなってしまうことがあります。そのため、授業の名前を一部省略して表示しています。誰でもどの授業か分かるように努めていますが、もし自分が探している授業がどれか分からなかった場合、フィードバックでお伝えください。\n\n\n\n\nVersion 2.1.0\n最近の更新内容\n・時間割関係及び欠時数関係の処理を、時間割アプリとして変更\n・毎週金曜の欠時数アラートメッセージの廃止\n→いずれ復活させます';

              replyTokenMessage(replyToken, text);

              break;

            case 'フィードバック':
              replyTokenMessage(replyToken, 'フィードバック内容をできるだけ詳細に、ラインのトークでお送りください。');

              // フィードバックモードに変更
              await firestore.updateDocument(env, userId, 'setting', {feedback: true});

              break;

            case 'test':
              // Firestore に書き込み
              await firestore.updateDocument(env, userId, 'timetable', {101: '現代の国語ア'});

              break;

            default:
              // 設定を取得
              const setting = await getDocument(env, collection, docId);

              // フィードバックを送りたいのかチェック
              if (setting['feedback']){
                replyTokenMessage(replyToken, 'フィードバックありがとうございました。追ってこちらから連絡することがございます。');
                firestore.updateDocument(`${userId}/setting`, {feedback: false}, true);
                const now = new Date();
                const month = now.getMonth() + 1; // 月(0始まりなので+1する)
                const date = now.getDate();       // 日
                const hour = now.getHours();      // 時(0〜23)
                const minute = now.getMinutes();  // 分
                const data = {
                  [`${month}/${date} ${hour}h${minute}m ${userId}`]: getMessage
                };
                firestore.updateDocument(`feedback/all`, data, true);
              }

              break;
          }

          break;
        case 'follow':
          // ブロック解除時にも有効

          // 歓迎メッセージ
          replyTokenMessage(replyToken, 'ようこそ新宿山吹の時間割へ');

          // ユーザーDBが存在しない時は作成
          makeUserDB(userId);

          // userIdが登録されていない時登録
          setUserId(userId);

          break;

        case 'postback':
          break;

        default:
          break;
      }
    }



    // レスポンスを返す
    return new Response("OK", { status: 200 });
  },
};


// replyTokenで返信
async function replyTokenMessage(replyToken, message) {
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${CHANNEL_ACCESS_TOKEN}`,
  };

  const body = JSON.stringify({
    replyToken,
    messages: [
      {
        type: "text",
        text: message,
      },
    ],
  });

  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers,
    body,
  });

  await res.text();
}


// 
async function sendUserAbsence(userId, replyToken){

}