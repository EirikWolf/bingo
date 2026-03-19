import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import app from './firebase';
import { db } from './firebase';
import toast from 'react-hot-toast';

// VAPID key from Firebase Console → Cloud Messaging → Web Push certificates
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY ?? '';

let messaging: ReturnType<typeof getMessaging> | null = null;

function getMessagingInstance() {
  if (!messaging) {
    try {
      messaging = getMessaging(app);
    } catch {
      console.warn('Firebase Messaging not supported in this browser');
      return null;
    }
  }
  return messaging;
}

/**
 * Check if notifications are supported in this browser.
 */
export function isNotificationSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator
  );
}

/**
 * Get current notification permission status.
 */
export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission;
}

/**
 * Request notification permission and register FCM token.
 * Returns the token if granted, null otherwise.
 */
export async function requestNotificationPermission(
  userId: string,
  locationId: string | null
): Promise<string | null> {
  if (!isNotificationSupported()) {
    toast.error('Nettleseren din støtter ikke push-varsler');
    return null;
  }

  if (!VAPID_KEY) {
    console.warn('VAPID key not configured — push notifications disabled');
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    toast('Push-varsler er ikke aktivert', { icon: '🔕' });
    return null;
  }

  const msg = getMessagingInstance();
  if (!msg) return null;

  try {
    // Register the FCM service worker
    const registration = await navigator.serviceWorker.register(
      '/firebase-messaging-sw.js'
    );

    const token = await getToken(msg, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      console.warn('No FCM token received');
      return null;
    }

    // Store token in Firestore under the user's fcmTokens subcollection
    await setDoc(
      doc(db, 'users', userId, 'fcmTokens', token),
      {
        token,
        locationId: locationId ?? null,
        platform: 'web',
        createdAt: serverTimestamp(),
      }
    );

    toast.success('Push-varsler er aktivert!');
    return token;
  } catch (error) {
    console.error('FCM registration error:', error);
    toast.error('Kunne ikke aktivere push-varsler');
    return null;
  }
}

/**
 * Remove FCM token when user disables notifications.
 */
export async function removeNotificationToken(
  userId: string,
  token: string
): Promise<void> {
  try {
    await deleteDoc(doc(db, 'users', userId, 'fcmTokens', token));
  } catch (error) {
    console.error('Error removing FCM token:', error);
  }
}

/**
 * Listen for foreground messages and show as toast.
 */
export function setupForegroundMessages(): (() => void) | null {
  const msg = getMessagingInstance();
  if (!msg) return null;

  const unsubscribe = onMessage(msg, (payload) => {
    const title = payload.notification?.title ?? 'BingoPortalen';
    const body = payload.notification?.body ?? '';
    toast(
      `${title}: ${body}`,
      {
        icon: '🔔',
        duration: 5000,
      }
    );
  });

  return unsubscribe;
}
