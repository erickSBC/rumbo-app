# Rumbo — MVP

SaaS para la gestión de empresas de transporte interprovincial de pasajeros.
Monorepo con dos apps independientes. Ver `rumbo-arquitectura-v2-mvp.md` para la
arquitectura completa y el plan de 2 semanas (Anexo D).

## Estructura

```
RumboApp/
├─ frontend/   Next.js 16 + TypeScript + Tailwind (landing y dashboard)
├─ backend/    Node + Express + TypeScript (API, Firestore Admin, Gemini)
├─ firestore.rules   Reglas de seguridad (Anexo C) — se despliegan el Día 10
└─ rumbo-arquitectura-v2-mvp.md
```

## Requisitos

- Node.js 22+
- Un proyecto de Firebase (`rumboapp-264ca`) con Firestore habilitado.

## Puesta en marcha (local)

### Backend

```bash
cd backend
cp .env.example .env                 # ajusta valores si hace falta
# Coloca el service account key en backend/serviceAccountKey.json
#   (Firebase Console -> Cuentas de servicio -> Generar nueva clave privada)
npm install
npm run seed:planes                  # carga los 3 planes en Firestore (una vez)
npm run dev                          # http://localhost:4000
```

Endpoints: `GET /health`, `GET /api/planes`.

### Frontend

```bash
cd frontend
cp .env.local.example .env.local     # completa las claves NEXT_PUBLIC_*
npm install
npm run dev                          # http://localhost:3000
```

El landing (`/`) muestra los tres planes leídos del backend → Firestore.

## Seguridad

- El `serviceAccountKey.json` y los `.env*` están gitignored; **nunca** se
  commitean ni entran en imágenes Docker (sección 7.2 del documento).
- Las claves `NEXT_PUBLIC_*` de Firebase son públicas por diseño.

## Estado del plan (Anexo D)

- [x] **Día 1** — Proyecto Firebase; Next.js + Express en local; colección `planes` cargada.
- [ ] Día 2 — Firebase Auth, registro con elección de plan, custom claims, login.
- [ ] Día 3 — CRUD de rutas/buses/usuarios con enforcement de límites.
- [ ] … (ver Anexo D)
