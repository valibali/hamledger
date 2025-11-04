# HamLedger Installation Guide / HamLedger Telepítési Útmutató

## English

### System Requirements

- **Operating System**: Windows 10/11 (64-bit) or Linux (Ubuntu 18.04+, or equivalent)
- **RAM**: Minimum 4 GB
- **Storage**: Minimum 500 MB free space
- **Internet Connection**: Required for QRZ.com, DX cluster, and weather data

### Windows Installation

#### 1. Install HamLedger

1. Download the latest Windows version from the [Releases](https://github.com/valibali/hamledger/releases) page
2. Run the `HamLedger_x.x.x_windows_x64.exe` installer
3. Follow the installation wizard instructions
4. Launch HamLedger after installation

#### 2. Install Hamlib (for CAT Control)

If you want to use CAT control functionality (radio control), you need to install Hamlib:

##### 2.1. Download Hamlib

1. Visit the [Hamlib official snapshots page](https://hamlib.sourceforge.net/snapshots/)
2. Download the latest **stable Win64** version (e.g., `hamlib-w64-4.5.5.zip`)
3. Extract the ZIP file to a temporary location

##### 2.2. Install Hamlib

1. Create a folder: `C:\Program Files\Hamlib`
2. Copy all contents from the extracted ZIP to `C:\Program Files\Hamlib`
3. The `rigctld.exe` should be located at: `C:\Program Files\Hamlib\bin\rigctld.exe`

##### 2.3. Add Hamlib to System PATH

1. Press `Win + R`, type `sysdm.cpl`, and press Enter
2. Click on the **Advanced** tab
3. Click **Environment Variables**
4. In the **System Variables** section, find and select **Path**, then click **Edit**
5. Click **New** and add: `C:\Program Files\Hamlib\bin`
6. Click **OK** on all dialogs
7. Restart your computer or log out and back in

##### 2.4. Verify Installation

1. Open Command Prompt (`Win + R`, type `cmd`, press Enter)
2. Type `rigctld --version` and press Enter
3. You should see the Hamlib version information

#### 3. Configure HamLedger

1. Launch HamLedger
2. Go through the Setup Wizard
3. When asked about CAT Control, check "Enable CAT Control"
4. HamLedger will automatically check for and install Hamlib if needed
5. The installation will add Hamlib to your user PATH automatically
6. Enter `rigctld` as the rigctld path (since it will be in your PATH after installation)

**Note**: The automatic Hamlib installation adds the Hamlib bin directory to your user PATH, so no administrator privileges are required.

### Linux Installation

#### 1. Install HamLedger

##### Option A: Download Pre-built Package

1. Download the appropriate package from [Releases](https://github.com/valibali/hamledger/releases):
   - `.deb` for Ubuntu/Debian
   - `.rpm` for Fedora/CentOS/RHEL
   - `.AppImage` for universal Linux

##### Option B: Install .deb Package (Ubuntu/Debian)

```bash
sudo dpkg -i HamLedger_x.x.x_linux_x64.deb
sudo apt-get install -f  # Fix any dependency issues
```

##### Option C: Install .rpm Package (Fedora/CentOS/RHEL)

```bash
sudo rpm -i HamLedger_x.x.x_linux_x64.rpm
```

##### Option D: Run AppImage

```bash
chmod +x HamLedger_x.x.x_linux_x64.AppImage
./HamLedger_x.x.x_linux_x64.AppImage
```

#### 2. Install Hamlib (for CAT Control)

##### Ubuntu/Debian:

```bash
sudo apt update
sudo apt install libhamlib-utils
```

##### Fedora:

```bash
sudo dnf install hamlib
```

##### CentOS/RHEL:

```bash
sudo yum install hamlib
# or for newer versions:
sudo dnf install hamlib
```

##### Arch Linux:

```bash
sudo pacman -S hamlib
```

#### 3. Verify Hamlib Installation

```bash
rigctld --version
```

#### 4. Configure HamLedger

1. Launch HamLedger
2. Go through the Setup Wizard
3. When asked about CAT Control, check "Enable CAT Control"
4. Enter `rigctld` as the rigctld path


### Mac Installation

#### 1. Install HamLedger

1. Download the latest Mac version from the [Releases](https://github.com/valibali/hamledger/releases) page
2. Run the `HamLedger_x.x.x_macos_arm64.dmg` installer (For Apple Silicon) or `HamLedger_x.x.x_macos_x64.dmg` (For Intel)
3. Follow the installation wizard instructions
4. Launch HamLedger after installation

#### 2. Install Hamlib (for CAT Control)

If you want to use CAT control functionality (radio control), you need to install Hamlib. 
The easiest method is installing Brew:

1. Press Command+Space and type Terminal and press enter/return key.
2. Copy and paste the following command in Terminal app:
`/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`
and press enter/return key. Wait for the command to finish. If you are prompted to enter a password, please type your Mac user's login password and press ENTER. Mind you, as you type your password, it won't be visible on your Terminal (for security reasons), but rest assured it will work.
3. Now, copy/paste and run this command to make brew command available inside the Terminal: `echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile`
4. Copy and paste the following command: `brew install hamlib` and press enter/return key. Wait for the command to finish.

#### 3. Verify Hamlib Installation

```bash
rigctld --version
```

#### 4. Configure HamLedger

1. Launch HamLedger
2. Go through the Setup Wizard
3. When asked about CAT Control, check "Enable CAT Control"
4. Enter `rigctld` as the rigctld path


### Troubleshooting

#### Windows

- **"rigctld is not recognized"**: Make sure Hamlib is properly installed and added to PATH
- **Permission errors**: Run Command Prompt as Administrator when testing
- **Antivirus blocking**: Add Hamlib folder to antivirus exceptions

#### Mac and Linux

- **Permission denied for serial ports**: Add your user to the `dialout` group:

  ```bash
  sudo usermod -a -G dialout $USER
  ```

  Then log out and back in.

- **rigctld not found**: Make sure Hamlib is installed using your distribution's package manager or brew in case of Mac.
