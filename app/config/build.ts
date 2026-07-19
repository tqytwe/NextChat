import tauriConfig from "../../src-tauri/tauri.conf.json";
import { DEFAULT_INPUT_TEMPLATE } from "../constant";

export const getBuildConfig = () => {
  if (typeof process === "undefined") {
    throw Error(
      "[Server Config] you are importing a nodejs-only module outside of nodejs",
    );
  }

  const buildMode = process.env.BUILD_MODE ?? "standalone";
  const isApp = !!process.env.BUILD_APP;
  const sub2apiManagedMode = ["1", "true", "yes", "on"].includes(
    (process.env.SUB2API_MANAGED_MODE ?? "").toLowerCase(),
  );
  const rawBasePath =
    process.env.NEXTCHAT_BASE_PATH ?? (sub2apiManagedMode ? "/ai" : "");
  const basePath =
    rawBasePath.trim() === "" || rawBasePath.trim() === "/"
      ? ""
      : "/" + rawBasePath.trim().replace(/^\/+|\/+$/g, "");
  const version = "v" + tauriConfig.package.version;

  const commitInfo = (() => {
    try {
      const childProcess = require("child_process");
      const commitDate: string = childProcess
        .execSync('git log -1 --format="%at000" --date=unix')
        .toString()
        .trim();
      const commitHash: string = childProcess
        .execSync('git log --pretty=format:"%H" -n 1')
        .toString()
        .trim();

      return { commitDate, commitHash };
    } catch (e) {
      console.error("[Build Config] No git or not from git repo.");
      return {
        commitDate: "unknown",
        commitHash: "unknown",
      };
    }
  })();

  return {
    version,
    ...commitInfo,
    buildMode,
    isApp,
    basePath,
    sub2apiManagedMode,
    template: process.env.DEFAULT_INPUT_TEMPLATE ?? DEFAULT_INPUT_TEMPLATE,
  };
};

export type BuildConfig = ReturnType<typeof getBuildConfig>;
