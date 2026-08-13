import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, Paths } from 'expo-file-system';
import { SQLiteDatabase } from 'expo-sqlite';
import { clearAllDatabaseRows } from '../db/maintenance';

const SQLITE_DIRECTORY_NAME = 'SQLite';

export async function deleteAppManagedDocumentFiles(): Promise<number> {
  try {
    const documentDirectory = new Directory(Paths.document);
    const entries = documentDirectory.list();
    let deletedCount = 0;

    for (const entry of entries) {
      if (entry instanceof Directory && entry.name === SQLITE_DIRECTORY_NAME) {
        continue;
      }
      try {
        entry.delete();
        deletedCount += 1;
      } catch {
        // Best-effort cleanup; a single locked file should not block the reset.
      }
    }

    return deletedCount;
  } catch {
    return 0;
  }
}

export async function resetAppForDevelopment(db: SQLiteDatabase): Promise<void> {
  await clearAllDatabaseRows(db);
  await deleteAppManagedDocumentFiles();
  await AsyncStorage.clear();
}
