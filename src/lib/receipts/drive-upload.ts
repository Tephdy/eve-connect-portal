import "server-only";

export type DriveUploadInput = {
  folderName: string;
  monthFolder: string;
  files: File[];
  /** If provided, used as the base for the generated filenames. */
  tagPrefix?: string;
};

export type DriveUploadResult = {
  folderId: string;
  folderUrl: string;
  tenantFolderUrl: string;
  folderName: string;
  monthFolder: string;
  files: { name: string; id: string; url: string }[];
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 20;
const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
];

export function validateFiles(files: File[]): string | null {
  if (files.length === 0) return "No files";
  if (files.length > MAX_FILES) return "Too many files (" + files.length + ", max " + MAX_FILES + ")";
  for (const f of files) {
    if (f.size > MAX_FILE_SIZE) return f.name + " exceeds 10 MB";
    if (!ALLOWED_MIME.includes(f.type)) return f.name + " has unsupported type";
  }
  return null;
}

/**
 * Send files to the Apps Script endpoint that writes them to Google Drive.
 * The Apps Script URL comes from GOOGLE_DRIVE_SCRIPT_URL.
 */
export async function uploadToDrive(
  input: DriveUploadInput
): Promise<DriveUploadResult> {
  const scriptUrl = process.env.GOOGLE_DRIVE_SCRIPT_URL;
  if (!scriptUrl) throw new Error("GOOGLE_DRIVE_SCRIPT_URL not set");

  const tagPrefix = (input.tagPrefix ?? "receipt").toLowerCase();
  const date = new Date().toISOString().slice(0, 10);

  const payloadFiles: { name: string; mimeType: string; base64: string }[] = [];
  for (let i = 0; i < input.files.length; i++) {
    const f = input.files[i];
    const ext = f.name.split(".").pop() || "bin";
    const buffer = Buffer.from(await f.arrayBuffer());
    payloadFiles.push({
      name: tagPrefix + "-" + date + "-" + (i + 1) + "." + ext,
      mimeType: f.type,
      base64: buffer.toString("base64"),
    });
  }

  const res = await fetch(scriptUrl, {
    method: "POST",
    body: JSON.stringify({
      folderName: input.folderName,
      monthFolder: input.monthFolder,
      files: payloadFiles,
    }),
    cache: "no-store",
  });
  const json: any = await res.json();
  if (!json?.success) throw new Error(json?.error ?? "Drive upload failed");

  return {
    folderId: json.folderId,
    folderUrl: json.folderUrl,
    tenantFolderUrl: json.tenantFolderUrl,
    folderName: json.folderName,
    monthFolder: json.monthFolder,
    files: json.files ?? [],
  };
}
