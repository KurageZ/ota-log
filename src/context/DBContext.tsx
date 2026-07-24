import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SQLite from 'expo-sqlite';
import { SQLiteDatabase } from 'expo-sqlite';
import { ActivityIndicator, TouchableOpacity, View, Text } from 'react-native';
import { runMigrations } from '../db/migrations';
import { ArtistRepository } from '../repositories/ArtistRepository';
import { EventRepository } from '../repositories/EventRepository';
import { TripRepository } from '../repositories/TripRepository';
import { ExpenseRepository } from '../repositories/ExpenseRepository';
import { PhotoRepository } from '../repositories/PhotoRepository';
import { ChekiRepository } from '../repositories/ChekiRepository';
import { ChekiManualEntryRepository } from '../repositories/ChekiManualEntryRepository';
import { UserConfigRepository } from '../repositories/UserConfigRepository';
import { DateItemRepository } from '../repositories/DateItemRepository';
import { useAppTheme } from '../theme/appTheme';
import { rebaseLegacyLocalMediaUris } from '../utils/localMedia';
import { materializePresetArtistAvatars } from '../utils/presetArtistMedia';
import { toISODate } from '../utils/date';

export interface Repositories {
  artists: ArtistRepository;
  events: EventRepository;
  trips: TripRepository;
  expenses: ExpenseRepository;
  photos: PhotoRepository;
  cheki: ChekiRepository;
  chekiManualEntries: ChekiManualEntryRepository;
  userConfig: UserConfigRepository;
  dateItems: DateItemRepository;
  rawDb: SQLiteDatabase;
}

const DBContext = createContext<Repositories | null>(null);
const MAX_AUTO_RETRIES = 2;
const RETRY_DELAY_MS = 1200;
let sharedRepositories: Repositories | null = null;
let sharedRepositoriesPromise: Promise<Repositories> | null = null;

function buildRepositories(db: SQLiteDatabase): Repositories {
  return {
    rawDb: db,
    artists: new ArtistRepository(db),
    events: new EventRepository(db),
    trips: new TripRepository(db),
    expenses: new ExpenseRepository(db),
    photos: new PhotoRepository(db),
    cheki: new ChekiRepository(db),
    chekiManualEntries: new ChekiManualEntryRepository(db),
    userConfig: new UserConfigRepository(db),
    dateItems: new DateItemRepository(db),
  };
}

async function initializeDatabase(): Promise<Repositories> {
  if (sharedRepositories) return sharedRepositories;
  if (sharedRepositoriesPromise) return sharedRepositoriesPromise;

  sharedRepositoriesPromise = (async () => {
    const db = await SQLite.openDatabaseAsync('ota.db');
    await db.runAsync('PRAGMA foreign_keys = ON');
    await runMigrations(db);
    await rebaseLegacyLocalMediaUris(db);
    await materializePresetArtistAvatars(db);
    const repositories = buildRepositories(db);
    await repositories.events.reconcileExpiredPlanned(toISODate(new Date()));
    sharedRepositories = repositories;
    return repositories;
  })();

  try {
    return await sharedRepositoriesPromise;
  } catch (error) {
    sharedRepositoriesPromise = null;
    throw error;
  }
}

function resetDatabaseInitializationState() {
  sharedRepositories = null;
  sharedRepositoriesPromise = null;
}

export function DBProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useAppTheme();
  const [repos, setRepos] = useState<Repositories | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const load = async (attempt: number) => {
      try {
        const initializedRepos = await initializeDatabase();
        if (!active) return;
        setRepos(initializedRepos);
        setError(null);
        setIsRetrying(false);
      } catch (err: unknown) {
        if (!active) return;

        const nextAttempt = attempt + 1;
        if (nextAttempt <= MAX_AUTO_RETRIES) {
          setRetryCount(nextAttempt);
          setIsRetrying(true);
          retryTimer = setTimeout(() => {
            void load(nextAttempt);
          }, RETRY_DELAY_MS);
          return;
        }

        setError(String(err));
        setIsRetrying(false);
      }
    };

    setRepos(null);
    setError(null);
    setRetryCount(0);
    setIsRetrying(false);
    void load(0);

    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [reloadKey]);

  const retryInitialization = () => {
    resetDatabaseInitializationState();
    setRepos(null);
    setError(null);
    setRetryCount(0);
    setIsRetrying(false);
    setReloadKey((value) => value + 1);
  };

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.screen }}>
        <Text style={{ fontSize: 17, fontWeight: '700', color: colors.danger, marginBottom: 8 }}>数据加载遇到一点问题</Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 16 }}>
          App 已尝试自动重新加载数据库，你也可以手动再试一次。
        </Text>
        <TouchableOpacity
          onPress={retryInitialization}
          style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.accent, marginBottom: 12 }}
          activeOpacity={0.85}
        >
          <Text style={{ color: colors.onAccent, fontSize: 14, fontWeight: '700' }}>重新加载</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 11, color: colors.textMuted, textAlign: 'center' }} numberOfLines={4}>
          {error}
        </Text>
      </View>
    );
  }

  if (!repos) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.screen }}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={{ marginTop: 12, fontSize: 13, color: colors.textSecondary }}>
          {isRetrying ? `正在重新加载数据…（第 ${retryCount + 1} 次）` : '正在加载数据…'}
        </Text>
      </View>
    );
  }

  return <DBContext.Provider value={repos}>{children}</DBContext.Provider>;
}

export function useDB(): Repositories {
  const repos = useContext(DBContext);
  if (!repos) throw new Error('useDB must be called inside DBProvider');
  return repos;
}
