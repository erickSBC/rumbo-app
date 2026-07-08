/**
 * Inicialización del Firebase Web SDK (lado cliente).
 *
 * Estas claves NEXT_PUBLIC_* son públicas por diseño: el SDK web las expone en
 * el navegador. La seguridad real vive en las reglas de Firestore (Anexo C) y
 * en la verificación de tokens del backend, no en ocultar estas claves.
 *
 * Se usará desde el Día 2 para el login con Firebase Authentication.
 */
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Evita reinicializar en el hot-reload de Next.js.
export const firebaseApp: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth: Auth = getAuth(firebaseApp);
