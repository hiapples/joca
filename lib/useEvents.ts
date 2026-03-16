// lib/useEvents.ts
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
import { PartyEvent, EventType, CreatorProfile } from '../types';
import { useAuth } from './auth';

const EVENTS_KEY = 'events_cache_v1';
const PROFILE_KEY = 'profile_v1';

// 你的後端 API
const API_BASE = 'http://192.168.1.139:4000';

export type NewEventPayload = {
  type: EventType;
  region: string;
  place: string;
  timeRange: string;
  timeISO: string;
  builtInPeople: number;
  maxPeople: number;
  notes?: string;
  createdByProfile?: CreatorProfile | null;
};

async function fetchJson(url: string, options?: RequestInit) {
  const res = await fetch(url, options);

  const txt = await res.text();
  let data: any = null;

  try {
    data = JSON.parse(txt);
  } catch {
    data = { error: txt || 'Server error' };
  }

  if (!res.ok) {
    throw new Error(data?.error || 'Server error');
  }

  return data;
}

async function loadProfileSnapshot() {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    if (!raw) return null;

    let p: any = {};
    try {
      p = JSON.parse(raw);
    } catch (e) {
      console.log('解析 profile snapshot 失敗', e);
      return null;
    }

    const userId = typeof p.userId === 'string' ? p.userId : '';
    if (!userId) return null;

    return {
      userId,
      nickname: p.nickname || '',
      gender: p.gender === '男' || p.gender === '女' ? p.gender : null,
      age: typeof p.age === 'number' ? p.age : null,
      intro: p.intro || '',
      photoUri: p.photoUri || '',
    };
  } catch (e) {
    console.log('讀取 profile snapshot 失敗', e);
    return null;
  }
}

async function saveProfileSnapshot(profile: {
  userId: string;
  nickname?: string;
  gender?: '男' | '女' | null;
  age?: number | null;
  intro?: string;
  photoUri?: string;
}) {
  try {
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.log('儲存 profile snapshot 失敗', e);
  }
}

async function fetchMe(accessToken: string) {
  const data = await fetchJson(API_BASE + '/users/me', {
    headers: { Authorization: 'Bearer ' + accessToken },
  });
  return data;
}

function toSnapshotFromMe(me: any, fallbackUserId: string) {
  const userId =
    typeof me?.userId === 'string'
      ? me.userId
      : typeof me?._id === 'string'
        ? me._id
        : fallbackUserId;

  return {
    userId: String(userId || ''),
    nickname: typeof me?.nickname === 'string' ? me.nickname : '',
    gender: me?.gender === '男' || me?.gender === '女' ? me.gender : null,
    age: typeof me?.age === 'number' ? me.age : null,
    intro: typeof me?.intro === 'string' ? me.intro : '',
    photoUri: typeof me?.photoUri === 'string' ? me.photoUri : '',
  };
}

function normalizeCreatorProfile(input?: CreatorProfile | null): CreatorProfile {
  const p = input && typeof input === 'object' ? input : {};
  const gender = p.gender === '男' || p.gender === '女' ? p.gender : null;
  const age = typeof p.age === 'number' ? p.age : null;

  return {
    nickname: typeof p.nickname === 'string' ? p.nickname : '',
    gender: gender,
    age: age,
    intro: typeof p.intro === 'string' ? p.intro : '',
    photoUri: typeof p.photoUri === 'string' ? p.photoUri : '',
  };
}

export function useEvents() {
  const [events, setEvents] = useState<PartyEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const { accessToken, user } = useAuth();
  const myUserId = user && user.userId ? String(user.userId) : '';

  const persistCache = useCallback(async (list: PartyEvent[]) => {
    setEvents(list);
    try {
      await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(list));
    } catch (e) {
      console.log('儲存 EVENTS 快取失敗', e);
    }
  }, []);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchJson(API_BASE + '/events?limit=50');
      if (Array.isArray(list)) {
        await persistCache(list);
      } else {
        setEvents([]);
      }
    } catch (e) {
      console.log('載入活動失敗:', e);
      try {
        const raw = await AsyncStorage.getItem(EVENTS_KEY);
        if (raw) {
          const cached = JSON.parse(raw);
          if (Array.isArray(cached)) setEvents(cached);
        }
      } catch (err2) {
        console.log('讀取 EVENTS 快取失敗:', err2);
      }
    } finally {
      setLoading(false);
    }
  }, [persistCache]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const reload = useCallback(async () => {
    await loadEvents();
  }, [loadEvents]);

  // ✅ 先信任目前登入中的帳號，再退回本機快照
  const getProfileSnapshot = useCallback(async () => {
    if (accessToken) {
      try {
        const me = await fetchMe(accessToken);
        const snap = toSnapshotFromMe(me, myUserId);

        if (snap.userId) {
          await saveProfileSnapshot(snap);
          return snap;
        }
      } catch (e) {
        console.log('fetch /users/me 失敗', e);
      }
    }

    const cached = await loadProfileSnapshot();
    if (cached && cached.userId) return cached;

    return null;
  }, [accessToken, myUserId]);

  const addEvent = useCallback(
    async (ev: NewEventPayload) => {
      let createdByProfile = normalizeCreatorProfile(ev.createdByProfile || null);

      const profileSnap = await getProfileSnapshot();
      if (!profileSnap || !profileSnap.userId) {
        throw new Error('找不到會員資料');
      }

      if (!ev.createdByProfile) {
        createdByProfile = {
          nickname: profileSnap.nickname || '',
          gender: profileSnap.gender,
          age: profileSnap.age,
          intro: profileSnap.intro || '',
          photoUri: profileSnap.photoUri || '',
        };
      }

      const body = {
        type: ev.type,
        region: ev.region,
        place: ev.place,
        timeRange: ev.timeRange,
        timeISO: ev.timeISO,
        builtInPeople: ev.builtInPeople,
        maxPeople: ev.maxPeople,
        notes: ev.notes || '',
        attendees: [],
        createdAt: dayjs().toISOString(),
        createdBy: profileSnap.userId,
        createdByProfile: createdByProfile,
      };

      const created = (await fetchJson(API_BASE + '/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })) as PartyEvent;

      setEvents((prev) => [created, ...prev]);
    },
    [getProfileSnapshot]
  );

  const getEvent = useCallback(async (id: string) => {
    if (!id) return null;

    const data = (await fetchJson(API_BASE + '/events/' + id)) as PartyEvent;

    setEvents((prev) => {
      const idx = prev.findIndex((e) => String(e.id) === String(data.id));
      if (idx === -1) return [data, ...prev];
      const arr = [...prev];
      arr[idx] = data;
      return arr;
    });

    return data;
  }, []);

  const joinEvent = useCallback(
    async (eventId: string) => {
      const profile = await getProfileSnapshot();
      if (!profile) throw new Error('請先完成會員資料');

      const url = API_BASE + '/events/' + String(eventId) + '/join';
      const body = {
        userId: profile.userId,
        profile: {
          nickname: profile.nickname,
          gender: profile.gender,
          age: profile.age,
          intro: profile.intro,
          photoUri: profile.photoUri,
        },
      };

      const updated = (await fetchJson(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })) as PartyEvent;

      setEvents((prev) => {
        const idx = prev.findIndex((e) => String(e.id) === String(updated.id));
        if (idx === -1) return [updated, ...prev];
        const arr = [...prev];
        arr[idx] = updated;
        return arr;
      });

      return updated;
    },
    [getProfileSnapshot]
  );

  const confirmAttendee = useCallback(
    async (eventId: string, attendeeId: string, action: 'confirm' | 'reject') => {
      const url =
        API_BASE +
        '/events/' +
        String(eventId) +
        '/attendees/' +
        String(attendeeId) +
        '/confirm';

      const updated = (await fetchJson(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: action }),
      })) as PartyEvent;

      setEvents((prev) => {
        const idx = prev.findIndex((e) => String(e.id) === String(updated.id));
        if (idx === -1) return [updated, ...prev];
        const arr = [...prev];
        arr[idx] = updated;
        return arr;
      });

      return updated;
    },
    []
  );

  const cancelAttend = useCallback(async (eventId: string, attendeeId: string) => {
    const url =
      API_BASE +
      '/events/' +
      String(eventId) +
      '/attendees/' +
      String(attendeeId) +
      '/cancel';

    const updated = (await fetchJson(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })) as PartyEvent;

    setEvents((prev) => {
      const idx = prev.findIndex((e) => String(e.id) === String(updated.id));
      if (idx === -1) return [updated, ...prev];
      const arr = [...prev];
      arr[idx] = updated;
      return arr;
    });

    return updated;
  }, []);

  const removeAttendee = useCallback(async (eventId: string, attendeeId: string) => {
    const url =
      API_BASE +
      '/events/' +
      String(eventId) +
      '/attendees/' +
      String(attendeeId) +
      '/remove';

    const updated = (await fetchJson(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })) as PartyEvent;

    setEvents((prev) => {
      const idx = prev.findIndex((e) => String(e.id) === String(updated.id));
      if (idx === -1) return [updated, ...prev];
      const arr = [...prev];
      arr[idx] = updated;
      return arr;
    });

    return updated;
  }, []);

  const sendMessage = useCallback(
    async (eventId: string, text: string) => {
      const profile = await getProfileSnapshot();
      if (!profile) throw new Error('請先完成會員資料');

      const url = API_BASE + '/events/' + String(eventId) + '/messages';

      const body = {
        userId: profile.userId,
        text: text,
        profile: {
          nickname: profile.nickname,
          gender: profile.gender,
          age: profile.age,
          intro: profile.intro,
          photoUri: profile.photoUri,
        },
      };

      const updated = (await fetchJson(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })) as PartyEvent;

      setEvents((prev) => {
        const idx = prev.findIndex((e) => String(e.id) === String(updated.id));
        if (idx === -1) return [updated, ...prev];
        const arr = [...prev];
        arr[idx] = updated;
        return arr;
      });

      return updated;
    },
    [getProfileSnapshot]
  );

  const retractMessage = useCallback(
    async (eventId: string, messageId: string) => {
      const profile = await getProfileSnapshot();
      if (!profile) throw new Error('請先完成會員資料');

      const url =
        API_BASE +
        '/events/' +
        String(eventId) +
        '/messages/' +
        String(messageId) +
        '/retract';

      const updated = (await fetchJson(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: profile.userId,
        }),
      })) as PartyEvent;

      setEvents((prev) => {
        const idx = prev.findIndex((e) => String(e.id) === String(updated.id));
        if (idx === -1) return [updated, ...prev];
        const arr = [...prev];
        arr[idx] = updated;
        return arr;
      });

      return updated;
    },
    [getProfileSnapshot]
  );

  const deleteEvent = useCallback(async (id: string) => {
    const url = API_BASE + '/events/' + String(id);
    console.log('準備刪除活動 id =', id);

    await fetchJson(url, { method: 'DELETE' });

    setEvents((prev) => prev.filter((ev) => String(ev.id) !== String(id)));
  }, []);

  const getUnreadCount = useCallback(
    async (eventId: string): Promise<number> => {
      const profile = await getProfileSnapshot();
      if (!profile) return 0;

      const me = profile.userId;

      const ev = events.find((x) => String(x.id) === String(eventId));
      if (!ev || !Array.isArray(ev.messages)) return 0;

      const msgs = ev.messages.filter((m) => m.userId !== me);
      return msgs.length;
    },
    [events, getProfileSnapshot]
  );

  return {
    events,
    loading,
    reload,
    addEvent,
    deleteEvent,
    getEvent,
    joinEvent,
    confirmAttendee,
    cancelAttend,
    removeAttendee,
    sendMessage,
    retractMessage,
    getUnreadCount,
  };
}