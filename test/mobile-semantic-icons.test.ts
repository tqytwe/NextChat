import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "@jest/globals";

const semanticIcons = [
  "add",
  "chat",
  "cloud-fail",
  "close",
  "copy",
  "delete",
  "download",
  "eye",
  "eye-off",
  "favorite",
  "history",
  "image",
  "left",
  "max",
  "prompt",
  "reload",
  "sd",
  "send-white",
  "settings",
  "share",
  "three-dots",
  "upload",
  "voice",
  "bot",
];

describe("mobile semantic icons", () => {
  test.each(semanticIcons)("%s inherits the active theme color", (name) => {
    const source = readFileSync(
      resolve(process.cwd(), `app/icons/${name}.svg`),
      "utf8",
    );
    const paintedElements =
      source.match(/<(?:path|circle|rect)\b[^>]*>/gi) || [];
    expect(
      paintedElements.filter((element) =>
        /(?:fill|stroke)(?:\s*=\s*["']|\s*:)[^>]*(?:#(?:000(?:000)?|333(?:333)?|fff(?:fff)?)\b|\b(?:black|white)\b)/i.test(
          element,
        ),
      ),
    ).toEqual([]);
  });
});
