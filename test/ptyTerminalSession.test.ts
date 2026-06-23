import assert from "node:assert/strict";
import test from "node:test";

import { DisposableLike, PtyExitEvent, PtyProcess, PtySpawnOptions, PtyTerminalSession } from "../src/ptyTerminalSession";

class FakePty implements PtyProcess {
  readonly dataListeners = new Set<(data: string) => void>();
  readonly exitListeners = new Set<(event: PtyExitEvent) => void>();
  readonly writes: Array<string | Buffer> = [];
  readonly resizes: Array<{ columns: number; rows: number }> = [];
  killed = false;

  readonly onData = (listener: (data: string) => void): DisposableLike => {
    this.dataListeners.add(listener);
    return {
      dispose: () => this.dataListeners.delete(listener)
    };
  };

  readonly onExit = (listener: (event: PtyExitEvent) => void): DisposableLike => {
    this.exitListeners.add(listener);
    return {
      dispose: () => this.exitListeners.delete(listener)
    };
  };

  write(data: string | Buffer): void {
    this.writes.push(data);
  }

  resize(columns: number, rows: number): void {
    this.resizes.push({ columns, rows });
  }

  kill(): void {
    this.killed = true;
  }

  emitData(data: string): void {
    for (const listener of this.dataListeners) {
      listener(data);
    }
  }

  emitExit(event: PtyExitEvent): void {
    for (const listener of this.exitListeners) {
      listener(event);
    }
  }
}

test("starts a PTY with shell, cwd, and terminal environment", () => {
  const fakePty = new FakePty();
  const spawnCalls: Array<{ file: string; args: readonly string[]; options: PtySpawnOptions }> = [];
  const session = new PtyTerminalSession({
    shell: "/bin/zsh",
    cwdResolver: () => "/workspace",
    env: {
      PATH: "/usr/bin",
      TERM_PROGRAM: "vscode"
    },
    ptyFactory: (file, args, options) => {
      spawnCalls.push({ file, args, options });
      return fakePty;
    }
  });

  assert.equal(session.ensureStarted(), true);
  assert.equal(session.isLive(), true);
  assert.equal(spawnCalls.length, 1);
  assert.equal(spawnCalls[0].file, "/bin/zsh");
  assert.deepEqual(spawnCalls[0].args, []);
  assert.equal(spawnCalls[0].options.cwd, "/workspace");
  assert.equal(spawnCalls[0].options.env.PWD, "/workspace");
  assert.equal(spawnCalls[0].options.env.PATH, "/usr/bin");
  assert.equal(spawnCalls[0].options.env.TERM, "xterm-256color");
  assert.equal(spawnCalls[0].options.env.COLORTERM, "truecolor");
  assert.equal(spawnCalls[0].options.env.TERM_PROGRAM, "code-indicator");
});

test("buffers PTY output for a later webview", () => {
  const fakePty = new FakePty();
  const received: string[] = [];
  const session = new PtyTerminalSession({
    ptyFactory: () => fakePty
  });

  session.onData((data) => received.push(data));
  session.ensureStarted();
  fakePty.emitData("prompt");

  assert.deepEqual(received, ["prompt"]);
  assert.equal(session.getBufferedOutput(), "prompt");
});

test("does not spawn a second PTY when one is already live", () => {
  const fakePty = new FakePty();
  let spawnCount = 0;
  const session = new PtyTerminalSession({
    ptyFactory: () => {
      spawnCount += 1;
      return fakePty;
    }
  });

  assert.equal(session.spawn(), true);
  assert.equal(session.spawn(), true);

  assert.equal(spawnCount, 1);
  assert.equal(session.isLive(), true);
});

test("runs the startup command after spawning a PTY", () => {
  const fakePty = new FakePty();
  const session = new PtyTerminalSession({
    ptyFactory: () => fakePty
  });

  assert.equal(session.spawn({ startupCommand: "echo ready" }), true);

  assert.deepEqual(fakePty.writes, ["echo ready\r"]);
});

test("does not run an empty startup command", () => {
  const fakePty = new FakePty();
  const session = new PtyTerminalSession({
    ptyFactory: () => fakePty
  });

  assert.equal(session.spawn({ startupCommand: "   " }), true);

  assert.deepEqual(fakePty.writes, []);
});

test("does not rerun the startup command when spawn is called while live", () => {
  const fakePty = new FakePty();
  const session = new PtyTerminalSession({
    ptyFactory: () => fakePty
  });

  assert.equal(session.spawn({ startupCommand: "echo first" }), true);
  assert.equal(session.spawn({ startupCommand: "echo second" }), true);

  assert.deepEqual(fakePty.writes, ["echo first\r"]);
});

test("resizes an active PTY and preserves dimensions for startup", () => {
  const fakePty = new FakePty();
  let startupOptions: PtySpawnOptions | undefined;
  const session = new PtyTerminalSession({
    ptyFactory: (_file, _args, options) => {
      startupOptions = options;
      return fakePty;
    }
  });

  session.resize(120, 40);
  session.ensureStarted();
  session.resize(100, 32);

  assert.equal(startupOptions?.cols, 120);
  assert.equal(startupOptions?.rows, 40);
  assert.deepEqual(fakePty.resizes, [{ columns: 100, rows: 32 }]);
});

test("kills a live PTY, clears buffered output, and reports stopped", () => {
  const fakePty = new FakePty();
  let clearCount = 0;
  const session = new PtyTerminalSession({
    ptyFactory: () => fakePty
  });

  session.onClear(() => {
    clearCount += 1;
  });
  session.ensureStarted();
  fakePty.emitData("prompt");

  assert.equal(session.kill(), true);

  assert.equal(fakePty.killed, true);
  assert.equal(session.isLive(), false);
  assert.equal(session.getBufferedOutput(), "");
  assert.equal(session.getStatus().state, "stopped");
  assert.equal(clearCount, 1);
});

test("kill is a no-op when no PTY is live", () => {
  let spawnCount = 0;
  const session = new PtyTerminalSession({
    ptyFactory: () => {
      spawnCount += 1;
      return new FakePty();
    }
  });

  assert.equal(session.kill(), false);

  assert.equal(spawnCount, 0);
  assert.equal(session.isLive(), false);
  assert.equal(session.getStatus().state, "stopped");
});

test("marks the session exited and allows restart", () => {
  const firstPty = new FakePty();
  const secondPty = new FakePty();
  const ptys = [firstPty, secondPty];
  const exits: PtyExitEvent[] = [];
  const session = new PtyTerminalSession({
    ptyFactory: () => ptys.shift() ?? new FakePty()
  });

  session.onExit((event) => exits.push(event));
  session.ensureStarted();
  firstPty.emitExit({ exitCode: 0 });

  assert.equal(session.isLive(), false);
  assert.equal(session.getStatus().state, "exited");
  assert.deepEqual(exits, [{ exitCode: 0 }]);

  assert.equal(session.restart(), true);
  assert.equal(session.isLive(), true);
});

test("restart kills the current PTY, clears output, and spawns a new PTY", () => {
  const firstPty = new FakePty();
  const secondPty = new FakePty();
  const ptys = [firstPty, secondPty];
  let clearCount = 0;
  const session = new PtyTerminalSession({
    ptyFactory: () => ptys.shift() ?? new FakePty()
  });

  session.onClear(() => {
    clearCount += 1;
  });
  session.ensureStarted();
  firstPty.emitData("old output");

  assert.equal(session.restart(), true);

  assert.equal(firstPty.killed, true);
  assert.equal(session.isLive(), true);
  assert.equal(session.getBufferedOutput(), "");
  assert.equal(clearCount, 1);
  assert.equal(ptys.length, 0);
});

test("restart runs the startup command only on the new PTY", () => {
  const firstPty = new FakePty();
  const secondPty = new FakePty();
  const ptys = [firstPty, secondPty];
  const session = new PtyTerminalSession({
    ptyFactory: () => ptys.shift() ?? new FakePty()
  });

  session.ensureStarted();

  assert.equal(session.restart({ startupCommand: "echo restarted" }), true);

  assert.deepEqual(firstPty.writes, []);
  assert.deepEqual(secondPty.writes, ["echo restarted\r"]);
});

test("returns false and reports an error when PTY startup throws", () => {
  const session = new PtyTerminalSession({
    ptyFactory: () => {
      throw new Error("native module unavailable");
    }
  });

  assert.equal(session.ensureStarted(), false);
  assert.equal(session.isLive(), false);
  assert.equal(session.getStatus().state, "error");
});
