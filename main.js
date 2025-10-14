let CHANNEL_ACCESS_TOKEN;

// JWTアクセストークン生成
async function getAccessToken(env) {
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
  const keyBuffer = pemToArrayBuffer(privateKeyPEM);

  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(toSign));
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

  const jwt = `${toSign}.${signatureBase64}`;

  // アクセストークン取得
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const data = await res.json();
  if (!data.access_token) throw new Error("アクセストークン取得失敗");
  return data.access_token;
}


// PEM文字列をArrayBufferへ変換
function pemToArrayBuffer(pem) {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const binary = atob(b64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return buffer;
}

// ================================
// Firestore関連関数
// ================================
const firestore = {
  // ドキュメント取得
  async getDocument(env, collection, docId) {
    const token = await getAccessToken(env);
    const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(await res.text());
    const doc = await res.json();

    // Firestoreのfields形式を通常のオブジェクトに変換
    const data = {};
    for (const key in doc.fields) {
      const val = doc.fields[key];
      if (val.stringValue !== undefined) data[key] = val.stringValue;
      else if (val.integerValue !== undefined) data[key] = Number(val.integerValue);
    }
    return data;
  },

  // ドキュメント作成・更新
  async updateDocument(env, collection, docId, data) {
    const token = await getAccessToken(env);
    const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`;

    // Firestore形式に変換
    const fields = {};
    for (const key in data) {
      fields[key] = { stringValue: String(data[key]) };
    }

    const body = JSON.stringify({ fields });
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body,
    });

    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  },
};



// ================================
// メイン処理
// ================================
export default {
  async fetch(request, env) {
    CHANNEL_ACCESS_TOKEN = env.CHANNEL_ACCESS_TOKEN;

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const body = await request.json();
    const events = body.events || [];

    for (const event of events){
      const replyToken = event.replyToken;
      const userId = event.source.userId;

      switch(event.type){
        case 'message':

          const getMessage = event.message?.text || "";

          switch (getMessage){

            case "欠時数確認":
              await sendUserAbsence(env, userId, replyToken);
              break;

            case "ヘルプ":
              await replyTokenMessage(
                replyToken,
                "Q. ボタンの色を変えたら文字が見えなくなりました。\nA. 「colorCode」と送信してください。\n\nVersion 2.1.0\n最近の更新内容: 欠時数機能改修"
              );
              break;

            case "フィードバック":
              await replyTokenMessage(replyToken, "フィードバック内容をできるだけ詳細に送信してください。");
              await firestore.updateDocument(env, userId, "setting", { feedback: "true" });
              break;

            case "test":
              await firestore.updateDocument(env, userId, "timetable", { 101: "test" });
              await replyTokenMessage(replyToken, "Firestore にデータを保存しました。");
              break;

            default:
              try {
                const setting = await firestore.getDocument(env, userId, "setting");
                if (setting.feedback === "true") {
                  await replyTokenMessage(replyToken, "フィードバックありがとうございました！");
                  await firestore.updateDocument(env, userId, "setting", { feedback: "false" });
                }
              } catch (e) {
                await replyTokenMessage(replyToken, "フィードバック送信に失敗しました。");
              }
              break;

          }
          break;

        case 'follow':
          await replyTokenMessage(replyToken, "ようこそ新宿山吹の時間割へ");
          break;

        default:
          break;
      }
    }


    return new Response("OK", { status: 200 });
  },
};



// replyToken返信
async function replyTokenMessage(replyToken, message) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
  };

  const body = JSON.stringify({
    replyToken,
    messages: [{ type: "text", text: message }],
  });

  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers,
    body,
  });
}


// 欠時数をテキストで送信
async function sendUserAbsence(env, userId, replyToken) {
  const absenceDoc = await firestore.getDocument(env, userId, "absence");
  const timetableDoc = await firestore.getDocument(env, userId, "timetable");

  let text = "";
  const days = ["月", "火", "水", "木", "金"];

  for (let i = 0; i < 30; i++) {
    if (i % 6 === 0) text += `\n${days[Math.floor(i / 6)]}曜\n`;
    const period = `${(i % 6) * 2 + 1}-${(i % 6) * 2 + 2}限 `;
    const subject = timetableDoc[i + 101] || "";
    const count = absenceDoc[subject] || 0;
    text += `${period}${subject ? `${subject}: ${count}回` : ""}\n`;
  }

  const total = Object.values(absenceDoc).reduce((a, b) => a + Number(b || 0), 0);
  text += `\n総欠時: ${total}`;

  await replyTokenMessage(replyToken, text);
}
