export type EventType =
  | 'concert'
  | 'livehouse'
  | 'festival'
  | 'handshake'
  | 'signing'
  | 'fanmeeting'
  | 'other';

export type EventStatus = 'completed' | 'planned' | 'wishlist' | 'cancelled';

export type DateItemSourceKind = 'manual' | 'linked_activity' | 'first_cheki' | 'first_live';

export type DateItemAnniversaryKind = 'day' | 'month' | 'year';

export type ExpenseCategory =
  | 'hotel'
  | 'transport'
  | 'ticket'
  | 'tokuten'
  | 'merch'
  | 'other';

export interface Artist {
  id: string;
  name: string;
  short_name: string | null;
  parent_id: string | null;
  avatar_uri: string | null;
  background_uri: string | null;
  background_color: string | null;
  url: string | null;
  is_favorite: number;
  created_at: string;
}

export interface Event {
  id: string;
  title: string;
  event_type: EventType;
  actual_expense: number | null;
  /** Compatibility projection from the representative session. */
  event_date: string;
  event_time: string | null;
  open_time: string | null;
  start_time: string | null;
  end_time: string | null;
  city: string | null;
  venue: string | null;
  /** Compatibility alias of actual_expense until the activity UI is migrated. */
  ticket_price: number | null;
  status: EventStatus;
  review_score: number | null;
  notes: string | null;
  details: string | null;
  url: string | null;
  setlist_text: string | null;
  trip_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventSession {
  id: string;
  event_id: string;
  title: string | null;
  session_date: string;
  end_date: string | null;
  open_time: string | null;
  start_time: string | null;
  end_time: string | null;
  city: string | null;
  venue: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface EventTimetableEntry {
  id: string;
  session_id: string;
  title: string;
  artist_id: string | null;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Cheki {
  id: string;
  event_id: string | null;
  artist_id: string | null;
  photo_uri: string;
  front_photo_uri: string | null;
  back_photo_uri: string | null;
  date: string | null;
  price: number | null;
  notes: string | null;
  is_favorite: 0 | 1;
  created_at: string;
}

export interface ChekiManualEntry {
  id: string;
  artist_id: string;
  event_id: string | null;
  date: string | null;
  count: number;
  total_price: number | null;
  created_at: string;
  updated_at: string;
}

export interface ChekiRecord {
  id: string;
  event_id: string | null;
  artist_id: string | null;
  date: string | null;
  quantity: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChekiItem {
  id: string;
  record_id: string;
  sort_order: number;
  unit_price: number;
  display_aspect_ratio: number;
  is_favorite: 0 | 1;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ChekiImageSide = 'front' | 'back';

export interface ChekiItemImage {
  id: string;
  item_id: string;
  side: ChekiImageSide;
  photo_uri: string;
  created_at: string;
  updated_at: string;
}

export interface ChekiCalendarDaySummary {
  date: string;
  totalCount: number;
  photoCount: number;
  noPhotoCount: number;
  artistCount: number;
  latestPhotoUri: string | null;
  fallbackArtistAvatarUri: string | null;
}

export interface CreateChekiInput {
  event_id?: string | null;
  artist_id?: string | null;
  photo_uri: string;
  date?: string | null;
  price?: number | null;
  notes?: string | null;
}

export interface CreateChekiManualEntryInput {
  artist_id: string;
  event_id?: string | null;
  date?: string | null;
  count: number;
  total_price?: number | null;
}

export interface UpdateChekiInput {
  date?: string | null;
  artist_id?: string | null;
  event_id?: string | null;
  price?: number | null;
  notes?: string | null;
}

export interface UpdateChekiManualEntryInput {
  artist_id?: string;
  event_id?: string | null;
  date?: string | null;
  count?: number;
  total_price?: number | null;
}

export interface Photo {
  id: string;
  event_id: string | null;
  local_uri: string;
  created_at: string;
}

export interface Trip {
  id: string;
  name: string;
  origin_city: string | null;
  dest_city: string | null;
  depart_date: string | null;
  return_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  trip_id: string | null;
  event_id: string | null;
  category: ExpenseCategory;
  amount: number;
  notes: string | null;
  created_at: string;
}

export interface CreateEventInput {
  title: string;
  event_type: EventType;
  event_date: string;
  event_time?: string | null;
  city?: string | null;
  venue?: string | null;
  ticket_price?: number | null;
  actual_expense?: number | null;
  status: EventStatus;
  review_score?: number | null;
  notes?: string | null;
  details?: string | null;
  url?: string | null;
  setlist_text?: string | null;
  trip_id?: string | null;
}

export interface CreateEventSessionInput {
  title?: string | null;
  session_date: string;
  end_date?: string | null;
  open_time?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  city?: string | null;
  venue?: string | null;
  sort_order?: number;
}

export interface ReplaceEventSessionInput extends CreateEventSessionInput {
  id?: string;
}

export type CreateEventWithSessionsInput = Omit<
  CreateEventInput,
  'event_date' | 'event_time' | 'city' | 'venue' | 'ticket_price'
> & {
  sessions: CreateEventSessionInput[];
};

export interface CreateEventTimetableEntryInput {
  title: string;
  artist_id?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  notes?: string | null;
  sort_order?: number;
}

export interface EventSessionScheduleInput extends ReplaceEventSessionInput {
  timetable: CreateEventTimetableEntryInput[];
}

export type CreateEventWithScheduleInput = Omit<CreateEventWithSessionsInput, 'sessions'> & {
  sessions: EventSessionScheduleInput[];
  artist_ids: string[];
};

export type UpdateEventWithScheduleInput = Omit<CreateEventWithScheduleInput, 'event_type'>;

export interface CreateArtistInput {
  name: string;
  short_name?: string | null;
  parent_id?: string | null;
  avatar_uri?: string | null;
  background_uri?: string | null;
  background_color?: string | null;
  url?: string | null;
}

export interface CreateTripInput {
  name: string;
  origin_city?: string | null;
  dest_city?: string | null;
  depart_date?: string | null;
  return_date?: string | null;
  notes?: string | null;
}

export interface CreateExpenseInput {
  trip_id?: string | null;
  event_id?: string | null;
  category: ExpenseCategory;
  amount: number;
  notes?: string | null;
}

export type ArtistConfirmationMode = 'always' | 'matches_only' | 'never';

export interface UserConfig {
  id: string;
  name: string;
  avatar_uri: string | null;
  avatar_emoji: string;
  oshi_artist_id: string | null;
  artist_confirmation_mode: ArtistConfirmationMode;
  updated_at: string;
}

export interface CreateUserConfigInput {
  name?: string;
  avatar_uri?: string | null;
  avatar_emoji?: string;
  oshi_artist_id?: string | null;
  artist_confirmation_mode?: ArtistConfirmationMode;
}

export interface DateItem {
  id: string;
  title: string;
  date: string;
  source_kind: DateItemSourceKind;
  linked_event_id: string | null;
  notes: string | null;
  show_on_calendar: number;
  reminder_enabled: number;
  reminder_offset_days: number;
  reminder_time: string;
  created_at: string;
  updated_at: string;
}

export interface DateItemArtist {
  important_date_id: string;
  artist_id: string;
}

export interface DateItemAnniversaryRule {
  id: string;
  important_date_id: string;
  anniversary_kind: DateItemAnniversaryKind;
  anniversary_value: number;
  label: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

export interface ScheduledReminderState {
  id: string;
  target_kind: 'important_date' | 'important_date_anniversary';
  target_id: string;
  notification_id: string;
  scheduled_for: string;
  updated_at: string;
}

export interface CreateDateItemInput {
  title: string;
  date: string;
  source_kind: DateItemSourceKind;
  linked_event_id?: string | null;
  notes?: string | null;
  show_on_calendar?: boolean;
  reminder_enabled?: boolean;
  reminder_offset_days?: number;
  reminder_time?: string;
  artistIds?: string[];
}

export interface UpdateDateItemInput {
  title?: string;
  date?: string;
  source_kind?: DateItemSourceKind;
  linked_event_id?: string | null;
  notes?: string | null;
  show_on_calendar?: boolean;
  reminder_enabled?: boolean;
  reminder_offset_days?: number;
  reminder_time?: string;
  artistIds?: string[];
}
