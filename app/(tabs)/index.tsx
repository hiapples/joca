// app/(tabs)/index.tsx
import React, { useState, useCallback, useMemo } from 'react';
import { useFocusEffect, router } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
  RefreshControl,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
import { useEvents } from '../../lib/useEvents';

const PROFILE_KEY = 'profile_v1';

export default function Home() {
  const { events, loading, reload, deleteEvent } = useEvents();
  const [refreshing, setRefreshing] = useState(false);

  // 目前登入這個人的資料（顯示在標題用）
  const [myGender, setMyGender] = useState<'男' | '女' | null>(null);
  const [myNickname, setMyNickname] = useState<string>('');
  const [myAge, setMyAge] = useState<number | null>(null);

  // 檢查會員資料，不合格就提醒 + 可以轉去會員頁
  const checkProfileAndRedirect = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(PROFILE_KEY);

      if (!raw) {
        Alert.alert(
          '請先建立會員資料',
          '完成會員資料後才能使用活動功能喔！',
          [
            {
              text: '去填資料',
              onPress: function () {
                router.replace('/profile');
              },
            },
          ]
        );
        return;
      }

      const p = JSON.parse(raw) || {};
      const nickname =
        typeof p.nickname === 'string' ? p.nickname.trim() : '';
      const gender: '男' | '女' | null =
        p.gender === '男' || p.gender === '女' ? p.gender : null;
      const ageNum = Number(p.age);
      const ageOK = Number.isFinite(ageNum) && ageNum >= 18;

      if (nickname) {
        setMyNickname(nickname);
      }
      if (gender) {
        setMyGender(gender);
      }
      if (ageOK) {
        setMyAge(ageNum);
      }

      if (!nickname || !gender || !ageOK) {
        Alert.alert(
          '請先完成會員資料',
          '暱稱、性別、年齡（需大於 18）都要填寫完整喔～',
          [
            {
              text: '去填資料',
              onPress: function () {
                router.replace('/profile');
              },
            },
          ]
        );
      }
    } catch (e) {
      console.log('檢查會員資料錯誤:', e);
    }
  }, []);

  // 下拉刷新
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  // 每次首頁 focus 都檢查會員 + reload 活動
  useFocusEffect(
    useCallback(() => {
      checkProfileAndRedirect();
      reload();
    }, [])
  );

  // 以「建立時間 createdAt」為基準：
  //  - 建立後 24 小時內會顯示
  //  - 超過 24 小時就從列表消失
  const sortedEvents = useMemo(() => {
    const now = dayjs();

    const activeEvents = events.filter(function (e: any) {
      const base = dayjs(e.createdAt || e.timeISO);
      if (!base.isValid()) {
        return true; // 沒有時間就先保留
      }
      const diffMinutes = now.diff(base, 'minute');
      return diffMinutes < 24 * 60; // ⭐ 小於 24 小時才顯示
    });

    return activeEvents.sort(function (a: any, b: any) {
      const aTime = new Date(a.createdAt || a.timeISO || 0).getTime();
      const bTime = new Date(b.createdAt || b.timeISO || 0).getTime();
      return bTime - aTime;
    });
  }, [events]);

  if (loading && !refreshing) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#020617',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color="white" />
      </View>
    );
  }

  // 刪除自己創建的活動
  function handleDelete(id: string) {
    const target = events.find(function (e: any) {
      return String(e.id) === String(id);
    });
    if (!target) {
      return;
    }

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
        paddingHorizontal: 16,
        paddingTop: 80,
        backgroundColor: '#020617',
      }}
    >
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
        data={sortedEvents}
        keyExtractor={function (e: any) {
          return String(e.id);
        }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={{ color: 'white' }}>
            還沒有活動，去「發起活動」那頁新增一個！
          </Text>
        }
        renderItem={function ({ item }: { item: any }) {
          const builtIn =
            typeof item.builtInPeople === 'number' ? item.builtInPeople : 0;
          const attendees = Array.isArray(item.attendees)
            ? item.attendees.length
            : 0;
          const total = builtIn + attendees;

          const isMine = item.createdBy === 'me';

          // 活動時間：顯示用
          const eventTime = dayjs(item.timeISO);
          const timeText = eventTime.isValid()
            ? eventTime.format('MM/DD HH:mm')
            : '';

          // 類型顯示：揪唱歌 / 揪喝酒
          const typeLabel =
            item.type === 'KTV' ? '🎤 揪唱歌' : '🍻 揪喝酒';

          // 會員資訊字串：女 24 王曉明
          const profileText =
            myGender && myAge !== null && myNickname
              ? myGender + ' ' + myAge + ' ' + myNickname
              : '';

          // 性別顏色：女=紅，男=藍，沒資料就白（用在暱稱那段）
          const profileColor =
            myGender === '女'
              ? '#fca5a5'
              : myGender === '男'
              ? '#93c5fd'
              : '#ffffff';

          // 24 小時倒數：以「建立時間 createdAt」為基準
          let countdownText = '';
          const created = dayjs(item.createdAt || item.timeISO);
          if (created.isValid()) {
            const now = dayjs();
            const expireAt = created.add(24, 'hour'); // ⭐ 建立後 24 小時
            if (expireAt.isAfter(now)) {
              const diffMs = expireAt.diff(now);
              const totalMinutes = Math.floor(diffMs / 60000);
              const hours = Math.floor(totalMinutes / 60);
              const minutes = totalMinutes % 60;
              countdownText =
                '剩餘 ' + hours + ' 小時 ' + minutes + ' 分';
            } else {
              countdownText = '';
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
              {/* 第一行：揪唱歌 / 揪喝酒 + | + 女 24 王曉明（顏色依性別） + 刪除按鈕 */}
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

              {/* 第二行：地區・地點 */}
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

              {/* 第三行：時間 */}
              <Text
                style={{
                  color: 'white',
                  marginTop: 2,
                  lineHeight: 21,
                }}
              >
                時間 : {timeText}
              </Text>

              {/* 第四行：人數 */}
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

              {/* 第五行：24 小時倒數，放在右下角 */}
              {countdownText ? (
                <Text
                  style={{
                    color: '#fde68a',
                    marginTop: 4,
                    lineHeight: 21,
                    textAlign: 'right', // 👉 右下角
                  }}
                >
                  {countdownText}
                </Text>
              ) : null}
            </Pressable>
          );
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="white"
            title="重新整理中..."
            titleColor="white"
          />
        }
      />
    </View>
  );
}
