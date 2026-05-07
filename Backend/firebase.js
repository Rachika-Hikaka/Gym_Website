let firestore = null;

try {
  const admin = require("firebase-admin");
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (serviceAccountJson && !admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(serviceAccountJson))
    });
    firestore = admin.firestore();
  }
} catch (error) {
  firestore = null;
}

async function saveFirebaseDocument(collection, data) {
  if (!firestore) return;
  await firestore.collection(collection).add({
    ...data,
    syncedAt: new Date().toISOString()
  });
}

module.exports = {
  firestore,
  saveFirebaseDocument
};
