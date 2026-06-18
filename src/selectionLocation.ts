import * as path from "path";

export interface TextPosition {
  readonly line: number;
  readonly character: number;
}

export interface TextRange {
  readonly start: TextPosition;
  readonly end: TextPosition;
}

export interface SelectionLocationInput {
  readonly filePath: string;
  readonly selection: TextRange;
  readonly workspaceFolderPath?: string;
}

export function formatSelectionLocation(input: SelectionLocationInput): string {
  const range = normalizeRange(input.selection);
  const displayPath = getDisplayPath(input.filePath, input.workspaceFolderPath);
  const startLine = range.start.line + 1;
  const startColumn = range.start.character + 1;
  const endLine = range.end.line + 1;
  const endColumn = range.end.character + 1;

  return `${displayPath}:${startLine}:${startColumn}-${endLine}:${endColumn}`;
}

function normalizeRange(range: TextRange): TextRange {
  if (isBeforeOrEqual(range.start, range.end)) {
    return range;
  }

  return {
    start: range.end,
    end: range.start
  };
}

function isBeforeOrEqual(left: TextPosition, right: TextPosition): boolean {
  if (left.line !== right.line) {
    return left.line < right.line;
  }

  return left.character <= right.character;
}

function getDisplayPath(filePath: string, workspaceFolderPath: string | undefined): string {
  if (!workspaceFolderPath) {
    return normalizePathSeparators(filePath);
  }

  const relativePath = path.relative(workspaceFolderPath, filePath);
  if (relativePath === "" || startsOutsideWorkspace(relativePath)) {
    return normalizePathSeparators(filePath);
  }

  return normalizePathSeparators(relativePath);
}

function startsOutsideWorkspace(relativePath: string): boolean {
  return relativePath === ".." || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath);
}

function normalizePathSeparators(value: string): string {
  return value.split(path.sep).join("/");
}
