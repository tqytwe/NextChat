/* eslint-disable @next/next/no-page-custom-font */
import "./styles/globals.scss";
import "./styles/markdown.scss";
import "./styles/highlight.scss";
import { getClientConfig } from "./config/client";
import type { Metadata, Viewport } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { GoogleTagManager, GoogleAnalytics } from "@next/third-parties/google";
import { getServerSideConfig } from "./config/server";

export const metadata: Metadata = {
  title: "JisudengChat",
  description: "JisudengChat Android and Web AI workspace.",
  appleWebApp: {
    title: "JisudengChat",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#151515" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const serverConfig = getServerSideConfig();
  const clientConfig = getClientConfig();
  const isAndroidBuild =
    process.env.BUILD_ANDROID === "1" || process.env.BUILD_ANDROID === "true";
  const basePath = serverConfig.nextChatBasePath;

  return (
    <html lang="en">
      <head>
        <meta name="config" content={JSON.stringify(clientConfig)} />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
        />
        <link
          rel="manifest"
          href={`${basePath}/site.webmanifest`}
          crossOrigin="use-credentials"
        ></link>
        {!isAndroidBuild && (
          <script src={`${basePath}/serviceWorkerRegister.js`} defer></script>
        )}
      </head>
      <body>
        {children}
        {!isAndroidBuild && serverConfig?.isVercel && (
          <>
            <SpeedInsights />
          </>
        )}
        {!isAndroidBuild && serverConfig?.gtmId && (
          <>
            <GoogleTagManager gtmId={serverConfig.gtmId} />
          </>
        )}
        {!isAndroidBuild && serverConfig?.gaId && (
          <>
            <GoogleAnalytics gaId={serverConfig.gaId} />
          </>
        )}
      </body>
    </html>
  );
}
