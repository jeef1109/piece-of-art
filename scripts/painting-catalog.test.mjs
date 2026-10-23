import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { paintings, paintingIdReplacements, themes } from "../src/components/sites/piece-of-art/paintingCatalog.generated.ts";

const projectRoot = resolve(import.meta.dirname, "..");
const curation = JSON.parse(await readFile(new URL("./painting-catalog-curation.json", import.meta.url), "utf8"));

test("catalog contains 12 themes with 10 unique reviewed artworks each", () => {
  assert.equal(themes.length, 12);
  assert.equal(paintings.length, 120);
  assert.equal(new Set(paintings.map((painting) => painting.id)).size, 120);
  for (const theme of themes) {
    const actual = paintings.filter((painting) => painting.themeId === theme.id).map((painting) => painting.id);
    assert.equal(actual.length, 10);
    assert.deepEqual(actual, curation.themes[theme.id]);
  }
});

test("excluded monochrome, sketch and previously removed works cannot return", () => {
  for (const painting of paintings) assert.ok(!curation.excludedIds.includes(painting.id), painting.id);
});

test("all replacement files are the exact visually approved color originals", async () => {
  assert.equal(Object.keys(curation.replacements).length, 31);
  for (const [id, replacement] of Object.entries(curation.replacements)) {
    const painting = paintings.find((painting) => painting.id === id);
    assert.ok(painting, id);
    assert.equal(painting.image, replacement.image);
    assert.equal(painting.publicDomain, true);
    assert.match(replacement.sourceImage, /^https:\/\/images\.metmuseum\.org\//);
    const bytes = await readFile(resolve(projectRoot, `public${painting.image}`));
    assert.equal(bytes.subarray(0, 3).toString("hex"), "ffd8ff", `${id}: valid JPEG`);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), replacement.sha256, id);
  }
});

test("completed slots migrate one-to-one without losing progress", () => {
  const oldIds = Object.values(curation.replacements).map((replacement) => replacement.replaces);
  assert.equal(new Set(oldIds).size, 31);
  const migrated = oldIds.map((id) => paintingIdReplacements[id] ?? id);
  assert.equal(new Set(migrated).size, oldIds.length);
  assert.deepEqual(new Set(migrated), new Set(Object.keys(curation.replacements)));
  assert.ok(migrated.every((id) => paintings.some((painting) => painting.id === id)));
});

test("every local catalog image exists", async () => {
  for (const painting of paintings.filter((painting) => painting.image.startsWith("/"))) {
    const bytes = await readFile(resolve(projectRoot, `public${painting.image}`));
    assert.ok(bytes.length > 1000, painting.id);
  }
});
