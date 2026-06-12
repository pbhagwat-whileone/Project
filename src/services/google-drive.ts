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
      q: `'${folderId}' in parents and trashed = false and (mimeType = 'application/vnd.google-apps.document' or mimeType = 'text/plain' or mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' or mimeType = 'application/vnd.google-apps.spreadsheet' or mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')`,
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

  if (file.mimeType === "application/vnd.google-apps.spreadsheet" || file.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    return extractGoogleSheetText(auth, file.id);
  }

  return extractGoogleDocText(auth, file.id);
}

async function extractGoogleSheetText(
  auth: OAuth2Client,
  spreadsheetId: string
): Promise<string> {
  const sheets = google.sheets({ version: "v4", auth });
  
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId,
  });
  
  const parts: string[] = [];
  
  for (const sheet of spreadsheet.data.sheets ?? []) {
    const title = sheet.properties?.title;
    if (!title) continue;
    
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: title,
    });
    
    const rows = res.data.values;
    if (!rows || rows.length === 0) continue;
    
    parts.push(`Sheet: ${title}\n`);
    
    const headers = rows[0];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] ?? [];
      let rowText = "";
      const colCount = Math.max(headers.length, row.length);
      for (let j = 0; j < colCount; j++) {
        const header = headers[j] ? String(headers[j]).trim() : `Column${j+1}`;
        const value = row[j] ? String(row[j]).trim() : "";
        if (value) {
          rowText += `${header}: ${value}\n`;
        }
      }
      if (rowText) {
        parts.push(rowText.trim());
        parts.push("");
      }
    }
  }
  
  return parts.join("\n").trim();
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

