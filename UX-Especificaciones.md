# Especificaciones UX/UI – App Congreso Juegos de Mesa

## 1. Principios de diseño
- **Mobile-first**: toda vista debe diseñarse inicialmente para 360 × 720 px, adaptándose a tablet y escritorio con layouts fluidos.
- **Consistencia visual**: uso de un sistema de diseño basado en Tailwind con tokens definidos (colores, tipografía, espaciado).
- **Jerarquía clara**: prioridad para las acciones principales (CTA prominentes), información secundaria en tarjetas o acordeones.
- **Accesibilidad AA**: contraste mínimo 4.5:1, tamaños de fuente ≥ 16 px en cuerpo, navegación por teclado y roles ARIA.
- **Feedback inmediato**: animaciones microinteracciones ≤150 ms, toasts informativos tras acciones clave, skeletons para cargas.

## 2. Design tokens iniciales
| Token | Valor | Uso |
|-------|-------|-----|
| `color.primary` | `#1C7C54` | Botones primarios, enlaces destacados.
| `color.secondary` | `#FFB400` | Estados de advertencia, badges de evento.
| `color.background` | `#F5F7FA` | Fondo de app y tarjetas.
| `color.surface` | `#FFFFFF` | Tarjetas, modales.
| `color.text.primary` | `#1F2933` | Texto principal.
| `color.text.secondary` | `#52606D` | Texto secundario.
| `color.success` | `#2EA44F` | Confirmaciones.
| `color.error` | `#D03801` | Alertas y errores.
| `radius.sm` | `8px` | Chips, inputs.
| `radius.md` | `16px` | Tarjetas, modales.
| `shadow.card` | `0 8px 16px rgba(15,23,42,0.08)` | Tarjetas elevadas.
| `font.family` | `"Inter", "Roboto", sans-serif` | Tipografía global.
| `font.scale` | `[12, 14, 16, 20, 24, 32]` | Escala tipográfica base.
| `spacing.unit` | `4px` | Base para spacing (multiplicadores ×2, ×3, ×4, ...).

## 3. Arquitectura de navegación
1. **Tab bar inferior (5 tabs)**: Home, Ludoteca, Registrar, Tablón, Perfil.
2. **FAB contextual**: en Home (Registrar partida), en Ludoteca (Añadir juego), en Tablón (Publicar anuncio).
3. **Drawer lateral en escritorio**: muestra las mismas secciones + acceso rápido a panel de organización (si aplica).
4. **Estado sesión**: avatar + badge de rol en esquina superior derecha; indicador online/offline.

## 4. Flujos y pantallas

### 4.1 Onboarding y acceso
- **Pantalla de bienvenida**
  - Logo, texto corto del evento, CTA "Acceder".
  - Link a FAQ/soporte.
- **Login Email/Password**
  - Inputs con validación en vivo.
  - Botón "Continuar" (disabled hasta completar).
  - Mensaje inline si email no está en whitelist.
- **Verificación whitelist**
  - Estado de carga mientras se consulta función callable.
  - Modal error con CTA "Contactar organización".
- **Perfil inicial**
  - Campos alias (required), nombre opcional, selector idioma (ES/EN), toggle consentimiento RGPD.
  - Upload avatar (opcional) con recorte 1:1.
  - CTA "Guardar y entrar".

### 4.2 Home del evento
- **Hero del día**: tarjeta con fecha del día del congreso (según regla 07:00–06:59), resumen de partidas jugadas hoy.
- **Sección acciones rápidas**: botones grandes (Registrar partida, Añadir juego, Publicar anuncio).
- **Panel estadísticas rápidas**
  - Tarjetas mini con: partidas hoy, tiempo total, juegos activos.
  - Indicadores comparativos vs día anterior.
- **Feed reciente**
  - Lista de últimas partidas registradas (avatar de participantes, juego, duración).
  - Chips para filtrar (solo mis partidas, global, anuncios recientes).
- **Avisos de organización**
  - Banner deslizable con mensajes (p. ej., "Cena a las 20:30").

### 4.3 Ludoteca
- **Header**: campo búsqueda (debounce 300 ms), botones filtro (sheet inferior).
- **List/Grid toggle**: vista lista para mobile; vista grid en tablet/escritorio.
- **Item de juego**
  - Imagen portada, título, propietario, nº copias, idiomas, chips de jugadores/duración.
  - Estado manual (badge) si no hay BGG.
  - Icono para marcar favorito.
- **Detalle de juego**
  - Tabs: Información, Copias disponibles, Partidas recientes.
  - CTA "Registrar partida" preseleccionando juego.
- **Filtros sheet**
  - Secciones: Propietario (multi-select), Nº jugadores (slider 1–10+), Duración (chips 15,30,45,60,90,120+), Idioma, Peso BGG (rangos).
  - Botón "Guardar filtro" (persistencia en Firestore por usuario).
- **FAB Añadir juego**
  - Modal en pasos:
    1. Buscar (campo + lista resultados BGG + estado cargando/sin resultados).
    2. Seleccionar + revisar metadatos.
    3. Completar campos propios (copias, idioma, notas).
    4. Confirmación con resumen y CTA "Ver en ludoteca".

### 4.4 Registro de partida
- **Acceso**: Tab central "Registrar" o CTA directos.
- **Wizard de 4 pasos** (barra progreso 25% increments):
  1. **Juego**: selector de la ludoteca, opción "Añadir manual" (nombre + propietario auto = usuario).
  2. **Jugadores**: chips con avatar + alias, búsqueda incremental sobre asistentes; mostrar número actual/ máximo recomendado del juego.
  3. **Detalles**: pickers hora inicio (wheel mobile), duración (chips 15–180), sala (dropdown), notas.
  4. **Resultado**: selector ganador único/múltiple, toggle "Empate", ordenamiento podio arrastrable.
- **Detección duplicado**
  - Tras confirmar, modal comparando con partida sospechosa (datos clave).
  - Botones: "Ver partida" (abre en overlay), "Registrar de todos modos" (marca `forced`).
- **Feedback**
  - Toast de éxito + opción compartir (copiar link) y CTA "Registrar otra".

### 4.5 Tablón "Busco mesa"
- **Listado**
  - Cards con juego (portada), plazas libres, hora estimada, sala, propietario.
  - Chip estado (Abierta, Completa, En juego).
  - Botón "Apuntarme" con confirmación y contador plazas.
- **Detalle anuncio**
  - Lista de inscritos (avatar + alias).
  - Botón "Abrir chat" (navega a canal asociado).
  - Acción rápida "Convertir en partida" (rol organización/creador).
- **Publicar anuncio**
  - Form similar al registro de partida pero sin resultado ni duración obligatoria.
  - Campo descripción libre + preferencia nivel experiencia.

### 4.6 Estadísticas
- **Tabs superiores**: Global / Mi perfil.
- **Selector de rango**: chips (Hoy, Ayer, Todo congreso) + date picker avanzado (desktop).
- **Panel global**
  - Gráfico barras partidas por franja horaria.
  - Top 5 juegos más jugados (lista con mini sparkline).
  - Tarjetas métricas (partidas totales, jugadores únicos, duración media).
- **Panel individual**
  - Tarjetas: partidas jugadas, tiempo total, ratio victorias.
  - Sección compañeros frecuentes (chips con avatar + nº partidas compartidas).
  - Gráfico línea evolución diaria.
- **Accesibilidad**
  - Descripciones textuales de gráficos para lectores de pantalla.
  - Botón "Descargar CSV" (organización) visible solo con rol.

### 4.7 Chat y notificaciones
- **Lista de chats**: orden cronológico, preview último mensaje, badges de no leídos.
- **Vista chat**
  - Burbujas con alias + hora, diferenciación por color.
  - Quick replies (chips) en parte inferior.
  - Input con soporte de adjuntos (imágenes ≤2 MB).
- **Notificaciones push**
  - Modal onboarding para solicitar permiso (solo tras explicar beneficios).
  - Centro de notificaciones interno con historial (por si se deniega permiso).

### 4.8 Perfil y configuración
- **Datos usuario**
  - Avatar editable, alias, email (solo lectura), idioma preferido.
  - Switch "Mostrarme disponible" para tablón.
- **Preferencias**
  - Notificaciones (toggle chat, partidas, anuncios).
  - Idioma interfaz, tema (claro/oscuro auto).
- **Legal y soporte**
  - Enlaces a privacidad, contacto, cerrar sesión.
- **Panel organización (si rol)**
  - Sub-sección con tabs: Asistentes, Whitelist, Duplicados, Exportaciones.
  - Tabla responsiva con filtros.

## 5. Estados y componentes clave
- **Skeletons**: tarjetas de ludoteca y partidas con placeholders animados.
- **Empty states**
  - Ludoteca vacía → ilustración + CTA "Añade tu primer juego".
  - Estadísticas sin datos → mensaje "Registra tu primera partida".
  - Chat sin mensajes → texto introductorio.
- **Errores**
  - Banner persistente en top para fallos de red con opción "Reintentar".
  - Mensajes inline en formularios con icono y color `color.error`.
- **Offline**
  - Badge en toolbar "Modo offline" cuando no hay conexión.
  - Formularios muestran info "Tus datos se sincronizarán cuando recuperes conexión".

## 6. Adaptaciones responsive
- **Tablet (≥768px)**
  - Tab bar pasa a lateral (rail) con icono + etiqueta.
  - Home muestra dos columnas (estadísticas + feed).
  - Ludoteca en grid 2–3 columnas.
- **Escritorio (≥1024px)**
  - Layout 12 columnas, contenedores máx. 1200px.
  - Secciones con tablas más densas, filtros visibles en sidebar.
  - Registro de partida muestra wizard en modal centrado (steps a la izquierda, formulario a la derecha).

## 7. Microcopys clave
- Botón añadir juego: "Añadir a la ludoteca".
- Confirmación partida: "¡Partida registrada!".
- Alerta duplicado: "Creemos que esta partida ya fue registrada hace X min".
- Empty tablón: "Aún no hay mesas abiertas. ¿Quieres crear la primera?".
- Error whitelist: "Tu correo no está autorizado para este evento. Contacta con la organización.".

## 8. Métricas UX a monitorizar
- Tasa de conversión onboarding (usuarios que completan alias vs que abandonan).
- Tiempo medio para registrar una partida.
- % de anuncios que se convierten en partidas en < 2h.
- Ratio de detecciones de duplicado aceptadas vs forzadas.
- NPS / satisfacción tras el evento (encuesta in-app).

## 9. Entregables adicionales
- Wireframes low-fidelity en Figma (no incluidos aquí) siguiendo especificaciones.
- Biblioteca de componentes en Storybook (ligada a tokens definidos).
- Guía de contenidos (tono cercano, inclusivo, entusiasta).
