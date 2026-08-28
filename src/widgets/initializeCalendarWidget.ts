import type { ChekiRepository } from '../repositories/ChekiRepository';
import type { AppCalendarWeekStart, AppThemeId } from '../theme/config';

export async function initializeCalendarWidget(
  _cheki: ChekiRepository,
  _themeId: AppThemeId,
  _weekStart: AppCalendarWeekStart,
  _now = new Date(),
): Promise<void> {}
