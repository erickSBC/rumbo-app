/**
 * Seed de la colección global `planes` (Anexo B / Anexo D, Día 1).
 *
 * Carga los tres planes una sola vez en Firestore usando el Admin SDK.
 * Es idempotente: usa el `id` del plan como ID del documento y `set()`, así
 * que re-ejecutarlo actualiza en lugar de duplicar. Única fuente de verdad
 * que la landing lee para pintar precios y el backend para el enforcement.
 *
 * Uso:  npm run seed:planes   (desde backend/)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getDb } from "../src/config/firebase.js";
import type { Plan } from "../src/types/domain.js";

async function seedPlanes(): Promise<void> {
  const seedPath = resolve(process.cwd(), "scripts/planes.seed.json");
  const planes: Plan[] = JSON.parse(readFileSync(seedPath, "utf-8"));

  const db = getDb();
  const batch = db.batch();

  for (const plan of planes) {
    const ref = db.collection("planes").doc(plan.id);
    batch.set(ref, plan, { merge: true });
    console.log(
      `  • ${plan.id.padEnd(9)} S/ ${plan.precioMensual}/mes  ` +
        `buses=${plan.maxBuses}  usuarios=${plan.maxUsuarios}  ` +
        `IA=${plan.asistenteIA}`
    );
  }

  await batch.commit();
  console.log(`\n✅ ${planes.length} planes cargados en la colección "planes".`);

  // Verificación de lectura: confirma que quedaron escritos.
  const snapshot = await db.collection("planes").get();
  console.log(`🔎 Verificación: la colección tiene ${snapshot.size} documentos.`);
}

seedPlanes()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error cargando planes:", err);
    process.exit(1);
  });
