import type { SupabaseClient } from "@supabase/supabase-js";
import type { OAuth2Client } from "google-auth-library";
import { getGeminiClient, GEMINI_MODEL } from "@/ai/gemini";
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

async function extractDocumentMetadata(
  documentName: string,
  textSample: string
): Promise<{ project_name: string; industry: string }> {
  const ai = getGeminiClient();
  const prompt = `From this WhileOne project document, extract metadata.

Document title: ${documentName}
Content sample:
${textSample.slice(0, 2500)}

Respond in JSON only: {"project_name": "...", "industry": "..."}
Use the document title if no better project name is found.`;

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });
    const parsed = JSON.parse(response.text ?? "{}") as {
      project_name?: string;
      industry?: string;
    };
    return {
      project_name: parsed.project_name ?? documentName,
      industry: parsed.industry ?? "Technology",
    };
  } catch {
    return { project_name: documentName, industry: "Technology" };
  }
}

async function processDocument(
  supabase: SupabaseClient<Database>,
  userId: string,
  auth: OAuth2Client,
  file: DriveDocument,
  documentId: string
) {
  console.log("================================");
  console.log("PROCESSING:", file.name);

  await supabase
    .from("knowledge_documents")
    .update({ status: "processing" })
    .eq("id", documentId);

  const text = await fetchDocumentText(auth, file);

  console.log("TEXT LENGTH:", text?.length ?? 0);
  console.log("TEXT SAMPLE:", text?.slice(0, 200));

  const chunks = chunkText(text);

  console.log("CHUNK COUNT:", chunks.length);

  const metadata = await extractDocumentMetadata(file.name, text);

  console.log("METADATA:", metadata);

  const { error: deleteError } = await supabase
    .from("knowledge_chunks")
    .delete()
    .eq("document_id", documentId);

  if (deleteError) {
    console.error("DELETE CHUNKS ERROR:", deleteError);
    throw deleteError;
  }

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    console.log(
      `PROCESSING CHUNK ${i + 1}/${chunks.length} (${chunk.length} chars)`
    );

    try {
      const embedding = await generateEmbedding(chunk);

      console.log("EMBEDDING LENGTH:", embedding.length);

      const { error: insertError } = await supabase
        .from("knowledge_chunks")
        .insert({
          document_id: documentId,
          chunk_text: chunk,
          project_name: metadata.project_name,
          industry: metadata.industry,
          embedding: embeddingToPgVector(embedding),
        });

      if (insertError) {
        console.error("CHUNK INSERT ERROR:", insertError);
        throw insertError;
      }

      console.log(`CHUNK ${i + 1} INSERTED`);
    } catch (err) {
      console.error(`CHUNK ${i + 1} FAILED:`, err);
      throw err;
    }
  }

  const { error: updateError } = await supabase
    .from("knowledge_documents")
    .update({
      status: "synced",
      last_modified: file.modifiedTime,
      document_name: file.name,
    })
    .eq("id", documentId);

  if (updateError) {
    console.error("DOCUMENT UPDATE ERROR:", updateError);
    throw updateError;
  }

  console.log("DOCUMENT SYNCED:", file.name);
  console.log("================================");
}

export async function syncKnowledgeBase(
  supabase: SupabaseClient<Database>,
  userId: string,
  auth: OAuth2Client,
  folderId: string
): Promise<SyncResult> {
  let documentsProcessed = 0;
  const errors: string[] = [];

  try {
    const driveFiles = await listGoogleDocsInFolder(auth, folderId);
    const driveFileIds = new Set(driveFiles.map((f) => f.id));

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
  (
    modified > existingModified ||
    existing.status === "processing" ||
    existing.status === "error"
  );

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
            })
            .select("id")
            .single();

          if (error || !inserted) throw error ?? new Error("Insert failed");
          documentId = inserted.id;
        }

        if (!documentId) continue;

        await processDocument(supabase, userId, auth, file, documentId);
        documentsProcessed++;
      } catch (err) {
        console.error("DOCUMENT PROCESS ERROR:", err);
      
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
    await supabase.from("sync_logs").insert({
      user_id: userId,
      documents_processed: documentsProcessed,
      status: "error",
      message,
    });
    return { documentsProcessed, status: "error", message };
  }
}
