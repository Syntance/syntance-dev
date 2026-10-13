"use client";

/**
 * Zapis pliku: natywne okno „Zapisz jako” (File System Access API — Chrome, Edge) z wyborem
 * folderu i nazwy; w pozostałych przeglądarkach zwykłe pobieranie do „Pobranych”.
 */

export interface SaveFileType {
  description: string;
  mime: string;
  extension: string;
}

export type SaveResult = "saved" | "downloaded" | "cancelled";

interface WritableLike {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
}

interface FileHandleLike {
  createWritable(): Promise<WritableLike>;
}

function isFileHandle(value: unknown): value is FileHandleLike {
  return typeof value === "object" && value !== null && typeof Reflect.get(value, "createWritable") === "function";
}

function isWritable(value: unknown): value is WritableLike {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof Reflect.get(value, "write") === "function" &&
    typeof Reflect.get(value, "close") === "function"
  );
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  // Opóźnione zwolnienie — Safari potrzebuje chwili na rozpoczęcie pobierania.
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function saveFile(blob: Blob, fileName: string, type: SaveFileType): Promise<SaveResult> {
  const picker: unknown = Reflect.get(globalThis, "showSaveFilePicker");
  if (typeof picker === "function") {
    try {
      const handle: unknown = await Reflect.apply(picker, globalThis, [
        {
          suggestedName: fileName,
          types: [{ description: type.description, accept: { [type.mime]: [`.${type.extension}`] } }],
        },
      ]);
      if (isFileHandle(handle)) {
        const writable: unknown = await handle.createWritable();
        if (isWritable(writable)) {
          await writable.write(blob);
          await writable.close();
          return "saved";
        }
      }
    } catch (error) {
      if (isAbort(error)) return "cancelled";
      // SecurityError (np. iframe) → zwykłe pobieranie.
    }
  }
  downloadBlob(blob, fileName);
  return "downloaded";
}
