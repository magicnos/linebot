let CHANNEL_ACCESS_TOKEN;

// ================================
// JWTアクセストークン生成
// ================================
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
    return await res.json();
  },

  // ドキュメント作成・更新
  async updateDocument(env, collection, docId, data) {
    const token = await getAccessToken(env);
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
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body,
    });

    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  },
};




export default {
  async fetch(request, env) {
    CHANNEL_ACCESS_TOKEN = env.CHANNEL_ACCESS_TOKEN;

    if (request.method !== "POST"){
      return new Response("Method Not Allowed", { status: 405 });
    }

    const body = await request.json();
    const events = body.events;

    for (const event of events) {
      const replyToken = event.replyToken;
      const userId = event.source.userId;

      switch (event.type) {
        case "message":
          const getMessage = event.message?.text || "";

          switch (getMessage) {
            case "欠時数確認":
              await sendUserAbsence(env, userId, replyToken);
              break;

            case 'ヘルプ':
              const text =
              'Q.\nボタンの色を変えたらボタンの文字が見えなくなりました。どうしたらいいですか。\nA.\n半角テキストで、「colorCode」と送信すると、設定から自分でカラーコードを変更する時の状態にできます。\n\n\nQ.\n授業の名前がみつかりません。\nA.\nLINEというアプリを使っている構造上、授業の名前が長すぎると、名前を全て描画できなくなってしまうことがあります。そのため、授業の名前を一部省略して表示しています。誰でもどの授業か分かるように努めていますが、もし自分が探している授業がどれか分からなかった場合、フィードバックでお伝えください。\n\n\n\n\nVersion 2.1.0\n最近の更新内容\n・時間割関係及び欠時数関係の処理を、時間割アプリとして変更\n・毎週金曜の欠時数アラートメッセージの廃止\n→いずれ復活させます';
              replyTokenMessage(replyToken, text);
              break;

            case "フィードバック":
              await replyTokenMessage(replyToken, 'フィードバック内容をできるだけ詳細に送信してください。');
              await firestore.updateDocument(env, userId, 'timetable', { 101: '現代の国語ア' });
              break;

            case "test":
              await firestore.updateDocument(env, userId, 'timetable', { 101: 'test' });
              await replyTokenMessage(replyToken, "Firestore にデータを保存しました。");
              break;

            default:
              // 設定情報を取得して判定
              try {
                const doc = await firestore.getDocument(env, userId, 'setting');
                if (doc['feedback']){
                  await replyTokenMessage(replyToken, "フィードバックありがとうございました！");
                  await firestore.updateDocument(env, userId, 'setting', { feedback: "false" });
                }
              }catch{
                await replyTokenMessage(replyToken, "フィードバック送信に失敗しました。お手数ですが再度フィードバックをお送りください。");
              }
              break;
          }
          break;

        case "follow":
          await replyTokenMessage(replyToken, "ようこそ!時間割管理Botへ!");
          // await makeUserDB(env, userId);
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


// 欠時数一覧をテキストメッセージで送信する
async function sendUserAbsence(env, replyToken, userId){
  // 欠時数と時間割情報取得
  const absenceDoc = await firestore.getDocument(env, userId, 'absence');
  const timetableDoc = await firestore.getDocument(env, userId, 'timetable');

  // 欠時数情報を入れとくやつ
  let absenceText = '';

  // 整形
  for (let i = 0; i < 30; i++){
    // 曜日
    if (i % 6 == 0){
      if (i != 0){
        absenceText += `\n${'月火水木金'[i/6]}曜\n`;
      }else{
        absenceText += `${'月火水木金'[i/6]}曜\n`;
      }
    }
    // 時限
    absenceText += String((i%6)*2+1) + '-' + String((i%6)*2+2) + '限 ';
    // 授業名と欠時数
    if (absenceDoc[timetableDoc[i+101]] === undefined){
      absenceText += '\n';
    }else{
      absenceText += `${timetableDoc[i+101]} : ${absenceDoc[timetableDoc[i+101]]}\n`;
    }
  }

  // 総欠時を追加
  absenceText += '\n';
  const absence = Object.values(absenceDoc);
  let sum = 0;
  for (const i of absence){
    sum += i;
  }
  absenceText += `総欠時 : ${sum}`;


  // 送信
  replyTokenMessage(replyToken, absenceText);
}