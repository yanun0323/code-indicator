export type TerminalTrailingCharacter = "space" | "newline";

export interface TerminalSendText {
  readonly text: string;
  readonly addNewLine: boolean;
}

export function getTerminalSendText(value: string, trailingCharacter: string | undefined): TerminalSendText {
  if (trailingCharacter === "newline") {
    return {
      text: value,
      addNewLine: true
    };
  }

  return {
    text: `${value} `,
    addNewLine: false
  };
}
