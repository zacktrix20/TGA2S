import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, signInAnonymously, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    if (error.code === 'auth/popup-closed-by-user') {
      console.log("Login cancelled by user (popup closed).");
      throw new Error("Ulifunga dirisha la kuingia kabla ya kumaliza.");
    }
    if (error.code === 'auth/popup-blocked') {
      throw new Error("Kivinjari chako kimezuia dirisha la kuingia (Popup). Tafadhali ruhusu popups kwa tovuti hii ili uweze kuingia.");
    }
    console.error("Login failed", error);
    throw error;
  }
};

// Email/Password Authentication (Easier alternative)
export const signupWithEmail = async (email: string, password: string) => {
  try {
    console.log('📧 Creating account with email:', email);
    const result = await createUserWithEmailAndPassword(auth, email, password);
    console.log('✅ Account created:', result.user.uid);
    return result.user;
  } catch (error: any) {
    console.error('📧 Signup error details:', error);
    if (error.code === 'auth/email-already-in-use') {
      throw new Error("Barua pepe hii tayari ina akaunti.");
    }
    if (error.code === 'auth/weak-password') {
      throw new Error("Nenosiri linapaswa kuwa na angalau herufi 6.");
    }
    if (error.code === 'auth/invalid-email') {
      throw new Error("Barua pepe sio halali.");
    }
    const errorMsg = error.message || "Imeshindwa kuandika akaunti";
    console.error('Full error:', errorMsg);
    throw new Error(errorMsg);
  }
};

export const signinWithEmail = async (email: string, password: string) => {
  try {
    console.log('📧 Signing in with email:', email);
    const result = await signInWithEmailAndPassword(auth, email, password);
    console.log('✅ Signed in:', result.user.uid);
    return result.user;
  } catch (error: any) {
    console.error('📧 Signin error details:', error);
    if (error.code === 'auth/user-not-found') {
      throw new Error("Barua pepe hii haipatikani.");
    }
    if (error.code === 'auth/wrong-password') {
      throw new Error("Nenosiri si sahihi.");
    }
    if (error.code === 'auth/invalid-email') {
      throw new Error("Barua pepe sio halali.");
    }
    const errorMsg = error.message || "Imeshindwa kuingia";
    console.error('Full error:', errorMsg);
    throw new Error(errorMsg);
  }
};

export const logout = () => signOut(auth);

export const loginAnonymously = async () => {
  try {
    console.log('🎭 Attempting anonymous login...');
    const result = await signInAnonymously(auth);
    console.log('✅ Anonymous login successful:', result.user.uid);
    return result.user;
  } catch (error: any) {
    console.error('🎭 Anonymous login failed:', error);
    throw new Error("Imeshindwa kuingia kwa njia ya demo. Tafadhali jaribu tena.");
  }
};

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();
