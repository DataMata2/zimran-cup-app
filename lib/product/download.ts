// Save text the page built as a file, without a server round trip (so nothing personal goes in a URL).

/** How long a blob URL stays valid after the click: long enough for iOS Safari's Download / View prompt. */
export const BLOB_REVOKE_MS = 60_000;

/** Download `text` as `filename` (browser only). */
export function downloadText(text: string, filename: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), BLOB_REVOKE_MS);
}
