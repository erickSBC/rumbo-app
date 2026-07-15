/**
 * Prueba real end-to-end del registro (Día 2). NO forma parte del runtime;
 * es un script de verificación manual.
 *
 * Comprueba:
 *  1. POST /api/auth/registro con el plan Flota crea el tenant.
 *  2. El documento empresas/{empresaId} quedó bien formado en Firestore.
 *  3. El usuario tiene los customClaims empresaId + rol (vía Admin SDK).
 *  4. Un LOGIN REAL (API REST de Firebase) devuelve un ID token que, al
 *     decodificarlo, lleva empresaId y rol.
 *  5. GET /api/auth/me con ese token devuelve la empresa (empresaId derivado
 *     del token, no del cliente).
 *
 * Requiere el backend corriendo en http://localhost:4000.
 * Uso: npm run test:registro   (desde backend/)
 */
import "dotenv/config";
import { getAuth, getDb } from "../src/config/firebase.js";

const API = process.env.API_URL ?? "http://localhost:4000";
const WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY ?? "AIzaSyD2KSC_e2aDrLrLPuzE--fH_Hb1G33qaDU";

const SAMPLE = {
  ruc: "20512345678",
  razonSocial: "Transportes Cruz del Valle S.A.C.",
  email: "admin.flota@rumbo.pe",
  password: "demo123456",
  planId: "flota",
};

function decodeJwt(token: string): Record<string, unknown> {
  const payload = token.split(".")[1];
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
}

async function limpiarPrevio(): Promise<void> {
  const auth = getAuth();
  const db = getDb();
  try {
    const existing = await auth.getUserByEmail(SAMPLE.email);
    const uid = existing.uid;
    const usuarioSnap = await db.collection("usuarios").doc(uid).get();
    const empresaId = usuarioSnap.data()?.empresaId as string | undefined;
    if (empresaId) await db.collection("empresas").doc(empresaId).delete();
    await db.collection("usuarios").doc(uid).delete();
    await auth.deleteUser(uid);
    console.log("🧹 Limpieza: se eliminó el registro de prueba anterior.\n");
  } catch {
    // No existía: nada que limpiar.
  }
}

async function main(): Promise<void> {
  await limpiarPrevio();

  // 1) Registro vía HTTP.
  console.log("1) POST /api/auth/registro (plan Flota)…");
  const regRes = await fetch(`${API}/api/auth/registro`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(SAMPLE),
  });
  const reg = await regRes.json();
  if (!regRes.ok) throw new Error(`Registro falló: ${JSON.stringify(reg)}`);
  console.log("   →", reg, "\n");
  const { uid, empresaId } = reg as { uid: string; empresaId: string };

  // 2) Documento Empresa en Firestore.
  console.log("2) Documento empresas/" + empresaId + " en Firestore:");
  const empresaSnap = await getDb().collection("empresas").doc(empresaId).get();
  console.log("   →", JSON.stringify(empresaSnap.data(), null, 2), "\n");

  console.log("   Documento usuarios/" + uid + ":");
  const usuarioSnap = await getDb().collection("usuarios").doc(uid).get();
  console.log("   →", JSON.stringify(usuarioSnap.data(), null, 2), "\n");

  // 3) Custom claims vía Admin SDK.
  console.log("3) customClaims del usuario (Admin SDK):");
  const userRecord = await getAuth().getUser(uid);
  console.log("   →", JSON.stringify(userRecord.customClaims), "\n");

  // 4) Login real por la API REST de Firebase → ID token → decodificar.
  console.log("4) Login real (Firebase REST signInWithPassword) y decode del token:");
  const loginRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${WEB_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: SAMPLE.email,
        password: SAMPLE.password,
        returnSecureToken: true,
      }),
    }
  );
  const login = (await loginRes.json()) as { idToken?: string };
  if (!loginRes.ok) throw new Error(`Login falló: ${JSON.stringify(login)}`);
  const idToken = login.idToken as string;
  const claims = decodeJwt(idToken);
  console.log("   → empresaId en el token:", claims.empresaId);
  console.log("   → rol en el token:      ", claims.rol);
  console.log("   → email en el token:    ", claims.email, "\n");

  // 5) GET /api/auth/me con el token (empresaId derivado del token).
  console.log("5) GET /api/auth/me con el token del login:");
  const meRes = await fetch(`${API}/api/auth/me`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const me = await meRes.json();
  console.log("   →", JSON.stringify(me, null, 2));

  // Aserciones finales.
  const ok =
    claims.empresaId === empresaId &&
    claims.rol === "admin_empresa" &&
    (me as { empresa?: { id?: string } }).empresa?.id === empresaId;
  console.log("\n" + (ok ? "✅ TODO OK" : "❌ Alguna verificación no cuadró"));
  if (!ok) process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error en la prueba:", err);
    process.exit(1);
  });
