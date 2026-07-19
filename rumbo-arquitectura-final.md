# Documento de Arquitectura de Software

## Rumbo — SaaS para la gestión de empresas de transporte interprovincial de pasajeros

**Versión:** 2.1 — Producto en producción
**Alcance:** documento completo, secciones 1 a 9. Incorpora el módulo de encomiendas y la redefinición del asistente IA como capacidad exclusiva del plan Terminal.

**Nota de alcance.** Esta versión consolida la arquitectura del producto sobre tres pilares: (1) modelo comercial SaaS con elección de plan por el cliente y enforcement de límites y capacidades, (2) aislamiento multi-tenant, y (3) integración de inteligencia artificial con Gemini. Las funcionalidades planificadas para versiones posteriores quedan documentadas en la sección 8 como hoja de ruta.

---

## 1. Visión del producto y propuesta de valor

### 1.1 Definición del problema

Las empresas pequeñas y medianas de transporte interprovincial de pasajeros en el Perú gestionan su operación con herramientas fragmentadas: cuadernos para el manifiesto, hojas de Excel para las ventas y reportes manuales de fin de mes. Esto produce cuatro problemas concretos:

1. Sobreventa de asientos cuando dos vendedores venden el mismo pasaje simultáneamente.
2. Manifiestos incompletos o inexactos, exponiendo a la empresa a multas de la SUTRAN en controles de carretera.
3. Nula visibilidad ejecutiva: el dueño no conoce las ventas del día ni las rutas más rentables sin esperar el consolidado manual.
4. Software empresarial existente costoso e inaccesible para empresas de 3 a 25 buses.

Adicionalmente, las encomiendas —segunda fuente de ingresos del rubro— suelen gestionarse en cuadernos separados de la venta de pasajes, sin trazabilidad del paquete ni control de entregas, generando pérdidas y disputas con los clientes.

### 1.2 Público objetivo y casos de uso principales

**Público objetivo:** empresas peruanas de transporte interprovincial con flotas de 3 a 25 buses, un punto de venta principal, y personal de counter que ya usa computadoras pero sin sistema integrado.

**Casos de uso principales:**

- Registro autoservicio de la empresa con **elección de plan** (Ruta, Flota o Terminal).
- Venta de pasajes en counter con selección de asiento en un mapa gráfico.
- Prevención automática de sobreventa mediante transacciones atómicas.
- Registro de encomiendas que viajan en la bodega de una salida programada, con código de guía único, y su entrega en destino validando el documento del destinatario (según plan contratado).
- Generación del manifiesto electrónico de cada salida: pasajeros y carga.
- Consulta ejecutiva en lenguaje natural mediante asistente con IA (exclusivo del plan Terminal).
- Reporte de ventas del día: pasajes y encomiendas.

### 1.3 Propuesta de valor diferenciada

**Modelo SaaS con planes escalonados y diferenciadores claros.** El cliente elige entre tres planes según el tamaño y la ambición de su operación, y comienza con una prueba gratuita de 14 días sin tarjeta:

- **Ruta (S/ 149):** la operación esencial — venta de pasajes, mapa de asientos, manifiesto y reportes.
- **Flota (S/ 399):** añade el **módulo de encomiendas**, incorporando la segunda fuente de ingresos del negocio al mismo sistema, con guías únicas, ciclo de entrega y manifiesto de carga.
- **Terminal (S/ 899):** añade el **asistente ejecutivo con inteligencia artificial**, que responde en lenguaje natural sobre la operación completa de la empresa.

Los límites y capacidades de cada plan (buses, usuarios, encomiendas, asistente IA) son datos configurables, no código: el sistema los lee y los hace cumplir automáticamente. Crear un nuevo plan o ajustar una capacidad no requiere reprogramar.

**Integración nativa de inteligencia artificial.** El asistente basado en Gemini es la capacidad insignia del plan Terminal y el diferenciador del producto frente a soluciones tradicionales: el gerente pregunta "¿cuál fue mi ruta más rentable esta semana?" o "¿cuántas encomiendas tengo sin entregar?" y recibe la respuesta con cifras reales de su operación.

**Cero instalación, cero mantenimiento.** Aplicación 100% web sobre infraestructura administrada de Google Cloud, con costo marginal por cliente inferior a USD 5 mensuales, lo que sostiene precios accesibles para PYMEs.

---

## 2. Marco teórico y tecnologías base

### 2.1 Modelos de cloud computing: definición y aplicación al proyecto

- **IaaS (Infrastructure as a Service):** el proveedor entrega máquinas virtuales, almacenamiento y red; el cliente administra sistema operativo y aplicación. Ejemplo: Google Compute Engine.
- **PaaS (Platform as a Service):** el proveedor administra hasta el tiempo de ejecución; el cliente solo despliega código. Ejemplos: Google Cloud Run, Firebase.
- **SaaS (Software as a Service):** el proveedor entrega la aplicación completa lista para usar. Ejemplos: Gmail, y el propio Rumbo hacia sus clientes.

**Aplicación al proyecto.** Rumbo es un producto SaaS para el cliente final (la empresa de transporte contrata un plan y usa la aplicación desde el navegador) y se construye sobre PaaS (Cloud Run, Firestore, Firebase Authentication), lo que permite al equipo concentrarse en la lógica de negocio. Se descarta IaaS para eliminar carga operativa y optimizar el costo de infraestructura.

### 2.2 Arquitectura multi-tenant: aislamiento de datos y gestión de inquilinos

Un sistema multi-tenant sirve a múltiples clientes ("tenants") con una única instancia de software, manteniendo los datos de cada uno aislados. De los tres patrones clásicos de aislamiento (base de datos por tenant, esquema por tenant, tabla compartida con discriminador), se adopta el patrón de **colección compartida con campo discriminador `empresaId`**, por su simplicidad, costo cero adicional y compatibilidad natural con Firestore.

El aislamiento se garantiza en dos capas: (a) el backend inyecta el `empresaId` del usuario autenticado en toda consulta — ningún endpoint lo recibe como parámetro del cliente; (b) las reglas de seguridad de Firestore verifican que el `empresaId` del documento coincida con el del token, bloqueando accesos cruzados incluso ante errores del código.

**Gestión de inquilinos y planes.** Cada tenant se crea mediante el registro autoservicio, en el cual el cliente **elige uno de los tres planes disponibles**. El plan elegido queda referenciado en el documento de la empresa (`planId`) y sus límites y capacidades (`maxBuses`, `maxUsuarios`, `encomiendas`, `asistenteIA`) se leen en tiempo de ejecución para autorizar o denegar operaciones. Esto convierte a los planes en configuración, no en código: crear un cuarto plan, ajustar un límite o reasignar una capacidad entre planes no requiere reprogramar — es una actualización de datos.

### 2.3 Inteligencia artificial y LLMs: conceptos, API de Gemini e ingeniería de prompts

Un modelo de lenguaje grande (LLM) es una red neuronal entrenada sobre grandes volúmenes de texto, capaz de responder preguntas y transformar datos en lenguaje natural. **Gemini** es la familia de LLMs de Google, accesible mediante la API de Google AI Studio, seleccionada por su capa gratuita para desarrollo, su integración HTTP simple desde Node.js y su contexto amplio.

**Ingeniería de prompts** es la construcción de la instrucción enviada al modelo. En Rumbo el prompt se arma dinámicamente con tres bloques: instrucciones de rol y reglas estrictas, un resumen de datos operativos del tenant obtenido de Firestore, y la pregunta del usuario. Este patrón (una forma simplificada de *retrieval-augmented generation*) garantiza que el modelo solo responda sobre datos reales del tenant: el LLM nunca accede a la base de datos; el backend controla qué datos entran al contexto.

### 2.4 Tecnologías y frameworks: justificación de las herramientas seleccionadas

Criterios de selección: costo cero durante el desarrollo, curva de aprendizaje corta y máxima compatibilidad con herramientas de generación de código con IA (stacks populares con abundante documentación producen mejor código generado).

- **Frontend:** Next.js con React y TypeScript. Renderizado híbrido, ecosistema maduro, despliegue directo en Firebase Hosting con SSL automático.
- **Backend:** Node.js + Express + TypeScript en Google Cloud Run (contenedores serverless). Comparte lenguaje y tipos con el frontend; escala a cero sin tráfico.
- **Base de datos:** Cloud Firestore (NoSQL documental). Sincronización en tiempo real para el mapa de asientos, reglas de seguridad declarativas que refuerzan el multi-tenant, transacciones atómicas y capa gratuita.
- **Autenticación:** Firebase Authentication. Login, tokens JWT y recuperación de contraseña sin código propio.
- **IA:** API de Gemini (`gemini-2.5-flash`) vía HTTPS desde el backend, con la clave en Google Secret Manager.
- **Infraestructura:** Google Cloud Platform, unificando cómputo, datos, identidad e IA bajo un proveedor.

---

## 3. Especificación de requisitos del sistema

### 3.1 Requisitos funcionales

**RF-01. Catálogo público de planes.** La landing pública muestra los tres planes (Ruta, Flota, Terminal) con precios y características, leídos desde la colección `planes`.

**RF-02. Registro autoservicio con elección de plan.** Un visitante registra su empresa eligiendo uno de los tres planes. El sistema crea el tenant (`Empresa` con `planId` y estado `prueba`), la cuenta del administrador, e inicia el período de prueba de 14 días. No se solicita tarjeta ni se procesa pago real en esta versión.

**RF-03. Enforcement de límites y capacidades por plan.** Antes de crear un bus o un usuario, el backend compara el conteo actual del tenant contra `maxBuses` / `maxUsuarios` del plan contratado y rechaza la operación con un mensaje claro si se excede. Las capacidades funcionales se habilitan solo si el plan las incluye: el módulo de encomiendas requiere `encomiendas = true` y el asistente IA requiere `asistenteIA = true`. Ante un rechazo, el mensaje sugiere el plan de menor precio que sí incluye la capacidad (derivado del catálogo, no fijo en código).

**RF-04. Cambio de plan.** El administrador puede cambiar su empresa a otro plan desde su panel. El cambio actualiza `planId` y los límites y capacidades aplican de inmediato (sin proceso de cobro en esta versión). En un cambio a un plan de menor capacidad con datos que exceden los nuevos límites, no se elimina información: el tenant conserva sus datos pero no puede crear nuevos registros hasta volver bajo el límite.

**RF-05. Autenticación y sesión.** Acceso con correo y contraseña mediante Firebase Authentication, sesión por token JWT y recuperación de contraseña por correo.

**RF-06. Gestión de usuarios internos.** El administrador crea, edita y desactiva usuarios de su tenant con rol `vendedor`, respetando el límite `maxUsuarios` del plan.

**RF-07. Gestión de rutas.** El administrador define rutas con origen, destino, duración estimada y precio base.

**RF-08. Gestión de flota.** El administrador registra buses con placa y número de asientos, respetando `maxBuses`.

**RF-09. Programación de salidas.** El administrador programa salidas combinando ruta, bus, fecha, hora y precio.

**RF-10. Venta de pasaje en counter.** El vendedor selecciona una salida, visualiza el mapa de asientos en tiempo real, elige un asiento libre, ingresa nombre y documento del pasajero y confirma la venta.

**RF-11. Prevención de sobreventa.** La venta se ejecuta dentro de una transacción atómica de Firestore que verifica que el asiento siga libre antes de confirmar. Si otro vendedor lo tomó, la transacción falla y se solicita elegir otro asiento.

**RF-12. Anulación de pasaje.** El administrador puede anular un pasaje, liberando el asiento de forma transaccional para su reventa.

**RF-13. Manifiesto electrónico.** Para cada salida, el sistema genera la lista de pasajeros (asiento, nombre, documento) en una vista imprimible desde el navegador, con los datos de cabecera exigidos por SUTRAN/MTC (empresa, ruta, bus, chofer).

**RF-14. Reporte de ventas del día.** El administrador consulta pasajes vendidos, monto total y ventas por ruta del día en curso, con desglose de ingresos por encomiendas cuando el plan incluye el módulo.

**RF-15. Asistente conversacional con IA — exclusivo del plan Terminal.** El administrador de una empresa con plan Terminal formula preguntas en lenguaje natural y recibe respuestas basadas en los datos actuales de su tenant vía la API de Gemini. Para empresas en planes Ruta o Flota, el sistema responde con un mensaje de upgrade claro ("Tu plan no incluye el asistente. Actualiza a Terminal.").

**RF-16. Panel del superadministrador.** El superadministrador visualiza las empresas registradas con su plan y estado, y puede suspenderlas o reactivarlas. Una empresa suspendida queda bloqueada en toda la API.

**RF-17. Registro de encomienda.** Disponible en planes con `encomiendas = true`. El vendedor o el administrador registra una encomienda asociada a una salida programada del tenant, con: datos del remitente (nombre y documento), datos del destinatario (nombre y documento), descripción del contenido, peso en kilogramos y precio cobrado. El sistema genera automáticamente un código de guía único por tenant con formato `ENC-{correlativo}` (por ejemplo, `ENC-000123`), garantizando mediante transacción atómica que dos registros simultáneos no reciban el mismo código.

**RF-18. Ciclo de estados de la encomienda.** La encomienda transita: `registrada` → `en_viaje` (despachada al partir la salida) → `en_destino` (la salida llegó) → `entregada` (el destinatario la recogió). Adicionalmente puede pasar a `anulada` (solo desde `registrada`, y solo por el administrador). El despacho puede ejecutarse por salida completa (todas las encomiendas registradas de la salida pasan a `en_viaje` en una sola acción). La entrega requiere buscar la encomienda por su código de guía y registrar el documento de quien recoge. Cada transición queda registrada en auditoría.

**RF-19. Manifiesto de carga.** El manifiesto de una salida (RF-13) incorpora una segunda sección con las encomiendas a bordo (`registrada` o `en_viaje`): código de guía, remitente, destinatario, descripción y peso, con el total de bultos y peso acumulado. La declaración de carga complementa el cumplimiento normativo ante SUTRAN/MTC.

**RF-20. Consulta de encomiendas pendientes.** El administrador consulta las encomiendas pendientes de entrega (`en_viaje` y `en_destino`) para gestionar la bodega de destino. Los datos de encomiendas se incorporan al contexto del asistente IA (sección 6.3) en empresas con plan Terminal, habilitando preguntas como "¿cuántas encomiendas tengo pendientes de entrega?".

### 3.2 Requisitos no funcionales

- **Rendimiento:** respuesta menor a 2 segundos en la venta de pasaje; al menos 20 usuarios concurrentes por tenant sin degradación.
- **Disponibilidad:** objetivo 99.5 % mensual, sostenido por las SLAs de Cloud Run, Firestore y Firebase Hosting.
- **Escalabilidad:** autoescalado automático de Cloud Run; la arquitectura soporta crecer de 1 a 100 tenants sin cambios estructurales.
- **Seguridad:** HTTPS (TLS) en toda comunicación; contraseñas gestionadas por Firebase Authentication (nunca accesibles); aislamiento por `empresaId` reforzado con reglas de Firestore; secretos en Google Secret Manager.
- **Usabilidad:** interfaz responsiva desde 360 px; español peruano; montos en soles; fechas DD/MM/AAAA.
- **Mantenibilidad:** código TypeScript versionado en GitHub, organizado por módulos de dominio (auth, planes, ventas, flota, encomiendas, ia).

### 3.3 Restricciones del sistema

**Capa gratuita.** El producto opera sobre el free tier de Google Cloud: Cloud Run (2 M invocaciones/mes), Firestore (50 k lecturas y 20 k escrituras diarias), Firebase Auth (50 k usuarios activos/mes) y cuota diaria gratuita de la API de Gemini. Suficiente para la operación inicial y un piloto con los primeros tenants; el crecimiento posterior se cubre con el margen del modelo (sección 7.3).

**Restricciones de alcance de esta versión (exclusiones deliberadas):**

- Sin procesamiento de pagos reales: la elección y cambio de plan operan en modo prueba/manual.
- Sin venta en línea al pasajero final.
- Sin gestión de múltiples terminales por empresa (una empresa = una sede).
- En encomiendas: sin cobro contra entrega (pago del destinatario), sin tarifario automático por peso/volumen (el precio lo ingresa el vendedor) y sin trazabilidad fotográfica del paquete.
- Sin pronóstico de demanda, API pública ni app del chofer.

Todas estas exclusiones están planificadas en la hoja de ruta (sección 8.2).

**Restricción normativa.** El manifiesto generado sigue el contenido mínimo exigido por SUTRAN/MTC (datos del vehículo, chofer, relación de pasajeros con documento y declaración de carga). La facturación electrónica SUNAT queda para una versión posterior.

---

## 4. Modelado del negocio y gestión de identidad (multi-tenant)

### 4.1 Estructura de roles y matriz de permisos

Se definen **tres roles**, el mínimo que cubre la operación del producto:

- **Superadministrador (SA):** dueño del SaaS. Gestiona planes y tenants; no accede a datos operativos de los clientes.
- **Administrador de empresa (AE):** dueño o gerente del tenant. Autoridad plena dentro de su empresa.
- **Vendedor (V):** cajero de counter. Vende pasajes, gestiona encomiendas y consulta manifiestos.

**Matriz de permisos:**

| Entidad / Acción | SA | AE | V |
|---|:-:|:-:|:-:|
| Ver catálogo de planes | ✓ | ✓ | — |
| Crear / editar planes | ✓ | — | — |
| Registrar empresa (autoservicio) | — | ✓ | — |
| Elegir / cambiar plan de su empresa | — | ✓ | — |
| Suspender / reactivar empresas | ✓ | — | — |
| Ver panel global de tenants | ✓ | — | — |
| Gestionar usuarios internos | — | ✓ | — |
| Gestionar rutas y buses | — | ✓ | — |
| Programar / cancelar salidas | — | ✓ | — |
| Vender pasaje en counter | — | ✓ | ✓ |
| Anular pasaje | — | ✓ | — |
| Generar / ver manifiesto (pasajeros y carga) | — | ✓ | ✓ |
| Reporte de ventas del día | — | ✓ | — |
| Registrar encomienda | — | ✓† | ✓† |
| Despachar encomiendas de una salida | — | ✓† | ✓† |
| Entregar encomienda (código + documento) | — | ✓† | ✓† |
| Anular encomienda | — | ✓† | — |
| Consultar encomiendas pendientes | — | ✓† | — |
| Consultar asistente IA | — | ✓* | — |

*✓† solo si el plan contratado incluye `encomiendas = true` (Flota y Terminal). ✓\* solo si el plan incluye `asistenteIA = true` (**exclusivo de Terminal**). Estos son los puntos donde la elección de plan del cliente se hace visible en los permisos: el mismo rol tiene o no acceso a cada capacidad según el plan — el enforcement comercial materializado dos veces con el mismo patrón.*

### 4.2 Estrategia y aislamiento de datos multi-tenant

Patrón adoptado: **colección compartida con campo discriminador `empresaId`** en todos los documentos operativos. La colección `planes` es la única global y pública (todos los tenants ven el mismo catálogo).

El aislamiento opera en dos capas independientes:

**Capa de aplicación.** El backend extrae el `empresaId` del token JWT verificado (Firebase Authentication lo incluye como *custom claim* asignado al crear el usuario) y lo inyecta en cada consulta. Ningún endpoint acepta `empresaId` desde el cliente.

**Capa de reglas de Firestore.** Reglas declarativas verifican que `resource.data.empresaId == request.auth.token.empresaId` en toda lectura y escritura de colecciones operativas. El superadministrador porta la marca `isSuperAdmin` en su token, que le da lectura sobre `empresas` y escritura sobre `planes`, pero no acceso a `pasajes`, `salidas` ni `encomiendas` de los tenants.

**Ciclo de vida del tenant.** (1) El visitante elige plan en la landing y completa el registro → (2) el backend crea el documento `Empresa` con `planId` elegido y `estado = prueba`, crea el usuario AE con su custom claim y registra `fechaFinPrueba` a 14 días → (3) durante la prueba y tras ella, el AE puede cambiar de plan → (4) el SA puede suspender el tenant (`estado = suspendida`), lo que bloquea a sus usuarios en toda la API.

### 4.3 Diagrama de casos de uso — descripción para graficar

Notación: rectángulo del sistema con elipses (casos de uso), actores como muñecos a los lados, líneas de asociación actor–caso.

**Actores (4):**
- **Visitante / Administrador de empresa** — izquierda, centro (el visitante se convierte en AE tras registrarse; puede dibujarse como un solo actor con nota).
- **Vendedor** — izquierda, abajo.
- **Superadministrador** — derecha, arriba.
- **API de Gemini** — derecha, abajo, con estereotipo `<<sistema>>`.

**Casos de uso en cuatro grupos verticales:**

Grupo 1 — Suscripción (arriba):
- Ver planes y precios
- Registrar empresa eligiendo plan
- Cambiar de plan
- Suspender / reactivar empresa

Grupo 2 — Operación de pasajes (centro-superior):
- Gestionar rutas y buses
- Programar salida
- Vender pasaje en counter
- Anular pasaje
- Generar manifiesto (pasajeros y carga)
- Ver reporte del día

Grupo 3 — Encomiendas (centro-inferior):
- Registrar encomienda
- Despachar encomiendas de la salida
- Entregar encomienda en destino
- Consultar pendientes de entrega

Grupo 4 — Inteligencia artificial (abajo):
- Preguntar al asistente IA

**Conexiones:**
- Administrador de empresa → todos los del Grupo 1 (excepto suspender), Grupo 2, Grupo 3 y Grupo 4.
- Vendedor → "Vender pasaje en counter", "Generar manifiesto", "Registrar encomienda", "Despachar encomiendas" y "Entregar encomienda".
- Superadministrador → "Suspender / reactivar empresa", "Ver planes y precios" y "Gestionar planes".
- API de Gemini → "Preguntar al asistente IA" con estereotipo `<<include>>`.
- **Notas UML:** sobre el Grupo 3, "Precondición: plan con encomiendas = true (Flota o Terminal)"; sobre el Grupo 4, "Precondición: plan Terminal (asistenteIA = true)" — haciendo visibles en el diagrama los dos niveles de enforcement por plan.

### 4.4 Diagrama de actividades — descripción para graficar

Flujo recomendado: **registro de una nueva empresa con elección de plan**, por ser el flujo que materializa el modelo SaaS y el ciclo de vida del tenant.

Carriles verticales: **Visitante**, **Frontend**, **Backend (Cloud Run)**, **Firestore / Firebase Auth**.

1. **Inicio** (Visitante).
2. **Visitar landing de planes** (Visitante → Frontend): ve los tres planes con precios.
3. **Elegir plan y pulsar "Empezar prueba de 14 días"** (Visitante).
4. **Completar formulario de registro** (Visitante → Frontend): RUC, razón social, correo y contraseña del administrador.
5. **Enviar solicitud de registro** (Frontend → Backend) con el `planId` elegido.
6. **Validar datos** (Backend). Rombo: ¿RUC y correo válidos y no registrados? Si no → responder error → volver al paso 4. Si sí → continuar.
7. **Crear cuenta del administrador** (Backend → Firebase Auth).
8. **Crear documento Empresa** (Backend → Firestore) con `planId`, `estado = prueba` y `fechaFinPrueba` (+14 días).
9. **Asignar custom claims al usuario** (Backend → Firebase Auth): `empresaId`, `rol = admin_empresa`.
10. **Registrar evento en auditoría** (Backend → Firestore).
11. **Responder éxito e iniciar sesión automática** (Backend → Frontend).
12. **Mostrar dashboard con el plan elegido y días de prueba restantes** (Frontend → Visitante, ahora Administrador).
13. **Fin.**

**Nota para el diagrama:** encerrar los pasos 7 a 10 en un recuadro etiquetado "Aprovisionamiento del tenant".

*Como segundo diagrama de actividades opcional se sugiere el ciclo de la encomienda (registro → despacho → entrega), que visualiza el flujo del RF-18.*

### 4.5 Diagrama de clases (modelo de dominio) — descripción para graficar

*(Corresponde también a la sección 5.5.)*

**Ocho clases**, notación UML con compartimentos de nombre y atributos:

**Plan** — global, sin `empresaId`:
- `id: string`, `nombre: string`, `precioMensual: number`, `precioAnual: number`, `maxBuses: number`, `maxUsuarios: number`, `encomiendas: boolean`, `asistenteIA: boolean`

**Empresa** (tenant):
- `id: string`, `ruc: string`, `razonSocial: string`, `email: string`, `planId: string`, `estado: string` (prueba | activa | suspendida), `fechaRegistro: Date`, `fechaFinPrueba: Date`

**Usuario:**
- `id: string`, `empresaId: string`, `nombre: string`, `email: string`, `rol: string` (admin_empresa | vendedor), `estado: string`

**Ruta:**
- `id: string`, `empresaId: string`, `origen: string`, `destino: string`, `duracionMin: number`, `precioBase: number`

**Bus:**
- `id: string`, `empresaId: string`, `placa: string`, `numAsientos: number`, `estado: string`

**Salida:**
- `id: string`, `empresaId: string`, `rutaId: string`, `busId: string`, `fechaHora: Date`, `precio: number`, `choferNombre: string`, `estado: string` (programada | completada | cancelada)

**Pasaje:**
- `id: string`, `empresaId: string`, `salidaId: string`, `numAsiento: number`, `pasajeroNombre: string`, `pasajeroDoc: string`, `vendedorId: string`, `fechaVenta: Date`, `precioPagado: number`, `estado: string` (vendido | anulado)

**Encomienda:**
- `id: string`, `empresaId: string`, `salidaId: string`, `codigo: string` (guía única por tenant, formato `ENC-{correlativo}`), `remitenteNombre: string`, `remitenteDoc: string`, `destinatarioNombre: string`, `destinatarioDoc: string`, `descripcion: string`, `pesoKg: number`, `precio: number`, `registradoPor: string`, `fechaRegistro: Date`, `entregadaA: string` (documento de quien recogió; vacío hasta la entrega), `fechaEntrega: Date`, `estado: string` (registrada | en_viaje | en_destino | entregada | anulada)

**Relaciones:**

1. `Plan 1 ── * Empresa` — "contrata". Cada empresa elige exactamente un plan; un plan tiene muchas empresas suscritas.
2. `Empresa 1 ── * Usuario` — composición.
3. `Empresa 1 ── * Ruta` — composición.
4. `Empresa 1 ── * Bus` — composición.
5. `Ruta 1 ── * Salida` — "programada como".
6. `Bus 1 ── * Salida` — "asignado a".
7. `Salida 1 ── * Pasaje` — composición.
8. `Usuario 1 ── * Pasaje` — "registra".
9. `Salida 1 ── * Encomienda` — composición, "transporta". La encomienda viaja en la bodega de una salida concreta, reutilizando la entidad existente.
10. `Usuario 1 ── * Encomienda` — "registra".

**Decisiones de modelado:** remitente y destinatario se registran como datos embebidos en la encomienda (misma decisión que el pasajero en `Pasaje`); `choferNombre` es texto simple en `Salida`. Para el correlativo del código de guía existe un documento de contador por tenant (`contadores/{empresaId}`), incrementado dentro de la misma transacción que crea la encomienda — el mismo patrón de documento determinista bajo transacción usado en el candado antisobreventa (sección 7.1).

**Notas para el diagrama:** resaltar en negrita `empresaId` en las siete clases que lo llevan (mecanismo multi-tenant), `planId` en `Empresa` (elección de plan) y los flags `encomiendas` / `asistenteIA` en `Plan` (capacidades por plan).

---

## 5. Arquitectura de infraestructura en la nube

### 5.1 Diseño de red y servicios administrados

Arquitectura 100 % sobre servicios administrados de Google Cloud, sin máquinas virtuales ni redes administradas manualmente:

- **Firebase Hosting** — frontend Next.js y landing pública, con CDN y TLS automático.
- **Google Cloud Run** — backend Node.js/Express como contenedor serverless con autoescalado y escala a cero.
- **Cloud Firestore** — base de datos operativa con sincronización en tiempo real.
- **Firebase Authentication** — identidad, tokens JWT y custom claims (`empresaId`, `rol`, `isSuperAdmin`).
- **Google Secret Manager** — API key de Gemini y secretos.
- **API de Gemini (Google AI Studio)** — consumida por HTTPS desde el backend.

**Flujo de red:** el navegador descarga el frontend desde Firebase Hosting; el frontend llama al backend en Cloud Run adjuntando el token JWT; el backend verifica el token, consulta Firestore filtrando por `empresaId` y, para el asistente, invoca la API de Gemini con la clave leída de Secret Manager. Todo el tráfico público es HTTPS.

### 5.2 Diagrama de despliegue — descripción para graficar

Notación UML de despliegue: nodos como cajas 3D, artefactos como rectángulos internos, líneas etiquetadas con protocolo.

**Bloque izquierdo — Cliente:**
- Nodo "Dispositivo del usuario (AE o Vendedor)" con artefacto "Navegador web → App Next.js".

**Bloque central — Google Cloud Platform (contenedor grande):**
- Nodo "Firebase Hosting" con artefacto "Frontend estático Next.js + Landing de planes".
- Nodo "Cloud Run" con artefacto "Contenedor backend (Node.js + Express + TypeScript)".
- Nodo "Cloud Firestore" con las colecciones: `planes`, `empresas`, `usuarios`, `rutas`, `buses`, `salidas`, `pasajes`, `encomiendas`, `contadores`, `auditoria`.
- Nodo "Firebase Authentication".
- Nodo "Secret Manager" con artefacto "API key Gemini".

**Bloque derecho — Externo:**
- Nodo "Google AI Studio" con artefacto "API de Gemini".

**Conexiones:**
1. Navegador → Firebase Hosting: `HTTPS (descarga del frontend)`.
2. App Next.js → Firebase Authentication: `HTTPS (login, refresh de token)`.
3. App Next.js → Cloud Run: `HTTPS + JWT`.
4. Cloud Run → Firebase Authentication: `verificación de token`.
5. Cloud Run → Firestore: `gRPC interno GCP`.
6. Cloud Run → Secret Manager: `lectura de secretos`.
7. Cloud Run → API de Gemini: `HTTPS`.

### 5.3 Estrategia de cómputo: contenedores serverless

Se elige **Cloud Run** descartando: (a) máquinas virtuales, por costo fijo y carga operativa injustificada; (b) Cloud Functions puras, por fragmentar el backend en funciones aisladas dificultando compartir código y tipos.

Cloud Run ejecuta el mismo contenedor Docker usado en desarrollo local, escala de 0 a N instancias según demanda y cobra solo por uso. Configuración: 512 MB de memoria, 1 vCPU, concurrencia 80, autoescalado 0–5 instancias, región `us-central1` (free tier).

### 5.4 Modelo de datos y almacenamiento: justificación de la base de datos

Se elige **Cloud Firestore** (NoSQL documental) frente a una base relacional por cinco razones aplicadas al caso:

1. **Sincronización en tiempo real** para el mapa de asientos compartido entre vendedores, sin WebSockets manuales.
2. **Transacciones atómicas** para la prevención de sobreventa (RF-11) y la unicidad del correlativo de guías de encomienda (RF-17).
3. **Reglas de seguridad declarativas** que refuerzan el aislamiento multi-tenant en el propio motor de datos.
4. **Cero administración** de conexiones, réplicas o capacidad.
5. **Capa gratuita** suficiente para la operación inicial y el piloto.

**Limitación reconocida:** Firestore no es óptimo para agregaciones analíticas complejas. El reporte del día se resuelve con consultas simples más agregación en el backend; para analítica avanzada se contempla exportar a BigQuery en una versión posterior.

**Colecciones (10):** `planes` (global), `empresas`, `usuarios`, `rutas`, `buses`, `salidas`, `pasajes`, `encomiendas`, `contadores` (un documento por tenant, para correlativos), `auditoria` — todas excepto `planes` asociadas a un tenant.

### 5.5 Diagrama de clases

Ver sección 4.5, donde se describe el modelo de dominio completo de ocho clases con sus atributos y relaciones. La correspondencia entre clases del dominio y colecciones de Firestore es uno a uno (más la colección auxiliar `contadores`).

---

## 6. Integración de inteligencia artificial (Google AI Studio / Gemini)

### 6.1 Definición del caso de uso de IA

**Asistente conversacional de consulta** para el administrador de empresa, **capacidad exclusiva del plan Terminal** (`asistenteIA = true`). Es la funcionalidad insignia del plan superior y el principal incentivo comercial de upgrade. Responde preguntas en lenguaje natural sobre la operación real del tenant:

- "¿Cuánto vendí hoy?"
- "¿Cuál es mi ruta más vendida esta semana?"
- "¿Cuántos asientos libres quedan en la salida de esta noche a Arequipa?"
- "¿Cuántas encomiendas tengo pendientes de entrega?"

**No-metas de esta versión:** el asistente no modifica datos (solo consulta), no inventa cifras (el prompt lo instruye a responder "No tengo ese dato disponible"), no accede a otros tenants (el backend arma el contexto solo con datos del `empresaId` autenticado).

### 6.2 Diagrama de componentes — descripción para graficar

Notación UML de componentes con interfaces ofrecidas (círculo) y requeridas (semicírculo).

**Columna izquierda — Cliente:** componente `ChatUI` (en el dashboard Next.js), requiere `IConsultaIA`.

**Columna central — dentro de un contenedor "Módulo IA (Cloud Run)":**
- `ControladorIA` (endpoint `POST /api/ai/consulta`) — ofrece `IConsultaIA`; requiere `IAuth`, `IContexto`, `IGemini`. **Incluye la verificación del plan:** antes de procesar, comprueba que el plan del tenant tenga `asistenteIA = true`; si no, retorna 403 con el mensaje de upgrade hacia Terminal.
- `RecuperadorContexto` — ofrece `IContexto`; requiere `IFirestore`.
- `AdaptadorGemini` — ofrece `IGemini`; requiere `ISecrets`.

**Columna derecha — Servicios:**
- `Firebase Authentication` — ofrece `IAuth`.
- `Cloud Firestore` — ofrece `IFirestore`.
- `Secret Manager` — ofrece `ISecrets`.
- `API de Gemini` — externa (`<<external>>`), consumida por `AdaptadorGemini` por HTTPS.

### 6.3 Flujo de procesamiento y armado de prompts

1. **Autenticación y autorización por plan.** El controlador verifica el token, extrae `empresaId` y `rol`, valida que el rol sea `admin_empresa`, lee el plan del tenant y confirma `asistenteIA = true` (plan Terminal). Valida además que la pregunta no exceda 500 caracteres.
2. **Recuperación de contexto.** Consulta Firestore (filtrada por `empresaId`) y arma un resumen fijo: ventas de hoy y de los últimos 7 días, top 5 rutas del mes, ocupación promedio por ruta, salidas de hoy y mañana, anulaciones del mes, y el bloque de encomiendas — registradas hoy (cantidad y monto), pendientes de entrega con las 5 más antiguas (código, destinatario, días en espera) y entregadas en los últimos 7 días. Un briefing único simplifica la implementación y responde la mayoría de preguntas frecuentes.
3. **Armado del prompt** con la plantilla:

```
Eres el asistente ejecutivo de la empresa de transporte {razonSocial}.
Respondes preguntas al administrador sobre el estado de su operación.

REGLAS ESTRICTAS:
- Responde en español peruano, tono profesional y directo.
- Usa únicamente los datos del CONTEXTO. Si el dato no está, responde
  "No tengo ese dato disponible en este momento".
- No inventes cifras. Máximo 3 párrafos. Sin saludos ni despedidas.
- Fechas DD/MM/AAAA. Montos S/ 1,234.56.

CONTEXTO OPERATIVO (al {fechaHoraActual}):
{tablaResumen}

PREGUNTA DEL ADMINISTRADOR:
{pregunta}
```

4. **Invocación a Gemini** por HTTPS con timeout de 15 segundos; la API key se lee de Secret Manager.
5. **Respuesta y manejo de errores.** El texto validado retorna al frontend; ante timeout o cuota agotada se devuelve "El asistente no está disponible en este momento".
6. **Auditoría asíncrona** del evento (empresaId, usuarioId, latencia, timestamp) sin bloquear la respuesta.

### 6.4 Diagrama de secuencia — descripción para graficar

Líneas de vida (izquierda a derecha): **Administrador** (actor), **ChatUI**, **ControladorIA**, **Firebase Auth**, **RecuperadorContexto**, **Firestore**, **AdaptadorGemini**, **API de Gemini** (doble borde, externa).

1. Administrador → ChatUI: `escribirPregunta("¿cuál fue mi ruta más vendida?")`.
2. ChatUI → ControladorIA: `POST /api/ai/consulta {token, pregunta}`.
3. ControladorIA → Firebase Auth: `verificarToken(token)`.
4. Firebase Auth --> ControladorIA: `{empresaId, rol}`.
5. ControladorIA → Firestore: `leer empresa y su plan`.
6. Firestore --> ControladorIA: `{planId, asistenteIA}`.
7. **Fragmento alt (rectángulo con dos particiones):**
   - Partición superior "[asistenteIA = false]": ControladorIA --> ChatUI: `403 — "Tu plan no incluye el asistente. Actualiza a Terminal."` → fin de la secuencia.
   - Partición inferior "[asistenteIA = true]": continúa.
8. ControladorIA → RecuperadorContexto: `obtenerContexto(empresaId)`.
9. RecuperadorContexto → Firestore: `queries filtradas por empresaId` (ventas, salidas, encomiendas).
10. Firestore --> RecuperadorContexto: datos.
11. RecuperadorContexto --> ControladorIA: `tablaResumen`.
12. ControladorIA → AdaptadorGemini: `enviar(promptFinal)`.
13. AdaptadorGemini → API de Gemini: `HTTPS POST generateContent`.
14. API de Gemini --> AdaptadorGemini: `{texto}`.
15. AdaptadorGemini --> ControladorIA: `respuesta`.
16. ControladorIA --> ChatUI: `{respuesta}`.
17. ChatUI --> Administrador: mostrar respuesta.

**Notas laterales:** sobre pasos 8–10 "Filtrado obligatorio por empresaId"; sobre paso 13 "Timeout 15 s, mensaje neutro ante error". El fragmento alt del paso 7 es el que demuestra visualmente que el asistente es una capacidad exclusiva del plan Terminal, gobernada por la elección del cliente.

---

## 7. Calidad, escalabilidad y FinOps

### 7.1 Escalabilidad y tolerancia a fallos

- **Escalado automático:** Cloud Run de 0 a N instancias; Firestore y Hosting escalan de forma transparente.
- **Alta disponibilidad por diseño:** todos los servicios administrados operan con redundancia multi-zona bajo SLA de Google (99.95 %). No hay punto único de falla administrado por el equipo.
- **Tolerancia a fallos de Gemini:** timeout de 15 s y mensaje neutro; la operación core (ventas y encomiendas) no depende del asistente.
- **Concurrencia — dos puntos críticos, un mismo patrón:** (a) la **prevención de sobreventa** usa un documento-candado determinista por asiento (`salidas/{salidaId}/asientos/{numAsiento}`) leído y escrito dentro de la misma transacción que crea el pasaje: de dos ventas concurrentes, Firestore confirma una y la otra falla la precondición del candado; (b) la **unicidad del correlativo de guías** usa el contador por tenant (`contadores/{empresaId}`) incrementado dentro de la misma transacción que crea la encomienda. Ambos se cubren con pruebas de operaciones simultáneas en paralelo.

### 7.2 Políticas de seguridad

- **Cifrado:** HTTPS/TLS en tránsito (certificados automáticos de Firebase Hosting); cifrado en reposo por defecto en Firestore.
- **Identidad:** Firebase Authentication gestiona contraseñas (hash), tokens JWT de 1 hora y custom claims (`empresaId`, `rol`, `isSuperAdmin`).
- **Aislamiento multi-tenant:** doble capa (backend + reglas de Firestore); ningún endpoint acepta `empresaId` del cliente.
- **Enforcement de plan del lado del servidor:** los límites y capacidades (`maxBuses`, `maxUsuarios`, `encomiendas`, `asistenteIA`) se verifican siempre en el backend, nunca solo en la interfaz — ocultar un botón no es seguridad.
- **Secretos:** API key de Gemini en Secret Manager; jamás en el código ni en la imagen Docker.
- **Validación de entrada:** esquemas Zod en todos los endpoints; preguntas al asistente limitadas a 500 caracteres; rate limit de 10 consultas IA por minuto por usuario.
- **Auditoría:** eventos sensibles en la colección `auditoria` — registro de tenant, cambio de plan, venta, anulación, consulta IA, suspensión, y los del módulo de encomiendas: `registro_encomienda`, `despacho_encomiendas`, `entrega_encomienda` y `anulacion_encomienda`. La entrega es el evento más sensible del módulo (momento de posible disputa), por lo que su registro incluye fecha, usuario que entregó y documento del receptor.

### 7.3 Optimización de costos (FinOps)

**Fase de desarrollo: USD 0** — todo dentro del free tier de Google Cloud (Cloud Run, Firestore, Firebase Auth, Hosting y cuota gratuita de Gemini Flash).

**Fase piloto (3–10 tenants):**

| Servicio | Uso estimado mensual | Costo |
|---|---|---|
| Cloud Run | < 500 k peticiones | Free tier |
| Firestore | ~100 k lecturas/día | USD 2 – 6 |
| Firebase Auth y Hosting | Uso bajo | Free tier |
| API de Gemini (Flash) | ~2.000 consultas | USD 3 – 10 |
| Secret Manager y varios | — | USD 0 – 1 |
| **Total** | | **USD 5 – 17 / mes** |

**Sostenibilidad del modelo:** el costo marginal por tenant queda por debajo de USD 3 mensuales, frente a un plan mínimo de S/ 149 (~USD 40), preservando margen amplio. El costo de la API de Gemini queda además naturalmente contenido al ser el asistente exclusivo del plan superior (S/ 899), el de mayor margen. Estrategias aplicadas desde el diseño: escala a cero de Cloud Run, modelo Gemini Flash (10× más barato que Pro), contexto compacto (~1.000 tokens por consulta) y alerta de presupuesto en Google Cloud Billing al 80 %.

---

## 8. Conclusiones y trabajo futuro

### 8.1 Desafíos técnicos de la integración y despliegue

- **Concurrencia en la venta y en las guías:** riesgo de sobreventa y de correlativos duplicados; mitigados con transacciones atómicas sobre documentos deterministas (candado por asiento, contador por tenant) y pruebas de operaciones simultáneas.
- **Fugas entre tenants:** el mayor riesgo de un SaaS; mitigado con doble capa de aislamiento y pruebas automatizadas de acceso cruzado, incluyendo pruebas negativas a nivel de reglas de Firestore (verificación de rechazo explícito `permission-denied`, no de resultados vacíos, cuidando artefactos de caché del SDK cliente).
- **Alucinaciones del asistente:** mitigadas con prompt estricto ("responde solo con el contexto") y pruebas que contrastan cada respuesta contra las cifras reales en Firestore.
- **Configuración de servicios cloud:** las reglas de Firestore, los custom claims, los índices compuestos y el CORS entre Hosting y Cloud Run son las fuentes de fricción más comunes; se abordan temprano para no bloquear el cierre.
- **Disciplina de alcance:** con desarrollo asistido por IA el riesgo no es escribir código lento, sino agregar funcionalidades no planificadas. El documento actúa como contrato de alcance: lo que no está en los RF-01 a RF-20 no se construye en esta versión.

### 8.2 Hoja de ruta hacia versiones futuras

**Prioridad alta:** pasarela de pagos para cobro real de suscripciones (Culqi/Izipay); venta en línea al pasajero final; múltiples terminales por empresa (reintroducir la entidad Terminal y el rol jefe de terminal, ya diseñados en la versión extendida de esta arquitectura).

**Prioridad media:** facturación electrónica SUNAT vía PSE; manifiesto en PDF descargable y app PWA para el chofer; extensiones del módulo de encomiendas — cobro contra entrega, tarifario automático por peso/volumen, historial de remitentes frecuentes y trazabilidad fotográfica.

**Prioridad baja:** pronóstico de demanda y precios dinámicos con IA; API pública de integraciones; exportación a BigQuery para analítica; permisos personalizados.

La landing pública refleja esta hoja de ruta: las funcionalidades marcadas como "Próximamente" corresponden a los ítems de esta sección.

---

## 9. Anexos

### Anexo A — Glosario

- **Counter:** ventanilla de venta de boletos en el terminal; el "vendedor de counter" es quien la atiende.
- **Manifiesto:** lista oficial de pasajeros y carga de una salida, exigida por SUTRAN/MTC.
- **Salida:** instancia concreta de una ruta con bus, fecha y hora asignados; los pasajes y encomiendas se registran contra una salida.
- **Encomienda:** paquete que un remitente envía en la bodega de un bus para que un destinatario lo recoja en la ciudad de destino.
- **Guía:** código único de la encomienda (`ENC-{correlativo}`) que identifica el envío y permite su búsqueda y entrega.
- **Tenant:** empresa cliente del SaaS; en el modelo, la entidad `Empresa`.
- **Custom claim:** dato adicional incrustado en el token JWT por Firebase Authentication (aquí: `empresaId`, `rol`, `isSuperAdmin`).
- **Free tier:** capa gratuita de un servicio cloud.

### Anexo B — Semillas de la colección `planes`

```json
[
  {
    "id": "ruta",
    "nombre": "Ruta",
    "precioMensual": 149,
    "precioAnual": 1490,
    "maxBuses": 5,
    "maxUsuarios": 3,
    "encomiendas": false,
    "asistenteIA": false
  },
  {
    "id": "flota",
    "nombre": "Flota",
    "precioMensual": 399,
    "precioAnual": 3990,
    "maxBuses": 25,
    "maxUsuarios": 15,
    "encomiendas": true,
    "asistenteIA": false
  },
  {
    "id": "terminal",
    "nombre": "Terminal",
    "precioMensual": 899,
    "precioAnual": 8990,
    "maxBuses": 9999,
    "maxUsuarios": 9999,
    "encomiendas": true,
    "asistenteIA": true
  }
]
```

Estos tres documentos se cargan en Firestore. La landing los lee para pintar los precios y el backend los lee para el enforcement — una única fuente de verdad. **Nota de migración:** en instalaciones previas donde el plan Flota tenía `asistenteIA = true`, el traslado del asistente al plan Terminal es exclusivamente una actualización de estos documentos (y de la landing comercial); no requiere cambio de código — evidencia directa del principio "planes como configuración" (sección 2.2).

### Anexo C — Esquema simplificado de reglas de Firestore

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /planes/{planId} {
      allow read: if true;
      allow write: if request.auth.token.isSuperAdmin == true;
    }

    match /empresas/{empresaId} {
      allow read: if request.auth.token.empresaId == empresaId
                  || request.auth.token.isSuperAdmin == true;
    }

    match /contadores/{empresaId} {
      allow read, write: if request.auth.token.empresaId == empresaId;
    }

    match /{coleccion}/{docId} {
      allow read, write: if request.auth != null
                         && resource.data.empresaId == request.auth.token.empresaId;
    }
  }
}
```

### Anexo D — Plan de construcción

**Núcleo del producto (10 días hábiles):**

| Día | Entregable |
|---|---|
| 1 | Proyecto Firebase + GCP; Next.js y backend Express corriendo; colección `planes` cargada |
| 2 | Firebase Auth; registro de empresa con elección de plan; custom claims; login |
| 3 | CRUD de rutas y buses con enforcement de `maxBuses`; CRUD de usuarios con enforcement de `maxUsuarios` |
| 4 | Programación de salidas; listado de salidas del día |
| 5 | Mapa de asientos leyendo ocupación en tiempo real; publicación de reglas de Firestore |
| 6 | Venta de pasaje con transacción atómica; prueba de doble venta simultánea |
| 7 | Manifiesto (vista imprimible); anulación de pasaje; reporte de ventas del día |
| 8 | Asistente IA: endpoint, recuperador de contexto, prompt y llamada a Gemini; verificación de plan |
| 9 | ChatUI en el dashboard; panel del superadmin; cambio de plan |
| 10 | Despliegue en Firebase Hosting + Cloud Run; verificación end-to-end en producción |

**Módulo de encomiendas (3 días hábiles):**

| Día | Entregable | Prueba de verificación |
|---|---|---|
| E1 | Campo `encomiendas` en `planes`; módulo backend de registro (RF-17) con contador transaccional de guías y enforcement por plan; pantalla de registro desde la salida | Registro exitoso en plan con la capacidad; rechazo 403 con mensaje de upgrade en plan Ruta; dos registros en paralelo → códigos correlativos distintos |
| E2 | Ciclo de estados (RF-18): despacho por salida, búsqueda por código, entrega con documento del receptor, anulación solo admin | Transiciones válidas aceptadas e inválidas rechazadas; entrega con código de otro tenant → rechazada (prueba negativa de aislamiento); eventos en auditoría |
| E3 | Manifiesto de carga (RF-19); reporte con desglose de encomiendas y pendientes de entrega (RF-20); bloque de encomiendas en el contexto del asistente IA | El manifiesto muestra solo encomiendas a bordo con totales; el reporte separa pasajes de encomiendas y calza con verificación independiente; el asistente responde por las pendientes con la cifra real |

**Guion de presentación del producto (8 minutos):** (1) landing y elección del plan Ruta → registro en vivo → dashboard con el plan activo; (2) crear una ruta y 5 buses → intentar el 6.º y mostrar el rechazo por límite del plan; (3) programar una salida y vender 2 pasajes en el mapa de asientos; (4) registrar una encomienda con su guía y mostrar el manifiesto con pasajeros y carga; (5) solicitar el asistente IA con un plan sin la capacidad → mensaje de upgrade → cambiar al plan Terminal → hacer 2 preguntas al asistente con respuesta en vivo, incluida una sobre encomiendas pendientes. El recorrido cubre los tres pilares: SaaS con planes, multi-tenant y IA.

**Regla de construcción:** un día por vez, plan de archivos antes de escribir, verificación real al cerrar cada día, commit por día. El núcleo existente no se modifica al añadir módulos; cada módulo se incorpora siguiendo el patrón de módulos del backend.

### Anexo E — Referencias

- Google Cloud. *Cloud Run documentation*. https://cloud.google.com/run/docs
- Google Cloud. *Firestore documentation*. https://cloud.google.com/firestore/docs
- Google AI. *Gemini API documentation*. https://ai.google.dev/gemini-api/docs
- Firebase. *Security rules for Cloud Firestore*. https://firebase.google.com/docs/firestore/security/get-started
- SUTRAN / MTC (Perú). Normativa sobre manifiesto de pasajeros y Reglamento Nacional de Administración de Transporte.

---

*Fin del documento — versión 2.1.*
