# Plan de Ejecución del MVP – App Congreso Juegos de Mesa

## 1. Épicas y tareas del MVP

### 1.1 Autenticación y control de acceso
- **E1.1 Configuración de Firebase Auth**: crear proyecto Firebase, activar proveedor Email/Password, definir dominios autorizados, forzar verificación de email.
- **E1.2 Sincronización de whitelist**: colección `authorizedEmails` con flags de rol; función administrativa para importar CSV inicial.
- **E1.3 Flujo de onboarding**: pantalla de login con validación de whitelist, captura de alias, avatar opcional y consentimiento.
- **E1.4 Panel básico de organización**: módulo restringido para añadir/quitar emails, reasignar roles y descargar log de accesos.
- **E1.5 Auditoría y seguridad**: Cloud Functions para registrar intentos fallidos y bloquear usuarios dados de baja.

### 1.2 Ludoteca del evento
- **E2.1 Esqueleto de la colección `libraryEntries`**: campos para id BGG, propietario, copias, idioma, notas, bandera `manual`.
- **E2.2 Integración búsqueda BGG**: función callable que consulta API, aplica caché (`gamesCache`) y normaliza metadatos.
- **E2.3 Formulario “Añadir juego”**: autocompletado por nombre/ID, selección de resultado y override manual.
- **E2.4 Listado y filtros básicos**: vista mobile-first con chips de filtros (jugadores, duración, propietario, idioma) y ordenamientos guardados en Firestore.
- **E2.5 Gestión de duplicados de juego**: validaciones front/back para evitar entradas con mismo id BGG + propietario.

### 1.3 Registro de partidas y detección de duplicados
- **E3.1 Modelo `plays`**: campos juego, jugadores, sala, horaInicio, duracionMin, ganador(es), podio, notas, `createdBy`.
- **E3.2 Selector de jugadores**: autocompletado sobre usuarios activos; soporte multi-ganador y empate.
- **E3.3 Regla de día de congreso**: utilidades para calcular día lógico (07:00–06:59) en front y stored fields en back.
- **E3.4 Heurística de duplicados**: Cloud Function que genera `duplicateHash` (juego + jugadores ordenados + hora redondeada) y devuelve alerta; opción de marcar `forced=true`.
- **E3.5 Historial y edición**: listado por usuario con filtros rápidos; permitir editar partidas propias durante ventana configurable (p. ej. 30 min).

### 1.4 Paneles de estadísticas
- **E4.1 Agregados base**: jobs programados (Cloud Scheduler + Function) que calculan métricas por día y por usuario y guardan en `statsDaily`.
- **E4.2 Panel global**: tarjetas (partidas por franja, juegos más jugados, duración media) y gráficos sencillos (bar/line) responsivos.
- **E4.3 Panel individual**: resumen personal (partidas, tiempo total, compañeros frecuentes) con filtros por día.
- **E4.4 Exportación light**: botón para descargar CSV simple de partidas propias (organización tendrá exportación completa en V1).

### 1.5 Plataforma y QA
- **E5.1 Setup frontend**: PWA en React + TypeScript + Vite + React Query + Tailwind (o design system equivalente).
- **E5.2 CI/CD**: GitHub Actions para lint, tests, deploy a Firebase Hosting preview.
- **E5.3 Testing**: plan de pruebas end-to-end con Playwright (escenarios críticos), pruebas de usabilidad interna y checklist de accesibilidad AA.
- **E5.4 Observabilidad**: configuración básica de Firebase Analytics/Crashlytics (via integración web) y logging estructurado.

## 2. Arquitectura base

```
[Cliente PWA] ⇄ [Firebase Auth]
       ↓              ↓
React Query    Custom Claims (rol)
       ↓              ↓
[Firestore] ←→ [Cloud Functions HTTP/Callable]
       ↓              ↓
[Storage (avatars)]  [Cloud Scheduler]
```

- **Front-end**: PWA React/TS con Vite, lazy loading por secciones, almacenamiento offline ligero (IndexedDB) para formularios temporales.
- **State management**: React Query + Zustand para estado global pequeño (usuario, configuraciones).
- **Backend**: Firestore como BD principal, Cloud Functions para lógica sensible (whitelist, duplicados, agregados, integraciones BGG), Cloud Scheduler para jobs nocturnos.
- **Seguridad**: reglas de Firestore basadas en `request.auth.token.role` (`assistant`, `organizer`). Campos críticos solo modificables por Cloud Functions.
- **Integración BGG**: función callable `fetchGameMetadata` con cache TTL 7 días; fallback manual si API falla.
- **Infraestructura**: Firebase Hosting para PWA, Functions en región EU, Storage para avatares e imágenes de juegos personalizados.

## 3. Modelo de datos (Firestore)

### 3.1 Colecciones principales

| Colección | Clave | Campos principales | Notas |
|-----------|-------|--------------------|-------|
| `events` | `{eventId}` | `name`, `slug`, `startDate`, `endDate`, `dayBoundary` (hora frontera), `status`, `config` | Permite múltiples eventos futuros.
| `users` | `{uid}` | `email`, `alias`, `avatarUrl`, `roles` (array), `eventIds`, `language`, `consent`, `createdAt`, `updatedAt`, `status` | Roles via custom claims + documento.
| `authorizedEmails` | `{emailHash}` | `email`, `role`, `eventIds`, `invitedBy`, `createdAt`, `revoked` | Usada por funciones admin.
| `libraryEntries` | `{eventId}/{entryId}` | `gameId` (ref `games` o null), `manualTitle`, `ownerUid`, `ownerAlias`, `copies`, `language`, `notes`, `bggData` (map), `manual` (bool), `createdAt` | Índice compuesto por `ownerUid` y `gameId`.
| `gamesCache` | `{bggId}` | `data`, `fetchedAt`, `ttl` | TTL 7 días para no llamar repetidamente.
| `plays` | `{eventId}/{playId}` | `gameRef`, `players` (array objetos {uid, alias}), `startTime`, `durationMin`, `winners`, `podium`, `room`, `notes`, `duplicateHash`, `forced`, `createdBy`, `createdAt`, `updatedAt`, `statsDay` | `statsDay` = string YYYY-MM-DD con regla 07:00–06:59.
| `playDuplicates` | `{eventId}/{hash}` | `playIds` array, `latestOccurrence`, `status` | Trazabilidad de duplicados confirmados.
| `statsDaily` | `{eventId}/{statsDay}` | `global` (totales), `byGame`, `byHour`, `topPlayers`, `updatedAt` | Precalculado por job.
| `userStats` | `{eventId}_{uid}` | `totals`, `byDay`, `partners`, `updatedAt` | Derivado del job nocturno.

### 3.2 Reglas de Firestore (resumen)
- `users`: lectura propia y pública limitada (alias, avatar) mediante reglas con `allow get` filtrado; escritura propia excepto campos roles/estado (solo Functions).
- `libraryEntries`: `allow read` a asistentes del evento; `allow create/update/delete` solo si `request.auth.uid == resource.data.ownerUid`; organización puede modificar todo.
- `plays`: creación/edición permitida al creador y participantes durante 30 min (`request.time - resource.data.createdAt < duration(30, 'm')`); staff/organización sin restricción.
- `statsDaily`, `userStats`: solo lectura; escrita por Cloud Functions con servicio.
- `authorizedEmails`: solo lectura/escritura mediante Cloud Functions admin.

### 3.3 Índices sugeridos
- `libraryEntries`: `eventId` + `gameId` + `ownerUid` para detección duplicados.
- `plays`: `eventId` + `statsDay`, `eventId` + `players.uid` array, `eventId` + `duplicateHash`.
- `userStats`: `eventId` + `uid` compuesto.

## 4. Flujos UX/UI prioritarios

1. **Onboarding / Login**
   - Intro → formulario email/password → verificación whitelist → selección alias/idioma → tutorial corto (skip) → home con resumen del día.
2. **Añadir juego a la ludoteca**
   - FAB “Añadir” → búsqueda BGG → seleccionar resultado (preview con metadatos) → completar campos propios (copias, idioma, notas) → confirmación con CTA para ver ficha.
3. **Registrar partida**
   - Botón “Registrar” persistente → paso 1: seleccionar juego (ludoteca o manual) → paso 2: jugadores (chips autocompletadas con foto) → paso 3: hora/duración, sala → paso 4: ganador(es) + notas → toast de éxito → modal de posible duplicado si aplica con opciones “Ver partida existente” / “Confirmar de todos modos”.
4. **Consultar estadísticas**
   - Home: cards con partidas del día y CTA a panel → Panel global: tabs Día / General; Panel individual: tabs Resumen / Compañeros; selector de rango (día actual, anteriores) con chips; gráficos accesibles con descripciones.
5. **Gestión básica para organización**
   - Home de organización (badge en avatar) → lista de asistentes con filtros → acciones: aprobar/bloquear, editar whitelist, ver duplicados confirmados.

## 5. Roadmap y validación

| Iteración | Duración | Entregables clave | Validación |
|-----------|----------|-------------------|------------|
| **Sprint 0** | 1 semana | Setup repos (frontend, functions), CI/CD, diseño de componentes base, definiciones de datos y reglas iniciales | Revisión técnica interna, despliegue a entorno staging |
| **Sprint 1** | 2 semanas | Autenticación + whitelist, onboarding usuario, panel simple organización | Pruebas con correos reales (lista corta) |
| **Sprint 2** | 2 semanas | Ludoteca con búsqueda BGG/caché, formulario y listados | Sesión con 5–8 asistentes testers; verificación filtros |
| **Sprint 3** | 2 semanas | Registro de partidas + heurística duplicados | Test interno con datos sintéticos; validación organización |
| **Sprint 4** | 2 semanas | Estadísticas globales/individuales + job nocturno + exportación ligera | Demostración funcional a stakeholders, QA completo |
| **Buffer/Lanzamiento** | 1 semana | Correcciones, hardening, textos legales, checklist accesibilidad, Lighthouse | Go/No Go con organización |

### Plan de pruebas
- **Unitarias**: lógica de duplicados, cálculo de `statsDay`, parseo BGG.
- **Integración**: flujos end-to-end con Playwright (login, añadir juego, registrar partida, ver estadísticas).
- **Aceptación con organización**: checklists del PRD (whitelist, duplicados, estadísticas 07:00).
- **Monitoreo post-lanzamiento**: tablero en Data Studio con métricas KPI (partidas/día, % usuarios activos, ratio duplicados).

## 6. Próximos pasos inmediatos
1. Validar con stakeholders tecnologías sugeridas (React/TS + Firebase) y ajustar si hay restricciones previas.
2. Crear repos técnicos (frontend + functions) y aplicar plantillas CI.
3. Detallar especificaciones UI (wireframes) y definir design tokens iniciales.
4. Elaborar backlog en herramienta de gestión (Jira/Linear) mapeando épicas/tareas anteriores con estimaciones iniciales.
5. Preparar dataset de juegos de ejemplo y usuarios para pruebas de Sprint 1–3.
