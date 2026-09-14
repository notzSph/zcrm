import type { Interaction, LeadAttachment } from "@/lib/types";

/**
 * Contract for the server-owned lead timeline. Entries are already ordered and
 * rendered; the client must not merge, infer, or deduplicate diary events.
 */
export type LeadTimelineEntry = {
  id: string;
  occurred_at: string;
  kind: "activity" | "interaction" | "reminder" | "system";
  title: string;
  body?: string | null;
  actor?: string | null;
};

export type LeadTimelinePage = {
  entries: LeadTimelineEntry[];
  next_cursor: string | null;
};

export type CreateInteractionInput = Pick<
  Interaction,
  "interaction_type" | "body" | "occurred_at" | "external_ref"
>;

export type UploadProgress = (percent: number) => void;
export type LeadDrawerApi = {
  getTimeline(leadId: string, cursor?: string | null): Promise<LeadTimelinePage>;
  createInteraction(leadId: string, input: CreateInteractionInput): Promise<Interaction>;
  listAttachments(leadId: string): Promise<LeadAttachment[]>;
  uploadAttachment(leadId: string, file: File, kind: string, onProgress: UploadProgress): Promise<LeadAttachment>;
  deleteAttachment(attachmentId: string): Promise<void>;
};

type ApiError = Error & { status?: number };

async function responseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = new Error("The request could not be completed.") as ApiError;
    error.status = response.status;
    throw error;
  }
  return response.json() as Promise<T>;
}

function xhrUpload(leadId: string, file: File, kind: string, onProgress: UploadProgress) {
  return new Promise<LeadAttachment>((resolve, reject) => {
    const request = new XMLHttpRequest();
    const form = new FormData();
    form.append("file", file);
    form.append("kind", kind);
    request.open("POST", `/api/leads/${leadId}/attachments`);
    request.responseType = "json";
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) resolve(request.response as LeadAttachment);
      else {
        const error = new Error("Upload failed.") as ApiError;
        error.status = request.status;
        reject(error);
      }
    });
    request.addEventListener("error", () => reject(new Error("Upload failed. Check your connection and retry.")));
    request.send(form);
  });
}

export const leadDrawerApi: LeadDrawerApi = {
  async getTimeline(leadId, cursor) {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    return responseJson<LeadTimelinePage>(await fetch(`/api/leads/${leadId}/timeline${query}`, { cache: "no-store" }));
  },
  async createInteraction(leadId, input) {
    return responseJson<Interaction>(await fetch(`/api/leads/${leadId}/interactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }));
  },
  async listAttachments(leadId) {
    return responseJson<LeadAttachment[]>(await fetch(`/api/leads/${leadId}/attachments`, { cache: "no-store" }));
  },
  uploadAttachment: xhrUpload,
  async deleteAttachment(attachmentId) {
    const response = await fetch(`/api/attachments/${attachmentId}`, { method: "DELETE" });
    if (!response.ok) throw new Error("Could not delete the file.");
  },
};
