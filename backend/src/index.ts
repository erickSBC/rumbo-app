/**
 * Punto de arranque del backend. Inicializa Firebase Admin y levanta Express.
 */
import "dotenv/config";
import { createApp } from "./app.js";
import { initFirebase } from "./config/firebase.js";

const PORT = Number(process.env.PORT ?? 4000);

function main(): void {
  // Falla temprano y claro si la credencial no está disponible.
  initFirebase();

  const app = createApp();
  app.listen(PORT, () => {
    console.log(`🚌 Rumbo backend escuchando en http://localhost:${PORT}`);
    console.log(`   Healthcheck:  http://localhost:${PORT}/health`);
    console.log(`   Planes:       http://localhost:${PORT}/api/planes`);
  });
}

main();
