/**
 * Inicialización del Firebase Admin SDK.
 *
 * El Admin SDK opera con privilegios de servidor y OMITE las reglas de
 * Firestore (Anexo C) — por eso es el único que puede escribir en la
 * colección `planes` (seed) y asignar custom claims (Día 2).
 *
 * La credencial se carga desde un archivo de service account referenciado por
 * la variable de entorno SERVICE_ACCOUNT_PATH. Ese archivo NUNCA se commitea
 * ni se incluye en la imagen Docker (sección 7.2). En Cloud Run se usará la
 * identidad del servicio, no un archivo.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import admin from "firebase-admin";
import "dotenv/config";

let app: admin.app.App;

export function initFirebase(): admin.app.App {
  if (app) return app;

  const credentialPath = process.env.SERVICE_ACCOUNT_PATH ?? "./serviceAccountKey.json";
  const absolutePath = resolve(process.cwd(), credentialPath);

  let serviceAccount: admin.ServiceAccount;
  try {
    serviceAccount = JSON.parse(readFileSync(absolutePath, "utf-8"));
  } catch (err) {
    throw new Error(
      `No se pudo leer el service account en "${absolutePath}". ` +
        `Define SERVICE_ACCOUNT_PATH en backend/.env o coloca el archivo ` +
        `serviceAccountKey.json en la raíz de backend/. Detalle: ${(err as Error).message}`
    );
  }

  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID ?? "rumboapp-264ca",
  });

  return app;
}

/** Instancia de Firestore ya inicializada. */
export function getDb(): admin.firestore.Firestore {
  initFirebase();
  return admin.firestore();
}

/** Instancia de Firebase Auth ya inicializada (se usará desde el Día 2). */
export function getAuth(): admin.auth.Auth {
  initFirebase();
  return admin.auth();
}
