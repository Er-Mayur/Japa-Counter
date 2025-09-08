import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, parseISO } from 'date-fns';

export interface JapaSessionData {
  date: string;
  taps: number;
  japs: number;
}

export const useJapaSessions = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<JapaSessionData[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSessions = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('japa_sessions')
        .select('date, taps, japs')
        .eq('user_id', user.id);

      if (error) throw error;

      const formattedSessions = (data || []).map(session => ({
        date: session.date,
        taps: session.taps || 0,
        japs: session.japs || 0,
      }));

      setSessions(formattedSessions);
    } catch (error) {
      console.error('Error loading japa sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSession = async (date: Date, taps: number, japs: number) => {
    if (!user) return;

    try {
      const dateString = format(date, 'yyyy-MM-dd');
      
      const { error } = await supabase
        .from('japa_sessions')
        .upsert({
          user_id: user.id,
          date: dateString,
          taps,
          japs,
        }, {
          onConflict: 'user_id,date'
        });

      if (error) throw error;

      // Update local state
      setSessions(prev => {
        const updated = prev.filter(s => s.date !== dateString);
        return [...updated, { date: dateString, taps, japs }];
      });
    } catch (error) {
      console.error('Error saving japa session:', error);
      throw error;
    }
  };

  const getSessionData = (date: Date): JapaSessionData | null => {
    const dateString = format(date, 'yyyy-MM-dd');
    return sessions.find(session => session.date === dateString) || null;
  };

  useEffect(() => {
    loadSessions();
  }, [user]);

  return {
    sessions,
    loading,
    saveSession,
    getSessionData,
    refreshSessions: loadSessions,
  };
};