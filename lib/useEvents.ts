// lib/useEvents.ts
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
import { useAuth } from './auth';
import { PartyEvent, EventType } from '../types';
import { API_BASE } from './config';

type AddEventInput = {
  type: EventType;
  region: string;
  place: string;
  timeRange: string;
  timeISO: string;
  builtInPeople: number;
  maxPeople: number;
  notes?: string;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

export function useEvents() {
  const { user } = useAuth();

  const [events, setEvents] = useState<PartyEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const myUserId = user && user.userId ? String(user.userId) : '';

  const myProfile = {
    nickname: user?.nickname || '',
    gender: user?.gender || null,
    age: typeof user?.age === 'number' ? user.age : null,
    intro: user?.intro || '',
    photoUri: user?.photoUri || '',
  };

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(API_BASE + '/events');
      const data = await safeJson(res);

      if (!res.ok) {
        throw new Error((data && data.error) || '載入活動失敗');
      }

      const list = Array.isArray(data) ? data : [];
      setEvents(list);
      return list;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const getEvent = useCallback(async (id: string) => {
    const res = await fetch(API_BASE + '/events/' + String(id));
    const data = await safeJson(res);

    if (!res.ok) {
      throw new Error((data && data.error) || '取得活動失敗');
    }

    return data;
  }, []);

  const addEvent = useCallback(
    async (input: AddEventInput) => {
      if (!myUserId) {
        throw new Error('找不到會員資料');
      }

      const body = {
        type: input.type,
        region: input.region,
        place: input.place,
        timeRange: input.timeRange,
        timeISO: input.timeISO,
        builtInPeople: input.builtInPeople,
        maxPeople: input.maxPeople,
        notes: input.notes || '',
        createdBy: myUserId,
        createdByProfile: myProfile,
        attendees: [],
      };

      const res = await fetch(API_BASE + '/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await safeJson(res);

      if (!res.ok) {
        throw new Error((data && data.error) || '新增活動失敗');
      }

      await reload();
      return data;
    },
    [myUserId, myProfile, reload]
  );

  const deleteEvent = useCallback(async (id: string) => {
    const res = await fetch(API_BASE + '/events/' + String(id), {
      method: 'DELETE',
    });

    const data = await safeJson(res);

    if (!res.ok) {
      throw new Error((data && data.error) || '刪除活動失敗');
    }

    setEvents((prev) => prev.filter((e) => String(e.id) !== String(id)));
    return data;
  }, []);

  const joinEvent = useCallback(
    async (eventId: string) => {
      if (!myUserId) {
        throw new Error('缺少 userId');
      }

      const res = await fetch(API_BASE + '/events/' + String(eventId) + '/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: myUserId,
          profile: myProfile,
        }),
      });

      const data = await safeJson(res);

      if (!res.ok) {
        throw new Error((data && data.error) || '加入房間失敗');
      }

      setEvents((prev) =>
        prev.map((e) => (String(e.id) === String(eventId) ? data : e))
      );

      return data;
    },
    [myUserId, myProfile]
  );

  const cancelAttend = useCallback(async (eventId: string, attendeeId: string) => {
    const res = await fetch(
      API_BASE +
        '/events/' +
        String(eventId) +
        '/attendees/' +
        String(attendeeId) +
        '/cancel',
      {
        method: 'POST',
      }
    );

    const data = await safeJson(res);

    if (!res.ok) {
      throw new Error((data && data.error) || '離開房間失敗');
    }

    setEvents((prev) =>
      prev.map((e) => (String(e.id) === String(eventId) ? data : e))
    );

    return data;
  }, []);

  const removeAttendee = useCallback(async (eventId: string, attendeeId: string) => {
    const res = await fetch(
      API_BASE +
        '/events/' +
        String(eventId) +
        '/attendees/' +
        String(attendeeId) +
        '/remove',
      {
        method: 'POST',
      }
    );

    const data = await safeJson(res);

    if (!res.ok) {
      throw new Error((data && data.error) || '移除成員失敗');
    }

    setEvents((prev) =>
      prev.map((e) => (String(e.id) === String(eventId) ? data : e))
    );

    return data;
  }, []);

  const sendMessage = useCallback(
    async (eventId: string, text: string) => {
      if (!myUserId) {
        throw new Error('缺少 userId');
      }

      const res = await fetch(API_BASE + '/events/' + String(eventId) + '/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: myUserId,
          text: text,
          profile: myProfile,
        }),
      });

      const data = await safeJson(res);

      if (!res.ok) {
        throw new Error((data && data.error) || '送出訊息失敗');
      }

      setEvents((prev) =>
        prev.map((e) => (String(e.id) === String(eventId) ? data : e))
      );

      return data;
    },
    [myUserId, myProfile]
  );

  const sendImageMessage = useCallback(
    async (eventId: string, asset: any) => {
      if (!myUserId) {
        throw new Error('缺少 userId');
      }

      if (!asset || !asset.uri) {
        throw new Error('缺少圖片資料');
      }

      const formData = new FormData();

      formData.append('userId', myUserId);
      formData.append('profile', JSON.stringify(myProfile));

      const filename =
        asset.fileName ||
        asset.filename ||
        'chat-' + Date.now() + '.jpg';

      const mimeType = asset.mimeType || asset.type || 'image/jpeg';

      formData.append('photo', {
        uri: asset.uri,
        name: filename,
        type: mimeType,
      } as any);

      const res = await fetch(
        API_BASE + '/events/' + String(eventId) + '/messages/image',
        {
          method: 'POST',
          body: formData,
        }
      );

      const data = await safeJson(res);

      if (!res.ok) {
        throw new Error((data && data.error) || '送出圖片失敗');
      }

      setEvents((prev) =>
        prev.map((e) => (String(e.id) === String(eventId) ? data : e))
      );

      return data;
    },
    [myUserId, myProfile]
  );

  const retractMessage = useCallback(
    async (eventId: string, messageId: string) => {
      if (!myUserId) {
        throw new Error('缺少 userId');
      }

      const res = await fetch(
        API_BASE +
          '/events/' +
          String(eventId) +
          '/messages/' +
          String(messageId) +
          '/retract',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: myUserId,
          }),
        }
      );

      const data = await safeJson(res);

      if (!res.ok) {
        throw new Error((data && data.error) || '收回訊息失敗');
      }

      setEvents((prev) =>
        prev.map((e) => (String(e.id) === String(eventId) ? data : e))
      );

      return data;
    },
    [myUserId]
  );

  const getUnreadCount = useCallback(
    async (eventId: string) => {
      try {
        if (!myUserId) return 0;

        const ev = await getEvent(String(eventId));
        const messages: any[] = Array.isArray(ev?.messages) ? ev.messages : [];
        const attendees: any[] = Array.isArray(ev?.attendees) ? ev.attendees : [];

        const myAttend: any | null =
          attendees.find((a: any) => String(a.userId) === String(myUserId)) || null;

        const isHost =
          ev &&
          ev.createdBy != null &&
          String(ev.createdBy) === String(myUserId);

        const hasEnteredRoom = isHost || myAttend?.status === 'joined';

        if (!hasEnteredRoom) return 0;
        if (!messages.length) return 0;

        const key = 'event_last_read_' + String(eventId) + '_' + String(myUserId);
        const lastReadAt = await AsyncStorage.getItem(key);
        const storedTime = lastReadAt ? dayjs(lastReadAt) : null;

        let count = 0;

        for (const m of messages) {
          const createdAt = m?.createdAt;
          if (!createdAt) continue;
          if (String(m.userId) === String(myUserId)) continue;

          const msgTime = dayjs(createdAt);
          if (!msgTime.isValid()) continue;

          if (!storedTime || msgTime.isAfter(storedTime)) {
            count++;
          }
        }

        return count;
      } catch (e) {
        console.log('getUnreadCount error:', e);
        return 0;
      }
    },
    [myUserId, getEvent]
  );

  return {
    events,
    loading,
    reload,
    getEvent,
    addEvent,
    deleteEvent,
    joinEvent,
    cancelAttend,
    removeAttendee,
    sendMessage,
    sendImageMessage,
    retractMessage,
    getUnreadCount,
  };
}