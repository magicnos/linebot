import admin from "firebase-admin";

if (!admin.apps.length){
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

const db = admin.firestore();

export async function writeData(collection, docId, data){
  await db.collection(collection).doc(docId).set(data);
}

export async function readData(collection, docId){
  const doc = await db.collection(collection).doc(docId).get();
  return doc.exists ? doc.data() : null;
}