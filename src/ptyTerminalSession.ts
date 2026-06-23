import os from "node:os";

import type { IPty, IPtyForkOptions } from "node-pty";

export interface DisposableLike {
  dispose(): void;
}

export interface PtyProcess {
  readonly onData: (listener: (data: string) => void) => DisposableLike;
  readonly onExit: (listener: (event: PtyExitEvent) => void) => DisposableLike;
  write(data: string | Buffer): void;
  resize(columns: number, rows: number): void;
  kill(signal?: string): void;
}

export interface PtyExitEvent {
  readonly exitCode: number;
  readonly signal?: number;
}

export interface PtySpawnOptions {
  readonly name: string;
  readonly cols: number;
  readonly rows: number;
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
}

export type PtyFactory = (file: string, args: readonly string[], options: PtySpawnOptions) => PtyProcess;

export interface TerminalSessionStatus {
  readonly state: "idle" | "starting" | "ready" | "exited" | "error" | "stopped";
  readonly message: string;
}

export interface TerminalSessionOptions {
  readonly ptyFactory?: PtyFactory;
  readonly cwdResolver?: () => string;
  readonly shell?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly initialCols?: number;
  readonly initialRows?: number;
  readonly maxBufferedBytes?: number;
}

export class PtyTerminalSession {
  private readonly ptyFactory: PtyFactory;
  private readonly cwdResolver: () => string;
  private readonly shell: string;
  private readonly env: NodeJS.ProcessEnv;
  private readonly maxBufferedBytes: number;
  private readonly dataListeners = new Set<(data: string) => void>();
  private readonly statusListeners = new Set<(status: TerminalSessionStatus) => void>();
  private readonly exitListeners = new Set<(event: PtyExitEvent) => void>();
  private readonly clearListeners = new Set<() => void>();
  private pty: PtyProcess | undefined;
  private dataDisposable: DisposableLike | undefined;
  private exitDisposable: DisposableLike | undefined;
  private bufferedOutput = "";
  private cols: number;
  private rows: number;
  private status: TerminalSessionStatus = {
    state: "idle",
    message: "Terminal is not started"
  };

  constructor(options: TerminalSessionOptions = {}) {
    this.ptyFactory = options.ptyFactory ?? defaultPtyFactory;
    this.cwdResolver = options.cwdResolver ?? os.homedir;
    this.shell = options.shell ?? process.env.SHELL ?? "/bin/zsh";
    this.env = options.env ?? process.env;
    this.cols = options.initialCols ?? 80;
    this.rows = options.initialRows ?? 24;
    this.maxBufferedBytes = options.maxBufferedBytes ?? 200_000;
  }

  onData(listener: (data: string) => void): DisposableLike {
    this.dataListeners.add(listener);
    return toDisposable(() => this.dataListeners.delete(listener));
  }

  onStatus(listener: (status: TerminalSessionStatus) => void): DisposableLike {
    this.statusListeners.add(listener);
    return toDisposable(() => this.statusListeners.delete(listener));
  }

  onExit(listener: (event: PtyExitEvent) => void): DisposableLike {
    this.exitListeners.add(listener);
    return toDisposable(() => this.exitListeners.delete(listener));
  }

  onClear(listener: () => void): DisposableLike {
    this.clearListeners.add(listener);
    return toDisposable(() => this.clearListeners.delete(listener));
  }

  getBufferedOutput(): string {
    return this.bufferedOutput;
  }

  getStatus(): TerminalSessionStatus {
    return this.status;
  }

  isLive(): boolean {
    return this.pty !== undefined;
  }

  ensureStarted(): boolean {
    return this.spawn();
  }

  spawn(): boolean {
    if (this.pty) {
      return true;
    }

    this.setStatus({
      state: "starting",
      message: "Terminal is starting"
    });

    try {
      const pty = this.ptyFactory(this.shell, [], {
        name: "xterm-256color",
        cols: this.cols,
        rows: this.rows,
        cwd: this.cwdResolver(),
        env: {
          ...this.env,
          TERM: "xterm-256color",
          COLORTERM: "truecolor",
          TERM_PROGRAM: "code-indicator"
        }
      });

      this.pty = pty;
      this.dataDisposable = pty.onData((data) => this.handleData(data));
      this.exitDisposable = pty.onExit((event) => this.handleExit(event));
      this.setStatus({
        state: "ready",
        message: "Terminal is connected"
      });
      return true;
    } catch {
      this.cleanupPty();
      this.setStatus({
        state: "error",
        message: "Terminal failed to start"
      });
      return false;
    }
  }

  write(data: string): boolean {
    if (!this.pty) {
      return false;
    }

    this.pty.write(data);
    return true;
  }

  resize(columns: number, rows: number): void {
    this.cols = Math.max(2, Math.floor(columns));
    this.rows = Math.max(1, Math.floor(rows));

    if (this.pty) {
      this.pty.resize(this.cols, this.rows);
    }
  }

  restart(): boolean {
    this.clear();
    if (this.pty) {
      this.pty.kill();
      this.cleanupPty();
    }

    return this.spawn();
  }

  kill(): boolean {
    if (!this.pty) {
      this.clear();
      this.setStatus({
        state: "stopped",
        message: "Terminal stopped"
      });
      return false;
    }

    this.pty.kill();
    this.cleanupPty();
    this.clear();
    this.setStatus({
      state: "stopped",
      message: "Terminal stopped"
    });
    return true;
  }

  dispose(): void {
    if (this.pty) {
      this.pty.kill();
    }
    this.cleanupPty();
    this.dataListeners.clear();
    this.statusListeners.clear();
    this.exitListeners.clear();
    this.clearListeners.clear();
  }

  private handleData(data: string): void {
    this.bufferedOutput += data;
    if (this.bufferedOutput.length > this.maxBufferedBytes) {
      this.bufferedOutput = this.bufferedOutput.slice(this.bufferedOutput.length - this.maxBufferedBytes);
    }

    for (const listener of this.dataListeners) {
      listener(data);
    }
  }

  private handleExit(event: PtyExitEvent): void {
    this.cleanupPty();
    this.setStatus({
      state: "exited",
      message: "Terminal exited"
    });

    for (const listener of this.exitListeners) {
      listener(event);
    }
  }

  private setStatus(status: TerminalSessionStatus): void {
    this.status = status;
    for (const listener of this.statusListeners) {
      listener(status);
    }
  }

  private clear(): void {
    this.bufferedOutput = "";
    for (const listener of this.clearListeners) {
      listener();
    }
  }

  private cleanupPty(): void {
    this.dataDisposable?.dispose();
    this.exitDisposable?.dispose();
    this.dataDisposable = undefined;
    this.exitDisposable = undefined;
    this.pty = undefined;
  }
}

function defaultPtyFactory(file: string, args: readonly string[], options: PtySpawnOptions): PtyProcess {
  const nodePty = require("node-pty") as typeof import("node-pty");
  const ptyOptions: IPtyForkOptions = {
    name: options.name,
    cols: options.cols,
    rows: options.rows,
    cwd: options.cwd,
    env: options.env
  };

  return nodePty.spawn(file, [...args], ptyOptions) as IPty;
}

function toDisposable(dispose: () => void): DisposableLike {
  return { dispose };
}
