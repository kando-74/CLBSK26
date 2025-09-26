# App Congreso Juegos de Mesa – Frontend

Este paquete contiene la base del **frontend PWA** (React + TypeScript + Vite) descrito en el PRD del congreso de juegos de mesa. Incluye la navegación principal, componentes estilados con Tailwind CSS y vistas de ejemplo para los flujos del MVP.

## Características incluidas

- ⚙️ **Arquitectura Vite + React Router** con layout mobile-first y navegación adaptada a escritorio.
- 🎨 **Tokens de diseño** aplicados vía Tailwind (colores, tipografías, sombras, radios) según las especificaciones UX.
- 📱 **Estructura de pantallas** inicial: Home, Ludoteca, Registrar partida, Tablón “Busco mesa” y Perfil/Panel de organización.
- 🧪 Contenido de muestra para ilustrar heurísticas clave (detección de duplicados, filtros guardados, estadísticas del día).

## Requisitos

- Node.js ≥ 18
- npm ≥ 9

Instala las dependencias con:

```bash
npm install
```

## Scripts

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Inicia el servidor de desarrollo en `http://localhost:5173`. |
| `npm run build` | Genera la build de producción en `dist/`. |
| `npm run preview` | Sirve la build generada para verificación manual. |
| `npm run lint` | Ejecuta ESLint sobre el código fuente. |
| `npm run typecheck` | Verifica los tipos con TypeScript (`--noEmit`). |
| `npm run test` | Ejecuta la suite de Vitest en modo batch. |

## Integración continua

La pipeline definida en `../.github/workflows/ci.yml` se ejecuta en cada push a `main` y `dev`, además de los pull requests. Los pasos automatizados replican la verificación local:

- instalación con `npm ci` (husky desactivado),
- `npm run lint`,
- `npm run typecheck`,
- `npm run test -- --run --reporter=dot`.

Para lanzar la misma verificación localmente, ejecuta en el directorio `frontend` los comandos `npm run lint`, `npm run typecheck` y `npm run test`.

## Estructura relevante

```
frontend/
├── src/
│   ├── components/   # Layout y elementos reutilizables
│   ├── pages/        # Vistas principales del MVP
│   ├── utils/        # Utilidades (cálculo del “día del congreso”, etc.)
│   └── index.css     # Tailwind + tokens de diseño
├── tailwind.config.js
└── vite.config.ts
```

## Próximos pasos sugeridos

1. Conectar las vistas con Firestore/Firebase Auth según el plan de ejecución.
2. Sustituir los datos estáticos por servicios reales y React Query.
3. Añadir testing (unitario y E2E) y la configuración PWA (`vite-plugin-pwa`).
4. Crear componentes compartidos adicionales (tablas, formularios multistep) y Storybook.

> Consulta el documento `../MVP-Ejecucion.md` para alinear el desarrollo incremental con las épicas planificadas.
