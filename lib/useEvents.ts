// lib/useEvents.ts
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PartyEvent } from '../types';

const STORAGE_KEY = 'party_events_v1';

export function useEvents() {
  const [events, setEvents] = useState<PartyEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);

      if (raw) {
        const parsed = JSON.parse(raw);
        setEvents(Array.isArray(parsed) ? parsed : []);
      } else {
        setEvents([]);
      }
    } catch (e) {
      console.log('讀取錯誤:', e);
    } finally {
      setLoading(false);
    }
  }

  async function save(next: PartyEvent[]) {
    setEvents(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.log('寫入錯誤:', e);
    }
  }

  async function reload() {
    await loadEvents();
  }

  async function addEvent(ev: PartyEvent) {
    const next = [...events, ev];
    await save(next);
  }

  async function deleteEvent(id: string) {
    const next = events.filter((e) => String(e.id) !== String(id));
    await save(next);
  }

  return {
    events,
    loading,
    reload,
    addEvent,
    deleteEvent,
  };
}
