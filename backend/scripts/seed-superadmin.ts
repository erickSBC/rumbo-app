/**
 * Seed del superadministrador (RF-16, §4.2). Idempotente.
 *
 * Crea (o reutiliza) la cuenta superadmin@rumbo.pe en Firebase Auth y le
 * asigna el custom claim { isSuperAdmin: true } SIN empresaId: el SA no
 * pertenece a ningún tenant y no tiene documento en `usuarios`.
 *
 * Uso: npm run seed:superadmin
 */
import "dotenv/config";
import { getAuth } from "../src/config/firebase.js";

const EMAIL = "superadmin@rumbo.pe";
const PASSWORD = process.env.SUPERADMIN_PASSWORD ?? "rumbo123";

async function main(): Promise<void> {
  const auth = getAuth();

  let uid: string;
  try {
    uid = (await auth.getUserByEmail(EMAIL)).uid;
    console.log(`Cuenta existente: ${EMAIL} (${uid})`);
  } catch {
    uid = (await auth.createUser({ email: EMAIL, password: PASSWORD, displayName: "Superadmin Rumbo" })).uid;
    console.log(`Cuenta creada: ${EMAIL} (${uid})`);
  }

  await auth.setCustomUserClaims(uid, { isSuperAdmin: true });
  const claims = (await auth.getUser(uid)).customClaims;
  console.log(`Claims: ${JSON.stringify(claims)}`);
  console.log("✅ Superadmin listo.");
}

main().then(() => process.exit(0)).catch((err) => { console.error("❌", err); process.exit(1); });
