export interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  entity_type: "contact" | "task" | "followup" | null;
  entity_id: number | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationListResponse {
  items: Notification[];
  unread_count: number;
}
