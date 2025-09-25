# Sprint Plan – Congreso Juegos de Mesa

## Información general
- **Equipo**: Frontend PWA (React + Vite)
- **Sprint**: S03 – Integración tablón "Busco mesa"
- **Duración propuesta**: 2 semanas (10 días hábiles)
- **Fecha de inicio sugerida**: por definir en la planning
- **Objetivo**: Validar el tablón "Busco mesa" sobre datos persistentes, con pruebas automatizadas y mejoras de accesibilidad/responsive.

## Alcance y entregables
1. Conectar la vista `Tablón` con un backend (mock o Firestore) que permita CRUD de mesas.
2. Persistir inscripciones y altas de mesas con manejo de errores y estados de carga.
3. Implementar suite de pruebas unitarias para flujos críticos del tablón.
4. Mejorar accesibilidad (roles, foco, navegación teclado) y comportamiento responsive en escritorio.
5. Configurar scripts de verificación y pipeline CI (lint, type-check, test) documentados.

## Backlog priorizado
| ID | Ítem | Objetivo | Criterios de aceptación |
| --- | --- | --- | --- |
| TAB-101 | Integración de servicio de mesas | Reemplazar datos estáticos por servicio (mock/Firestore) con lectura inicial, loaders y manejo de errores visibles. | - Servicio expuesto vía hook `useTablesService`.<br>- Estado inicial muestra spinner mientras carga.<br>- Errores muestran banner con opción reintentar.<br>- Datos persisten tras recarga de página. |
| TAB-102 | Inscripciones persistentes | Sincronizar `handleJoin` y `handleCreate` con el servicio para actualizar plazas y estado `joined`. | - Al unirse, la plaza se decrementa remota y localmente.<br>- Reintentos ante conflicto optimista (plaza agotada).<br>- Logs de acción visibles en `actionMessage` tras confirmación remota.<br>- Formulario se resetea solo si la creación se confirma. |
| TAB-103 | Pruebas unitarias | Añadir Vitest + Testing Library para cubrir filtros, alta y mensajes de error. | - Script `npm run test` presente.<br>- Cobertura mínima: filtros aplicados, join con plazas llenas, validación de campos requeridos.<br>- Tests incluidos en CI. |
| TAB-104 | Accesibilidad | Ajustar roles, foco y navegación teclado del tablón. | - Mensajes de acción reciben foco automático ARIA-live.<br>- Botones/toggles accesibles vía teclado.<br>- Etiquetas correctamente asociadas a inputs.<br>- Audit manual con Lighthouse A11y ≥ 90. |
| TAB-105 | Responsive desktop | Mejorar layout multicolumna y estados vacíos. | - Breakpoint ≥ 1024 px muestra tarjetas distribuidas en dos columnas.<br>- Estado vacío sin mesas con mensaje y CTA.<br>- Capturas de pantalla adjuntas en demo. |
| OPS-201 | Pipeline de calidad | Configurar CI (GitHub Actions) con lint, type-check y test. | - Workflow automatizado en `.github/workflows`.<br>- Documentación en README con pasos locales.<br>- Pipeline verde en PR demo. |

## Plan de trabajo (tentativo)
- **Día 1-2**: Kickoff, definir entorno (mock vs Firestore), crear estructura de servicio (TAB-101).
- **Día 3-4**: Implementar sincronización de join/create y estados de carga (TAB-102).
- **Día 5**: Setup Vitest, escribir primeros tests (TAB-103).
- **Día 6**: Ajustes de accesibilidad (TAB-104).
- **Día 7**: Responsive desktop y estados vacíos (TAB-105).
- **Día 8**: Configuración CI y documentación (OPS-201).
- **Día 9**: Buffer para bugs, estabilización, pruebas cruzadas.
- **Día 10**: Sprint review, demo y retro.

## Dependencias y riesgos
- Acceso a credenciales de Firestore. Si no están disponibles, preparar mock API local.
- Sandbox local puede bloquear puertos; prever script alternativo (`npm run dev --host --port`).
- Curva de adopción de Vitest y CI para miembros sin experiencia previa.
- Tiempo adicional para ajustes de diseño si surgen cambios de última hora desde UX.

## Métricas de seguimiento
- % de historias completadas vs comprometidas.
- Estado de pipeline CI (número de ejecuciones verdes/rojas).
- Cobertura mínima lograda en tests del tablón.
- Lighthouse Accessibility score en `/tablon` (target ≥ 90).

## Definition of Done (sprint)
- Todas las historias cumplen criterios de aceptación y pasan tests/lint/type-check.
- Demostración funcional del tablón conectado, con captura o video.
- Checklist de accesibilidad/responsive firmado por QA o par designado.
- Pipeline CI activo y documentado en `README.md`.

## Preparación previa a la planning
- Validar disponibilidad del equipo y ajustar capacidad.
- Decidir entorno de persistencia (mock vs Firestore real) y preparar credenciales si aplica.
- Reunir feedback de usuarios internos del tablón para ajustar prioridades.
- Revisar backlog de bugs abiertos relacionados que puedan entrar en el sprint.
