import assert from "node:assert/strict";
import test from "node:test";
import { formatSelectionLocation } from "../src/selectionLocation";

test("formats a single-line selection with 1-based positions", () => {
  const actual = formatSelectionLocation({
    filePath: "/repo/src/extension.ts",
    workspaceFolderPath: "/repo",
    selection: {
      start: { line: 9, character: 2 },
      end: { line: 9, character: 17 }
    }
  });

  assert.equal(actual, "src/extension.ts:10:3-10:18");
});

test("formats a cursor location as a zero-length range", () => {
  const actual = formatSelectionLocation({
    filePath: "/repo/src/extension.ts",
    workspaceFolderPath: "/repo",
    selection: {
      start: { line: 9, character: 2 },
      end: { line: 9, character: 2 }
    }
  });

  assert.equal(actual, "src/extension.ts:10:3-10:3");
});

test("formats a multi-line selection", () => {
  const actual = formatSelectionLocation({
    filePath: "/repo/src/extension.ts",
    workspaceFolderPath: "/repo",
    selection: {
      start: { line: 4, character: 0 },
      end: { line: 7, character: 12 }
    }
  });

  assert.equal(actual, "src/extension.ts:5:1-8:13");
});

test("normalizes reversed ranges", () => {
  const actual = formatSelectionLocation({
    filePath: "/repo/src/extension.ts",
    workspaceFolderPath: "/repo",
    selection: {
      start: { line: 7, character: 12 },
      end: { line: 4, character: 0 }
    }
  });

  assert.equal(actual, "src/extension.ts:5:1-8:13");
});

test("uses an absolute path when the file is outside the workspace", () => {
  const actual = formatSelectionLocation({
    filePath: "/outside/file.ts",
    workspaceFolderPath: "/repo",
    selection: {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 4 }
    }
  });

  assert.equal(actual, "/outside/file.ts:1:1-1:5");
});

test("uses an absolute path when no workspace is available", () => {
  const actual = formatSelectionLocation({
    filePath: "/repo/src/extension.ts",
    selection: {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 4 }
    }
  });

  assert.equal(actual, "/repo/src/extension.ts:1:1-1:5");
});
