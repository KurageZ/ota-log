import { SQLiteDatabase } from 'expo-sqlite';
import { Trip, CreateTripInput } from '../types/models';
import { generateId } from '../utils/uuid';
import { toISODateTime } from '../utils/date';

export class TripRepository {
  constructor(private db: SQLiteDatabase) {}

  async findAll(): Promise<Trip[]> {
    return this.db.getAllAsync<Trip>(
      'SELECT * FROM trips ORDER BY depart_date DESC, created_at DESC'
    );
  }

  async findById(id: string): Promise<Trip | null> {
    return this.db.getFirstAsync<Trip>(
      'SELECT * FROM trips WHERE id = ?',
      [id]
    );
  }

  async create(input: CreateTripInput): Promise<Trip> {
    const now = toISODateTime();
    const trip: Trip = {
      id: generateId(),
      name: input.name,
      origin_city: input.origin_city ?? null,
      dest_city: input.dest_city ?? null,
      depart_date: input.depart_date ?? null,
      return_date: input.return_date ?? null,
      notes: input.notes ?? null,
      created_at: now,
      updated_at: now,
    };
    await this.db.runAsync(
      `INSERT INTO trips
         (id, name, origin_city, dest_city, depart_date, return_date, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        trip.id, trip.name, trip.origin_city, trip.dest_city,
        trip.depart_date, trip.return_date, trip.notes,
        trip.created_at, trip.updated_at,
      ]
    );
    return trip;
  }

  async update(id: string, input: Partial<CreateTripInput>): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (input.name !== undefined) { fields.push('name = ?'); values.push(input.name); }
    if (input.origin_city !== undefined) { fields.push('origin_city = ?'); values.push(input.origin_city); }
    if (input.dest_city !== undefined) { fields.push('dest_city = ?'); values.push(input.dest_city); }
    if (input.depart_date !== undefined) { fields.push('depart_date = ?'); values.push(input.depart_date); }
    if (input.return_date !== undefined) { fields.push('return_date = ?'); values.push(input.return_date); }
    if (input.notes !== undefined) { fields.push('notes = ?'); values.push(input.notes); }

    if (fields.length === 0) return;

    fields.push('updated_at = ?');
    values.push(toISODateTime());
    values.push(id);

    await this.db.runAsync(
      `UPDATE trips SET ${fields.join(', ')} WHERE id = ?`,
      values as string[]
    );
  }

  async findNextUpcoming(today: string): Promise<Trip | null> {
    return this.db.getFirstAsync<Trip>(
      `SELECT * FROM trips WHERE depart_date >= ? ORDER BY depart_date ASC LIMIT 1`,
      [today]
    );
  }

  async findUpcomingMultiple(today: string, limit: number): Promise<Trip[]> {
    return this.db.getAllAsync<Trip>(
      `SELECT * FROM trips WHERE depart_date >= ? ORDER BY depart_date ASC LIMIT ?`,
      [today, limit]
    );
  }

  async delete(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM trips WHERE id = ?', [id]);
  }
}
