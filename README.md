# PRD – App para Congreso de Juegos de Mesa

*(Documento de definición exhaustiva – sin código)*

> **Documento complementario**: el plan de ejecución del MVP con épicas, arquitectura, modelos de datos y roadmap detallado se encuentra en [`MVP-Ejecucion.md`](./MVP-Ejecucion.md).

---

## 1) Resumen ejecutivo

App orientada a asistentes de un congreso específico de juegos de mesa. Objetivos: (1) registrar asistentes; (2) construir la **ludoteca del evento** a partir de los juegos que cada participante llevará (enriquecidos con datos de BGG); (3) **registrar partidas** durante el congreso; (4) ofrecer **estadísticas** globales e individuales; (5) **comunicación interna** (chat y tablón “busco mesa”).

**Plataformas**: **web app mobile‑first (PWA)**: pensada para teléfono (uso principal), con responsive para tablet y escritorio. Soporte de instalación como app (icono en pantalla de inicio), notificaciones push y caché ligera para uso intermitente. **Backend**: Firebase (Auth, Firestore, Cloud Functions, Storage, FCM, Hosting). **Integración externa**: BoardGameGeek (BGG) para metadatos de juegos.

---

## 2) Alcance y objetivos (MVP → V1 → V2)

**MVP (imprescindible)**

* Registro e inicio de sesión de asistentes (lista blanca de emails facilitada por la organización).
* Ludoteca del evento: alta de juegos por parte de los asistentes; enriquecimiento con metadatos BGG; filtros básicos.
* Registro de partidas: juego, jugadores (de la lista de inscritos), hora de inicio, duración, resultado (ganador + opcionalmente posiciones).
* Detección de posibles duplicados de partida (heurística simple).
* Panel de **estadísticas globales** y **por usuario** (día del congreso definido 07:00–06:59 del día siguiente).

**V1 (deseable a corto)**

* Tablón “busco mesa” (publicar partidas abiertas, plazas, sala, hora estimada, inscripción).
* Canal de chat por partida y notificaciones push (FCM).
* Filtros avanzados en ludoteca (autor, editorial, año, nº jugadores, duración, peso, idioma, propietario).
* Exportación CSV/Excel de partidas y estadísticas (para organización).

**V2 (evoluciones)**

* Estadísticas de **grupos** (parejas, tríos) y afinidades (“con quién juego más / gano más / juego más tiempo”).
* Badges / gamificación (p. ej., “Explorador de novedades”, “Maratón 10h”).
* Modo offline (caché local + sincronización) y soportar múltiples eventos/reuniones.
* Roles de staff/moderación y herramientas antifraude (p. ej., verificación cruzada de partidas).

---

## 3) Personas y roles

* **Asistente/Jugador**: añade juegos que lleva, registra partidas, consulta ludoteca/estadísticas, se apunta a mesas abiertas, usa chat.
* **Organización**: aprueba listas de asistentes (whitelist), modera contenido, consulta paneles globales, exporta datos.
* **Staff/Moderador** (opcional V2): ayuda a resolver duplicados, valida partidas conflictivas, gestiona salas y anuncios.

**Permisos (resumen)**

* Invitado (no invitado por email): acceso restringido (solo portada/FAQ o “evento privado”).
* Asistente: CRUD sobre sus juegos; crear/editar partidas en las que participa; escribir en chats y tablón; ver estadísticas propias + globales agregadas.
* Organización/Staff: todo lo anterior + moderación, cierre/edición de cualquier partida, acceso a exportaciones.

---

## 4) Historias de usuario clave

1. *Como asistente*, quiero **añadir los juegos que llevaré** para que otros puedan encontrarlos y proponer partidas.
2. *Como asistente*, quiero **buscar en la ludoteca** por filtros (nº jugadores, duración, autor, propietario) para proponer una partida adecuada al grupo disponible.
3. *Como asistente*, quiero **registrar una partida** (con juego, participantes, hora, duración y ganador) para llevar un histórico del congreso.
4. *Como sistema*, quiero **detectar duplicados** al registrar una partida para evitar contar la misma partida dos veces.
5. *Como asistente*, quiero **ver mis estadísticas** (nº de partidas por día, tiempo total, con quién juego más), para tener una visión de mi congreso.
6. *Como organización*, quiero **ver estadísticas globales** (partidas por franja, juegos más jugados, mesas con más uso) para evaluar el éxito del evento.
7. *Como asistente*, quiero ver un **tablero “busco mesa”** y **apuntarme** con un click para organizarme rápidamente.
8. *Como asistentes de una partida*, queremos un **chat de partida** para coordinarnos (sala, hora, retrasos).

---

## 5) Requisitos funcionales (detallados)

### 5.1 Registro y acceso (whitelist)

* La organización sube una **lista de emails autorizados**.
  * **Lista blanca inicial** (Fase 0):
    * ulises1002048@gmail.com
    * patricio1002048@gmail.com
    * tomas1002048@gmail.com
    * saul1002048@gmail.com
  * **Administrador inicial**: alejandro.martin.millan@gmail.com (permisos completos, incluida la edición de la whitelist).
* Autenticación por email (u otros proveedores, opcional) **validando pertenencia a la lista**.
* Campo perfil de usuario: alias, nombre visible, avatar (opcional), preferencia de idioma, consentimiento RGPD.

**Criterios de aceptación**

* Solo emails en la lista pueden completar registro.
* Cambio de dispositivo no crea duplicados de usuario.
* Baja/baneo desde panel de organización.

### 5.2 Ludoteca del evento

* **Alta de juegos** por usuario: búsqueda por nombre/ID y selección.
* **Enriquecimiento BGG**: título, autores, editorial, año, nº jugadores, duración, “weight”, portada, id BGG, etiquetas/temas/ mecánicas.
* **Propietario** (usuario que lo lleva) + **cantidad** (si lleva varias copias) + observaciones (idioma del juego, edición, estado componentes).
* **Filtros**: propietario, nº jugadores, duración, autor, editorial, año, peso, idioma, nombre.
* Durante la Fase 0, el **catálogo inicial** será introducido por la propia organización/asistentes según avancen las pruebas internas.

**Criterios de aceptación**

* Evitar duplicados del **mismo juego/propietario** (mismo id BGG + usuario).
* Si no se encuentra en BGG, permitir **ficha manual mínima** (nombre + propietario), marcada como “sin validar”.

### 5.3 Registro de partidas

* Campos: juego (de la ludoteca o BGG), jugadores (de la lista de asistentes), sala (opcional), hora inicio, duración, **ganador** (obligatorio) + **podio** (opcional), notas.
* **Regla de día de congreso**: día = 07:00 a 06:59 del día siguiente (configurable por evento).
* **Detección de duplicados** (heurística inicial): si se intenta registrar una partida con mismo juego, conjunto de jugadores idéntico o muy similar, y hora de inicio dentro de ±10–15 min de otra ya registrada, avisar y permitir: (a) **confirmar duplicado** (no crear) o (b) **forzar creación** (dejando rastro y alerta a moderación).

**Criterios de aceptación**

* Validar que todos los jugadores estén registrados en el evento.
* Duración ≥ 1 minuto y ≤ 24 h.
* Un ganador obligatorio (o “empate” marcado explícitamente). Podio opcional.

### 5.4 Estadísticas

**Globales**

* Nº de partidas por día del evento y por franja horaria.
* Juegos más jugados (top N), duración total jugada por título.
* Media de jugadores por partida; distribución de duraciones; tiempo total de juego.

**Individuales (por usuario)**

* Partidas jugadas (listado y conteo), tiempo total, juegos más repetidos.
* Con quién ha jugado más (conteo de co-participaciones) y con quién ha jugado **más tiempo** (suma de duraciones compartidas).
* Ratio de victorias por juego (si se registra ganador/podio).

**Grupos (V2)**

* Métricas para parejas/tríos frecuentes (coincidencia ≥ X partidas o ≥ Y horas).

**Criterios de aceptación**

* Las métricas respetan la **regla de día** 07:00–06:59.
* Cómputos consistentes ante edición/eliminación de partidas.

### 5.5 Tablón “Busco mesa” (V1)

* Crear anuncio: juego (de ludoteca o BGG), sala, **nº de plazas** mín/máx, hora estimada de inicio, notas.
* Estado del anuncio: **Abierta**, **Completa**, **Cerrada** (manual o por inicio de partida).
* **Inscripción 1 clic** para asistentes; el creador puede **aceptar/expulsar** y marcar **lista de espera**.
* Conversión de anuncio a **registro de partida** con traspaso de jugadores/horarios.

### 5.6 Chat interno (V1)

* **Canales**: por partida registrada y por anuncio del tablón.
* Notificaciones push (FCM) para menciones y cambios de estado (opcional silenciable).
* Moderación básica (reportar, borrar mensajes, bloquear usuarios en caso extremo).

### 5.7 Panel de organización

* Gestión de asistentes (altas/bajas/roles), exportación de datos (CSV/Excel), indicadores en tiempo real (partidas activas, salas con más actividad), configuración del evento (fechas, regla de día, salas, normas).

---

## 6) Requisitos no funcionales

* **Tecnología**: Firebase (Auth, Firestore, Cloud Functions, Storage, Hosting, FCM) + **PWA** (Service Worker, manifest, Add‑to‑Home‑Screen).
* **Prioridad móvil**: diseño **mobile‑first** con targets táctiles ≥ 44×44 px, tipografía legible (≥ 16 px base), gestos simples (scroll, tap; evitar gestos complejos), **feedback <100 ms** al tocar (skeletons/spinners breves), navegación inferior de 3–5 ítems.

* **Rendimiento**: FCP ≤ 2.0 s y TTI ≤ 3.0 s en móviles de gama media (red 4G), JS inicial < 200 KB gzip, lazy‑loading en vistas pesadas (ludoteca y estadísticas), caché de imágenes.
* **Modo offline‑lite**: lectura de **últimas 24 h** de ludoteca/anuncios/estadísticas y **borradores** de partidas/anuncios; sincronización en segundo plano cuando vuelva la red.
* **Disponibilidad**: ≥ 99% durante el evento; plan de contingencia (modo sólo lectura si BGG o Firestore presentan incidencias parciales).
* **Privacidad/RGPD**: consentimiento, aviso legal, política de privacidad; derecho a eliminación de datos post‑evento; retención por defecto: 12 meses (configurable).
* **Accesibilidad**: AA (contraste, tamaños, foco y etiquetas ARIA); navegación por teclado y lectores de pantalla en móviles.
* **Internacionalización**: al menos ES/EN; formatos locales (hora, fecha, números) según zona horaria del evento.

---

## 7) Arquitectura técnica (alto nivel)

* **Frontend**: SPA web responsive **mobile‑first**.
* **PWA**: Service Worker para caché de recursos y datos críticos, **Background Sync** para colas de envíos (partidas, mensajes), **Web Push/FCM**.
* **Auth**: Firebase Auth con whitelist de emails; opcional proveedores sociales.
* **Datos**: Firestore (colecciones: usuarios, juegosEvento, partidas, anuncios, chats, eventos, salas, agregadosEstadísticos).
* **Funciones**: Cloud Functions para: integración BGG (fetch + cache), validación negocio (duplicados), cron/agregados, exportaciones.
* **Almacenamiento**: Storage para avatares/portadas locales (cuando no haya imagen de BGG).
* **Notificaciones**: FCM para avisos de chat y cambios de estado de anuncios.
* **Seguridad**: Reglas de Firestore por rol; verificación de inputs en Functions; logs de auditoría.

---

## 8) Modelo de datos (resumen, sin código)

**Usuario**

* id, email, alias, nombre visible, avatarURL, rol [asistente|staff|organización], consentimientoRGPD: sí/no.

**Evento**

* id, nombre, sede, fechas, horaInicioDiaCongreso (ej. 07:00), zonas/salas[]

**JuegoEvento** (un juego llevado por un usuario)

* id, idBGG, nombre, propietarioUsuarioId, cantidad, idioma, edición, año, autor(es), editorial(es), numJugadoresMin/Max, duraciónMedia, peso, portadaURL, notas.

**Partida**

* id, eventoId, juegoId (o idBGG si no está en ludoteca), jugadoresIds[], horaInicio, duraciónMin, ganadorUsuarioId, podioOrdenadoIds[], sala, notas, estado [abierta|finalizada], huellaDuplicado (hash heurístico), creadoPor.

**AnuncioMesa** (tablón “busco mesa”)

* id, eventoId, juegoId/idBGG, creadorId, plazasMin, plazasMax, inscritosIds[], sala, horaEstimada, estado [abierta|completa|cerrada], notas.

**ChatMensaje**

* id, canalTipo [partida|anuncio], canalId, autorId, timestamp, texto, moderado [true/false].

**AgregadoEstadístico**

* id, eventoId, tipo [global|usuario|juego|franja], clave (p. ej., fecha, userId), métricas (conteos, duraciones, etc.), ventanaTemporal.

---

## 9) Flujos principales

**Alta de juego a la ludoteca**

1. Usuario busca por nombre → 2) Selecciona juego/ID → 3) Sistema trae metadatos BGG y precarga ficha → 4) Usuario confirma (idioma/edición/cantidad) → 5) Guardar.

**Registro de partida**

1. Usuario elige juego → 2) Añade jugadores (autocompletar desde inscritos) → 3) Define hora inicio/duración → 4) Marca ganador/podio → 5) Sistema calcula huella y busca duplicados cercanos → 6) Usuario confirma o cancela → 7) Guardar + actualizar agregados.

**Publicar mesa en tablón**

1. Usuario define juego, plazas, sala, hora estimada → 2) Publica → 3) Otros se inscriben → 4) Creador cierra/convierte a partida.

**Chat de partida**

1. Al crear partida se abre canal → 2) Participantes reciben notificaciones → 3) Moderación disponible.

---

## 10) Reglas de negocio (selección)

* **Día de congreso** configurable (por defecto 07:00–06:59). Todas las estadísticas se calculan con esta frontera.
* **Ganador obligatorio**; si hay empate, marcar “empate” y permitir múltiples ganadores.
* **Duplicados**: advertir si (mismo juego) ∧ (jugadores coinciden ≥ 80%) ∧ (|Δ horaInicio| ≤ 15 min). Registro deja traza si el usuario fuerza.
* **Privacidad**: los chats y partidas son visibles para asistentes del evento; exportaciones solo para organización.

---

## 11) Estadísticas – definiciones

* **Partidas por día**: conteo en ventana [07:00 d, 06:59 d+1].
* **Duración media**: media aritmética de duraciónMin por día/usuario/juego.
* **Compañeros frecuentes**: top-N usuarios por co-participación; **tiempo compartido** suma de duraciones de partidas comunes.
* **Afinidad de grupos (V2)**: parejas/tríos con mayor nº de co-participaciones o mayor tiempo compartido, con umbral mínimo.

---

## 12) Integración con BGG (sin código)

* **Búsqueda** por nombre/ID para alta de juegos; **detalle** por id para metadatos.
* **Caché** en Firestore con TTL (ej. 7 días) para no reconsultar títulos iguales.
* **Backoff** y retardo entre llamadas; cola de peticiones y reintentos.
* **Plan B**: si BGG falla, permitir alta manual mínima.

**Campos típicos a mapear**: nombre, año, autores, editorial, jugadores min/máx, duración, peso, portada, mecánicas/temas.

---

## 13) Seguridad, privacidad y cumplimiento

* **RGPD/LOPDGDD**: consentimiento informado; base jurídica “interés legítimo de organización de evento” o “consentimiento”; derechos ARSULIPO (acceso, rectificación, supresión, etc.).
* **Retención**: borrar/anonimizar datos personales tras el periodo acordado (p. ej., 12 meses post-evento).
* **Reglas de acceso**: únicamente emails autorizados; logs de auditoría en acciones sensibles.
* **Moderación**: reportes, bloqueo usuarios reincidentes; registro de cambios en partidas.

---

## 14) UX/UI – mapa de pantallas (sin maquetas)

* **Onboarding/Acceso** (email autorizado) → **Home** del evento.
* **Navegación móvil**: barra inferior fija (Home, Ludoteca, Registrar, Tablón, Perfil), FAB para acciones clave ("Registrar partida", "Publicar anuncio").
* **Ludoteca**: lista y detalle; filtros *mobile‑friendly* (sheet deslizable con chips/toggles); botón “Añadir juego que llevo”.
* **Registrar partida**: formulario por pasos, autocompletado de jugadores; aviso de duplicados claro con opción **Confirmar** o **Ver partida sospechosa**.
* **Estadísticas**: globales e individuales con tabs; selector de día; gráficos compactos, tarjetas con métricas.
* **Tablón**: feed de anuncios; detalle con inscripciones 1‑tap; conversión a partida.
* **Chat**: canal por partida/anuncio; notificaciones; quick‑replies (“Llegando”, “En sala 2”).
* **Panel org.**: asistentes, salas, exportaciones, configuración.

**Patrones mobile‑first**: estados vacíos útiles, mensajes de error en línea, confirmaciones no intrusivas, navegación con una mano, campos con teclado adecuado (numérico para duración, etc.).

---

## 15) KPI de éxito

* % asistentes que añaden ≥1 juego.
* **% sesiones desde móvil** (objetivo principal ≥ 70%).
* Ratio anuncios → partidas efectivas.
* Nº medio de partidas/usuario y tiempo total de juego.
* % registros de partida con duplicado detectado (y confirmado como tal).
* Satisfacción post-evento (encuesta rápida in-app).

---

## 16) Roadmap & estimación (alto nivel, sin fechas fijas)

* **Fase 0**: validación con organización (este PRD) + datos de ejemplo.
* **Fase 1 (MVP)**: auth/whitelist, ludoteca básica + BGG, registro partidas + duplicados, estadísticas básicas.
* **Fase 2 (V1)**: tablón mesas, chat, notificaciones, filtros avanzados, exportaciones.
* **Fase 3 (V2)**: estadísticas de grupos, gamificación, offline, roles staff y auditoría ampliada.

---

## 17) Pruebas y verificación (aceptación)

**Casos esenciales**

* Registro con email en whitelist / fuera de whitelist.
* Alta de juego con y sin coincidencia en BGG.
* Registro de partida correcta; detección de duplicado; forzado con traza.
* Cómputo de estadísticas con frontera 07:00.
* Publicación de anuncio y conversión a partida.
* Permisos: asistente versus organización.

**Pruebas mobile**

* **Matriz de dispositivos**: Android (gama media 6"), iOS (iPhone actual y uno de 5.5–6.1"), tablet 8–10"; diferentes densidades.
* Lighthouse en modo móvil: Performance ≥ 80, Accessibility ≥ 90, Best Practices ≥ 90, SEO ≥ 90.
* Uso en red degradada (Good 3G/4G): comprobar FCP/TTI y comportamiento offline‑lite.

**Criterios de calidad**

* Sin errores bloqueantes; **fluidez táctil** (scroll y taps sin jank perceptible).
* Accesibilidad AA y localización correcta (zona horaria del evento).

---

## 18) Riesgos y mitigaciones

* **Cuotas/limitaciones BGG** → caché, colas y backoff; posibilidad de carga manual.
* **Conectividad deficiente en sede** → diseño “optimista” y tolerante a fallos; cola local (V2).
* **Abuso/troleo** → moderación, reputación mínima, bloqueo.
* **Privacidad** → mínimos datos personales; retención limitada y configurable.

---

## 19) Glosario

* **BGG**: BoardGameGeek, fuente de metadatos de juegos.
* **Ludoteca**: conjunto de juegos disponibles en el evento.
* **Tablón**: listado de partidas abiertas a inscripciones.
* **Huella de duplicado**: combinación de juego + jugadores + hora para detectar entradas repetidas.

---

## 20) Anexos (opcional)

* Lista de filtros BGG soportados (según campos disponibles).
* Textos legales (borradores de consentimiento/privacidad).
* Plantillas de exportación (columnas CSV).
