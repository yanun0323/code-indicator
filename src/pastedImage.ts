import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const MAX_PASTED_IMAGE_BYTES = 20 * 1024 * 1024;
export const PASTED_IMAGE_READ_ERROR_MESSAGE =
  "Unable to read the pasted image. Copy the image again, then paste it again.";
export const PASTED_IMAGE_TOO_LARGE_MESSAGE = "Paste an image smaller than 20 MB.";

const IMAGE_EXTENSIONS: Readonly<Record<string, string>> = {
  "image/avif": "avif",
  "image/bmp": "bmp",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/svg+xml": "svg",
  "image/tiff": "tiff",
  "image/webp": "webp"
};
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export interface PastedImageInput {
  readonly projectDirectory: string;
  readonly customImageDirectory?: string;
  readonly mediaType: string;
  readonly base64: string;
  readonly timestamp?: number;
}

export interface SavedPastedImage {
  readonly markdown: string;
  readonly usedFallbackDirectory: boolean;
}

export class PastedImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PastedImageError";
  }
}

export async function savePastedImage(input: PastedImageInput): Promise<SavedPastedImage> {
  const extension = IMAGE_EXTENSIONS[input.mediaType.toLowerCase()];
  if (!extension) {
    throw new PastedImageError("Paste a PNG, JPEG, GIF, WebP, BMP, AVIF, TIFF, or SVG image.");
  }

  const image = decodeImage(input.base64);
  const fileName = `${input.timestamp ?? Date.now()}.${extension}`;
  const defaultImageDirectory = path.join(input.projectDirectory, ".tmp", "images");
  const customImageDirectory = input.customImageDirectory?.trim();

  if (customImageDirectory) {
    try {
      const markdown = await writePastedImage(
        input.projectDirectory,
        path.resolve(input.projectDirectory, customImageDirectory),
        fileName,
        image
      );
      return { markdown, usedFallbackDirectory: false };
    } catch {
      const markdown = await writePastedImage(input.projectDirectory, defaultImageDirectory, fileName, image);
      return { markdown, usedFallbackDirectory: true };
    }
  }

  const markdown = await writePastedImage(input.projectDirectory, defaultImageDirectory, fileName, image);
  return { markdown, usedFallbackDirectory: false };
}

async function writePastedImage(
  projectDirectory: string,
  imageDirectory: string,
  fileName: string,
  image: Buffer
): Promise<string> {
  const filePath = path.join(imageDirectory, fileName);

  await mkdir(imageDirectory, { recursive: true });
  await writeFile(filePath, image, { flag: "wx" });

  const relativePath = path.relative(projectDirectory, filePath);
  const isInProject =
    relativePath !== ".." && !relativePath.startsWith(`..${path.sep}`) && !path.isAbsolute(relativePath);
  const markdownPath = (isInProject ? `.${path.sep}${relativePath}` : filePath).split(path.sep).join("/");
  const destination = /\s/.test(markdownPath) ? `<${markdownPath}>` : markdownPath;

  return ` [image](${destination}) `;
}

function decodeImage(base64: string): Buffer {
  if (base64.length === 0 || !BASE64_PATTERN.test(base64)) {
    throw new PastedImageError(PASTED_IMAGE_READ_ERROR_MESSAGE);
  }

  const paddingBytes = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  const imageBytes = (base64.length / 4) * 3 - paddingBytes;
  if (imageBytes > MAX_PASTED_IMAGE_BYTES) {
    throw new PastedImageError(PASTED_IMAGE_TOO_LARGE_MESSAGE);
  }

  return Buffer.from(base64, "base64");
}
