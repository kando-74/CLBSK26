# Backlog Evolutivo – Post MVP

Este documento agrupa y prioriza las funcionalidades solicitadas que expanden el alcance del PRD tras el MVP inicial. Se organiza por módulos para facilitar planificación iterativa.

---

## 1. Módulos y releases sugeridos

| Módulo | Objetivo | Release recomendado | Notas clave |
| --- | --- | --- | --- |
| Perfiles públicos & medios | Exponer fichas accesibles con foto moderada, bio y stats resumidas. | V1 | Requiere Storage + workflow de aprobación.
| Ludoteca & jornada avanzada | Quitar/archivar juegos, resets diarios, branding evento, CSV roles. | V1 | Depende de panel de organización sólido.
| Meeting point & disponibilidad | Mostrar quién está libre para qué tipos de partida. | V1 | Integra con tablón y notificaciones.
| Notificaciones & avisos | Alerts por juego/mesa, anuncios oficiales, fallback email. | V1→V2 | Inicial: push básicos; avanzado: preferencias y seguimiento.
| Badges & gamificación | Reconocer hitos por partidas, duración, salas, personas distintas. | V2 | Requiere agregados sólidos y jobs programados.
| Mesas privadas & DM | Partidas cerradas, invitaciones directas, chat privado. | V2 | Reglas de seguridad específicas, moderación ampliada.
| Analítica social | Métricas por salas, personas distintas, horas por día. | V2 | Alimenta badges y reportes.

---

## 2. Detalle por módulo

### 2.1 Perfiles públicos & medios
- **Historias**: ver ficha de cualquier asistente, subir selfie, moderación por staff.
- **Requisitos**
  - Colección `userProfiles` con foto en Storage, `photoStatus`, `visibility`.
  - Form de edición con recorte 1:1, límites (2 MB, formatos jpg/png).
  - Vista pública con alias, avatar, badges, stats rápidas, juegos frecuentes.
  - Reporte de foto/contenido → fila para moderación.
- **Aceptación**: galería de avatars aprobados, historial de cambios, usuarios pueden revertir a avatar genérico.
- **Dependencias**: Storage configurado, roles de moderadores en Auth claims.

### 2.2 Ludoteca & jornada avanzada
- **Historias**: archivar juego, resetear jornada, cambiar branding, importar CSV con roles.
- **Requisitos**
  - Campo `estado` en `libraryEntries` (activo/archivado) + `archivedAt`.
  - Acción "Reset jornada" que limpia disponibilidad, anuncios y flags, conserva partidas.
  - Configuración de evento (nombre, logo, dayBoundary) editable en panel.
  - Import CSV: validaciones, resumen de altas/errores, roles `participant|admin|collab`.
- **Aceptación**: resets auditados, confirmación doble, branding actualizado en toda la PWA.

### 2.3 Meeting point & disponibilidad
- **Historias**: marcarme disponible por tipo/duración, contactar a alguien del listado.
- **Requisitos**
  - Colección `userAvailability` (preferencias, expiración).
  - UI tipo tarjetas con filtros (duración, número jugadores, sala).
  - Integración con tablón (sugerir disponibles al crear anuncio) y chat (CTA "Enviar mensaje").
- **Aceptación**: estado expira al cerrar jornada, usuario puede pausar en cualquier momento.
- **Dependencias**: notificaciones para avisar a interesados cuando se abre mesa.

### 2.4 Notificaciones & avisos
- **Historias**: avisar cuando alguien abre mesa de mi juego, canal de anuncios, push a móvil.
- **Requisitos**
  - Suscripciones (`notificationSubscriptions`) por juego, sala, usuario.
  - Cloud Functions que disparen FCM + email fallback.
  - Centro in-app con pestañas (Organización, Mis juegos, Mensajes, Sistema).
  - Preferencias granulares en perfil (toggles por categoría, silencio temporal).
- **Aceptación**: auditoría de envíos masivos, usuarios pueden probar notificación.
- **Dependencias**: permisos push manejados tras educar al usuario; integración con meeting point y badges (logros → toast/push).

### 2.5 Badges & gamificación
- **Historias**: otorgar insignias por primer filler, 5 fillers, 10 fillers, haber jugado en todas las salas, 12h en un día, etc.
- **Requisitos**
  - Colecciones `badgeDefinitions` y `userBadges` (con contexto).
  - Jobs (Cloud Scheduler) que calculen contadores diarios + triggers en creación/edición de partidas.
  - UI: carrusel en perfil, catálogo explicativo, toast de celebración.
  - Categorías sugeridas: duración (filler/monster), volumen de partidas (1-100), salas (primera, cinco, todas), social (1-100 personas distintas), tiempo por jornada.
- **Aceptación**: badges idempotentes, posibilidad de revocar si se corrige partida, registro de fuente.
- **Dependencias**: métricas fiables y clasificación duración/sala en `plays`.

### 2.6 Mesas privadas & mensajería directa
- **Historias**: crear partida privada, invitar con código, recibir mensajes directos con push.
- **Requisitos**
  - Campo `visibility` en anuncios/partidas (`public|private|link`).
  - Lista de `invitees` y códigos de acceso temporales.
  - Canales de chat directos (1-1 o grupo reducido) con notificaciones.
  - Herramientas de moderación: reportes, silenciar, expulsar.
- **Aceptación**: privados no aparecen en listados generales, invitaciones caducan tras configurado, notificaciones respetan preferencias.
- **Dependencias**: refuerzo en reglas de Firestore, módulo de notificaciones estable.

### 2.7 Analítica social & reporting
- **Historias**: saber dónde se juega más, con cuántas personas diferentes he jugado, horas totales por día.
- **Requisitos**
  - Agregados por sala, duración, jugadores distintos (`playsRelationships`).
  - Panel en organización con rankings (salas, juegos, personas conectadas).
  - Exportes CSV adicionales (badges, disponibilidad histórica).
- **Aceptación**: datos recalculados tras ediciones, filtros por jornada.
- **Dependencias**: pipeline de estadísticas consolidado.

---

## 3. Roadmap tentativo

1. **V1 (post-MVP inmediato)**
   - Perfiles públicos & medios.
   - Ludoteca/jornada avanzada.
   - Meeting point & disponibilidad.
   - Notificaciones básicas (anuncios, organización).

2. **V1.1 (hardening)**
   - Preferencias granulares de notificaciones.
   - Importación CSV con roles + auditoría.
   - Estado de disponibilidad integrado en tablón.

3. **V2 (engagement)**
   - Badges iniciales (filler, salas, personas distintas, horas jugadas).
   - Mesas privadas + invitaciones.
   - Notificaciones por juego y recordatorios de préstamo.

4. **V2.1 (social + reporting)**
   - Mensajería directa con moderación.
   - Analítica social avanzada.
   - Expansión de badges (volumen alto, maratones, hitos especiales).

---

## 4. Métricas de validación
- % usuarios con perfil público y foto aprobada.
- Nº de juegos archivados frente a activos (indicador de salud de ludoteca).
- Usuarios marcados como disponibles que terminan en partida (conversion meeting point → juego).
- Tasa de opt-in a notificaciones push y ratio de clic en avisos.
- Nº de badges otorgados por categoría y retención de usuarios con ≥3 badges.
- % de mesas privadas con invitaciones aceptadas.

---

## 5. Riesgos y mitigaciones
- **Sobrecarga de notificaciones** → segmentación y límites diarios por usuario.
- **Moderación de fotos/DM** → herramientas de reporte, cola para staff, políticas claras.
- **Complejidad de reglas de Firestore** → pruebas automáticas de seguridad y revisiones periódicas.
- **Coste en Firebase** → monitorizar lecturas de agregados/badges, usar caché y colecciones agregadas.

