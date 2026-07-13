import Database from 'better-sqlite3';
import { SQLiteDatabase } from 'expo-sqlite';

type SQLParam = string | number | null | Uint8Array;

function normalizeParams(params?: unknown[]): SQLParam[] {
  return (params ?? []) as SQLParam[];
}

export function createAsyncSQLiteAdapter(db: Database.Database): SQLiteDatabase {
  return {
    getFirstAsync: async <T>(sql: string, params?: unknown[]) => {
      const row = db.prepare(sql).get(...normalizeParams(params)) as T | undefined;
      return row ?? null;
    },
    getAllAsync: async <T>(sql: string, params?: unknown[]) => (
      db.prepare(sql).all(...normalizeParams(params)) as T[]
    ),
    runAsync: async (sql: string, params?: unknown[]) => {
      const normalized = normalizeParams(params);
      if (normalized.length > 0) {
        return db.prepare(sql).run(...normalized);
      }
      return db.prepare(sql).run();
    },
    execAsync: async (sql: string) => {
      db.exec(sql);
    },
    withTransactionAsync: async <T>(callback: () => Promise<T>) => {
      db.exec('BEGIN');
      try {
        const result = await callback();
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  } as unknown as SQLiteDatabase;
}
