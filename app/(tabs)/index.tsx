// app/(tabs)/index.tsx
import React, { useState, useCallback, useMemo } from 'react';
import { useFocusEffect, router } from 'expo-router';
import { FlatList, Pressable, Text, View, Alert, ScrollView, Modal } from 'react-native';
import dayjs from 'dayjs';
import { useEvents } from '../../lib/useEvents';
import { PartyEvent, EventType } from '../../types';
import { useAuth } from '../../lib/auth';

const TAIWAN_REGIONS = [
  '全部',
  '基隆市', '台北市', '新北市', '桃園市', '新竹市', '新竹縣', '苗栗縣', '台中市', '彰化縣', '南投縣',
  '雲林縣', '嘉義市', '嘉義縣', '台南市', '高雄市', '屏東縣', '宜蘭縣', '花蓮縣', '台東縣', '澎湖縣',
  '金門縣', '連江縣',
];

type TypeFilter = '全部' | EventType;

function getVisibleAttendeesCount(attendees: any[]) {
  if (!Array.isArray(attendees)) return 0;

  return attendees.filter(function (a: any) {
    if (!a) return false;
    return a.status === 'pending' || a.status === 'confirmed';
  }).length;
}

export default function Home() {
  const { events, reload, deleteEvent } = useEvents();
  const { user } = useAuth();

  const [refreshing, setRefreshing] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState('全部');
  const [selectedType, setSelectedType] = useState<TypeFilter>('全部');

  const myUserId = user && user.userId ? String(user.userId) : null;

  useFocusEffect(
    useCallback(() => {
      reload();
      return () => {};
    }, [reload])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  }, [reload]);

  const sortedEvents = useMemo(() => {
    const now = dayjs();
    const list = Array.isArray(events) ? events : [];

    const activeEvents = list.filter(function (e: PartyEvent) {
      const base = dayjs(e.createdAt || e.timeISO);
      if (!base.isValid()) return true;
      const diffMinutes = now.diff(base, 'minute');
      return diffMinutes < 24 * 60;
    });

    const filteredEvents = activeEvents.filter(function (e: PartyEvent) {
      const regionOK = selectedRegion === '全部' || e.region === selectedRegion;
      const typeOK = selectedType === '全部' || e.type === selectedType;
      return regionOK && typeOK;
    });

    return filteredEvents.sort(function (a: PartyEvent, b: PartyEvent) {
      const aCreatedBy = a && a.createdBy != null ? String(a.createdBy).trim() : '';
      const bCreatedBy = b && b.createdBy != null ? String(b.createdBy).trim() : '';
      const myId = myUserId != null ? String(myUserId).trim() : '';

      const aIsMine = !!myId && aCreatedBy === myId;
      const bIsMine = !!myId && bCreatedBy === myId;

      // 自己發起的活動排最上面
      if (aIsMine && !bIsMine) return -1;
      if (!aIsMine && bIsMine) return 1;

      // 同一群內再按時間新到舊
      const aTime = new Date(a.createdAt || a.timeISO || '').getTime();
      const bTime = new Date(b.createdAt || b.timeISO || '').getTime();
      return bTime - aTime;
    });
  }, [events, selectedRegion, selectedType, myUserId]);

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

  function resetFilters() {
    setSelectedRegion('全部');
    setSelectedType('全部');
  }

  function getTypeLabel(type: EventType) {
    if (type === 'KTV') return '🎤 揪唱歌';
    if (type === 'Bar') return '🍻 揪喝酒';
    return '🀄 揪麻將';
  }

  function getTypeChipLabel(type: TypeFilter) {
    if (type === '全部') return '全部';
    if (type === 'KTV') return '唱歌';
    if (type === 'Bar') return '喝酒';
    return '麻將';
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#020617', paddingTop: 80, paddingHorizontal: 16 }}>
      <View
        style={{
          marginBottom: 20,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text style={{ fontSize: 22, fontWeight: 'bold', color: 'white' }}>
          近期活動
        </Text>

        <Pressable
          onPress={function () {
            setShowFilter(true);
          }}
          style={{
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: '#a7a2a2',
            backgroundColor: '#111827',
          }}
        >
          <Text style={{ color: '#a7a2a2', fontSize: 12, lineHeight: 18 }}>篩選</Text>
        </Pressable>
      </View>

      {selectedRegion !== '全部' || selectedType !== '全部' ? (
        <Text style={{ color: '#9ca3af', marginBottom: 10 }}>
          目前篩選：{selectedRegion !== '全部' ? selectedRegion : '全部地區'}・
          {selectedType !== '全部' ? getTypeChipLabel(selectedType) : '全部類型'}
        </Text>
      ) : null}

      <FlatList
        style={{ flex: 1 }}
        data={sortedEvents}
        keyExtractor={function (e: any, index: number) {
          const baseId =
            e && e.id != null ? String(e.id) : e && e.timeISO ? String(e.timeISO) : String(index);
          return baseId;
        }}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListEmptyComponent={
          <View style={{ flex: 1, justifyContent: 'flex-start' }}>
            <Text style={{ color: 'white' }}>
              {selectedRegion !== '全部' || selectedType !== '全部'
                ? '目前篩選條件下沒有活動'
                : '還沒有活動，去「發起活動」那頁新增一個！'}
            </Text>
          </View>
        }
        renderItem={function ({ item }: { item: PartyEvent }) {
          const builtIn = typeof item.builtInPeople === 'number' ? item.builtInPeople : 0;

          const attendeesCount = Array.isArray(item.attendees)
            ? item.attendees.filter(function (a: any) {
                return a && a.status === 'confirmed';
              }).length
            : 0;

          const total = builtIn + attendeesCount;

          const createdByValue =
            item && item.createdBy != null ? String(item.createdBy).trim() : '';

          const myIdValue =
            myUserId != null ? String(myUserId).trim() : '';

          const isMine =
            !!createdByValue &&
            !!myIdValue &&
            createdByValue === myIdValue;

          const eventTime = dayjs(item.timeISO);
          const timeText = eventTime.isValid() ? eventTime.format('MM/DD HH:mm') : '';

          const typeLabel = getTypeLabel(item.type);

          const cp = item.createdByProfile || null;
          let hostGender: '男' | '女' | null = null;
          let hostAge: number | null = null;
          let hostNickname = '';

          if (cp && typeof cp === 'object') {
            const g = cp.gender === '男' || cp.gender === '女' ? cp.gender : null;
            const aNum = Number(cp.age);
            const a = Number.isFinite(aNum) && aNum > 0 ? aNum : null;
            const n = typeof cp.nickname === 'string' ? cp.nickname.trim() : '';
            hostGender = g;
            hostAge = a;
            hostNickname = n;
          }

          let profileText = '';
          if (hostNickname) profileText = hostNickname;
          if (hostAge !== null && !Number.isNaN(hostAge)) {
            profileText += (profileText ? ' ' : '') + String(hostAge);
          }

          const profileColor =
            hostGender === '女' ? '#fca5a5' : hostGender === '男' ? '#93c5fd' : '#ffffff';

          const notesText =
            typeof item.notes === 'string' ? item.notes.trim() : '';

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
              countdownText = '剩餘 ' + hours + ' 小時 ' + minutes + ' 分';
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
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: 'white', fontSize: 16, fontWeight: '600', lineHeight: 24 }}>
                  {typeLabel}
                  {profileText ? ' | ' : ''}
                  {profileText ? (
                    <Text style={{ color: profileColor, lineHeight: 24 }}>{profileText}</Text>
                  ) : null}
                </Text>

                {isMine && (
                  <Pressable
                    onPress={function (e) {
                      if (e && (e as any).stopPropagation) (e as any).stopPropagation();
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
                    <Text style={{ color: '#f97373', fontSize: 12, lineHeight: 18 }}>刪除</Text>
                  </Pressable>
                )}
              </View>

              <Text style={{ color: 'white', marginTop: 4, lineHeight: 21 }}>
                {item.region ? item.region + '・' : ''}
                {item.place}
              </Text>

              <Text style={{ color: 'white', marginTop: 2, lineHeight: 21 }}>
                時間： {timeText}
              </Text>

              <Text style={{ color: 'white', marginTop: 2, lineHeight: 21 }}>
                人數： {total}/{item.maxPeople} 人（內建 {builtIn} 人）
              </Text>

              {notesText ? (
                <Text style={{ color: '#d1d5db', marginTop: 4, lineHeight: 21 }}>
                  備註： {notesText}
                </Text>
              ) : null}

              {countdownText ? (
                <Text style={{ color: '#fde68a', marginTop: 4, lineHeight: 21, textAlign: 'right' }}>
                  {countdownText}
                </Text>
              ) : null}
            </Pressable>
          );
        }}
      />

      <Modal
        visible={showFilter}
        transparent
        animationType="fade"
        onRequestClose={function () {
          setShowFilter(false);
        }}
      >
        <Pressable
          onPress={function () {
            setShowFilter(false);
          }}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-start',
            alignItems: 'flex-end',
            paddingTop: 120,
            paddingRight: 16,
          }}
        >
          <Pressable
            onPress={function (e) {
              if (e && (e as any).stopPropagation) (e as any).stopPropagation();
            }}
            style={{
              width: 280,
              backgroundColor: '#111827',
              borderRadius: 12,
              padding: 16,
              borderWidth: 1,
              borderColor: '#1f2937',
            }}
          >
            <Text style={{ color: 'white', fontSize: 16, fontWeight: '600', marginBottom: 12 }}>
              篩選條件
            </Text>

            <Text style={{ color: '#9ca3af', marginBottom: 6 }}>類型</Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 }}>
              {(['全部', 'KTV', 'Bar', 'Mahjong'] as TypeFilter[]).map(function (t) {
                const active = selectedType === t;
                return (
                  <Pressable
                    key={t}
                    onPress={function () {
                      setSelectedType(t);
                    }}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: '#22c55e',
                      marginRight: 6,
                      marginBottom: 6,
                      backgroundColor: active ? '#22c55e' : '#0f172a',
                    }}
                  >
                    <Text style={{ color: active ? 'black' : 'white' }}>
                      {getTypeChipLabel(t)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={{ color: '#9ca3af', marginBottom: 6 }}>地區</Text>

            <ScrollView style={{ maxHeight: 200 }}>
              {TAIWAN_REGIONS.map(function (region) {
                const active = selectedRegion === region;
                return (
                  <Pressable
                    key={region}
                    onPress={function () {
                      setSelectedRegion(region);
                    }}
                    style={{
                      paddingVertical: 8,
                      borderBottomWidth: 0.5,
                      borderColor: '#1f2937',
                    }}
                  >
                    <Text style={{ color: active ? '#22c55e' : 'white' }}>
                      {region}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable
              onPress={function () {
                resetFilters();
              }}
              style={{
                marginTop: 12,
                padding: 10,
                borderRadius: 8,
                backgroundColor: '#374151',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: 'white' }}>重設</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}