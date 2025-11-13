// lib/storage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PartyEvent } from '../types';

const KEY = 'party_events_v1';

export async function loadEvents(): Promise<PartyEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: PartyEvent[] = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('loadEvents error', e);
    return [];
  }
}

export async function saveEvents(list: PartyEvent[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('saveEvents error', e);
  }
}
