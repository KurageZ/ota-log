import { SQLiteDatabase } from 'expo-sqlite';
import { CreateExpenseInput, Expense } from '../types/models';
import { generateId } from '../utils/uuid';
import { toISODateTime } from '../utils/date';

export class ExpenseRepository {
  constructor(private db: SQLiteDatabase) {}

  async findAll(): Promise<Expense[]> {
    return this.db.getAllAsync<Expense>(
      'SELECT * FROM expenses ORDER BY created_at ASC'
    );
  }

  async findByTripId(tripId: string): Promise<Expense[]> {
    return this.db.getAllAsync<Expense>(
      'SELECT * FROM expenses WHERE trip_id = ? ORDER BY created_at ASC',
      [tripId]
    );
  }

  async findByEventId(eventId: string): Promise<Expense[]> {
    return this.db.getAllAsync<Expense>(
      'SELECT * FROM expenses WHERE event_id = ? ORDER BY created_at ASC',
      [eventId]
    );
  }

  async sumByTripId(tripId: string): Promise<number> {
    const row = await this.db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses
       WHERE trip_id = ?
          OR event_id IN (SELECT id FROM events WHERE trip_id = ?)`,
      [tripId, tripId]
    );
    return row?.total ?? 0;
  }

  async sumByEventId(eventId: string): Promise<number> {
    const row = await this.db.getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE event_id = ?',
      [eventId]
    );
    return row?.total ?? 0;
  }

  async create(input: CreateExpenseInput): Promise<Expense> {
    const expense: Expense = {
      id: generateId(),
      trip_id: input.trip_id ?? null,
      event_id: input.event_id ?? null,
      category: input.category,
      amount: input.amount,
      notes: input.notes ?? null,
      created_at: toISODateTime(),
    };
    await this.db.runAsync(
      `INSERT INTO expenses (id, trip_id, event_id, category, amount, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        expense.id, expense.trip_id, expense.event_id,
        expense.category, expense.amount, expense.notes, expense.created_at,
      ]
    );
    return expense;
  }

  async update(id: string, input: Partial<CreateExpenseInput>): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (input.category !== undefined) { fields.push('category = ?'); values.push(input.category); }
    if (input.amount !== undefined) { fields.push('amount = ?'); values.push(input.amount); }
    if (input.notes !== undefined) { fields.push('notes = ?'); values.push(input.notes); }
    if (input.trip_id !== undefined) { fields.push('trip_id = ?'); values.push(input.trip_id); }
    if (input.event_id !== undefined) { fields.push('event_id = ?'); values.push(input.event_id); }

    if (fields.length === 0) return;
    values.push(id);

    await this.db.runAsync(
      `UPDATE expenses SET ${fields.join(', ')} WHERE id = ?`,
      values as string[]
    );
  }

  async groupByCategory(year?: number): Promise<{ category: string; total: number }[]> {
    if (year != null) {
      return this.db.getAllAsync<{ category: string; total: number }>(
        `SELECT e.category, SUM(e.amount) AS total
         FROM expenses e
         WHERE e.event_id IN (SELECT id FROM event_first_summaries WHERE event_date LIKE ? || '-%')
            OR e.trip_id IN (SELECT id FROM trips WHERE depart_date LIKE ? || '-%')
         GROUP BY e.category
         ORDER BY total DESC`,
        [String(year), String(year)]
      );
    }
    return this.db.getAllAsync<{ category: string; total: number }>(
      `SELECT category, SUM(amount) AS total FROM expenses GROUP BY category ORDER BY total DESC`
    );
  }

  async sumAll(): Promise<number> {
    const row = await this.db.getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(amount), 0) AS total FROM expenses'
    );
    return row?.total ?? 0;
  }

  async sumByYear(year: number): Promise<number> {
    const row = await this.db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(e.amount), 0) AS total
       FROM expenses e
       WHERE e.event_id IN (SELECT id FROM event_first_summaries WHERE event_date LIKE ? || '-%')
          OR e.trip_id IN (SELECT id FROM trips WHERE depart_date LIKE ? || '-%')`,
      [String(year), String(year)]
    );
    return row?.total ?? 0;
  }

  async delete(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM expenses WHERE id = ?', [id]);
  }
}
