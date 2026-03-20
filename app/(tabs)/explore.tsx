// app/(tabs)/explore.tsx
import React, { useState, useCallback, useRef } from 'react';
import {
  Alert,
  Text,
  TextInput,
  View,
  Pressable,
  ScrollView,
  Platform,
  Keyboard,
  RefreshControl,
} from 'react-native';
import dayjs from 'dayjs';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useEvents } from '../../lib/useEvents';
import { EventType } from '../../types';
import { useAuth } from '../../lib/auth';

import { API_BASE } from '../../lib/config';

const TAIWAN_REGIONS = [
  '基隆市', '台北市', '新北市', '桃園市', '新竹市', '新竹縣', '苗栗縣', '台中市', '彰化縣', '南投縣',
  '雲林縣', '嘉義市', '嘉義縣', '台南市', '高雄市', '屏東縣', '宜蘭縣', '花蓮縣', '台東縣', '澎湖縣',
  '金門縣', '連江縣',
];

const TIME_OPTIONS = [
  '00:00', '00:30', '01:00', '01:30', '02:00', '02:30', '03:00', '03:30', '04:00', '04:30', '05:00', '05:30',
  '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00', '22:30', '23:00', '23:30',
];

const KTV_DEFAULTS = {
  timeRange: '20:00',
  place: '好樂迪 新竹店',
  builtInPeople: '1',
  maxPeople: '4',
  notes: '這局有什麼規則限制打在這~',
};

const BAR_DEFAULTS = {
  timeRange: '21:00',
  place: '光年酒吧',
  builtInPeople: '1',
  maxPeople: '4',
  notes: '這局有什麼規則限制打在這~',
};

const MAHJONG_DEFAULTS = {
  timeRange: '19:30',
  place: '棋牌會館',
  builtInPeople: '1',
  maxPeople: '4',
  notes: '這局有什麼規則限制打在這~',
};

async function fetchMe(accessToken: string) {
  const res = await fetch(API_BASE + '/users/me', {
    headers: { Authorization: 'Bearer ' + accessToken },
  });
  if (!res.ok) return null;
  return await res.json();
}

function isProfileOK(me: any): boolean {
  if (!me) return false;

  const hasNickname = typeof me.nickname === 'string' && me.nickname.trim().length > 0;
  const hasGender = me.gender === '男' || me.gender === '女';
  const ageOK = typeof me.age === 'number' && me.age >= 18;
  const hasPhoto = !!me.hasPhoto;

  return hasNickname && hasGender && ageOK && hasPhoto;
}

export default function CreateEvent() {
  const { addEvent } = useEvents();
  const { accessToken, loggedIn, user } = useAuth();

  const [type, setType] = useState<EventType>('KTV');
  const [region, setRegion] = useState('台北市');
  const [place, setPlace] = useState('');
  const [notes, setNotes] = useState('');

  const [builtInPeople, setBuiltInPeople] = useState<number>(Number(KTV_DEFAULTS.builtInPeople));
  const [maxPeople, setMaxPeople] = useState<number>(Number(KTV_DEFAULTS.maxPeople));

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDateDropdown, setShowDateDropdown] = useState(false);

  const [timeRange, setTimeRange] = useState('');
  const [startTime, setStartTime] = useState<string | null>(null);
  const [showTimeDropdown, setShowTimeDropdown] = useState(false);

  const [refreshing, setRefreshing] = useState(false);

  const placeholders =
    type === 'KTV'
      ? KTV_DEFAULTS
      : type === 'Bar'
        ? BAR_DEFAULTS
        : MAHJONG_DEFAULTS;

  const params = useLocalSearchParams();
  const toast = typeof (params as any).toast === 'string' ? String((params as any).toast) : '';

  const handledToastRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!handledToastRef.current && (toast === 'saved' || toast === 'saved_slow')) {
        handledToastRef.current = true;
      }
      return () => {};
    }, [toast])
  );

  function resetForm() {
    setType('KTV');
    setRegion('台北市');
    setPlace('');
    setNotes('');
    setBuiltInPeople(Number(KTV_DEFAULTS.builtInPeople));
    setMaxPeople(Number(KTV_DEFAULTS.maxPeople));
    setTimeRange('');
    setStartTime(null);
    setShowTimeDropdown(false);
    setSelectedDate(new Date());
    setShowDateDropdown(false);
  }

  function handleSelectTime(time: string) {
    setStartTime(time);
    setTimeRange(time);
    setShowTimeDropdown(false);
  }

  function handleSelectDate(date: Date) {
    setSelectedDate(date);
    setShowDateDropdown(false);
  }

  function handleChangeType(next: EventType) {
    setType(next);

    if (next === 'KTV') {
      setBuiltInPeople(Number(KTV_DEFAULTS.builtInPeople));
      setMaxPeople(Number(KTV_DEFAULTS.maxPeople));
      return;
    }

    if (next === 'Bar') {
      setBuiltInPeople(Number(BAR_DEFAULTS.builtInPeople));
      setMaxPeople(Number(BAR_DEFAULTS.maxPeople));
      return;
    }

    setBuiltInPeople(Number(MAHJONG_DEFAULTS.builtInPeople));
    setMaxPeople(Number(MAHJONG_DEFAULTS.maxPeople));
  }

  function incBuilt() {
    setBuiltInPeople(function (p) {
      return p + 1;
    });
  }

  function decBuilt() {
    setBuiltInPeople(function (p) {
      return Math.max(1, p - 1);
    });
  }

  function incMax() {
    setMaxPeople(function (p) {
      return p + 1;
    });
  }

  function decMax() {
    setMaxPeople(function (p) {
      return Math.max(1, p - 1);
    });
  }

  async function onSubmit() {
    if (!loggedIn || !accessToken || !user || !user.userId) {
      Alert.alert('請先登入', '登入後才能建立活動');
      router.replace('/login');
      return;
    }

    const me = await fetchMe(accessToken);
    if (!isProfileOK(me)) {
      Alert.alert('請先完成會員資料', '完成會員資料後才能發起活動喔！', [
        {
          text: '去填資料',
          onPress: function () {
            router.replace({
              pathname: '/(tabs)/profile',
              params: { next: 'explore' },
            });
          },
        },
      ]);
      return;
    }

    const regionTrim = region.trim();
    const placeTrim = place.trim();
    const timeTrim = timeRange.trim();
    const notesTrim = notes.trim();

    if (!type || !regionTrim || !placeTrim || !timeTrim) {
      Alert.alert('請填寫完整', '除了備註之外，其他欄位都是必填喔！');
      return;
    }

    if (!startTime) {
      Alert.alert('時間錯誤', '請選擇開始時間');
      return;
    }

    const built = builtInPeople;
    const max = maxPeople;

    if (!Number.isFinite(built) || built <= 0) {
      Alert.alert('人數錯誤', '內建人數請設定大於 0 的數字');
      return;
    }

    if (!Number.isFinite(max) || max <= 0) {
      Alert.alert('人數上限錯誤', '人數上限請設定大於 0 的數字');
      return;
    }

    if (built >= max) {
      Alert.alert('人數錯誤', '內建人數必須小於人數上限（不能一樣，也不能比上限多）');
      return;
    }

    const now = dayjs();
    const parts = startTime.split(':');
    const sh = Number(parts[0]);
    const sm = Number(parts[1]);

    const startTimeMoment = dayjs(selectedDate)
      .hour(sh)
      .minute(sm)
      .second(0)
      .millisecond(0);

    if (startTimeMoment.isBefore(now)) {
      Alert.alert('時間錯誤', '時間已經過去了，請選擇晚一點的日期或時間');
      return;
    }

    const startTimeDate = startTimeMoment.toDate();

    try {
      await addEvent({
        type: type,
        region: regionTrim,
        place: placeTrim,
        timeRange: timeTrim,
        timeISO: startTimeDate.toISOString(),
        builtInPeople: built,
        maxPeople: max,
        notes: notesTrim,
      });

      resetForm();

      Alert.alert('成功', '活動已建立', [
        {
          text: '回首頁',
          onPress: function () {
            router.replace('/(tabs)');
          },
        },
      ]);
    } catch (e: any) {
      Alert.alert('建立失敗', e?.message || '請稍後再試');
    }
  }

  function handlePressSubmit() {
    Keyboard.dismiss();
    onSubmit();
  }

  function handleRefresh() {
    setRefreshing(true);
    resetForm();
    setRefreshing(false);
  }

  const dateOptions: { label: string; value: Date }[] = [];
  const today = new Date();

  for (let i = 0; i < 180; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dateOptions.push({
      label: dayjs(d).format('YYYY/MM/DD'),
      value: d,
    });
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#020617' }}>
      <View style={{ flex: 1, paddingTop: 80, paddingHorizontal: 16, backgroundColor: '#020617' }}>
        <Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 20, color: 'white' }}>
          發起活動
        </Text>

        <KeyboardAwareScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 24 }}
          extraScrollHeight={60}
          enableOnAndroid
          keyboardOpeningTime={Platform.OS === 'android' ? 0 : 250}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="white"
              title="重設表單中..."
              titleColor="white"
            />
          }
        >
          <View style={{ flexDirection: 'row', marginBottom: 15, marginTop: 5 }}>
            <Pressable
              onPress={function () {
                handleChangeType('KTV');
              }}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 999,
                alignItems: 'center',
                marginRight: 8,
                backgroundColor: type === 'KTV' ? '#22c55e' : '#111827',
                borderWidth: 1,
                borderColor: '#22c55e',
              }}
            >
              <Text style={{ color: type === 'KTV' ? 'black' : 'white', fontWeight: '600' }}>
                🎤 揪唱歌
              </Text>
            </Pressable>

            <Pressable
              onPress={function () {
                handleChangeType('Bar');
              }}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 999,
                alignItems: 'center',
                marginRight: 8,
                backgroundColor: type === 'Bar' ? '#22c55e' : '#111827',
                borderWidth: 1,
                borderColor: '#22c55e',
              }}
            >
              <Text style={{ color: type === 'Bar' ? 'black' : 'white', fontWeight: '600' }}>
                🍻 揪喝酒
              </Text>
            </Pressable>

            <Pressable
              onPress={function () {
                handleChangeType('Mahjong');
              }}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 999,
                alignItems: 'center',
                backgroundColor: type === 'Mahjong' ? '#22c55e' : '#111827',
                borderWidth: 1,
                borderColor: '#22c55e',
              }}
            >
              <Text style={{ color: type === 'Mahjong' ? 'black' : 'white', fontWeight: '600' }}>
                🀄 揪麻將
              </Text>
            </Pressable>
          </View>

          <Text style={{ color: 'white', marginBottom: 2 }}>地區</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 4 }}>
            {TAIWAN_REGIONS.map(function (city) {
              return (
                <Pressable
                  key={city}
                  onPress={function () {
                    setRegion(city);
                  }}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 999,
                    marginRight: 8,
                    backgroundColor: region === city ? '#22c55e' : '#111827',
                    borderWidth: 1,
                    borderColor: '#22c55e',
                  }}
                >
                  <Text style={{ color: region === city ? 'black' : 'white', fontSize: 13 }}>
                    {city}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Field
            label="地點"
            value={place}
            onChangeText={setPlace}
            placeholder={placeholders.place}
          />

          <View style={{ marginTop: 20, zIndex: 30 }}>
            <Text style={{ color: 'white', marginBottom: 4 }}>日期時間</Text>

            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1, marginRight: 8, position: 'relative' }}>
                <Pressable
                  onPress={function () {
                    setShowDateDropdown(function (prev) {
                      return !prev;
                    });
                  }}
                  style={{
                    backgroundColor: '#111827',
                    paddingVertical: 10,
                    borderRadius: 10,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: '#22c55e',
                  }}
                >
                  <Text style={{ color: 'white' }}>{dayjs(selectedDate).format('YYYY/MM/DD')}</Text>
                </Pressable>

                {showDateDropdown ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: 44,
                      left: 0,
                      right: 0,
                      backgroundColor: '#111827',
                      borderRadius: 10,
                      maxHeight: 220,
                      borderWidth: 1,
                      borderColor: '#374151',
                      overflow: 'hidden',
                      zIndex: 50,
                      elevation: 6,
                    }}
                  >
                    <ScrollView showsVerticalScrollIndicator={false}>
                      {dateOptions.map(function (opt) {
                        const isSelected =
                          dayjs(opt.value).format('YYYY/MM/DD') === dayjs(selectedDate).format('YYYY/MM/DD');

                        return (
                          <Pressable
                            key={opt.label}
                            onPress={function () {
                              handleSelectDate(opt.value);
                            }}
                            style={{ paddingVertical: 10, alignItems: 'center' }}
                          >
                            <Text style={{ color: isSelected ? '#22c55e' : 'white' }}>
                              {opt.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                ) : null}
              </View>

              <View style={{ flex: 1, position: 'relative' }}>
                <Pressable
                  onPress={function () {
                    setShowTimeDropdown(function (prev) {
                      return !prev;
                    });
                  }}
                  style={{
                    backgroundColor: '#111827',
                    paddingVertical: 10,
                    borderRadius: 10,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: '#22c55e',
                  }}
                >
                  <Text style={{ color: 'white' }}>{startTime || '開始時間'}</Text>
                </Pressable>

                {showTimeDropdown ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: 44,
                      left: 0,
                      right: 0,
                      backgroundColor: '#111827',
                      borderRadius: 10,
                      maxHeight: 200,
                      borderWidth: 1,
                      borderColor: '#374151',
                      overflow: 'hidden',
                      zIndex: 50,
                      elevation: 6,
                    }}
                  >
                    <ScrollView showsVerticalScrollIndicator={false}>
                      {TIME_OPTIONS.map(function (t) {
                        return (
                          <Pressable
                            key={t}
                            onPress={function () {
                              handleSelectTime(t);
                            }}
                            style={{ paddingVertical: 10, alignItems: 'center' }}
                          >
                            <Text style={{ color: t === startTime ? '#22c55e' : 'white' }}>
                              {t}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          <View style={{ marginTop: 20 }}>
            <Text style={{ color: 'white', marginBottom: 4 }}>內建人數</Text>
            <View
              style={{
                backgroundColor: '#111827',
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 8,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Pressable onPress={decBuilt} style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text style={{ color: 'white', fontSize: 18 }}>－</Text>
              </Pressable>

              <Text style={{ color: 'white', fontSize: 18, fontWeight: '600' }}>
                {builtInPeople}
              </Text>

              <Pressable onPress={incBuilt} style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text style={{ color: 'white', fontSize: 18 }}>＋</Text>
              </Pressable>
            </View>
          </View>

          <View style={{ marginTop: 20 }}>
            <Text style={{ color: 'white', marginBottom: 4 }}>人數上限</Text>
            <View
              style={{
                backgroundColor: '#111827',
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 8,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Pressable onPress={decMax} style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text style={{ color: 'white', fontSize: 18 }}>－</Text>
              </Pressable>

              <Text style={{ color: 'white', fontSize: 18, fontWeight: '600' }}>
                {maxPeople}
              </Text>

              <Pressable onPress={incMax} style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text style={{ color: 'white', fontSize: 18 }}>＋</Text>
              </Pressable>
            </View>
          </View>

          <Field
            label="備註"
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder={placeholders.notes}
            maxLength={50}
            maxLines={5}
          />
        </KeyboardAwareScrollView>

        <View style={{ paddingVertical: 16 }}>
          <Pressable
            onPress={handlePressSubmit}
            style={{
              backgroundColor: '#22c55e',
              borderRadius: 999,
              paddingVertical: 12,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: 'black', fontWeight: '600' }}>建立活動</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: 'default' | 'number-pad';
  multiline?: boolean;
  placeholder?: string;
  maxLength?: number;
  maxLines?: number;
};

function Field(props: FieldProps) {
  const {
    label,
    value,
    onChangeText,
    keyboardType,
    multiline,
    placeholder,
    maxLength,
    maxLines,
  } = props;

  function handleTextChange(text: string) {
    let nextText = text;

    if (typeof maxLength === 'number') {
      nextText = nextText.slice(0, maxLength);
    }

    if (multiline && typeof maxLines === 'number') {
      const lines = nextText.split('\n');
      if (lines.length > maxLines) {
        nextText = lines.slice(0, maxLines).join('\n');
      }
    }

    onChangeText(nextText);
  }

  return (
    <View style={{ marginTop: 20 }}>
      <Text style={{ color: 'white', marginBottom: 4 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={handleTextChange}
        keyboardType={keyboardType || 'default'}
        multiline={!!multiline}
        placeholder={placeholder}
        placeholderTextColor="#6b7280"
        maxLength={maxLength}
        style={{
          backgroundColor: '#111827',
          color: 'white',
          paddingHorizontal: 12,
          paddingVertical: 12,
          borderRadius: 10,
          textAlignVertical: multiline ? 'top' : 'center',
          lineHeight: multiline ? 20 : undefined,
        }}
      />

      {typeof maxLength === 'number' ? (
        <Text
          style={{
            color: '#9ca3af',
            fontSize: 12,
            marginTop: 6,
            textAlign: 'right',
          }}
        >
          {value.length}/{maxLength}
        </Text>
      ) : null}
    </View>
  );
}