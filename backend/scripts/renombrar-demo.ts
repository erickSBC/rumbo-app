/**
 * Migración de presentación: elimina "demo" de los datos visibles.
 *
 *  1. Renombra la empresa "Transportes Demo Flota SAC" →
 *     "Transportes Cruz del Valle S.A.C." (razonSocial en Firestore y
 *     displayName en Auth; el ID del documento no cambia).
 *  2. Migra TODOS los correos @rumbo-demo.com → @rumbo.pe:
 *     - cuentas de Firebase Auth (el uid y la contraseña se conservan),
 *     - campo email en `empresas` y `usuarios`.
 *  3. Renombra usuarios y choferes con "Demo" en el nombre por nombres
 *     realistas.
 *
 * Idempotente: si se vuelve a ejecutar, no encuentra nada que migrar.
 * Uso: npx tsx scripts/renombrar-demo.ts
 */
import "dotenv/config";
import { getAuth, getDb } from "../src/config/firebase.js";

const db = getDb();
const auth = getAuth();

const DOMINIO_VIEJO = "@rumbo-demo.com";
const DOMINIO_NUEVO = "@rumbo.pe";
const RAZON_NUEVA = "Transportes Cruz del Valle S.A.C.";

const migraEmail = (e: string) => e.replace(DOMINIO_VIEJO, DOMINIO_NUEVO);

/** Reemplazos con nombres realistas para lo que quedó como "… Demo". */
const NOMBRE_VENDEDOR = "Ricardo Salazar Ponce";
const NOMBRE_CHOFER = "Aurelio Mendoza Ríos";

async function main(): Promise<void> {
  // --- 1) Razón social de la empresa "Demo" ---------------------------------
  const empresasDemo = await db.collection("empresas").get();
  for (const d of empresasDemo.docs) {
    const data = d.data();
    if (typeof data.razonSocial === "string" && /demo/i.test(data.razonSocial)) {
      await d.ref.update({ razonSocial: RAZON_NUEVA });
      console.log(`✓ Empresa renombrada: "${data.razonSocial}" → "${RAZON_NUEVA}"`);
    }
  }

  // --- 2) Correos en Firebase Auth ------------------------------------------
  let pagina = await auth.listUsers(1000);
  let cuentasAuth = 0;
  for (;;) {
    for (const u of pagina.users) {
      if (!u.email?.endsWith(DOMINIO_VIEJO)) continue;
      const cambios: { email: string; displayName?: string } = { email: migraEmail(u.email) };
      if (u.displayName && /demo/i.test(u.displayName)) cambios.displayName = RAZON_NUEVA;
      await auth.updateUser(u.uid, cambios);
      console.log(`✓ Auth: ${u.email} → ${cambios.email}`);
      cuentasAuth++;
    }
    if (!pagina.pageToken) break;
    pagina = await auth.listUsers(1000, pagina.pageToken);
  }

  // --- 3) Correos en Firestore (empresas y usuarios) ------------------------
  let camposEmail = 0;
  for (const col of ["empresas", "usuarios"]) {
    const snap = await db.collection(col).get();
    for (const d of snap.docs) {
      const email = d.data().email;
      if (typeof email === "string" && email.endsWith(DOMINIO_VIEJO)) {
        await d.ref.update({ email: migraEmail(email) });
        camposEmail++;
      }
    }
  }
  console.log(`✓ Firestore: ${camposEmail} campos email migrados a ${DOMINIO_NUEVO}`);

  // --- 4) Nombres con "Demo" -------------------------------------------------
  const usuarios = await db.collection("usuarios").get();
  for (const d of usuarios.docs) {
    const nombre = d.data().nombre;
    if (typeof nombre === "string" && /demo/i.test(nombre)) {
      await d.ref.update({ nombre: NOMBRE_VENDEDOR });
      console.log(`✓ Usuario renombrado: "${nombre}" → "${NOMBRE_VENDEDOR}"`);
    }
  }
  const salidas = await db.collection("salidas").get();
  let choferes = 0;
  for (const d of salidas.docs) {
    const chofer = d.data().choferNombre;
    if (typeof chofer === "string" && /demo/i.test(chofer)) {
      await d.ref.update({ choferNombre: NOMBRE_CHOFER });
      choferes++;
    }
  }
  if (choferes > 0) console.log(`✓ ${choferes} salidas con chofer "Demo" renombradas`);

  console.log(`\n✅ Migración completa (${cuentasAuth} cuentas Auth, ${camposEmail} emails Firestore).`);
}

main().then(() => process.exit(0)).catch((err) => { console.error("❌", err); process.exit(1); });
