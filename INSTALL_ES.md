# Guía de Instalación de HamLedger

## Requisitos del Sistema

- **Sistema Operativo**: Windows 10/11 (64-bit), Linux (Ubuntu 18.04+, o equivalente) o macOS.
- **RAM**: Mínimo 4 GB.
- **Almacenamiento**: Mínimo 500 MB de espacio libre.
- **Conexión a Internet**: Necesaria para QRZ.com, clúster DX y datos meteorológicos.

---

## Instalación en Windows

### 1. Instalar HamLedger
1. Descarga la última versión para Windows desde la página de [Lanzamientos (Releases)](https://github.com/valibali/hamledger/releases).
2. Ejecuta el instalador `HamLedger_x.x.x_windows_x64.exe`.
3. Sigue las instrucciones del asistente de instalación.
4. Inicia HamLedger después de la instalación.

### 2. Instalar Hamlib (para Control CAT)
Si deseas controlar tu radio desde el programa, necesitas instalar Hamlib:

#### 2.1 Descarga
1. Visita la [página oficial de Hamlib](https://hamlib.sourceforge.net/snapshots/).
2. Descarga la versión **estable Win64** más reciente (ej. `hamlib-w64-4.5.5.zip`).
3. Extrae el archivo ZIP en una ubicación temporal.

#### 2.2 Instalación
1. Crea una carpeta en: `C:\Program Files\Hamlib`.
2. Copia todo el contenido del ZIP extraído a esa carpeta.
3. El archivo `rigctld.exe` debería quedar en: `C:\Program Files\Hamlib\bin\rigctld.exe`.

#### 2.3 Configurar el PATH del sistema
1. Presiona `Win + R`, escribe `sysdm.cpl` y pulsa Enter.
2. Ve a la pestaña **Opciones avanzadas**.
3. Haz clic en **Variables de entorno**.
4. En **Variables del sistema**, busca **Path**, selecciónalo y haz clic en **Editar**.
5. Haz clic en **Nuevo** y añade: `C:\Program Files\Hamlib\bin`.
6. Haz clic en **Aceptar** en todas las ventanas.
7. Reinicia tu computadora.

#### 2.4 Verificar
1. Abre el Símbolo del sistema (`cmd`).
2. Escribe `rigctld --version` y pulsa Enter. Deberías ver la información de la versión.

---

## Instalación en Linux

### 1. Instalar HamLedger
Descarga el paquete adecuado según tu distribución:
- `.deb` para Ubuntu/Debian.
- `.rpm` para Fedora/CentOS.
- `.AppImage` para cualquier distribución.

#### Ejemplo para Ubuntu/Debian:
```bash
sudo dpkg -i HamLedger_x.x.x_linux_x64.deb
sudo apt-get install -f  # Para corregir dependencias
```

### 2. Instalar Hamlib
- **Ubuntu/Debian**: `sudo apt install libhamlib-utils`
- **Fedora**: `sudo dnf install hamlib`
- **Arch Linux**: `sudo pacman -S hamlib`

---

## Instalación en macOS

### 1. Instalar HamLedger
1. Descarga el archivo `.dmg` desde [Releases](https://github.com/valibali/hamledger/releases).
   - Usa `arm64` para Apple Silicon (M1/M2/M3).
   - Usa `x64` para procesadores Intel.
2. Abre el DMG y arrastra HamLedger a tu carpeta de Aplicaciones.

### 2. Instalar Hamlib (vía Homebrew)
1. Abre la **Terminal**.
2. Instala Homebrew si no lo tienes:
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
3. Instala Hamlib:
   ```bash
   brew install hamlib
   ```

---

## Configuración Final

1. Inicia HamLedger.
2. Completa el **Asistente de Configuración (Setup Wizard)**.
3. En la sección de Control CAT, marca "Enable CAT Control".
4. Asegúrate de que la ruta del ejecutable sea `rigctld`.

## Solución de Problemas

- **Permisos en Linux/Mac**: Si no puedes acceder al puerto serie de la radio, añade tu usuario al grupo `dialout`:
  ```bash
  sudo usermod -a -G dialout $USER
  ```
  Luego cierra sesión y vuelve a entrar.
- **Antivirus en Windows**: Si `rigctld` falla, asegúrate de añadir la carpeta de Hamlib a las exclusiones de tu antivirus.
