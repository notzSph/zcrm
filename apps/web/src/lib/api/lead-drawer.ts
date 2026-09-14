import type { Interaction, Lead, LeadAttachment, LeadStatus } from "@/lib/types";

export type TimelineActor = {
  type: string;
  id: string | null;
  label: string | null;
};

export type TimelineSource = {
  type: string;
  label: string | null;
};

type InteractionTimelinePayload = {
  interaction_type: string;
  body: string | null;
  external_ref: string | null;
};

type AttachmentTimelinePayload = {
  filename: string | null;
  content_type: string | null;
  size_bytes: number | null;
  kind: string;
  status: string;
};

type ActivityTimelinePayload = {
  event_type?: string;
  from?: string;
  to?: string;
  title?: string;
  fields?: string[];
  [key: string]: unknown;
};

type TimelineItemBase = {
  id: string;
  schema_version: number;
  occurred_at: string | null;
  recorded_at: string;
  actor: TimelineActor;
  source: TimelineSource;
  revision: number;
  redacted: boolean;
};

export type LeadTimelineItem = TimelineItemBase & (
  | { kind: "interaction"; payload: InteractionTimelinePayload }
  | { kind: "attachment"; payload: AttachmentTimelinePayload }
  | { kind: "activity"; payload: ActivityTimelinePayload }
);

/** The cursor carries the server snapshot; the client preserves item order verbatim. */
export type LeadTimelinePage = {
  items: LeadTimelineItem[];
  next_cursor: string | null;
};

export type CreateInteractionInput = Pick<
  Interaction,
  "interaction_type" | "body" | "occurred_at" | "external_ref"
>;

export type StatusTransitionInput = {
  status: LeadStatus;
  next_action: string | null;
  reason: string | null;
  expected_version: number;
};

export type UploadProgress = (percent: number) => void;
export type LeadDrawerApi = {
  getTimeline(leadId: string, cursor?: string | null): Promise<LeadTimelinePage>;
  createInteraction(leadId: string, input: CreateInteractionInput, idempotencyKey: string): Promise<Interaction>;
  transitionStatus(leadId: string, input: StatusTransitionInput): Promise<Lead>;
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
  async createInteraction(leadId, input, idempotencyKey) {
    return responseJson<Interaction>(await fetch(`/api/leads/${leadId}/interactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(input),
    }));
  },
  async transitionStatus(leadId, input) {
    return responseJson<Lead>(await fetch(`/api/leads/${leadId}/status-transitions`, {
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
