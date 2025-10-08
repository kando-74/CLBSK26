param(
  [string]$ProjectId = "clbsk26"
)

$ErrorActionPreference = "Stop"

Write-Host "1) Ir a la raiz del repo"
Set-Location "C:\github\CLBSK26"

# Asegura firebase.json minimo
if (-not (Test-Path .\firebase.json)) {
  Write-Host "Creando firebase.json"
  @'
{
  "hosting": {
    "public": "frontend/dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  }
}
'@ | Set-Content -Encoding UTF8 .\firebase.json
}

# Asegura .firebaserc
if (-not (Test-Path .\.firebaserc)) {
  Write-Host "Creando .firebaserc"
  @"
{
  "projects": { "default": "$ProjectId" }
}
"@ | Set-Content -Encoding UTF8 .\.firebaserc
}

# Ignora node_modules en git (idempotente)
if (-not (Test-Path .\.gitignore) -or -not (Select-String -Path .\.gitignore -Pattern 'frontend/node_modules/' -Quiet)) {
  Write-Host "Asegurando .gitignore para node_modules"
  Add-Content .\.gitignore "frontend/node_modules/"
}

# 2) Cambiar a dev y sincronizar
Write-Host "2) Cambiar a rama dev"
git fetch origin
try {
  git switch dev | Out-Null
} catch {
  git switch -c dev origin/dev | Out-Null
}
git reset --hard origin/dev

# 3) Parche rapido de tipos (si existe Home.tsx)
$homePath = "frontend\src\pages\Home.tsx"
if (Test-Path $homePath) {
  Write-Host 'Parche: size="xs" -> "sm" en Home.tsx (idempotente)'
  (Get-Content $homePath) -replace 'size="xs"','size="sm"' | Set-Content $homePath
}


# 4) Separar config de Vitest (si hace falta)
$viteCfg = "frontend\vite.config.ts"
$vitestCfg = "frontend\vitest.config.ts"
if (Test-Path $viteCfg) {
  $viteContent = Get-Content $viteCfg -Raw
  if ($viteContent -match "vitest") {
    Write-Host "Moviendo configuracion de Vitest a vitest.config.ts"
    @'
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { environment: "jsdom", globals: true }
});
'@ | Set-Content $vitestCfg
    # Dejar Vite limpio
    @'
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({ plugins: [react()] });
'@ | Set-Content $viteCfg
  }
}

# 5) Build (manejado por firebase.json predeploy)

# 6) Contar ficheros generados
$files = (Get-ChildItem -Recurse .\frontend\dist -File | Measure-Object).Count
Write-Host ("Ficheros en dist: {0}" -f $files)

# 7) Deploy
Write-Host "4) Deploy a Firebase Hosting ($ProjectId)"
npx firebase-tools deploy --only hosting --project $ProjectId

Write-Host "Listo. Revisa: https://$ProjectId.web.app"
