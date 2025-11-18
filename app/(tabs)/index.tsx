// app/(tabs)/index.tsx
import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
} from 'react';
import { useFocusEffect, router } from 'expo-router';
import {
  FlatList,
  Pressable,
  Text,
  View,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
import { useEvents } from '../../lib/useEvents';
import { PartyEvent } from '../../types';

const PROFILE_KEY = 'profile_v1';

export default function Home() {
  const { events, reload, deleteEvent } = useEvents();
  const [refreshing, setRefreshing] = useState(false);

  // 我自己的 userId（從 profile_v1 讀）
  const [myUserId, setMyUserId] = useState<string | null>(null);

  // 讀取自己的 userId（包成 function，effect 跟 focus 都會用）
  const loadMyUserId = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(PROFILE_KEY);
      if (!raw) {
        setMyUserId(null);
        return;
      }
      const p = JSON.parse(raw) || {};
      if (typeof p.userId === 'string' && p.userId.trim().length > 0) {
        setMyUserId(p.userId.trim());
      } else {
        setMyUserId(null);
      }
    } catch (e) {
      console.log('讀取 profile_v1 失敗:', e);
      setMyUserId(null);
    }
  }, []);

  // 首次掛載時讀一次 userId
  useEffect(() => {
    loadMyUserId();
  }, [loadMyUserId]);

  // 下拉刷新
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  // 每次首頁 focus：重新讀 userId + 重新抓活動列表
  useFocusEffect(
    useCallback(() => {
      loadMyUserId();
      reload();
    }, [loadMyUserId, reload])
  );

  // 只留 24 小時內的活動＋排序
  const sortedEvents = useMemo(() => {
    const now = dayjs();
    const list = Array.isArray(events) ? events : [];

    const activeEvents = list.filter(function (e: PartyEvent) {
      const base = dayjs(e.createdAt || e.timeISO);
      if (!base.isValid()) return true;
      const diffMinutes = now.diff(base, 'minute');
      return diffMinutes < 24 * 60;
    });

    return activeEvents.sort(function (a: PartyEvent, b: PartyEvent) {
      const aTime = new Date(a.createdAt || a.timeISO || '').getTime();
      const bTime = new Date(b.createdAt || b.timeISO || '').getTime();
      return bTime - aTime;
    });
  }, [events]);

  // 刪除自己創建的活動
  function handleDelete(id: string) {
    const list = Array.isArray(events) ? (events as PartyEvent[]) : [];
    const target = list.find(function (e) {
      return String(e.id) === String(id);
    });
    if (!target) return;

    Alert.alert('刪除活動', '確定要刪除這個活動嗎？刪除後就看不到囉～', [
      { text: '取消', style: 'cancel' },
      {
        text: '刪除',
        style: 'destructive',
        onPress: function () {
          deleteEvent(id);
        },
      },
    ]);
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#020617',
        paddingTop: 80,
        paddingHorizontal: 16,
      }}
    >
      {/* ⭐ 標題固定在 FlatList 外面，下拉時不會跟著動 */}
      <Text
        style={{
          fontSize: 22,
          fontWeight: 'bold',
          marginBottom: 20,
          color: 'white',
        }}
      >
        近期活動
      </Text>

      <FlatList
        style={{ flex: 1 }} // 讓列表本身佔滿剩餘高度
        data={sortedEvents}
        keyExtractor={function (e: any, index: number) {
          const baseId =
            e && e.id != null
              ? String(e.id)
              : e && e.timeISO
              ? String(e.timeISO)
              : String(index);
          return baseId;
        }}
        // 讓內容撐滿，底下空白也算在可下拉區域裡
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: 24,
        }}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListEmptyComponent={
          <View
            style={{
              flex: 1,
              justifyContent: 'flex-start',
            }}
          >
            <Text style={{ color: 'white' }}>
              還沒有活動，去「發起活動」那頁新增一個！
            </Text>
          </View>
        }
        renderItem={function ({ item }: { item: PartyEvent }) {
          const builtIn =
            typeof item.builtInPeople === 'number'
              ? item.builtInPeople
              : 0;
          const attendeesCount = Array.isArray(item.attendees)
            ? item.attendees.length
            : 0;
          const total = builtIn + attendeesCount;

          // 判斷是不是我發起的：
          // 1. createdBy === myUserId → 一定是我
          // 2. 舊資料 createdBy 是 'me' 或 undefined → 也當成是我，可以刪
          const isMine =
            (myUserId != null &&
              String(item.createdBy) === String(myUserId)) ||
            item.createdBy === 'me' ||
            item.createdBy == null;

          const eventTime = dayjs(item.timeISO);
          const timeText = eventTime.isValid()
            ? eventTime.format('MM/DD HH:mm')
            : '';

          const typeLabel =
            item.type === 'KTV' ? '🎤 揪唱歌' : '🍻 揪喝酒';

          // 主揪資訊（從 createdByProfile 顯示）
          const cp = item.createdByProfile || null;
          let hostGender: '男' | '女' | null = null;
          let hostAge: number | null = null;
          let hostNickname = '';

          if (cp && typeof cp === 'object') {
            const g =
              cp.gender === '男' || cp.gender === '女'
                ? cp.gender
                : null;
            const aNum = Number(cp.age);
            const a =
              Number.isFinite(aNum) && aNum > 0 ? aNum : null;
            const n =
              typeof cp.nickname === 'string'
                ? cp.nickname.trim()
                : '';

            hostGender = g;
            hostAge = a;
            hostNickname = n;
          }

          let profileText = '';

          if (hostNickname) {
            profileText = hostNickname;
          }

          if (hostAge !== null && !Number.isNaN(hostAge)) {
            profileText += (profileText ? ' ' : '') + String(hostAge);
          }


          

          const profileColor =
            hostGender === '女'
              ? '#fca5a5'
              : hostGender === '男'
              ? '#93c5fd'
              : '#ffffff';

          // 24 小時倒數
          let countdownText = '';
          const created = dayjs(item.createdAt || item.timeISO);
          if (created.isValid()) {
            const now = dayjs();
            const expireAt = created.add(24, 'hour');
            if (expireAt.isAfter(now)) {
              const diffMs = expireAt.diff(now);
              const totalMinutes = Math.floor(diffMs / 60000);
              const hours = Math.floor(totalMinutes / 60);
              const minutes = totalMinutes % 60;
              countdownText =
                '剩餘 ' + hours + ' 小時 ' + minutes + ' 分';
            }
          }

          return (
            <Pressable
              onPress={function () {
                router.push({
                  pathname: '/event/[id]',
                  params: { id: String(item.id) },
                });
              }}
              style={{
                padding: 14,
                borderRadius: 12,
                backgroundColor: '#111827',
                marginTop: 8,
                marginBottom: 10,
              }}
            >
              {/* 第一行：類型 + 主揪 + 刪除 */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    color: 'white',
                    fontSize: 16,
                    fontWeight: '600',
                    lineHeight: 24,
                  }}
                >
                  {typeLabel}
                  {profileText ? ' | ' : ''}
                  {profileText ? (
                    <Text
                      style={{
                        color: profileColor,
                        lineHeight: 24,
                      }}
                    >
                      {profileText}
                    </Text>
                  ) : null}
                </Text>

                {isMine && (
                  <Pressable
                    onPress={function (e) {
                      if (e && e.stopPropagation) {
                        e.stopPropagation();
                      }
                      handleDelete(String(item.id));
                    }}
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: '#f97373',
                    }}
                  >
                    <Text
                      style={{
                        color: '#f97373',
                        fontSize: 12,
                        lineHeight: 18,
                      }}
                    >
                      刪除
                    </Text>
                  </Pressable>
                )}
              </View>

              {/* 地區・地點 */}
              <Text
                style={{
                  color: 'white',
                  marginTop: 4,
                  lineHeight: 21,
                }}
              >
                {item.region ? item.region + '・' : ''}
                {item.place}
              </Text>

              {/* 時間 */}
              <Text
                style={{
                  color: 'white',
                  marginTop: 2,
                  lineHeight: 21,
                }}
              >
                時間 : {timeText}
              </Text>

              {/* 人數 */}
              <Text
                style={{
                  color: 'white',
                  marginTop: 2,
                  lineHeight: 21,
                }}
              >
                人數 : {total}/{item.maxPeople} 人（內建 {builtIn} 人）
                {isMine ? '・我發起的活動' : ''}
              </Text>

              {/* 倒數 */}
              {countdownText ? (
                <Text
                  style={{
                    color: '#fde68a',
                    marginTop: 4,
                    lineHeight: 21,
                    textAlign: 'right',
                  }}
                >
                  {countdownText}
                </Text>
              ) : null}
            </Pressable>
          );
        }}
      />
    </View>
  );
}
