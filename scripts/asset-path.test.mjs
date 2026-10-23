import assert from "node:assert/strict";
import { test } from "node:test";
import { assetPath } from "../src/lib/asset-path.ts";

test("public assets work locally and below the GitHub Pages base path", () => {
  const previous = process.env.NEXT_PUBLIC_BASE_PATH;
  try {
    process.env.NEXT_PUBLIC_BASE_PATH = "";
    assert.equal(assetPath("/sites/art.jpg"), "/sites/art.jpg");
    process.env.NEXT_PUBLIC_BASE_PATH = "/piece-of-art/";
    assert.equal(assetPath("/sites/art.jpg"), "/piece-of-art/sites/art.jpg");
    for (const path of ["https://example.com/art.jpg", "//example.com/art.jpg", "data:image/png;base64,AA", "art.jpg"]) {
      assert.equal(assetPath(path), path);
    }
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
    else process.env.NEXT_PUBLIC_BASE_PATH = previous;
  }
});
