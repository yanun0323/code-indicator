import { getTerminalSendText } from "./terminalSendText";

export interface EmbeddedTerminalTarget {
  isLive(): boolean;
  ensureStarted(): boolean;
  write(data: string): boolean;
}

export interface ActiveTerminalTarget {
  sendText(text: string, addNewLine?: boolean): void;
  show(preserveFocus?: boolean): void;
}

export interface SendLocationRoutingOptions {
  readonly value: string;
  readonly trailingCharacter: string | undefined;
  readonly focusAfterSend: boolean;
  readonly embeddedTerminal?: EmbeddedTerminalTarget;
  readonly activeTerminal?: ActiveTerminalTarget;
  readonly focusEmbeddedTerminal?: () => PromiseLike<void> | void;
  readonly warnNoActiveTerminal?: () => void;
}

export type SendLocationTarget = "embedded" | "active" | "none";

export async function sendLocationToTerminal(options: SendLocationRoutingOptions): Promise<SendLocationTarget> {
  const sendText = getTerminalSendText(options.value, options.trailingCharacter);

  if (options.embeddedTerminal) {
    const wasLive = options.embeddedTerminal.isLive();
    if (!wasLive) {
      const didFocus = await tryFocusEmbeddedTerminal(options.focusEmbeddedTerminal);
      if (!didFocus) {
        return sendToActiveTerminal(options, sendText);
      }
    }

    if ((wasLive || options.embeddedTerminal.ensureStarted()) && options.embeddedTerminal.write(toPtyInput(sendText))) {
      if (options.focusAfterSend && wasLive) {
        await tryFocusEmbeddedTerminal(options.focusEmbeddedTerminal);
      }
      return "embedded";
    }
  }

  return sendToActiveTerminal(options, sendText);
}

function sendToActiveTerminal(
  options: SendLocationRoutingOptions,
  sendText: ReturnType<typeof getTerminalSendText>
): SendLocationTarget {
  if (!options.activeTerminal) {
    options.warnNoActiveTerminal?.();
    return "none";
  }

  options.activeTerminal.sendText(sendText.text, sendText.addNewLine);
  if (options.focusAfterSend) {
    options.activeTerminal.show(false);
  }
  return "active";
}

async function tryFocusEmbeddedTerminal(
  focusEmbeddedTerminal: SendLocationRoutingOptions["focusEmbeddedTerminal"]
): Promise<boolean> {
  try {
    await focusEmbeddedTerminal?.();
    return true;
  } catch {
    return false;
  }
}

function toPtyInput(sendText: ReturnType<typeof getTerminalSendText>): string {
  if (sendText.addNewLine) {
    return `${sendText.text}\r`;
  }

  return sendText.text;
}
