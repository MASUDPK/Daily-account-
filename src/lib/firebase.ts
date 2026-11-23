import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
} from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
  type Firestore,
} from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: 'AIzaSyBWo8Kgv_z8yMWN7izcUsl4NpAkWi3H1PQ',
  authDomain: 'daily-account-8ea61.firebaseapp.com',
  projectId: 'daily-account-8ea61',
  storageBucket: 'daily-account-8ea61.firebasestorage.app',
  messagingSenderId: '244805833481',
  appId: '1:244805833481:web:108ef7b157fb4f7789b9d8',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

let dbInstance: Firestore;
try {
  dbInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
    experimentalAutoDetectLongPolling: true,
  });
} catch {
  dbInstance = getFirestore(app);
}

export const db = dbInstance;
export const auth = getAuth(app);

// Keep administrator session persisted across browser & PWA restarts
setPersistence(auth, browserLocalPersistence).catch(() => {
  // Ignore if browser privacy mode blocks local persistence
});

export function mapFirebaseAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';

  switch (code) {
    case 'auth/invalid-email':
      return 'Invalid email address format. Please enter a valid administrator email.';
    case 'auth/missing-email':
      return 'Please enter your administrator email address.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please check your password and try again.';
    case 'auth/user-not-found':
      return 'No administrator account was found with this email address.';
    case 'auth/invalid-credential':
      return 'Invalid email or password. Please verify your administrator credentials and try again.';
    case 'auth/missing-password':
      return 'Please enter your password.';
    case 'auth/user-disabled':
      return 'This administrator account has been disabled. Contact the project owner in Firebase Console.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection and try again.';
    case 'auth/too-many-requests':
      return 'Too many unsuccessful attempts. Access is temporarily limited — please wait a few minutes or reset your password.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is disabled in Firebase Console for project daily-account-8ea61.';
    default:
      return error instanceof Error && error.message
        ? error.message
        : 'Authentication failed. Please try again.';
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<{ ok: boolean; offline: boolean }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { ok: false, offline: true };
  }
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return { ok: true, offline: false };
  }
  try {
    await getDocFromServer(doc(db, 'siteSettings', currentUser.uid));
    return { ok: true, offline: false };
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      return { ok: false, offline: true };
    }
    return { ok: true, offline: false };
  }
}
