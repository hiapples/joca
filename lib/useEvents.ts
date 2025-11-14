// src/lib/useEvents.ts
import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
import { PartyEvent, EventType, HostProfileSnapshot } from '../types';

const PROFILE_KEY = 'profile_v1';

// ⭐ 你的後端網址（目前是你電腦 IP）
const API_BASE = 'http://192.168.1.139:4000';

// 前端「發起活動」時要傳進來的欄位
type NewEventInput = {
  type: EventType;
  region: string;
  place: string;
  timeRange: string;      // e.g. "20:00"
  timeISO: string;        // ISO 字串
  builtInPeople: number;
  maxPeople: number;
  notes: string;
  attendees?: any[];      // 可選，預設 []
};

type UseEventsResult = {
  events: PartyEvent[];
  loading: boolean;
  reload: () => Promise<void>;
  addEvent: (payload: NewEventInput) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
};

type ProfileSnapshotWithId = {
  userId: string;
  profile: HostProfileSnapshot;
};

// 🔹 從 AsyncStorage 抓會員資料，順便確保有 userId（沒有就幫你生一個）
async function loadProfileSnapshotAndEnsureUserId(): Promise<ProfileSnapshotWithId | null> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    if (!raw) {
      return null;
    }

    let p: any = {};
    try {
      p = JSON.parse(raw) || {};
    } catch (e) {
      console.log('解析 profile_v1 失敗:', e);
      p = {};
    }

    // userId：沒有就產生一個
    let userId: string = '';
    if (typeof p.userId === 'string' && p.userId.trim().length > 0) {
      userId = p.userId.trim();
    } else {
      userId = 'u_' + Date.now();
      p.userId = userId;
      try {
        await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(p));
      } catch (e) {
        console.log('寫入 userId 失敗:', e);
      }
    }

    const nickname =
      typeof p.nickname === 'string' ? p.nickname.trim() : '';
    const gender: '男' | '女' | null =
      p.gender === '男' || p.gender === '女' ? p.gender : null;
    const ageNum = Number(p.age);
    const age =
      Number.isFinite(ageNum) && ageNum > 0 ? ageNum : null;
    const intro =
      typeof p.intro === 'string' ? p.intro : '';
    const photoUri =
      typeof p.photoUri === 'string' ? p.photoUri : undefined;

    const profile: HostProfileSnapshot = {
      nickname,
      gender,
      age,
      intro,
      photoUri,
    };

    return {
      userId,
      profile,
    };
  } catch (e) {
    console.log('讀取 PROFILE_KEY 失敗:', e);
    return null;
  }
}

export function useEvents(): UseEventsResult {
  const [events, setEvents] = useState<PartyEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // 🔹 從後端載入活動列表
  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(API_BASE + '/events');
      if (!res.ok) {
        console.log('GET /events 非 200 狀態碼:', res.status);
        setEvents([]);
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (Array.isArray(data)) {
        setEvents(data as PartyEvent[]);
      } else {
        setEvents([]);
      }
    } catch (e) {
      console.log('載入活動失敗:', e);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 🔹 首次掛載時載入
  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // 🔹 給外面用的 reload（首頁下拉重整、focus 時也會用）
  const reload = useCallback(async () => {
    await loadEvents();
  }, [loadEvents]);

  // 🔹 新增活動：CreateEvent 呼叫的就是這個 addEvent(payload)
  const addEvent = useCallback(
    async (payload: NewEventInput) => {
      const profileInfo = await loadProfileSnapshotAndEnsureUserId();
      if (!profileInfo) {
        Alert.alert(
          '提醒',
          '找不到會員資料，請先在會員頁填寫暱稱 / 性別 / 年齡'
        );
        return;
      }

      const nowISO = dayjs().toISOString();

      const body = {
        type: payload.type,
        region: payload.region,
        place: payload.place,
        timeRange: payload.timeRange,
        timeISO: payload.timeISO,

        builtInPeople: payload.builtInPeople,
        maxPeople: payload.maxPeople,

        notes: payload.notes || '',
        attendees: Array.isArray(payload.attendees)
          ? payload.attendees
          : [],

        createdAt: nowISO,

        // ⭐ 主揪（用會員的 userId + 快照）
        createdBy: profileInfo.userId,
        createdByProfile: profileInfo.profile,
      };

      try {
        const res = await fetch(API_BASE + '/events', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        const text = await res.text();
        console.log('POST /events 狀態:', res.status, '內容:', text);

        if (!res.ok) {
          Alert.alert('建立活動失敗', '伺服器回應錯誤，請稍後再試');
          return;
        }

        const created = JSON.parse(text) as PartyEvent;

        // 新活動塞到最前面
        setEvents(function (prev) {
          return [created].concat(prev);
        });
      } catch (e) {
        console.log('呼叫 POST /events 錯誤:', e);
        Alert.alert('建立活動失敗', '連線錯誤，請稍後再試');
      }
    },
    []
  );

  // 🔹 刪除活動：不管後端結果如何，前端一定把卡片移除
  const deleteEvent = useCallback(
    async (id: string) => {
      const url = API_BASE + '/events/' + String(id);
      console.log('準備刪除活動 id =', id, 'url =', url);

      try {
        const res = await fetch(url, {
          method: 'DELETE',
        });

        const text = await res.text();
        console.log(
          'DELETE /events 回應狀態:',
          res.status,
          '內容:',
          text
        );
      } catch (e) {
        console.log('呼叫 DELETE /events 錯誤:', e);
      }

      // ⭐ 無論如何，先把前端的列表移除這筆，避免永遠刪不掉
      setEvents(function (prev) {
        return prev.filter(function (ev) {
          return String(ev.id) !== String(id);
        });
      });
    },
    []
  );

  return {
    events,
    loading,
    reload,
    addEvent,
    deleteEvent,
  };
}
