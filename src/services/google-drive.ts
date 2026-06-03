import { google, docs_v1 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import * as mammoth from "mammoth";

export type DriveDocument = {
  id: string;
  name: string;
  modifiedTime: string;
  mimeType: string;
};

export async function listGoogleDocsInFolder(
  auth: OAuth2Client,
  folderId: string
): Promise<DriveDocument[]> {
  const drive = google.drive({ version: "v3", auth });
  const files: DriveDocument[] = [];
  let pageToken: string | undefined;

  do {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false and (mimeType = 'application/vnd.google-apps.document' or mimeType = 'text/plain' or mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')`,
      fields: "nextPageToken, files(id, name, modifiedTime, mimeType)",
      pageSize: 100,
      pageToken,
    });

    for (const file of response.data.files ?? []) {
      if (file.id && file.name) {
        files.push({
          id: file.id,
          name: file.name,
          modifiedTime: file.modifiedTime ?? new Date().toISOString(),
          mimeType: file.mimeType ?? "application/vnd.google-apps.document",
        });
      }
    }

    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return files;
}

export async function fetchDocumentText(
  auth: OAuth2Client,
  file: DriveDocument
): Promise<string> {
  if (file.mimeType === "text/plain") {
    const drive = google.drive({ version: "v3", auth });
    const res = await drive.files.get(
      { fileId: file.id, alt: "media" },
      { responseType: "text" }
    );
    return String(res.data ?? "");
  }

  if (file.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const drive = google.drive({ version: "v3", auth });
    const res = await drive.files.get(
      { fileId: file.id, alt: "media" },
      { responseType: "arraybuffer" }
    );
    const buffer = Buffer.from(res.data as ArrayBuffer);
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  return extractGoogleDocText(auth, file.id);
}

function extractGoogleDocText(
  auth: OAuth2Client,
  documentId: string
): Promise<string> {
  const docs = google.docs({ version: "v1", auth });
  return docs.documents.get({ documentId }).then((res) => {
    const body = res.data.body?.content ?? [];
    return flattenStructuralElements(body);
  });
}

function flattenStructuralElements(
  elements: docs_v1.Schema$StructuralElement[]
): string {
  const parts: string[] = [];

  for (const element of elements) {
    if (element.paragraph) {
      const text = element.paragraph.elements
        ?.map((e) => e.textRun?.content ?? "")
        .join("");
      if (text) parts.push(text);
    }
    if (element.table) {
      for (const row of element.table.tableRows ?? []) {
        for (const cell of row.tableCells ?? []) {
          const cellText = flattenStructuralElements(cell.content ?? []);
          if (cellText) parts.push(cellText);
        }
      }
    }
  }

  return parts.join("\n").trim();
}

