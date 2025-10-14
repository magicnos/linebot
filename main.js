// import 'https://static.line-scdn.net/liff/edge/2/sdk.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getFirestore,
  getDoc,
  doc,
  updateDoc,
  deleteField
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";



let db, auth, userId;



// DB初期化処理
async function initFirebase(){
  // Firebase初期化
  const firebaseConfig = {
    apiKey: "AIzaSyBdp66vY1UQJWQNpUaq_GBd-zcNnZXTXgg",
    authDomain: "linebot-799ed.firebaseapp.com",
    projectId: "linebot-799ed"
  };

  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth();

  // 匿名ログイン
  await signInAnonymously(auth);
}


// liff初期化とプロフィール取得
async function firstLiff(){
  const liffId = "2008192386-zPDXa2d8";

  try{
    // LIFF初期化
    await liff.init({ liffId });

    // ログインしてなければログイン
    if (!liff.isLoggedIn()){
      liff.login();
      return;
    }

    // ユーザープロフィール取得
    const profile = await liff.getProfile();
    document.getElementById("userId").textContent = profile.userId;

    return profile.userId;
  }catch (error){
    alert("エラーが起きました。再度開きなおすか、下記のエラー内容をお知らせください。\n" + "LIFF初期化に失敗しました: " + error);
  }
}


// Firestoreからデータ取得(コレクション/ドキュメント)
async function getData(path1, path2){
  const docRef = doc(db, path1, path2);
  const snap = await getDoc(docRef);

  if (snap.exists()){
    return snap.data(); 
  }else{
    return null;
  }
}


// 時間割に授業をセット(オブジェクト型)
function setTimetable(timetableData){
  const table = document.getElementById('timetable');
  for (let k = 1; k <= 5; k++){
    for (let i = 1; i <= 12; i+=2){
      if (timetableData[(k-1)*6 + (i-1)/2 + 101] != '空きコマ'){
        table.rows[i].cells[k].innerText = timetableData[(k-1)*6 + (i-1)/2 + 101];
      }else{
        table.rows[i].cells[k].innerText = '-';
      }
    }
  }
}


// 欠時数時間割にボタン設置&総欠時表示(オブジェクト型)
function setButton(timetableData, absenceData){
  const table = document.getElementById("absence");

  for (let k = 1; k <= 5; k++){
    for (let i = 1; i <= 12; i += 2){
      const className = timetableData[(k-1)*6 + (i-1)/2 + 101];

      // ここでクリアして、空きコマにした場所にボタンが残るのを防ぐ
      const cell = table.rows[i].cells[k];
      cell.textContent = ""; // クリア

      // 空きコマじゃないとき、ボタンと欠時数を設置
      if (className != '空きコマ'){
        // 増ボタン
        const btnUp = document.createElement("button");
        btnUp.textContent = "△";
        btnUp.onclick = () => changeAbsence(className, absenceData, timetableData, btnDown, btnUp, 1);
        cell.appendChild(btnUp);

        // 欠時数(span)
        const span = document.createElement("span");
        span.className = "count";
        span.textContent = absenceData[className];
        cell.appendChild(span);

        // 減ボタン
        const btnDown = document.createElement("button");
        btnDown.textContent = "▽";
        btnDown.onclick = () => changeAbsence(className, absenceData, timetableData, btnDown, btnUp, -1);
        cell.appendChild(btnDown);
      }else{
        cell.textContent = "-";
      }
    }
  }

  // 総欠時数表示
  allAbsence(absenceData);
}


// 欠時数を変える
async function changeAbsence(className, absenceData, timetableData, btnDown, btnUp, operation){
  // 現在のローカル欠時数を取得
  const current = absenceData[className];
  // 欠時数増減倍率取得(name="absenceScale" のラジオボタンのうち、チェックされているものを取得)
  const scale = Number(document.querySelector('input[name="absenceScale"]:checked').value);
  // 0以下なら変更しない
  if (current - scale < 0 && operation == -1) return;
  // ローカルで新しい欠時数を定義
  const newValue = current + scale*operation;

  // ローカル欠時数変更
  absenceData[className] = newValue;
  // UI欠時数を変更
  const table = document.getElementById('absence');
  for (let k = 1; k <= 5; k++){
    for (let i = 1; i <= 12; i+=2){
      if (timetableData[(k-1)*6 + (i-1)/2 + 101] != '空きコマ'){
        const cell = table.rows[i].cells[k];
        const span = cell.querySelector(".count");
        span.textContent = absenceData[timetableData[(k-1)*6 + (i-1)/2 + 101]];
      }
    }
  }

  // ボタンを無効化
  btnDown.disabled = true;
  btnUp.disabled = true;

  // DBに触ってる
  const docRef = doc(db, userId, 'absence');

  try{
    // DB更新
    await updateDoc(docRef, { [className]: newValue });
  }catch (err){
    alert("更新に失敗しました。もう一度試してください。");

    // DB更新失敗時値を元に戻す
    absenceData[className] = current;
    span.textContent = current;
  }finally{
    // ボタン再有効化
    btnDown.disabled = false;
    btnUp.disabled = false;
  }

  // 総欠時数表示
  allAbsence(absenceData);
}


// 総欠時表示
async function allAbsence(absenceData){
  let allAbsence = 0;
  for (const key in absenceData){
    allAbsence += absenceData[key];
  }
  document.getElementById("allAbsence").textContent = `総欠時：${allAbsence}`;
}


// 時間割モーダルの初期化
function initModal(){
  const modal = document.getElementById('modal');
  const span = document.getElementById('closeModal');

  // ×ボタンクリックで閉じる
  span.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  // モーダル外クリックで閉じる
  window.addEventListener('click', (event) => {
    if (event.target == modal){
      modal.style.display = 'none';
    }
  });

  // モーダル内授業ボタン
  modal.addEventListener('click', async e => {
    if (e.target.classList.contains('modal-btn')){
      const id = e.target.id;
      const newTimetable = await changeTimetable(id);
      const newAbsence = await getData(userId, 'absence');
      setTimetable(newTimetable);
      setButton(newTimetable, newAbsence);
      modal.style.display = 'none';
    }
  });
}


// セルをタップしたらモーダルを開く
function attachCellEvents(){
  // timetableテーブルだけ取得
  const timetable = document.getElementById('timetable');
  const cells = timetable.querySelectorAll('.cellText');

  cells.forEach(cell => {
    cell.addEventListener('click', async () => {
      const modal = document.getElementById("modal");
      const body = document.getElementById("modal-body");

      // タップされたセルの行・列番号を取得
      const row = cell.parentElement.rowIndex;
      const col = cell.cellIndex;

      // 時間割番号と授業群を取得
      const i = (Math.floor(row/2)) + (col-1)*6;
      const data = await getData('timetable_week', String(i+101));

      // モーダルに授業名を追加
      let html = `
        <h3>授業一覧</h3>
      `;
      for (let k = 0; k < Object.keys(data).length; k++){
        html += `<button id="m${i},${k}" class="modal-btn">${data[k]}</button>`;
      }
      body.innerHTML = html;

      // モーダル表示
      modal.style.display = 'block';
    });
  });
}


// 時間割変更
async function changeTimetable(id){
  // 現在の時間割を取得
  const timetableDoc = await getData(userId, 'timetable');

  // ボタンIdを配列に(時間割番号, 授業番号)
  const btnId = id.slice(1).split(',');

  // DBに触ってる
  const timetableDocRef = doc(db, userId, 'timetable');
  const absenceDocRef = doc(db, userId, 'absence');

  // -- 新規追加授業名取得 --
  // 曜日別時間割データ取得
  const timetableData = await getData('timetable_week', String(Number(btnId[0]) + 101));
  const newClassName = timetableData[btnId[1]];
  // ----

  // 現在の時間割配列を作成
  let currentTimetable = [];
  for (let t = 101; t < 131; t++){
    currentTimetable.push(timetableDoc[t]);
  }

  // キャッシュにしておく
  let newDoc = {}; // 新規授業情報
  let currentDoc = {}; // 既存授業情報
  let newCredit = 0; // 新規授業単位数
  let currentCredit = 0; // 既存授業単位数
  let elseI = 0;  // 既存授業が4単位の時、もう片方の場所
  let de1 = '';
  let de2 = '';
  const i = btnId[0]; // 変更箇所
  const currentClassName = currentTimetable[i]; // 既存授業名
  const timetables = {};  // 新しい時間割オブジェクト


  // 以下同じ授業でないとして、時間割変更
  if (newClassName != currentClassName){

    // 必要なドキュメントをまとめて取得
    newDoc = await getData('timetable_name', newClassName); // 新規授業情報
    currentDoc = await getData('timetable_name', currentClassName); // 既存授業情報

    // 単位数をまとめて取得
    newCredit = newDoc.credit; // 新規授業単位数
    currentCredit = currentDoc.credit; // 既存授業単位数

    // 既存授業が4単位の時、もう片方の場所を定義しておく
    if (currentCredit == 4){
      const currentWeek1 = currentDoc.week1;
      const currentWeek2 = currentDoc.week2;
      const currentHour = currentDoc.hour;
      if (i == currentWeek1*6 + currentHour){
        elseI = currentWeek2*6 + currentHour;
      }else{
        elseI = currentWeek1*6 + currentHour;
      }
    }

    // 配列操作
    if (newCredit == 4){
      // 新規授業が4単位の時、両方の場所を保存しておく
      de1 = currentTimetable[newDoc.week1*6 + newDoc.hour];
      de2 = currentTimetable[newDoc.week2*6 + newDoc.hour];

      // 既存授業単位数
      if (currentCredit == 4){
        // もう片方の情報
        const elseDoc = await getData('timetable_name', currentTimetable[elseI]);
        if (elseDoc.credit == 4){
          // もう片方の4単位を、全部空きコマにする
          currentTimetable[elseDoc.week1*6 + elseDoc.hour] = '空きコマ';
          currentTimetable[elseDoc.week2*6 + elseDoc.hour] = '空きコマ';

          // 既存授業のもう片方を空きコマにする
          currentTimetable[elseI] = '空きコマ';
        }
      }

      // 授業登録
      currentTimetable[newDoc.week1*6 + newDoc.hour] = newClassName;
      currentTimetable[newDoc.week2*6 + newDoc.hour] = newClassName;
    }else{
      if (currentCredit == 4){
        currentTimetable[elseI] = '空きコマ';
      }
    }

    // 一律で登録箇所に登録
    currentTimetable[i] = newClassName;

    // DB更新
    for (let k = 0; k < 30; k++){
      timetables[k+101] = currentTimetable[k];
    }
    await updateDoc(timetableDocRef, timetables);
  }else{
    // 同じ授業なら既存オブジェクトをそのまま返す
    for (let k = 0; k < 30; k++){
      timetables[k+101] = currentTimetable[k];
    }
  }


  // 以下同じ授業でないとして、欠時数変更
  if (newClassName != currentClassName){
    // 欠時削除
    if (newCredit == 4){
      if (de1 != de2){
        if (de1 != '空きコマ'){
          await updateDoc(absenceDocRef, { [de1]: deleteField() });
        }
        if (de2 != '空きコマ'){
          await updateDoc(absenceDocRef, { [de2]: deleteField() });
        }
      }else{
        if (de1 != '空きコマ'){
          await updateDoc(absenceDocRef, { [de1]: deleteField() });
        }
      }
    }else{
      if (currentCredit != 0){
        await updateDoc(absenceDocRef, { [currentClassName]: deleteField() });
      }
    }

    // 欠時追加
    if (newClassName != '空きコマ'){
      const newAbsence = { [newClassName]: 0 };
      await updateDoc(absenceDocRef, newAbsence);
    }
  }


  // UI反映のために新規時間割をreturnする
  return timetables;
}


// 今日の曜日に赤枠をつける
function highlightToday(){
  // 曜日配列（日曜=0, 月曜=1, ...）
  const dayOfWeek = new Date().getDay();

  // 1〜5（月〜金）のときのみ処理
  if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    // timetableテーブル内のthを取得
    const ths = document.querySelectorAll("#timetable thead th");

    // 例: 月なら1番目（0は「時限」）
    const targetTh = ths[dayOfWeek];
    if (targetTh) {
      targetTh.classList.add("todayHeader");
    }
  }
}


// 本日欠席機能
function todayAbsence(){
  // ボタンを取得
  const saveButton = document.getElementById("todayAbsence");

  // クリックイベントを登録
  saveButton.addEventListener("click", async () => {
    // 曜日取得
    const now = new Date();
    const day = now.getDay(); // 0=日曜, 1=月曜, ... 6=土曜

    // 土日は授業がない
    if (day == 0 || day == 6){
      alert('本日定時制課程の授業はありません。');
      return;
    }

    // 欠時数取得(catchで使うのでtryの外で定義)
    const absenceData = await getData(userId, 'absence');

    try{
      // 時間割取得
      const timetableObj = await getData(userId, 'timetable');
      const timetableData = [];
      for (let i = 0; i < 6; i++){
        if (timetableObj[(day-1)*6 + i + 101] != '空きコマ'){
          timetableData.push(timetableObj[(day-1)*6 + i + 101]);
        }
      }

      // 新しい欠時情報
      const newAbsenceData = {};
      for (let i = 0; i < timetableData.length; i++){
        // 何欠つけるのか調べる
        const classData = await getData('timetable_name', timetableData[i]);
        const credit = classData.credit;
        const addNumber = `${'21'[credit%2]}`;
        // 新規欠時代入
        newAbsenceData[timetableData[i]] =
        Number(absenceData[timetableData[i]]) + Number(addNumber);
      }

      // DB更新
      const docRef = doc(db, userId, 'absence');
      await updateDoc(docRef, newAbsenceData);

      // UI更新
      Object.assign(absenceData, newAbsenceData); // マージ
      setButton(timetableObj, absenceData);

      alert("本日の欠席を登録しました。");
    }catch (err){
      // エラー時は欠時数を元に戻す
      const docRef = doc(db, userId, 'absence');
      await updateDoc(docRef, absenceData);

      alert("欠時数登録に失敗しました。もう一度試してください。");
    }
  });
}




// メインの処理
async function main(){
  // DB初期化
  await initFirebase();
  // liff初期化とuserId取得
  userId = await firstLiff();

  // ユーザーの時間割情報と欠時数情報を取得
  const timetableData = await getData(userId, 'timetable');
  const absenceData = await getData(userId, 'absence');

  // 時間割に時間割を表示
  setTimetable(timetableData);

  // 欠時数時間割に欠時数と欠時変更ボタンを設置
  setButton(timetableData, absenceData);

  // 時間割モーダル表示と内容セット
  initModal();
  attachCellEvents();

  // 今日の曜日に赤枠をつける
  highlightToday();
  // 本日欠席機能
  todayAbsence();
}


main();


// 設定類のliffを作成
// 今あるgasを別のファイルにバックアップしておいて、一気に書き換える
// gasが必要最低限になったので、別のwebhookでラインボットを動かせるか試す