export type WebhookSource = "SHOPIFY" | "WOOCOMMERCE";
export type WebhookStatus = "RECEIVED" | "PROCESSING" | "SYNCED" | "FAILED";
export type LogLevel = "INFO" | "WARN" | "ERROR";

export interface SyncLog {
  id: string;
  message: string;
  level: LogLevel;
  created_at: string;
}

export interface WebhookEvent {
  id: string;
  source: WebhookSource;
  event_type: string;
  external_id: string;
  raw_payload: Record<string, unknown>;
  status: WebhookStatus;
  created_at: string;
  updated_at: string;
  logs?: SyncLog[];
}

export interface SyncStats {
  total_24h: number;
  synced: number;
  failed: number;
  avg_processing_ms: number | null;
}

export interface PaginatedEvents {
  data: WebhookEvent[];
  total: number;
  page: number;
  page_size: number;
}
