import assert from "node:assert/strict";
import test from "node:test";

import { EmbeddedTerminalTarget, sendLocationToTerminal } from "../src/terminalRouting";

test("sends to the embedded terminal when it is already live", async () => {
  const writes: string[] = [];
  let focused = 0;
  const embeddedTerminal: EmbeddedTerminalTarget = {
    isLive: () => true,
    ensureStarted: () => {
      throw new Error("should not start an already-live terminal");
    },
    write: (data) => {
      writes.push(data);
      return true;
    }
  };

  const target = await sendLocationToTerminal({
    value: "src/extension.ts:10:3-10:18",
    trailingCharacter: "space",
    focusAfterSend: true,
    embeddedTerminal,
    focusEmbeddedTerminal: () => {
      focused += 1;
    }
  });

  assert.equal(target, "embedded");
  assert.deepEqual(writes, ["src/extension.ts:10:3-10:18 "]);
  assert.equal(focused, 1);
});

test("starts and focuses the embedded terminal before first send", async () => {
  const writes: string[] = [];
  let started = false;
  let focused = 0;
  const embeddedTerminal: EmbeddedTerminalTarget = {
    isLive: () => started,
    ensureStarted: () => {
      started = true;
      return true;
    },
    write: (data) => {
      writes.push(data);
      return true;
    }
  };

  const target = await sendLocationToTerminal({
    value: "src/extension.ts:10:3-10:18",
    trailingCharacter: "newline",
    focusAfterSend: true,
    embeddedTerminal,
    focusEmbeddedTerminal: () => {
      focused += 1;
    }
  });

  assert.equal(target, "embedded");
  assert.deepEqual(writes, ["src/extension.ts:10:3-10:18\r"]);
  assert.equal(focused, 1);
});

test("falls back to the active terminal when embedded startup fails", async () => {
  const activeSends: Array<{ text: string; addNewLine?: boolean }> = [];
  let activeFocused = 0;
  const target = await sendLocationToTerminal({
    value: "src/extension.ts:10:3-10:18",
    trailingCharacter: "newline",
    focusAfterSend: true,
    embeddedTerminal: {
      isLive: () => false,
      ensureStarted: () => false,
      write: () => false
    },
    activeTerminal: {
      sendText: (text, addNewLine) => activeSends.push({ text, addNewLine }),
      show: (preserveFocus) => {
        assert.equal(preserveFocus, false);
        activeFocused += 1;
      }
    }
  });

  assert.equal(target, "active");
  assert.deepEqual(activeSends, [
    {
      text: "src/extension.ts:10:3-10:18",
      addNewLine: true
    }
  ]);
  assert.equal(activeFocused, 1);
});

test("falls back to the active terminal when embedded focus fails before startup", async () => {
  let started = false;
  const activeSends: Array<{ text: string; addNewLine?: boolean }> = [];
  const target = await sendLocationToTerminal({
    value: "src/extension.ts:10:3-10:18",
    trailingCharacter: "space",
    focusAfterSend: true,
    embeddedTerminal: {
      isLive: () => false,
      ensureStarted: () => {
        started = true;
        return true;
      },
      write: () => true
    },
    activeTerminal: {
      sendText: (text, addNewLine) => activeSends.push({ text, addNewLine }),
      show: () => undefined
    },
    focusEmbeddedTerminal: () => {
      throw new Error("view unavailable");
    }
  });

  assert.equal(target, "active");
  assert.equal(started, false);
  assert.deepEqual(activeSends, [
    {
      text: "src/extension.ts:10:3-10:18 ",
      addNewLine: false
    }
  ]);
});

test("warns when neither embedded nor active terminal can be used", async () => {
  let warnings = 0;
  const target = await sendLocationToTerminal({
    value: "src/extension.ts:10:3-10:18",
    trailingCharacter: "space",
    focusAfterSend: true,
    embeddedTerminal: {
      isLive: () => false,
      ensureStarted: () => false,
      write: () => false
    },
    warnNoActiveTerminal: () => {
      warnings += 1;
    }
  });

  assert.equal(target, "none");
  assert.equal(warnings, 1);
});
