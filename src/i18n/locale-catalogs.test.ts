import { describe, expect, it } from "vitest";
import en from "./en.json";
import fr from "./fr.json";

/** Recursively collects every leaf key path ("shell.section.palette", …) of
 * a nested catalog object. */
function leafKeyPaths(catalog: Record<string, unknown>, prefix = ""): string[] {
  const paths: string[] = [];
  for (const [key, value] of Object.entries(catalog)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null) {
      paths.push(...leafKeyPaths(value as Record<string, unknown>, path));
    } else {
      paths.push(path);
    }
  }
  return paths;
}

function valueAt(catalog: Record<string, unknown>, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (node, segment) => (node as Record<string, unknown>)[segment],
      catalog,
    );
}

describe("this app's own locale catalogs (en/fr)", () => {
  it("have exactly the same set of keys in both locales", () => {
    expect(leafKeyPaths(en).sort()).toEqual(leafKeyPaths(fr).sort());
  });

  it("have no empty-string translation in either locale", () => {
    for (const [locale, catalog] of [
      ["en", en],
      ["fr", fr],
    ] as const) {
      for (const path of leafKeyPaths(catalog)) {
        expect(
          valueAt(catalog, path),
          `${locale}.${path} should not be empty`,
        ).not.toBe("");
      }
    }
  });

  it("carries the same set of {{placeholders}} in the en and fr version of every key", () => {
    const placeholdersOf = (value: string): string[] =>
      [...value.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();

    for (const path of leafKeyPaths(en)) {
      const enValue = valueAt(en, path) as string;
      const frValue = valueAt(fr, path) as string;
      expect(placeholdersOf(frValue), path).toEqual(placeholdersOf(enValue));
    }
  });
});
