import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { PastedImageError, savePastedImage } from "../src/pastedImage";

test("uses .tmp/images when the custom image directory is empty", async (t) => {
  const projectDirectory = await mkdtemp(path.join(os.tmpdir(), "code-indicator-"));
  t.after(() => rm(projectDirectory, { recursive: true, force: true }));
  const image = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

  const result = await savePastedImage({
    projectDirectory,
    customImageDirectory: "   ",
    mediaType: "image/png",
    base64: image.toString("base64"),
    timestamp: 1_786_423_812_345
  });

  assert.deepEqual(result, {
    markdown: "[image](./.tmp/images/1786423812345.png)",
    usedFallbackDirectory: false
  });
  assert.deepEqual(
    await readFile(path.join(projectDirectory, ".tmp", "images", "1786423812345.png")),
    image
  );
});

test("saves a pasted image in a workspace-relative custom directory", async (t) => {
  const projectDirectory = await mkdtemp(path.join(os.tmpdir(), "code-indicator-"));
  t.after(() => rm(projectDirectory, { recursive: true, force: true }));

  const result = await savePastedImage({
    projectDirectory,
    customImageDirectory: "custom images",
    mediaType: "image/jpeg",
    base64: Buffer.from("image").toString("base64"),
    timestamp: 1_786_423_812_346
  });

  assert.deepEqual(result, {
    markdown: "[image](<./custom images/1786423812346.jpg>)",
    usedFallbackDirectory: false
  });
  assert.equal(
    (await readFile(path.join(projectDirectory, "custom images", "1786423812346.jpg"))).toString(),
    "image"
  );
});

test("saves a pasted image in an absolute custom directory", async (t) => {
  const testDirectory = await mkdtemp(path.join(os.tmpdir(), "code-indicator-"));
  t.after(() => rm(testDirectory, { recursive: true, force: true }));
  const projectDirectory = path.join(testDirectory, "project");
  const customImageDirectory = path.join(testDirectory, "custom images");
  await mkdir(projectDirectory);

  const result = await savePastedImage({
    projectDirectory,
    customImageDirectory,
    mediaType: "image/png",
    base64: Buffer.from("image").toString("base64"),
    timestamp: 1_786_423_812_347
  });
  const markdownPath = path.join(customImageDirectory, "1786423812347.png").split(path.sep).join("/");

  assert.deepEqual(result, {
    markdown: `[image](<${markdownPath}>)`,
    usedFallbackDirectory: false
  });
  assert.equal((await readFile(path.join(customImageDirectory, "1786423812347.png"))).toString(), "image");
});

test("falls back to .tmp/images when the custom image directory is unavailable", async (t) => {
  const projectDirectory = await mkdtemp(path.join(os.tmpdir(), "code-indicator-"));
  t.after(() => rm(projectDirectory, { recursive: true, force: true }));
  await writeFile(path.join(projectDirectory, "not-a-directory"), "file");

  const result = await savePastedImage({
    projectDirectory,
    customImageDirectory: "not-a-directory",
    mediaType: "image/png",
    base64: Buffer.from("image").toString("base64"),
    timestamp: 1_786_423_812_347
  });

  assert.deepEqual(result, {
    markdown: "[image](./.tmp/images/1786423812347.png)",
    usedFallbackDirectory: true
  });
  assert.equal(
    (await readFile(path.join(projectDirectory, ".tmp", "images", "1786423812347.png"))).toString(),
    "image"
  );
});

test("rejects an unsupported pasted image type", async () => {
  await assert.rejects(
    savePastedImage({
      projectDirectory: "/project",
      mediaType: "image/vnd.example",
      base64: "aW1hZ2U=",
      timestamp: 1
    }),
    (error: unknown) =>
      error instanceof PastedImageError &&
      error.message === "Paste a PNG, JPEG, GIF, WebP, BMP, AVIF, TIFF, or SVG image."
  );
});

test("rejects invalid pasted image data", async () => {
  await assert.rejects(
    savePastedImage({
      projectDirectory: "/project",
      mediaType: "image/png",
      base64: "not base64",
      timestamp: 1
    }),
    (error: unknown) =>
      error instanceof PastedImageError &&
      error.message === "Unable to read the pasted image. Copy the image again, then paste it again."
  );
});
