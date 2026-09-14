import type { Interaction, LeadAttachment } from "@/lib/types";

export type TimelineActor = { id: string; name: string } | null;
export type TimelinePayload =
  | { type: "interaction"; interaction_type: string; body: string; external_ref: string | null }
  | { type: "attachment"; attachment_id: string; filename: string; size_bytes: number; content_type: string | null; kind: string }
  | { type: "status_change"; from_status: string | null; to_status: string }
  | { type: "note"; body: string };

/** The server is authoritative: preserve the supplied items and their order. */
type TimelineItemBase = {
  id: string;
  occurred_at: string;
  actor: TimelineActor;
  source: string;
  revision: number;
  redacted: boolean;
};
export type LeadTimelineItem = TimelineItemBase & (
  | { kind: "interaction"; payload: Extract<TimelinePayload, { type: "interaction" }> }
  | { kind: "attachment"; payload: Extract<TimelinePayload, { type: "attachment" }> }
  | { kind: "status_change"; payload: Extract<TimelinePayload, { type: "status_change" }> }
  | { kind: "note"; payload: Extract<TimelinePayload, { type: "note" }> }
);

export type LeadTimelinePage = {
  schema_version: string;
  snapshot_seq: number;
  items: LeadTimelineItem[];
  next_cursor: string | null;
};

export type CreateInteractionInput = Pick<
  Interaction,
  "interaction_type" | "body" | "occurred_at" | "external_ref"
>;

export type UploadProgress = (percent: number) => void;
export type AttachmentInitiateInput = {
  filename: string;
  content_type: string | null;
  size_bytes: number;
  kind: string;
};
export type AttachmentInitiation = {
  attachment_id: string;
  upload: { url: string; method?: "PUT" | "POST"; headers?: Record<string, string> };
};

export type LeadDrawerApi = {
  getTimeline(leadId: string, cursor?: string | null): Promise<LeadTimelinePage>;
  createInteraction(leadId: string, input: CreateInteractionInput, idempotencyKey: string): Promise<Interaction>;
  listAttachments(leadId: string): Promise<LeadAttachment[]>;
  initiateAttachment(leadId: string, input: AttachmentInitiateInput): Promise<AttachmentInitiation>;
  uploadAttachment(initiation: AttachmentInitiation, file: File, onProgress: UploadProgress): Promise<void>;
  completeAttachment(attachmentId: string): Promise<LeadAttachment>;
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

function xhrUpload(initiation: AttachmentInitiation, file: File, onProgress: UploadProgress) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(initiation.upload.method ?? "PUT", initiation.upload.url);
    Object.entries(initiation.upload.headers ?? {}).forEach(([name, value]) => request.setRequestHeader(name, value));
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else {
        const error = new Error("Upload failed.") as ApiError;
        error.status = request.status;
        reject(error);
      }
    });
    request.addEventListener("error", () => reject(new Error("Upload failed. Check your connection and retry.")));
    request.send(file);
  });
}

export const leadDrawerApi: LeadDrawerApi = {
  async getTimeline(leadId, cursor) {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    return responseJson<LeadTimelinePage>(await fetch(`/api/leads/${leadId}/timeline${query}`, { cache: "no-store" }));
  },
  async createInteraction(leadId, input, idempotencyKey) {
    return responseJson<Interaction>(await fetch(`/api/leads/${leadId}/interactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(input),
    }));
  },
  async listAttachments(leadId) {
    return responseJson<LeadAttachment[]>(await fetch(`/api/leads/${leadId}/attachments`, { cache: "no-store" }));
  },
  async initiateAttachment(leadId, input) {
    // Assumption: the documented frontend contract reserves the attachment and returns a signed upload target here.
    return responseJson<AttachmentInitiation>(await fetch(`/api/leads/${leadId}/attachments/initiate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }));
  },
  uploadAttachment: xhrUpload,
  async completeAttachment(attachmentId) {
    // Assumption: completion is a typed POST and returns the finalized attachment record.
    return responseJson<LeadAttachment>(await fetch(`/api/attachments/${attachmentId}/complete`, { method: "POST" }));
  },
  async deleteAttachment(attachmentId) {
    const response = await fetch(`/api/attachments/${attachmentId}`, { method: "DELETE" });
    if (!response.ok) throw new Error("Could not delete the file.");
  },
};
