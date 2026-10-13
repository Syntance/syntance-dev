/**
 * Walidacja wgrywanych obrazów: format po sygnaturze bajtów (nie po rozszerzeniu ani MIME),
 * limit rozmiaru. Odrzucamy SVG i formaty, których przeglądarka nie zdekoduje.
 */
import { z } from "zod";

export const MAX_INPUT_BYTES = 80 * 1024 * 1024;

export const ACCEPTED_INPUT = "image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif";

export type ImageKind = "png" | "jpeg" | "webp" | "gif" | "bmp" | "avif";

const fileMetaSchema = z.object({
  name: z.string().min(1).max(255),
  size: z.number().int().positive().max(MAX_INPUT_BYTES),
});

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

export function sniffImageKind(bytes: Uint8Array): ImageKind | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0x89 && ascii(bytes, 1, 3) === "PNG" && bytes[4] === 0x0d && bytes[5] === 0x0a) return "png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "webp";
  if (ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a") return "gif";
  if (ascii(bytes, 0, 2) === "BM") return "bmp";
  if (ascii(bytes, 4, 4) === "ftyp" && ["avif", "avis"].includes(ascii(bytes, 8, 4))) return "avif";
  return null;
}

export type InputCheck = { ok: true; kind: ImageKind } | { ok: false; message: string };

export function checkInputFile(name: string, size: number, head: Uint8Array): InputCheck {
  const meta = fileMetaSchema.safeParse({ name, size });
  if (!meta.success) {
    return {
      ok: false,
      message: size > MAX_INPUT_BYTES ? "Plik jest za duży — maksymalnie 80 MB." : "Niepoprawny plik.",
    };
  }
  const kind = sniffImageKind(head);
  if (!kind) return { ok: false, message: "Nieobsługiwany format. Wybierz PNG, JPEG, WebP, GIF, BMP lub AVIF." };
  return { ok: true, kind };
}
