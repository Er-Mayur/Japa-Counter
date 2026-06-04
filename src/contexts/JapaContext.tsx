import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { format, subDays, differenceInDays, parseISO, isSameDay } from 'date-fns';

// --- Types ---

export interface JapaSessionData {
  date: string;
  jaaps: number;
  malas: number;
  updatedAt?: string;
}

export interface AppSettings {
  dailyTarget: number;
  monthlyTarget: number;
  yearlyTarget: number;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  notificationsEnabled: boolean;
  reminderTime: string;
  soundVolume: number;
  theme: "light" | "dark" | "auto";
  language: "hi" | "en";
  mantraType: "om" | "gayatri" | "mahamrityunjaya" | "custom";
  customMantra: string;
  vibrationPattern: "soft" | "medium" | "strong";
}

export interface DashboardStats {
  todayJaaps: number;
  todayMalas: number;
  todayTarget: number;
  weeklyMalas: number;
  monthlyMalas: number;
  monthlyTarget: number;
  yearlyMalas: number;
  yearlyTarget: number;
  currentStreak: number;
  longestStreak: number;
  totalJaaps: number;
  totalMalas: number;
  averageMalasPerDay: number;
  completionRate: number;
}

interface JapaContextType {
  // Data
  todayJaaps: number;
  todayMalas: number;
  history: JapaSessionData[];
  settings: AppSettings;
  stats: DashboardStats;
  loading: boolean;

  // Actions
  incrementJaaps: () => void;
  setJaaps: (count: number) => void;
  updateSession: (date: Date, malas: number) => Promise<void>;
  adjustJaapsForDate: (dateStr: string, deltaJaaps: number) => Promise<void>;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  getText: (hindi: string, english: string) => string;
}

// --- Defaults ---

const defaultSettings: AppSettings = {
  dailyTarget: 16,
  monthlyTarget: 150,
  yearlyTarget: 1825,
  soundEnabled: true,
  hapticsEnabled: true,
  notificationsEnabled: false,
  reminderTime: "06:00",
  soundVolume: 50,
  theme: "light",
  language: "en",
  mantraType: "om",
  customMantra: "",
  vibrationPattern: "medium",
};

const defaultStats: DashboardStats = {
  todayJaaps: 0,
  todayMalas: 0,
  todayTarget: 0,
  weeklyMalas: 0,
  monthlyMalas: 0,
  monthlyTarget: 0,
  yearlyMalas: 0,
  yearlyTarget: 0,
  currentStreak: 0,
  longestStreak: 0,
  totalJaaps: 0,
  totalMalas: 0,
  averageMalasPerDay: 0,
  completionRate: 0,
};

// --- Context ---

const JapaContext = createContext<JapaContextType | undefined>(undefined);

export const useJapa = () => {
  const context = useContext(JapaContext);
  if (context === undefined) {
    throw new Error('useJapa must be used within a JapaProvider');
  }
  return context;
};

// --- Provider ---

export const JapaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  
  // State
  const [todayJaaps, setTodayJaaps] = useState(0);
  const [history, setHistory] = useState<JapaSessionData[]>([]);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [currentDate, setCurrentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [settingsUpdatedAt, setSettingsUpdatedAt] = useState<string | null>(null);

  // ── User-scoped storage key helpers ─────────────────────────────────────────
  // All localStorage keys are prefixed with the current user id so that
  // signing in as a different user NEVER leaks data from a previous session.
  const SETTINGS_STORAGE_KEY = user ? `appSettings_${user.id}` : "appSettings";
  const SETTINGS_UPDATED_AT_KEY = user ? `appSettingsUpdatedAt_${user.id}` : "appSettingsUpdatedAt";

  const getStorageKey = useCallback((dateStr: string) => {
    const parsed = new Date(dateStr);
    const base = isNaN(parsed.getTime()) ? dateStr : parsed.toDateString();
    // Prefix with user id so different users never share the same key
    return user ? `${user.id}_${base}` : base;
  }, [user]);

  const getUpdatedAtMs = useCallback((value?: string | null) => {
    if (!value) return 0;
    const ms = new Date(value).getTime();
    return Number.isNaN(ms) ? 0 : ms;
  }, []);

  const persistSettingsToLocal = useCallback((nextSettings: AppSettings, updatedAt: string) => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
    localStorage.setItem(SETTINGS_UPDATED_AT_KEY, updatedAt);
    // No longer write individual flat keys to avoid cross-user pollution
  }, [SETTINGS_STORAGE_KEY, SETTINGS_UPDATED_AT_KEY]);

  const loadSettingsFromLocal = useCallback(() => {
    const cachedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
    const cachedUpdatedAt = localStorage.getItem(SETTINGS_UPDATED_AT_KEY);

    if (cachedSettings) {
      try {
        const parsed = JSON.parse(cachedSettings);
        return {
          settings: { ...defaultSettings, ...parsed },
          updatedAt: cachedUpdatedAt,
        };
      } catch (e) {
        console.error('Error parsing cached settings', e);
      }
    }

    // No fallback to un-scoped flat keys — that was the source of cross-user leakage
    return { settings: { ...defaultSettings }, updatedAt: cachedUpdatedAt };
  }, [SETTINGS_STORAGE_KEY, SETTINGS_UPDATED_AT_KEY]);

  const upsertSettingsToDb = useCallback(async (nextSettings: AppSettings, updatedAt: string) => {
    if (!user) return;
    const { error } = await supabase
      .from('app_settings')
      .upsert({
        user_id: user.id,
        settings: nextSettings as unknown as Json,
        updated_at: updatedAt,
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      console.error('Error saving settings to Supabase:', error);
    }
  }, [user]);

  const syncSettings = useCallback(async () => {
    if (!user) return;

    const localSnapshot = loadSettingsFromLocal();
    const localUpdatedAt = getUpdatedAtMs(localSnapshot.updatedAt);

    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('settings, updated_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      const dbUpdatedAt = getUpdatedAtMs(data?.updated_at);

      if (!data && localUpdatedAt) {
        const updatedAt = localSnapshot.updatedAt || new Date().toISOString();
        await upsertSettingsToDb(localSnapshot.settings, updatedAt);
        return;
      }

      if (dbUpdatedAt > localUpdatedAt) {
        const dbSettings = (data?.settings ?? {}) as unknown as Partial<AppSettings>;
        const nextSettings = { ...defaultSettings, ...dbSettings };
        setSettings(nextSettings);
        if (data?.updated_at) {
          setSettingsUpdatedAt(data.updated_at);
          persistSettingsToLocal(nextSettings, data.updated_at);
        }
      } else if (localUpdatedAt > dbUpdatedAt) {
        const updatedAt = localSnapshot.updatedAt || new Date().toISOString();
        await upsertSettingsToDb(localSnapshot.settings, updatedAt);
      }
    } catch (error) {
      console.error('Error syncing settings:', error);
    }
  }, [user, loadSettingsFromLocal, getUpdatedAtMs, upsertSettingsToDb, persistSettingsToLocal]);

  const upsertSessionState = useCallback((dateStr: string, jaaps: number, malas?: number, updatedAt?: string) => {
    const safeMalas = Number.isFinite(malas) ? (malas as number) : Math.floor(jaaps / 108);
    const storageKey = getStorageKey(dateStr);
    const safeUpdatedAt = updatedAt || new Date().toISOString();
    // Use user-scoped key so different users never share the same history cache
    const japaHistoryKey = user ? `japaHistory_${user.id}` : 'japaHistory';

    setHistory(prev => {
      const existingIndex = prev.findIndex(h => h.date === dateStr);
      const updated = [...prev];
      const entry = { date: dateStr, jaaps, malas: safeMalas, updatedAt: safeUpdatedAt };

      if (existingIndex >= 0) {
        updated[existingIndex] = entry;
      } else {
        updated.push(entry);
      }

      localStorage.setItem(japaHistoryKey, JSON.stringify(updated));
      return updated;
    });

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    if (dateStr === todayStr) {
      setTodayJaaps(jaaps);
    }

    localStorage.setItem(`japaCount_${storageKey}`, jaaps.toString());
    localStorage.setItem(`japaUpdatedAt_${storageKey}`, safeUpdatedAt);
  }, [getStorageKey, user]);

  const syncPendingData = useCallback(async () => {
    if (!user) return;

    // Collect all local dates that have japa data — only keys for the current user
    const userKeyPrefix = `japaCount_${user.id}_`;
    const localDates: { storageKey: string; formattedDate: string; localCount: number; localUpdatedAtRaw: string | null }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(userKeyPrefix)) {
        // Strip the prefix to get the date portion
        const datePart = key.slice(userKeyPrefix.length);
        const localCount = parseInt(localStorage.getItem(key) || '0');
        const date = new Date(datePart);
        if (isNaN(date.getTime())) continue;
        localDates.push({
          storageKey: key.replace('japaCount_', ''), // full scoped key minus "japaCount_"
          formattedDate: format(date, 'yyyy-MM-dd'),
          localCount,
          localUpdatedAtRaw: localStorage.getItem(`japaUpdatedAt_${user.id}_${datePart}`),
        });
      }
    }

    if (localDates.length === 0) return;

    // ONE batch query instead of N individual selects
    const allFormattedDates = localDates.map(d => d.formattedDate);
    const { data: dbRows, error } = await supabase
      .from('japa_sessions')
      .select('date, taps, updated_at')
      .eq('user_id', user.id)
      .in('date', allFormattedDates);

    if (error) { console.error('Error fetching sessions for sync:', error); return; }

    const dbMap = new Map((dbRows || []).map(r => [r.date, r]));
    const upsertRows: { user_id: string; date: string; taps: number; japs: number; updated_at: string }[] = [];

    for (const { storageKey, formattedDate, localCount, localUpdatedAtRaw } of localDates) {
      const localUpdatedAt = getUpdatedAtMs(localUpdatedAtRaw);
      const dbData = dbMap.get(formattedDate);
      const dbCount = dbData?.taps || 0;
      const dbUpdatedAt = getUpdatedAtMs(dbData?.updated_at);
      const localWins = localUpdatedAt > dbUpdatedAt;
      const dbWins = dbUpdatedAt > localUpdatedAt;

      if (localWins || (!localUpdatedAt && localCount > dbCount)) {
        const malas = Math.floor(localCount / 108);
        const updatedAt = localUpdatedAtRaw && getUpdatedAtMs(localUpdatedAtRaw) ? localUpdatedAtRaw : new Date().toISOString();
        upsertRows.push({ user_id: user.id, date: formattedDate, taps: localCount, japs: malas, updated_at: updatedAt });
        upsertSessionState(formattedDate, localCount, malas, updatedAt);
      } else if (dbWins) {
        localStorage.setItem(`japaCount_${storageKey}`, dbCount.toString());
        upsertSessionState(formattedDate, dbCount, Math.floor(dbCount / 108), dbData?.updated_at);
      }
    }

    // Bulk upsert all local-wins in one call
    if (upsertRows.length > 0) {
      const { error: upsertError } = await supabase
        .from('japa_sessions')
        .upsert(upsertRows, { onConflict: 'user_id,date' });
      if (upsertError) console.error('Bulk sync upsert failed:', upsertError);
    }
  }, [user, upsertSessionState, getUpdatedAtMs]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`japa_sessions_${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'japa_sessions', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const record = payload.new as { date?: string; taps?: number; japs?: number; updated_at?: string } | null;
          if (!record?.date) return;
          const jaaps = record.taps ?? 0;
          const malas = record.japs ?? Math.floor(jaaps / 108);
          upsertSessionState(record.date, jaaps, malas, record.updated_at);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, upsertSessionState]);

  useEffect(() => {
    if (!user) return;
    syncSettings();
  }, [user, syncSettings]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`app_settings_${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_settings', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const record = payload.new as { settings?: AppSettings; updated_at?: string } | null;
          if (!record?.settings || !record.updated_at) return;

          const localUpdatedAt = getUpdatedAtMs(settingsUpdatedAt || localStorage.getItem(SETTINGS_UPDATED_AT_KEY));
          const dbUpdatedAt = getUpdatedAtMs(record.updated_at);
          if (dbUpdatedAt > localUpdatedAt) {
            const nextSettings = { ...defaultSettings, ...record.settings };
            setSettings(nextSettings);
            setSettingsUpdatedAt(record.updated_at);
            persistSettingsToLocal(nextSettings, record.updated_at);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, getUpdatedAtMs, settingsUpdatedAt, persistSettingsToLocal]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncPendingData();
      syncSettings();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial sync if online
    if (navigator.onLine) {
      syncPendingData();
      syncSettings();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncPendingData, syncSettings]);

  // Check for date change
  useEffect(() => {
    const checkDate = () => {
      const nowStr = format(new Date(), 'yyyy-MM-dd');
      if (nowStr !== currentDate) {
        setCurrentDate(nowStr);
        setTodayJaaps(0);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkDate();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    const interval = setInterval(checkDate, 60000); // Check every minute

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [currentDate]);

  // Settings are loaded inside the user-change effect below (with user scoping).
  // No on-mount settings load here — that was a source of cross-user data leakage.

  // Load data from Supabase when user changes
  useEffect(() => {
    if (!user) {
      // ── Clear ALL in-memory state so the next user starts clean ─────────────
      setLoading(false);
      setTodayJaaps(0);
      setHistory([]);
      setSettings(defaultSettings);
      setSettingsUpdatedAt(null);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      
      // Always try to load today's count from localStorage first (most recent source of truth for today)
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const todayStorageKey = getStorageKey(todayStr);
      const localCount = localStorage.getItem(`japaCount_${todayStorageKey}`);
      const localUpdatedAtRaw = localStorage.getItem(`japaUpdatedAt_${todayStorageKey}`);
      const localUpdatedAt = getUpdatedAtMs(localUpdatedAtRaw);
      let localTodayJaaps = 0;
      if (localCount) {
        localTodayJaaps = parseInt(localCount);
        setTodayJaaps(localTodayJaaps);
      }

      // Try to load user-scoped cached history
      const japaHistoryKey = `japaHistory_${user.id}`;
      const cachedHistory = localStorage.getItem(japaHistoryKey);
      if (cachedHistory) {
        try {
          setHistory(JSON.parse(cachedHistory));
        } catch (e) {
          console.error('Error parsing cached history', e);
        }
      }

      // Load user-scoped settings from localStorage
      const { settings: localSettings, updatedAt: localSettingsUpdatedAt } = loadSettingsFromLocal();
      setSettings(localSettings);
      if (localSettingsUpdatedAt) setSettingsUpdatedAt(localSettingsUpdatedAt);

      try {
        // Fetch last 365 days only — enough for streak + stats, prevents unlimited growth
        const since = format(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
        const { data, error } = await supabase
          .from('japa_sessions')
          .select('date, taps, japs, updated_at')
          .eq('user_id', user.id)
          .gte('date', since)
          .order('date', { ascending: false });

        if (error) throw error;

        const formattedHistory = (data || []).map(session => ({
          date: session.date,
          jaaps: session.taps || 0,
          malas: session.japs || 0,
          updatedAt: session.updated_at || undefined,
        }));

        setHistory(formattedHistory);
        // Cache the history under a user-scoped key
        const japaHistoryKey = `japaHistory_${user.id}`;
        localStorage.setItem(japaHistoryKey, JSON.stringify(formattedHistory));

        formattedHistory.forEach((session) => {
          const storageKey = getStorageKey(session.date);
          localStorage.setItem(`japaCount_${storageKey}`, session.jaaps.toString());
          if (session.updatedAt) {
            localStorage.setItem(`japaUpdatedAt_${storageKey}`, session.updatedAt);
          }
        });

        // Set today's taps from DB if greater than local (e.g. synced from another device)
        // OR if local is 0 and DB has data.
        setCurrentDate(todayStr);
        const todaySession = formattedHistory.find(s => s.date === todayStr);
        const dbUpdatedAt = getUpdatedAtMs(todaySession?.updatedAt);
        
        if (todaySession) {
          if (dbUpdatedAt >= localUpdatedAt) {
             setTodayJaaps(todaySession.jaaps);
             // Update local storage to match DB
             localStorage.setItem(`japaCount_${todayStorageKey}`, todaySession.jaaps.toString());
             if (todaySession.updatedAt) {
               localStorage.setItem(`japaUpdatedAt_${todayStorageKey}`, todaySession.updatedAt);
             }
          }
        } 

      } catch (error) {
        console.error('Error loading japa data:', error);
        // If error (offline), we already loaded from localStorage above
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user, getStorageKey, getUpdatedAtMs]);

  // Debounced save to Supabase
  useEffect(() => {
    if (!user) return;

    const saveToSupabase = async () => {
      if (!isOnline) return;

      const today = new Date();
      const dateString = format(today, 'yyyy-MM-dd');
      const storageKey = getStorageKey(dateString);
      const updatedAt = localStorage.getItem(`japaUpdatedAt_${storageKey}`) || new Date().toISOString();
      const malas = Math.floor(todayJaaps / 108);

      try {
        const { error } = await supabase
          .from('japa_sessions')
          .upsert({
            user_id: user.id,
            date: dateString,
            taps: todayJaaps,
            japs: malas,
            updated_at: updatedAt,
          }, {
            onConflict: 'user_id,date'
          });

        if (error) throw error;
      } catch (error) {
        console.error('Error saving to Supabase:', error);
      }
    };

    // Save to localStorage immediately
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const storageKey = getStorageKey(todayStr);
    localStorage.setItem(`japaCount_${storageKey}`, todayJaaps.toString());
    if (!localStorage.getItem(`japaUpdatedAt_${storageKey}`)) {
      localStorage.setItem(`japaUpdatedAt_${storageKey}`, new Date().toISOString());
    }

    // Debounce Supabase save (2 seconds)
    const timeoutId = setTimeout(saveToSupabase, 2000);
    return () => clearTimeout(timeoutId);
  }, [todayJaaps, user, getStorageKey]);

  // Actions
  const incrementJaaps = useCallback(() => {
    const nowStr = format(new Date(), 'yyyy-MM-dd');
    const nextJaaps = nowStr !== currentDate ? 1 : todayJaaps + 1;
    const updatedAt = new Date().toISOString();
    if (nowStr !== currentDate) {
      setCurrentDate(nowStr);
    }
    upsertSessionState(nowStr, nextJaaps, Math.floor(nextJaaps / 108), updatedAt);
  }, [currentDate, todayJaaps, upsertSessionState]);

  const setJaaps = useCallback((count: number) => {
    const nowStr = format(new Date(), 'yyyy-MM-dd');
    const updatedAt = new Date().toISOString();
    upsertSessionState(nowStr, count, Math.floor(count / 108), updatedAt);
  }, [upsertSessionState]);

  const updateSession = useCallback(async (date: Date, malas: number) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const jaaps = malas * 108;
    const updatedAt = new Date().toISOString();

    // Update local state immediately
    upsertSessionState(dateStr, jaaps, malas, updatedAt);

    // Sync to Supabase if online
    if (user && navigator.onLine) {
      try {
        const { error } = await supabase
          .from('japa_sessions')
          .upsert({
            user_id: user.id,
            date: dateStr,
            taps: jaaps,
            japs: malas,
            updated_at: updatedAt,
          }, {
            onConflict: 'user_id,date'
          });
        if (error) throw error;
      } catch (error) {
        console.error('Error updating session:', error);
      }
    }
  }, [user, upsertSessionState]);

  const adjustJaapsForDate = useCallback(async (dateStr: string, deltaJaaps: number) => {
    if (!dateStr || deltaJaaps === 0) return;

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const storageKey = getStorageKey(dateStr);
    let currentJaaps = 0;

    if (dateStr === todayStr) {
      currentJaaps = todayJaaps;
    } else {
      const historyEntry = history.find(h => h.date === dateStr);
      if (historyEntry) {
        currentJaaps = historyEntry.jaaps;
      } else {
        const localCount = localStorage.getItem(`japaCount_${storageKey}`);
        currentJaaps = localCount ? parseInt(localCount, 10) || 0 : 0;
      }
    }

    const nextJaaps = Math.max(0, currentJaaps + deltaJaaps);
    const updatedAt = new Date().toISOString();
    upsertSessionState(dateStr, nextJaaps, Math.floor(nextJaaps / 108), updatedAt);

    if (user && navigator.onLine) {
      try {
        const { error } = await supabase
          .from('japa_sessions')
          .upsert({
            user_id: user.id,
            date: dateStr,
            taps: nextJaaps,
            japs: Math.floor(nextJaaps / 108),
            updated_at: updatedAt,
          }, {
            onConflict: 'user_id,date'
          });
        if (error) throw error;
      } catch (error) {
        console.error('Error adjusting session:', error);
      }
    }
  }, [getStorageKey, history, todayJaaps, upsertSessionState, user]);

  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      const updatedAt = new Date().toISOString();
      setSettingsUpdatedAt(updatedAt);
      persistSettingsToLocal(updated, updatedAt);
      if (user && navigator.onLine) {
        void upsertSettingsToDb(updated, updatedAt);
      }
      return updated;
    });
  }, [user, persistSettingsToLocal, upsertSettingsToDb]);

  const getText = useCallback((hindi: string, english: string) => {
    switch (settings.language) {
      case 'hi': return hindi;
      case 'en': return english;
      default: return `${hindi} / ${english}`;
    }
  }, [settings.language]);

  // Derived Stats
  const stats = useMemo(() => {
    const todayMalas = Math.floor(todayJaaps / 108);
    
    // Calculate totals from history + current todayJaaps
    // Note: history might already contain today's entry if fetched, 
    // but todayJaaps is the source of truth for today.
    
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const historyWithoutToday = history.filter(h => h.date !== todayStr);
    
    const totalJaaps = historyWithoutToday.reduce((acc, curr) => acc + curr.jaaps, 0) + todayJaaps;
    const totalMalas = historyWithoutToday.reduce((acc, curr) => acc + curr.malas, 0) + todayMalas;
    
    // Calculate Monthly and Yearly Malas
    const currentMonthStr = format(new Date(), 'yyyy-MM');
    const currentYearStr = format(new Date(), 'yyyy');

    const monthlyMalas = historyWithoutToday
      .filter(h => h.date.startsWith(currentMonthStr))
      .reduce((acc, curr) => acc + curr.malas, 0) + todayMalas;

    const yearlyMalas = historyWithoutToday
      .filter(h => h.date.startsWith(currentYearStr))
      .reduce((acc, curr) => acc + curr.malas, 0) + todayMalas;
    
    // Calculate streak
    // Streak increments if malas >= 16
    const dailyMalasMap = new Map<string, number>();
    history.forEach(h => dailyMalasMap.set(h.date, h.malas));
    dailyMalasMap.set(todayStr, todayMalas);

    let currentStreak = 0;
    // Check today
    if (todayMalas >= 16) {
      currentStreak++;
    }

    // Check past days
    let checkDate = new Date();
    // Limit loop to avoid infinite loops in case of weird date issues, though unlikely
    for (let i = 0; i < 3650; i++) { 
      checkDate = subDays(checkDate, 1);
      const dateStr = format(checkDate, 'yyyy-MM-dd');
      const malas = dailyMalasMap.get(dateStr) || 0;
      
      if (malas >= 16) {
        currentStreak++;
      } else {
        break;
      }
    }

    // Calculate Average Malas Per Day
    let averageMalasPerDay = 0;
    // Combine history dates and today
    const allDates = [...history.map(h => h.date), todayStr].sort();
    const firstDateStr = allDates[0];
    
    if (firstDateStr && totalMalas > 0) {
      const firstDate = parseISO(firstDateStr);
      const todayDate = new Date();
      // Add 1 to include the first day
      const totalDays = Math.max(1, differenceInDays(todayDate, firstDate) + 1);
      averageMalasPerDay = Math.round(totalMalas / totalDays);
    }
    
    return {
      ...defaultStats,
      todayJaaps,
      todayMalas,
      todayTarget: settings.dailyTarget,
      monthlyMalas,
      monthlyTarget: settings.monthlyTarget,
      yearlyMalas,
      yearlyTarget: settings.yearlyTarget,
      totalJaaps,
      totalMalas,
      currentStreak,
      averageMalasPerDay,
      completionRate: settings.dailyTarget > 0 ? Math.min((todayMalas / settings.dailyTarget) * 100, 100) : 0,
      // Add more complex stats calculations here as needed
    };
  }, [todayJaaps, history, settings]);

  const value = {
    todayJaaps,
    todayMalas: Math.floor(todayJaaps / 108),
    history,
    settings,
    stats,
    loading,
    incrementJaaps,
    setJaaps,
    updateSession,
    adjustJaapsForDate,
    updateSettings,
    getText,
  };

  return <JapaContext.Provider value={value}>{children}</JapaContext.Provider>;
};
