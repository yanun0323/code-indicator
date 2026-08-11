import assert from "node:assert/strict";
import test from "node:test";
import { getTerminalSendText } from "../src/terminalSendText";

test("appends a space without submitting terminal input by default", () => {
  const actual = getTerminalSendText("src/extension.ts:10:3-10:18", undefined);

  assert.deepEqual(actual, {
    text: "src/extension.ts:10:3-10:18 ",
    addNewLine: false
  });
});

test("submits terminal input when trailing character is newline", () => {
  const actual = getTerminalSendText("src/extension.ts:10:3-10:18", "newline");

  assert.deepEqual(actual, {
    text: "src/extension.ts:10:3-10:18",
    addNewLine: true
  });
});

test("falls back to space for an unknown trailing character", () => {
  const actual = getTerminalSendText("src/extension.ts:10:3-10:18", "unknown");

  assert.deepEqual(actual, {
    text: "src/extension.ts:10:3-10:18 ",
    addNewLine: false
  });
});

test("applies the trailing character to a pasted image link", () => {
  assert.deepEqual(getTerminalSendText("[image](./.tmp/images/1786423812345.png)", "space"), {
    text: "[image](./.tmp/images/1786423812345.png) ",
    addNewLine: false
  });
  assert.deepEqual(getTerminalSendText("[image](./.tmp/images/1786423812345.png)", "newline"), {
    text: "[image](./.tmp/images/1786423812345.png)",
    addNewLine: true
  });
});
