// lib/useEvents.ts
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
import { PartyEvent } from '../types';

const EVENTS_KEY = 'events_cache_v1';
const PROFILE_KEY = 'profile_v1';

// 你的後端 API
const API_BASE = 'http://192.168.1.139:4000';

export type NewEventPayload = {
  type: string;
  region: string;
  place: string;
  timeRange: string;
  timeISO: string;
  builtInPeople: number;
  maxPeople: number;
  notes?: string;
};

// ============ 公用：安全拿 JSON，錯誤時 throw ============

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

// ============ 讀使用者資料快照（報名/聊天用） ============

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

// ======================================================
// useEvents hook
// ======================================================
export function useEvents() {
  const [events, setEvents] = useState<PartyEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // -------- 本地快取 --------
  const persistCache = useCallback(async (list: PartyEvent[]) => {
    setEvents(list);
    try {
      await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(list));
    } catch (e) {
      console.log('儲存 EVENTS 快取失敗', e);
    }
  }, []);

  // -------- 初次載入 all events --------
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
      // fallback: 用快取
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

  // ======================================================
  // 新增活動
  // ======================================================
  const addEvent = useCallback(
    async (ev: NewEventPayload) => {
      const profile = await loadProfileSnapshot();
      if (!profile) throw new Error('找不到會員資料');

      const body = {
        ...ev,
        attendees: [],
        createdAt: dayjs().toISOString(),
        createdBy: profile.userId,
        createdByProfile: {
          nickname: profile.nickname,
          gender: profile.gender,
          age: profile.age,
          intro: profile.intro,
          photoUri: profile.photoUri,
        },
      };

      const created = (await fetchJson(API_BASE + '/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })) as PartyEvent;

      setEvents((prev) => [created, ...prev]);
    },
    []
  );

  // ======================================================
  // 取得單筆
  // ======================================================
  const getEvent = useCallback(async (id: string) => {
    if (!id) return null;

    const data = (await fetchJson(API_BASE + '/events/' + id)) as PartyEvent;

    // 放進 events cache
    setEvents((prev) => {
      const idx = prev.findIndex((e) => String(e.id) === String(data.id));
      if (idx === -1) return [data, ...prev];
      const arr = [...prev];
      arr[idx] = data;
      return arr;
    });

    return data;
  }, []);

  // ======================================================
  // 報名（含：被移除/拒絕/取消 → 永不能再報名）
  // ======================================================
  const joinEvent = useCallback(async (eventId: string) => {
    const profile = await loadProfileSnapshot();
    if (!profile) throw new Error('請先完成會員資料');

    const url = `${API_BASE}/events/${eventId}/join`;
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
  }, []);

  // ======================================================
  // 主揪確認 / 拒絕
  // ======================================================
  const confirmAttendee = useCallback(
    async (
      eventId: string,
      attendeeId: string,
      action: 'confirm' | 'reject'
    ) => {
      const url = `${API_BASE}/events/${eventId}/attendees/${attendeeId}/confirm`;

      const updated = (await fetchJson(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
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

  // ======================================================
  // 報名者自己取消（cancelled → 不能再報名）
  // ======================================================
  const cancelAttend = useCallback(
    async (eventId: string, attendeeId: string) => {
      const url = `${API_BASE}/events/${eventId}/attendees/${attendeeId}/cancel`;

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
    },
    []
  );

  // ======================================================
  // 主揪移除已接受（removed → 永不能再報名）
  // ======================================================
  const removeAttendee = useCallback(
    async (eventId: string, attendeeId: string) => {
      const url = `${API_BASE}/events/${eventId}/attendees/${attendeeId}/remove`;

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
    },
    []
  );

  // ======================================================
  // 聊天訊息（只有主揪 & confirmed 可以發言）
  // ======================================================
  const sendMessage = useCallback(
    async (eventId: string, text: string) => {
      const profile = await loadProfileSnapshot();
      if (!profile) throw new Error('請先完成會員資料');

      const url = `${API_BASE}/events/${eventId}/messages`;

      const body = {
        userId: profile.userId,
        text,
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
    []
  );

  // ======================================================
  // 刪除活動（只有主揪會按）
  // ======================================================
  const deleteEvent = useCallback(async (id: string) => {
    const url = `${API_BASE}/events/${id}`;
    console.log('準備刪除活動 id =', id);

    await fetchJson(url, { method: 'DELETE' });

    // 從前端移除
    setEvents((prev) => prev.filter((ev) => String(ev.id) !== String(id)));
  }, []);

  // ======================================================
  // 未讀訊息計數（保留原本功能）
  // ======================================================
  const getUnreadCount = useCallback(
    async (eventId: string): Promise<number> => {
      const profile = await loadProfileSnapshot();
      if (!profile) return 0;

      const me = profile.userId;

      const ev = events.find((x) => String(x.id) === String(eventId));
      if (!ev || !Array.isArray(ev.messages)) return 0;

      // 自己發的訊息不算未讀
      const msgs = ev.messages.filter((m) => m.userId !== me);

      return msgs.length;
    },
    [events]
  );

  // ======================================================
  // 返回全部功能
  // ======================================================
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
    getUnreadCount,
  };
}
