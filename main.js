let CHANNEL_ACCESS_TOKEN;

// ================================
// Firestore関連（改良版）
// ================================

// --- JWTトークンをキャッシュする（毎回生成しないように） ---
let FIREBASE_TOKEN_CACHE = { token: null, exp: 0 };

// Firestoreアクセストークン取得（キャッシュ付き）
async function getAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);

  // キャッシュが有効なら再利用
  if (FIREBASE_TOKEN_CACHE.token && FIREBASE_TOKEN_CACHE.exp > now + 60) {
    return FIREBASE_TOKEN_CACHE.token;
  }

  // JWTヘッダとペイロード
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: env.FIREBASE_CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  // JWT生成
  const jwt = await createJWT(header, payload, env.FIREBASE_PRIVATE_KEY);

  // Google OAuth2にPOSTしてアクセストークンを取得
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const data = await res.json();
  if (!data.access_token) throw new Error("アクセストークン取得失敗");

  // キャッシュ保存
  FIREBASE_TOKEN_CACHE = {
    token: data.access_token,
    exp: now + 3600,
  };

  return data.access_token;
}


// JWT作成関数（PEM → ArrayBuffer → 署名）
async function createJWT(header, payload, privateKeyPEM) {
  const encoder = new TextEncoder();
  const headerBase64 = btoa(JSON.stringify(header));
  const payloadBase64 = btoa(JSON.stringify(payload));
  const toSign = `${headerBase64}.${payloadBase64}`;

  const keyBuffer = pemToArrayBuffer(privateKeyPEM.replace(/\\n/g, "\n"));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(toSign));
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

  return `${toSign}.${signatureBase64}`;
}


// PEM文字列をArrayBufferへ変換
function pemToArrayBuffer(pem) {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}


// ================================
// Firestoreユーティリティ
// ================================
const firestore = {
  // ドキュメント取得
  async getDocument(env, collection, docId) {
    const token = await getAccessToken(env);
    const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      console.error("Firestore GET Error:", await res.text());
      throw new Error("Firestoreドキュメント取得失敗");
    }

    const doc = await res.json();
    return convertFirestoreToObject(doc.fields);
  },

  // ドキュメント更新（存在しなければ自動作成）
  async updateDocument(env, collection, docId, data) {
    const token = await getAccessToken(env);
    const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}/${docId}?updateMask.fieldPaths=*`;

    const fields = convertObjectToFirestore(data);

    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields }),
    });

    if (!res.ok) {
      console.error("Firestore UPDATE Error:", await res.text());
      throw new Error("Firestoreドキュメント更新失敗");
    }

    return await res.json();
  },
};


// ================================
// Firestore ↔ JS変換ヘルパー
// ================================

// Firestore → 通常オブジェクト
function convertFirestoreToObject(fields = {}) {
  const data = {};
  for (const key in fields) {
    const val = fields[key];
    const type = Object.keys(val)[0];
    data[key] = val[type];
  }
  return data;
}

// JSオブジェクト → Firestore形式
function convertObjectToFirestore(obj) {
  const fields = {};
  for (const key in obj) {
    const value = obj[key];
    if (typeof value === "number") fields[key] = { integerValue: value };
    else if (typeof value === "boolean") fields[key] = { booleanValue: value };
    else fields[key] = { stringValue: String(value) };
  }
  return fields;
}




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
              let text = '';

              text += 'Q.\n授業の名前がみつかりません。\n';
              text += 'A.\nLINEというアプリを使っている構造上、授業の名前を一部省略しています。誰でもどの授業か分かるように努めていますが、自分が探している授業がどれか分からなかった場合、フィードバックでお伝えください。\n\n\n';
              text += '\n\n';
              text += 'Version 2.2.0\n最近の更新内容\n・時間割関係及び欠時数関係の処理を、時間割アプリとして変更\n・応答速度の大幅な向上';

              await replyTokenMessage(replyToken, text);
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
