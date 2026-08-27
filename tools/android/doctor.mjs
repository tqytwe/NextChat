import { execFileSync } from "child_process";
import { existsSync, readFileSync, statSync, statfsSync } from "fs";
import path from "path";

const root = process.cwd();
const manifestPath = path.join(root, "tools/android/toolchain-manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const requireSecrets = process.argv.includes("--require-release-secrets");
const channelArg = process.argv.find((arg) => arg.startsWith("--channel="));
const channel = channelArg ? channelArg.slice("--channel=".length) : "direct";
const checks = [];

function fail(message) {
  throw new Error(message);
}

function check(label, predicate, detail) {
  if (!predicate) fail(`${label}: ${detail}`);
  checks.push(`${label}: ok`);
}

function command(command, args) {
  return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function env(name) {
  const value = String(process.env[name] || "").trim();
  check(`environment ${name}`, Boolean(value), "is missing; use scripts/android-with-toolchain.sh");
  return value;
}

function avdForChannel(value) {
  if (value === "direct") return manifest.avds.directRelease;
  if (value === "direct-e2e") return manifest.avds.directE2E;
  if (value === "play") return manifest.avds.play;
  fail(`Unknown Android channel: ${value}`);
}

try {
  check("repository", existsSync(path.join(root, ".git")), "run this from jisudeng-app-domestic");
  check("build user", command("id", ["-un"]) === manifest.buildUser, `must be ${manifest.buildUser}`);
  check("host", command("hostnamectl", ["--static"]) === manifest.host, `must be ${manifest.host}`);

  const androidHome = env("ANDROID_HOME");
  const androidSdkRoot = env("ANDROID_SDK_ROOT");
  const avdHome = env("ANDROID_AVD_HOME");
  const gradleHome = env("GRADLE_USER_HOME");
  const javaHome = env("JAVA_HOME");
  const maestro = env("JISUDENG_MAESTRO_BIN");
  const playwrightHome = env("PLAYWRIGHT_BROWSERS_PATH");
  const secrets = env("JISUDENG_ANDROID_SECRETS_DIR");

  check("SDK root", androidHome === manifest.sdkRoot && androidSdkRoot === manifest.sdkRoot, `must be ${manifest.sdkRoot}`);
  check("AVD root", avdHome === manifest.avdRoot, `must be ${manifest.avdRoot}`);
  check("Gradle home", gradleHome === manifest.gradleUserHome, `must be ${manifest.gradleUserHome}`);
  check("Java home", existsSync(javaHome), `${javaHome} is missing`);
  check("SDK adb", existsSync(path.join(androidHome, "platform-tools/adb")), "adb is missing");
  check("SDK emulator", existsSync(path.join(androidHome, "emulator/emulator")), "emulator is missing");
  check("SDK avdmanager", existsSync(path.join(androidHome, "cmdline-tools/latest/bin/avdmanager")), "avdmanager is missing");
  check("system image", existsSync(path.join(androidHome, "system-images/android-35/google_apis/x86_64/package.xml")), "API 35 Google APIs x86_64 image is missing");
  check("Maestro", existsSync(maestro), `${maestro} is missing`);
  check("Playwright no-download policy", process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD === "1", "must be 1");
  check("Playwright cache", existsSync(path.join(playwrightHome, `chromium-${manifest.playwrightChromiumRevision}`, "INSTALLATION_COMPLETE")), `chromium-${manifest.playwrightChromiumRevision} is missing; run the explicit toolchain provision workflow`);

  const nodeVersion = command("node", ["--version"]).replace(/^v/, "");
  check("Node", nodeVersion === manifest.nodeVersion, `expected ${manifest.nodeVersion}, got ${nodeVersion}`);
  const javaVersion = execFileSync("bash", ["-lc", "java -version 2>&1"], {
    encoding: "utf8",
  }).match(/version "(\d+)/)?.[1];
  check("Java", Number(javaVersion) === manifest.javaMajor, `expected Java ${manifest.javaMajor}`);
  const emulatorVersion = command(path.join(androidHome, "emulator/emulator"), ["-version"]).match(/version ([0-9.]+)/)?.[1];
  check("Android emulator", emulatorVersion === manifest.emulatorVersion, `expected ${manifest.emulatorVersion}, got ${emulatorVersion || "unknown"}`);
  const adbVersion = command(path.join(androidHome, "platform-tools/adb"), ["version"]).match(/Version ([0-9.]+)/)?.[1];
  check("Android platform tools", adbVersion === manifest.platformToolsVersion, `expected ${manifest.platformToolsVersion}, got ${adbVersion || "unknown"}`);

  const selected = avdForChannel(channel);
  const avdIni = path.join(avdHome, `${selected.name}.ini`);
  const avdConfig = path.join(avdHome, `${selected.name}.avd/config.ini`);
  check("AVD registration", existsSync(avdIni), `${selected.name} is not registered`);
  check("AVD config", existsSync(avdConfig), `${selected.name} config is missing`);
  const configText = readFileSync(avdConfig, "utf8");
  const expectedImage = channel === "play"
    ? "image.sysdir.1=system-images/android-35/google_apis_playstore/x86_64"
    : "image.sysdir.1=system-images/android-35/google_apis/x86_64";
  check("AVD image", configText.includes(expectedImage), `${selected.name} has an unexpected system image`);
  check("AVD device", configText.includes("hw.device.name=pixel_7"), `${selected.name} must use pixel_7`);
  check("AVD data partition", configText.includes("disk.dataPartition.size=10G"), `${selected.name} must have a 10G data partition`);

  const freeBytes = Number(statfsSync(root).bavail) * Number(statfsSync(root).bsize);
  check("free disk", freeBytes >= manifest.minimumFreeBytes, `need at least ${manifest.minimumFreeBytes} free bytes`);

  if (requireSecrets) {
    check("secrets directory", existsSync(secrets), `${secrets} is missing`);
    check("secrets directory mode", (statSync(secrets).mode & 0o077) === 0, `${secrets} must not be group/world accessible`);
    check("release keystore", existsSync(path.join(secrets, "nextchat-release.jks")), "release keystore is missing");
    check("keystore properties", existsSync(path.join(secrets, "keystore.properties")), "keystore properties are missing");
    check("Direct Firebase config", existsSync(path.join(secrets, "direct-google-services.json")), "Direct Firebase config is missing");
    if (channel === "play") check("Play Firebase config", existsSync(path.join(secrets, "play-google-services.json")), "Play Firebase config is missing");
  }

  console.log(`Jisudeng Android toolchain doctor passed for ${channel}.`);
  for (const item of checks) console.log(`- ${item}`);
} catch (error) {
  console.error(`Jisudeng Android toolchain doctor failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
