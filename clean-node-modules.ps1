# Script para limpiar node_modules de forma forzada
# Cierra todos los procesos que puedan estar usando los archivos

Write-Host "Cerrando procesos que puedan estar bloqueando archivos..."

# Cerrar procesos comunes que pueden bloquear archivos
try {
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
    Get-Process -Name "Code" -ErrorAction SilentlyContinue | Stop-Process -Force
    Get-Process -Name "devenv" -ErrorAction SilentlyContinue | Stop-Process -Force
} catch {
    Write-Host "No se pudieron cerrar algunos procesos: $_"
}

# Esperar un momento para que los procesos se cierren
Start-Sleep -Seconds 3

# Intentar eliminar node_modules de forma recursiva
Write-Host "Eliminando node_modules..."

if (Test-Path "frontend\node_modules") {
    try {
        Remove-Item -Path "frontend\node_modules" -Recurse -Force -ErrorAction Stop
        Write-Host "node_modules eliminado exitosamente"
    } catch {
        Write-Host "Error al eliminar node_modules: $_"
        Write-Host "Intentando método alternativo..."
        
        # Método alternativo usando cmd
        cmd /c "rmdir /s /q frontend\node_modules"
    }
} else {
    Write-Host "No se encontró node_modules en frontend"
}

Write-Host "Limpieza completada"