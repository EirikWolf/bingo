import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';

// Ensure app is initialized only once
if (getApps().length === 0) {
  initializeApp();
}

setGlobalOptions({ region: 'us-central1' });

export const db = getFirestore();
