import { getMessaging } from 'firebase-admin/messaging';
import { logger } from 'firebase-functions/v2';
import { db } from './firebase';

/**
 * Get all FCM tokens for users at a specific location.
 */
export async function getTokensForLocation(locationId: string): Promise<string[]> {
  const tokensSnap = await db
    .collectionGroup('fcmTokens')
    .where('locationId', '==', locationId)
    .get();

  return tokensSnap.docs.map((d) => d.data().token as string);
}

/**
 * Get FCM tokens for specific user UIDs (batched to avoid N+1).
 */
export async function getTokensForUsers(uids: string[]): Promise<string[]> {
  if (uids.length === 0) return [];
  const tokens: string[] = [];
  // Firestore 'in' query supports max 10 items
  for (let i = 0; i < uids.length; i += 10) {
    const chunk = uids.slice(i, i + 10);
    const snap = await db.collectionGroup('fcmTokens')
      .where('userId', 'in', chunk)
      .get();
    snap.docs.forEach((d) => tokens.push(d.data().token as string));
  }
  return tokens;
}

/**
 * Send FCM to multiple tokens, cleaning up stale ones.
 */
export async function sendToTokens(
  tokens: string[],
  title: string,
  body: string,
  link?: string
): Promise<void> {
  if (tokens.length === 0) return;

  const messaging = getMessaging();

  // FCM supports max 500 tokens per multicast
  const BATCH_SIZE = 500;
  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE);

    const response = await messaging.sendEachForMulticast({
      tokens: batch,
      notification: { title, body },
      webpush: {
        fcmOptions: { link: link ?? '/' },
        notification: {
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-72.png',
        },
      },
    });

    // Clean up stale tokens
    if (response.failureCount > 0) {
      const staleTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (resp.error?.code === 'messaging/registration-token-not-registered' ||
            resp.error?.code === 'messaging/invalid-registration-token') {
          staleTokens.push(batch[idx]!);
        }
      });

      // Delete stale tokens from Firestore (in-query limited to 10 items)
      if (staleTokens.length > 0) {
        const staleArray = [...new Set(staleTokens)];
        const deleteBatch = db.batch();
        for (let j = 0; j < staleArray.length; j += 10) {
          const chunk = staleArray.slice(j, j + 10);
          const tokenDocs = await db.collectionGroup('fcmTokens')
            .where('token', 'in', chunk)
            .get();
          tokenDocs.docs.forEach((d) => deleteBatch.delete(d.ref));
        }
        await deleteBatch.commit();
        logger.info(`Cleaned up ${staleTokens.length} stale FCM tokens`);
      }
    }

    logger.info(`Sent ${response.successCount}/${batch.length} notifications`);
  }
}
