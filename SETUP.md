# Zpevniq – Development Environment Setup Guide

Complete instructions for setting up and running **Zpevniq** on **Ubuntu / Debian** and **macOS** for Web/PC, Android (CLI-only or Android Studio), and iOS (macOS only).

---

## 1. Quick Start (Web / PC Only)

For 90% of day-to-day development (UI, ChordPro engine, unit tests, IndexedDB), you only need **Git** and **Node.js**.

### Install Node.js (v20+ LTS recommended via `nvm`)

**Ubuntu & macOS:**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc   # or: source ~/.zshrc on macOS

nvm install --lts
nvm use --lts
node -v && npm -v
```

### Clone, Install, and Verify

```bash
git clone <YOUR_REPO_URL> Zpevniq
cd Zpevniq
npm install

# Verify everything builds and passes tests
npm run typecheck && npm run test && npm run build

# Start local Web dev server
npm run dev
```

---

## 2. Android Setup (Ubuntu & macOS)

Capacitor 8 in this repository targets **Android SDK 36 (`compileSdkVersion = 36`)**, which requires **JDK 21**. You do **not** need to run Android Studio daily—you can build, launch the emulator, and deploy straight from the terminal.

### Step 2.1: Install JDK 21

#### Ubuntu / Debian
```bash
sudo apt update
sudo apt install -y openjdk-21-jdk
java -version
```

Find your exact `JAVA_HOME` path (usually `/usr/lib/jvm/java-21-openjdk-amd64` on x86_64):
```bash
dirname $(dirname $(readlink -f $(which java)))
```

#### macOS (Homebrew)
```bash
brew install openjdk@21
sudo ln -sfn "$(brew --prefix openjdk@21)/libexec/openjdk.jdk" /Library/Java/JavaVirtualMachines/openjdk-21.jdk
java -version
```

`JAVA_HOME` on macOS can be resolved dynamically via `/usr/libexec/java_home -v 21`.

---

### Step 2.2: Install Android SDK

Choose **either** the lightweight CLI-only setup (no IDE) **or** Android Studio.

#### Option A: Lightweight CLI-Only Setup (Recommended if you don't want another IDE)

1. **Install prerequisites (Ubuntu only):**
   ```bash
   sudo apt install -y unzip wget libgl1-mesa-dev
   ```

2. **Download Android Command-Line Tools** from [developer.android.com/studio#command-line-tools-only](https://developer.android.com/studio#command-line-tools-only) (Linux or macOS zip), then unpack into the standard SDK directory:

   **Ubuntu:**
   ```bash
   export ANDROID_HOME="$HOME/Android/Sdk"
   mkdir -p "$ANDROID_HOME/cmdline-tools"
   unzip commandlinetools-linux-*_latest.zip -d /tmp/cmdline-tools-tmp
   mv /tmp/cmdline-tools-tmp/cmdline-tools "$ANDROID_HOME/cmdline-tools/latest"
   rm -rf /tmp/cmdline-tools-tmp
   ```

   **macOS:**
   ```bash
   export ANDROID_HOME="$HOME/Library/Android/sdk"
   mkdir -p "$ANDROID_HOME/cmdline-tools"
   unzip commandlinetools-mac-*_latest.zip -d /tmp/cmdline-tools-tmp
   mv /tmp/cmdline-tools-tmp/cmdline-tools "$ANDROID_HOME/cmdline-tools/latest"
   rm -rf /tmp/cmdline-tools-tmp
   ```

3. **Install SDK packages (Android 36, platform-tools, build-tools, emulator):**
   ```bash
   export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

   yes | sdkmanager --licenses
   sdkmanager \
     "platform-tools" \
     "platforms;android-36" \
     "build-tools;36.0.0" \
     "emulator"
   ```

4. **(Optional) Install an emulator system image & create an AVD:**
   - **Ubuntu / Intel Mac (`x86_64`):**
     ```bash
     sdkmanager "system-images;android-36;google_apis;x86_64"
     avdmanager create avd -n Zpevniq_API_36 -k "system-images;android-36;google_apis;x86_64" -d pixel_7
     ```
   - **Apple Silicon Mac (`arm64-v8a`):**
     ```bash
     sdkmanager "system-images;android-36;google_apis;arm64-v8a"
     avdmanager create avd -n Zpevniq_API_36 -k "system-images;android-36;google_apis;arm64-v8a" -d pixel_7
     ```

5. **Enable KVM hardware acceleration (Ubuntu only, required for fast emulator):**
   ```bash
   sudo apt install -y qemu-kvm
   sudo usermod -aG kvm "$USER"
   # Log out and log back in (or reboot), then verify:
   ls -l /dev/kvm
   ```

#### Option B: Android Studio (GUI)

1. Install Android Studio ([developer.android.com/studio](https://developer.android.com/studio)).
2. Open **Settings → Languages & Frameworks → Android SDK** and install:
   - **Android 16 / API 36** (`platforms;android-36`)
   - **Android SDK Build-Tools** (`36.x`)
   - **Android SDK Platform-Tools** & **Android Emulator**
3. (Optional) Create an emulator in **Device Manager**.

> Android Studio bundles its own JDK, so building inside Android Studio works even without a system JDK—however, installing JDK 21 (Step 2.1) is still needed if you want to run `npx cap run android` from the terminal.

---

### Step 2.3: Configure Environment Variables

#### Ubuntu (`~/.bashrc`)
Append the following lines to `~/.bashrc` and run `source ~/.bashrc`:
```bash
export JAVA_HOME="/usr/lib/jvm/java-21-openjdk-amd64"
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
```

#### macOS (`~/.zshrc`)
Append the following lines to `~/.zshrc` and run `source ~/.zshrc`:
```bash
export JAVA_HOME="$(/usr/libexec/java_home -v 21)"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
```

Verify everything is visible in your shell:
```bash
java -version
adb version
emulator -list-avds
```

---

### Step 2.4: Build & Run on Android

#### Run on Emulator (CLI)
```bash
# 1. List available emulators and boot one in the background
emulator -list-avds
emulator -avd <AVD_NAME> &

# 2. Wait until the device appears as "device"
adb devices

# 3. Build web bundle, sync Capacitor plugins, install & launch APK
npm run cap:sync
npx cap run android
```

#### Run on a Physical Android Phone (USB)
1. On your phone: **Settings → About phone** → tap **Build number** 7 times to unlock Developer Options.
2. Go to **Settings → System → Developer options** → enable **USB debugging**.
3. Connect via USB, accept the RSA fingerprint prompt on the phone, and verify:
   ```bash
   adb devices
   ```
4. Build and run:
   ```bash
   npm run cap:sync && npx cap run android
   ```

#### Fast Live-Reload Development (Phone or Emulator on Same Wi-Fi)
```bash
# Terminal 1 – expose Vite dev server on your LAN
npm run dev -- --host

# Terminal 2 – launch Android app pointing at Vite dev server
npx cap run android --livereload --external
```
> Always run a normal `npm run cap:sync` (without `--livereload`) before building a standalone/offline APK.

#### Open in Android Studio (Optional)
```bash
npm run cap:sync
npx cap open android
```

#### Inspecting the Android WebView
Open **Google Chrome** on your PC/Mac and navigate to:
```text
chrome://inspect/#devices
```
Click **inspect** under Zpevniq to get full DevTools (Console, Network, Elements, IndexedDB/Storage) for the live Android WebView.

---

## 3. iOS Setup (macOS Only)

Building and running iOS apps requires **macOS** and **Xcode**.

### Prerequisites
1. Install **Xcode** from the Mac App Store, then launch it once to accept the license agreement.
2. Install Xcode Command Line Tools:
   ```bash
   xcode-select --install
   ```
3. Install **CocoaPods** (if using CocoaPods dependency management):
   ```bash
   brew install cocoapods
   ```

### Add the iOS Platform & Run
```bash
# One-time setup (if the ios/ folder does not exist yet)
npm install -D @capacitor/ios
npx cap add ios

# Build web bundle, sync native plugins, and launch on Simulator or iPhone
npm run cap:sync
npx cap run ios
```

To configure signing (Team / Apple ID) for a physical iPhone, open the project in Xcode:
```bash
npx cap open ios
```
Select **App → Signing & Capabilities** and choose your Development Team.

#### Inspecting the iOS WebView
In **Safari** on macOS, enable **Settings → Advanced → Show features for web developers**, then use **Develop → `<Simulator / iPhone>` → Zpevniq**.

---

## 4. Daily Development & Verification Checklist

Before committing or finishing any change (per [AGENTS.md](./AGENTS.md)):

```bash
npm run typecheck   # Zero TypeScript errors (strict mode)
npm run test        # All Vitest unit & contract tests pass
npm run build       # Clean production Web/Capacitor build
```

When you change native plugins or want to test on mobile:
```bash
npm run cap:sync
```

---

## 5. Troubleshooting

| Issue | Fix |
| :--- | :--- |
| `java: command not found` or Gradle complains about Java version | Install **JDK 21** (Step 2.1) and verify `java -version` prints `21.x`. |
| `SDK location not found` during Gradle build | Ensure `ANDROID_HOME` is exported in your shell, or create `android/local.properties` with `sdk.dir=/absolute/path/to/Android/Sdk` (this file is gitignored). |
| Emulator refuses to start on Ubuntu (`/dev/kvm permission denied`) | Run `sudo usermod -aG kvm "$USER"`, then **log out and back in**. |
| `adb devices` shows `unauthorized` | Unlock the phone screen and accept the *"Allow USB debugging?"* dialog, or run `adb kill-server && adb start-server`. |
| `adb devices` is empty on Ubuntu with USB phone | Try a data-capable USB cable, switch USB mode to **File Transfer (MTP)**, and ensure your user is in `plugdev` (`sudo usermod -aG plugdev "$USER"`). |
| `--livereload` cannot connect from a physical phone | Confirm PC and phone are on the same Wi-Fi network and allow TCP port `5173` through your firewall (e.g., `sudo ufw allow 5173/tcp` on Ubuntu). |
