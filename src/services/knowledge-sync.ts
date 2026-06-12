import type { SupabaseClient } from "@supabase/supabase-js";
import type { OAuth2Client } from "google-auth-library";
import type { Database } from "@/types/database";
import {
  embeddingToPgVector,
  generateEmbedding,
} from "@/services/embeddings";
import {
  fetchDocumentText,
  listGoogleDocsInFolder,
  type DriveDocument,
} from "@/services/google-drive";
import { chunkText } from "@/utils/chunk-text";

type SyncResult = {
  documentsProcessed: number;
  status: "success" | "error" | "partial";
  message: string;
};



async function processDocument(
  supabase: SupabaseClient<Database>,
  auth: OAuth2Client,
  file: DriveDocument,
  documentId: string
) {
  await supabase
    .from("knowledge_documents")
    .update({ status: "processing" })
    .eq("id", documentId);

  const text = await fetchDocumentText(auth, file);

  if (file.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    // console.log(`Found DOCX: ${file.name}`);
    // console.log(`Extracted ${text.length} characters`);
  }

  const chunks = chunkText(text);
  
  let projectName = file.name.trim();
  const extMatch = projectName.match(/^(.*?)(\.[a-zA-Z0-9]+)$/);
  if (extMatch) {
    projectName = extMatch[1];
  }

  const { error: deleteError } = await supabase
    .from("knowledge_chunks")
    .delete()
    .eq("document_id", documentId);

  if (deleteError) throw deleteError;

  for (const chunk of chunks) {
    const embedding = await generateEmbedding(chunk);
    const { error: insertError } = await supabase
      .from("knowledge_chunks")
      .insert({
        document_id: documentId,
        chunk_text: chunk,
        project_name: projectName,
        industry: null,
        embedding: embeddingToPgVector(embedding),
      });

    if (insertError) throw insertError;
  }

  const { error: updateError } = await supabase
    .from("knowledge_documents")
    .update({
      status: "synced",
      last_modified: file.modifiedTime,
      document_name: file.name,
      source_type: (file.mimeType === "application/vnd.google-apps.spreadsheet" || file.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") ? "google_sheet" : "document",
    })
    .eq("id", documentId);

  if (updateError) throw updateError;
}

export async function syncKnowledgeBase(
  supabase: SupabaseClient<Database>,
  userId: string,
  auth: OAuth2Client,
  folderIds: string[]
): Promise<SyncResult> {
  let documentsProcessed = 0;
  const errors: string[] = [];

  try {
    const driveFilesMap = new Map<string, DriveDocument>();
    for (const fid of folderIds) {
      try {
        const files = await listGoogleDocsInFolder(auth, fid);
        for (const file of files) {
          if (!driveFilesMap.has(file.id)) {
            driveFilesMap.set(file.id, file);
          }
        }
      } catch (err) {
        console.error(`Failed to list docs in folder ${fid}:`, err);
        errors.push(`Folder ${fid}: ${err instanceof Error ? err.message : "List failed"}`);
      }
    }
    
    const driveFiles = Array.from(driveFilesMap.values());
    const driveFileIds = new Set(driveFilesMap.keys());

    const { data: existingDocs } = await supabase
      .from("knowledge_documents")
      .select("*")
      .eq("user_id", userId);

    const existingByFileId = new Map(
      (existingDocs ?? []).map((d) => [d.google_file_id, d])
    );

    for (const file of driveFiles) {
      const existing = existingByFileId.get(file.id);
      const modified = new Date(file.modifiedTime).getTime();
      const existingModified = existing?.last_modified
        ? new Date(existing.last_modified).getTime()
        : 0;

      const isNew = !existing;
      const isModified =
        existing &&
        (modified > existingModified ||
          existing.status === "processing" ||
          existing.status === "error");

      if (!isNew && !isModified) continue;

      try {
        let documentId = existing?.id;

        if (isNew) {
          const { data: inserted, error } = await supabase
            .from("knowledge_documents")
            .insert({
              user_id: userId,
              google_file_id: file.id,
              document_name: file.name,
              last_modified: file.modifiedTime,
              status: "pending",
              source_type: (file.mimeType === "application/vnd.google-apps.spreadsheet" || file.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") ? "google_sheet" : "document",
            })
            .select("id")
            .single();

          if (error || !inserted) throw error ?? new Error("Insert failed");
          documentId = inserted.id;
        }

        if (!documentId) continue;

        await processDocument(supabase, auth, file, documentId);
        documentsProcessed++;
      } catch (err) {
        console.error("Document process error:", file.name, err);
        const msg =
          err instanceof Error
            ? `${err.name}: ${err.message}`
            : JSON.stringify(err);
        errors.push(`${file.name}: ${msg}`);
        if (existing?.id) {
          await supabase
            .from("knowledge_documents")
            .update({ status: "error" })
            .eq("id", existing.id);
        }
      }
    }

    for (const doc of existingDocs ?? []) {
      if (!driveFileIds.has(doc.google_file_id)) {
        await supabase
          .from("knowledge_documents")
          .delete()
          .eq("id", doc.id);
      }
    }

    const status: SyncResult["status"] =
      errors.length === 0
        ? "success"
        : documentsProcessed > 0
          ? "partial"
          : "error";

    const message =
      errors.length === 0
        ? `Synced ${documentsProcessed} document(s).`
        : `${documentsProcessed} synced. Errors: ${errors.join("; ")}`;

    await supabase.from("sync_logs").insert({
      user_id: userId,
      documents_processed: documentsProcessed,
      status,
      message,
    });

    return { documentsProcessed, status, message };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    console.error("Knowledge sync failed:", err);
    await supabase.from("sync_logs").insert({
      user_id: userId,
      documents_processed: documentsProcessed,
      status: "error",
      message,
    });
    return { documentsProcessed, status: "error", message };
  }
}
