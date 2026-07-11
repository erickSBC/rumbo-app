/**
 * Limpieza puntual (Día 10): elimina las empresas creadas MANUALMENTE por el
 * usuario (con sus usuarios y cuentas de Auth) y resetea el estado de las
 * empresas sembradas. Después de esto debe correrse `npm run seed:datos`, que
 * limpia y regenera TODOS los datos operativos (rutas, buses, salidas+asientos,
 * pasajes, auditoría) para las empresas restantes.
 *
 * Uso: npm run limpiar:manuales
 */
import "dotenv/config";
import { getAuth, getDb } from "../src/config/firebase.js";

/** Correos admin de las empresas creadas a mano por el usuario. */
const EMAILS_MANUALES = ["cruzdelsur@gmail.com", "micorreo@gmail.com"];
/** Y por razón social (por si el correo no se conoce). */
const RAZONES_MANUALES = ["Remolino SAC"];

async function main(): Promise<void> {
  const db = getDb();
  const auth = getAuth();

  // Reúne las empresas a borrar.
  const objetivos = new Map<string, FirebaseFirestore.DocumentSnapshot>();
  for (const email of EMAILS_MANUALES) {
    const snap = await db.collection("empresas").where("email", "==", email).get();
    snap.docs.forEach((d) => objetivos.set(d.id, d));
  }
  for (const razon of RAZONES_MANUALES) {
    const snap = await db.collection("empresas").where("razonSocial", "==", razon).get();
    snap.docs.forEach((d) => objetivos.set(d.id, d));
  }

  for (const [empresaId, doc] of objetivos) {
    const e = doc.data()!;
    console.log(`→ Eliminando "${e.razonSocial}" (${empresaId}, ${e.email})…`);

    // Usuarios del tenant: doc + cuenta de Auth (admin y vendedores creados por UI).
    const usuarios = await db.collection("usuarios").where("empresaId", "==", empresaId).get();
    for (const u of usuarios.docs) {
      const email = u.data().email as string | undefined;
      await u.ref.delete();
      if (email) {
        try {
          const rec = await auth.getUserByEmail(email);
          await auth.deleteUser(rec.uid);
          console.log(`   auth eliminado: ${email}`);
        } catch {
          /* sin cuenta de Auth */
        }
      }
    }
    // Cuenta del admin (por si no tenía doc en usuarios).
    try {
      const rec = await auth.getUserByEmail(e.email as string);
      await auth.deleteUser(rec.uid);
      console.log(`   auth eliminado: ${e.email}`);
    } catch {
      /* ya borrado arriba o inexistente */
    }

    await doc.ref.delete();
    console.log(`   empresa eliminada.`);
    // Sus rutas/buses/salidas/pasajes/auditoría los barre seed:datos después.
  }

  // Resetea las empresas sembradas a su estado original.
  const resets: { email: string; planId: string; estado: string }[] = [
    { email: "admin.flota@rumbo-demo.com", planId: "flota", estado: "prueba" },
    { email: "admin.andino@rumbo-demo.com", planId: "flota", estado: "activa" },
    { email: "admin.costanorte@rumbo-demo.com", planId: "flota", estado: "activa" },
    { email: "admin.selvacentral@rumbo-demo.com", planId: "ruta", estado: "prueba" },
  ];
  for (const r of resets) {
    const snap = await db.collection("empresas").where("email", "==", r.email).limit(1).get();
    if (snap.empty) continue;
    await snap.docs[0].ref.update({ planId: r.planId, estado: r.estado });
    console.log(`→ Reset ${r.email}: plan=${r.planId}, estado=${r.estado}`);
  }

  console.log("\n✅ Limpieza de datos manuales completa. Ahora corre: npm run seed:datos");
}

main().then(() => process.exit(0)).catch((err) => { console.error("❌", err); process.exit(1); });
