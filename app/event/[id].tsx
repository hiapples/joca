// app/event/[id].tsx
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import dayjs from 'dayjs';
import { useEvents } from '../../lib/useEvents';

export default function EventDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { events } = useEvents();

  // 如果沒有 id，直接顯示錯誤畫面
  if (!id || typeof id !== 'string') {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#020617',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 16,
        }}
      >
        <Text style={{ color: 'white', marginBottom: 16 }}>
          找不到這個活動，參數錯誤。
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: '#22c55e',
          }}
        >
          <Text style={{ color: '#22c55e' }}>回上一頁</Text>
        </Pressable>
      </View>
    );
  }

  const event = events.find((e: any) => String(e.id) === String(id));

  if (!event) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#020617',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 16,
        }}
      >
        <Text style={{ color: 'white', marginBottom: 16 }}>
          找不到這個活動，可能已被刪除。
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: '#22c55e',
          }}
        >
          <Text style={{ color: '#22c55e' }}>回上一頁</Text>
        </Pressable>
      </View>
    );
  }

  const builtIn =
    typeof event.builtInPeople === 'number' ? event.builtInPeople : 0;
  const attendees = Array.isArray(event.attendees)
    ? event.attendees.length
    : 0;
  const total = builtIn + attendees;

  // timeRange 可能不存在，就用 timeISO 的 HH:mm 當備用
  const timeRange =
    typeof event.timeRange === 'string' && event.timeRange.trim().length > 0
      ? event.timeRange
      : dayjs(event.timeISO).isValid()
      ? dayjs(event.timeISO).format('HH:mm')
      : '';

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#020617',
        paddingTop: 80,
        paddingHorizontal: 16,
      }}
    >
      {/* 返回 */}
      <Pressable
        onPress={() => router.back()}
        style={{ marginBottom: 16, alignSelf: 'flex-start' }}
      >
        <Text style={{ color: '#9ca3af' }}>〈 返回</Text>
      </Pressable>

      {/* 活動卡片 */}
      <View
        style={{
          backgroundColor: '#1f2937',
          borderRadius: 16,
          padding: 16,
        }}
      >
        <Text
          style={{
            color: 'white',
            fontSize: 20,
            fontWeight: '700',
            marginBottom: 8,
          }}
        >
          {event.type}｜{timeRange}
        </Text>

        <Text style={{ color: '#e5e7eb', marginBottom: 4 }}>
          {event.region ? event.region + '・' : ''}
          {event.place}
        </Text>

        <Text style={{ color: '#9ca3af', marginBottom: 8 }}>
          {dayjs(event.timeISO).isValid()
            ? dayjs(event.timeISO).format('YYYY/MM/DD HH:mm')
            : '時間未設定'}
        </Text>

        <Text style={{ color: '#e5e7eb', marginBottom: 4 }}>
          人數：{total}/{event.maxPeople} 人（內建 {builtIn} 人）
        </Text>

        {event.notes ? (
          <View style={{ marginTop: 12 }}>
            <Text style={{ color: '#9ca3af', marginBottom: 4 }}>備註</Text>
            <Text style={{ color: '#e5e7eb' }}>{event.notes}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
