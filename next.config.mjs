import webpack from "webpack";
import path from "path";

const mode = process.env.BUILD_MODE ?? "standalone";
console.log("[Next] build mode", mode);

const isAndroidBuild =
  process.env.BUILD_ANDROID === "1" || process.env.BUILD_ANDROID === "true";
// Next 14 emits an invalid `<script src="*.css">` when LimitChunkCountPlugin
// collapses an export build. Android can load the normal static asset graph,
// so only retain the legacy single-chunk behavior outside the Android build.
const disableChunk =
  !!process.env.DISABLE_CHUNK || (mode === "export" && !isAndroidBuild);
console.log("[Next] build with chunk: ", !disableChunk);
const sub2apiManagedMode = ["1", "true", "yes", "on"].includes(
  (process.env.SUB2API_MANAGED_MODE ?? "").toLowerCase(),
);
const rawBasePath =
  process.env.NEXTCHAT_BASE_PATH ?? (sub2apiManagedMode ? "/ai" : "");
const basePath =
  rawBasePath.trim() === "" || rawBasePath.trim() === "/"
    ? ""
    : "/" + rawBasePath.trim().replace(/^\/+|\/+$/g, "");
console.log("[Next] base path", basePath || "/");

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    });

    if (disableChunk) {
      config.plugins.push(
        new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 }),
      );
    }

    config.resolve.fallback = {
      child_process: false,
    };

    if (isAndroidBuild) {
      config.resolve.alias = {
        ...(config.resolve.alias ?? {}),
        "@/app/mcp/actions$": path.resolve(
          process.cwd(),
          "app/mcp/actions.android.ts",
        ),
      };
    }

    return config;
  },
  output: mode,
  images: {
    unoptimized: mode === "export",
  },
  experimental: {
    forceSwcTransforms: true,
  },
};

if (basePath) {
  nextConfig.basePath = basePath;
}

const CorsHeaders = [
  { key: "Access-Control-Allow-Credentials", value: "true" },
  { key: "Access-Control-Allow-Origin", value: "*" },
  {
    key: "Access-Control-Allow-Methods",
    value: "*",
  },
  {
    key: "Access-Control-Allow-Headers",
    value: "*",
  },
  {
    key: "Access-Control-Max-Age",
    value: "86400",
  },
];

if (mode !== "export") {
  nextConfig.headers = async () => {
    return [
      {
        source: "/api/:path*",
        headers: CorsHeaders,
      },
    ];
  };

  nextConfig.rewrites = async () => {
    const ret = [
      // adjust for previous version directly using "/api/proxy/" as proxy base route
      // {
      //   source: "/api/proxy/v1/:path*",
      //   destination: "https://api.openai.com/v1/:path*",
      // },
      {
        // https://{resource_name}.openai.azure.com/openai/deployments/{deploy_name}/chat/completions
        source:
          "/api/proxy/azure/:resource_name/deployments/:deploy_name/:path*",
        destination:
          "https://:resource_name.openai.azure.com/openai/deployments/:deploy_name/:path*",
      },
      {
        source: "/api/proxy/google/:path*",
        destination: "https://generativelanguage.googleapis.com/:path*",
      },
      {
        source: "/api/proxy/openai/:path*",
        destination: "https://api.openai.com/:path*",
      },
      {
        source: "/api/proxy/anthropic/:path*",
        destination: "https://api.anthropic.com/:path*",
      },
      {
        source: "/google-fonts/:path*",
        destination: "https://fonts.googleapis.com/:path*",
      },
      {
        source: "/sharegpt",
        destination: "https://sharegpt.com/api/conversations",
      },
      {
        source: "/api/proxy/alibaba/:path*",
        destination: "https://dashscope.aliyuncs.com/api/:path*",
      },
    ];

    return {
      beforeFiles: ret,
    };
  };
}

export default nextConfig;
