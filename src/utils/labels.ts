import { EventStatus, EventType, ExpenseCategory } from '../types/models';

export const STATUS_LABELS: Record<EventStatus, string> = {
  completed: '已完成',
  planned: '计划中',
  wishlist: '心愿单',
  cancelled: '已取消',
};

export const STATUS_VALUES: EventStatus[] = ['wishlist', 'planned', 'completed', 'cancelled'];

export const TYPE_LABELS: Record<EventType, string> = {
  concert: '演唱会',
  livehouse: 'Livehouse',
  festival: '音乐节',
  handshake: '握手会',
  signing: '签售会',
  fanmeeting: '见面会',
  other: '其他',
};

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  hotel: '住宿',
  transport: '交通',
  ticket: '票券',
  tokuten: '特典',
  merch: '周边',
  other: '其他',
};
