import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "@jest/globals";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("mobile performance and UI boundaries", () => {
  const home = source("app/components/home.tsx");
  const mobileApp = source("app/components/mobile-app.tsx");
  const mobileImage = source("app/client/mobile-image.ts");
  const inviteGrowth = source("app/client/invite-growth.ts");
  const styles = source("app/components/mobile-app.module.scss");

  test("loads the Android workspace and rare media codecs on demand", () => {
    expect(home).not.toContain(
      'import { AndroidManagedGate } from "./mobile-app"',
    );
    expect(home).toContain('await import("./mobile-app")');
    expect(mobileApp).toContain('from "../client/mobile-image"');
    expect(mobileApp).not.toContain('from "../utils/chat"');
    expect(mobileImage).toContain('await import("heic2any")');
    expect(mobileImage).not.toContain('require("heic2any")');
    expect(mobileImage.match(/reader\.readAsDataURL\(source\)/g)).toHaveLength(
      1,
    );
    expect(inviteGrowth).not.toContain('import QRCode from "qrcode"');
    expect(inviteGrowth).toContain('await import("qrcode")');
  });

  test("keeps mobile icons theme-safe and the navigation attached to the edge", () => {
    expect(styles).toMatch(
      /\.mobile-app svg\s*\{\s*filter: none !important;/,
    );
    const bottomTabs = styles.slice(
      styles.lastIndexOf(".bottom-tabs {"),
      styles.indexOf(".bottom-tab {", styles.lastIndexOf(".bottom-tabs {")),
    );
    expect(bottomTabs).toContain("bottom: 0;");
    expect(bottomTabs).toContain("border-radius: 0;");
    expect(bottomTabs).not.toContain("right: 12px;");
  });

  test("keeps two-column video controls shrinkable and stacks them on narrow screens", () => {
    expect(styles).toContain("grid-template-columns: repeat(2, minmax(0, 1fr));");
    expect(styles).toContain("@media (max-width: 380px)");
    expect(styles).toMatch(/\.form-grid\s*\{[\s\S]*?label,[\s\S]*?min-width: 0;/);
    expect(styles).toMatch(/\.library-action-row\s*\{[\s\S]*?button\s*\{[\s\S]*?min-width: 0;/);
  });

  test("uses a compact home hierarchy and one invite entry", () => {
    expect(mobileApp).toContain("<h1>{text.navigation.home}</h1>");
    expect(mobileApp).toContain("<ThreeDotsIcon />");
    expect(mobileApp).not.toMatch(/>\s*\.\.\.\s*<\/button>/);
    expect(
      mobileApp.match(/title=\{text\.account\.inviteGrowth\}/g),
    ).toHaveLength(2);
    expect(styles).toMatch(
      /\.summary-card \+ \.summary-card\s*\{\s*border-left:/,
    );
    expect(styles).toMatch(
      /\.account-menu-item:last-child\s*\{\s*border-bottom: 0;/,
    );
  });
});
