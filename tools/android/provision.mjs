import { execFileSync } from "child_process";
import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";

if (!process.argv.includes("--confirm-provision")) {
  console.error("Refusing to modify the Dell Android toolchain. Re-run with --confirm-provision after explicit approval.");
  process.exit(1);
}

const root = process.cwd();
const manifest = JSON.parse(readFileSync(path.join(root, "tools/android/toolchain-manifest.json"), "utf8"));
const sdkRoot = process.env.ANDROID_SDK_ROOT;
const avdHome = process.env.ANDROID_AVD_HOME;
if (sdkRoot !== manifest.sdkRoot || avdHome !== manifest.avdRoot) {
  throw new Error("Provisioning requires the fixed Dell SDK and AVD roots from scripts/android-toolchain-env.sh.");
}

const avdmanager = path.join(sdkRoot, "cmdline-tools/latest/bin/avdmanager");
const sdkmanager = path.join(sdkRoot, "cmdline-tools/latest/bin/sdkmanager");
const image = manifest.systemImage;

const managedSdkPackages = [manifest.compileSdkPlatform, `build-tools;${manifest.buildToolsVersion}`];
const packagePath = (sdkPackage) => {
  if (sdkPackage.startsWith("platforms;android-")) {
    return path.join(sdkRoot, "platforms", sdkPackage.slice("platforms;".length), "android.jar");
  }
  if (sdkPackage.startsWith("build-tools;")) {
    return path.join(sdkRoot, "build-tools", sdkPackage.slice("build-tools;".length), "aapt2");
  }
  throw new Error(`Unsupported managed SDK package: ${sdkPackage}`);
};

const missingSdkPackages = managedSdkPackages.filter((sdkPackage) => !existsSync(packagePath(sdkPackage)));
if (missingSdkPackages.length > 0) {
  if (!existsSync(sdkmanager)) throw new Error(`Missing sdkmanager: ${sdkmanager}`);
  console.log(`Installing missing fixed SDK packages: ${missingSdkPackages.join(", ")}`);
  execFileSync(sdkmanager, ["--install", ...missingSdkPackages], { stdio: "inherit" });
  for (const sdkPackage of missingSdkPackages) {
    if (!existsSync(packagePath(sdkPackage))) throw new Error(`SDK package installation did not produce ${sdkPackage}`);
  }
} else {
  console.log("Fixed SDK compile and build-tools packages are already present.");
}

for (const key of ["directRelease", "directE2E"]) {
  const avd = manifest.avds[key];
  const iniPath = path.join(avdHome, `${avd.name}.ini`);
  if (!existsSync(iniPath)) {
    execFileSync(avdmanager, ["create", "avd", "--force", "--name", avd.name, "--package", image, "--device", avd.device], {
      input: "no\n",
      stdio: ["pipe", "inherit", "inherit"],
    });
  }
  const configPath = path.join(avdHome, `${avd.name}.avd/config.ini`);
  const lines = readFileSync(configPath, "utf8").split("\n").filter(Boolean);
  const required = {
    "disk.dataPartition.size": "10G",
    "hw.device.name": avd.device,
    "hw.ramSize": "4096",
    "PlayStore.enabled": "no",
  };
  const updated = new Map(lines.map((line) => {
    const separator = line.indexOf("=");
    return separator >= 0 ? [line.slice(0, separator), line.slice(separator + 1)] : [line, ""];
  }));
  for (const [name, value] of Object.entries(required)) updated.set(name, value);
  writeFileSync(configPath, `${[...updated.entries()].map(([name, value]) => `${name}=${value}`).join("\n")}\n`, { mode: 0o600 });
  console.log(`Provisioned ${avd.name} from ${image}.`);
}

console.log("Provisioning completed. Browser revisions were not downloaded or modified.");
