// app/(tabs)/explore.tsx
import React, { useState, useCallback } from 'react';
import {
  Alert,
  Text,
  TextInput,
  View,
  Pressable,
  ScrollView,
  Platform,
  Keyboard,
} from 'react-native';
import dayjs from 'dayjs';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useEvents } from '../../lib/useEvents';
import { EventType } from '../../types';

// 跟會員頁一樣的 key
const PROFILE_KEY = 'profile_v1';

// 台灣縣市列表（北到南）
const TAIWAN_REGIONS = [
  '基隆市',
  '台北市',
  '新北市',
  '桃園市',
  '新竹市',
  '新竹縣',
  '苗栗縣',
  '台中市',
  '彰化縣',
  '南投縣',
  '雲林縣',
  '嘉義市',
  '嘉義縣',
  '台南市',
  '高雄市',
  '屏東縣',
  '宜蘭縣',
  '花蓮縣',
  '台東縣',
  '澎湖縣',
  '金門縣',
  '連江縣',
];

// 時間下拉選單的選項（00:00 ~ 23:30 每 30 分）
const TIME_OPTIONS = [
  '00:00', '00:30',
  '01:00', '01:30',
  '02:00', '02:30',
  '03:00', '03:30',
  '04:00', '04:30',
  '05:00', '05:30',
  '06:00', '06:30',
  '07:00', '07:30',
  '08:00', '08:30',
  '09:00', '09:30',
  '10:00', '10:30',
  '11:00', '11:30',
  '12:00', '12:30',
  '13:00', '13:30',
  '14:00', '14:30',
  '15:00', '15:30',
  '16:00', '16:30',
  '17:00', '17:30',
  '18:00', '18:30',
  '19:00', '19:30',
  '20:00', '20:30',
  '21:00', '21:30',
  '22:00', '22:30',
  '23:00', '23:30',
];

// 🎤 KTV 建議字
const KTV_DEFAULTS = {
  timeRange: '20:00', // 只顯示開始時間
  place: '好樂迪 竹北店',
  builtInPeople: '1',
  maxPeople: '6',
  notes: '想說什麼就寫在這～',
};

// 🍻 Bar 建議字
const BAR_DEFAULTS = {
  timeRange: '21:00',
  place: '光年酒吧',
  builtInPeople: '1',
  maxPeople: '4',
  notes: '想喝什麼寫一下～',
};

export default function CreateEvent() {
  const { addEvent } = useEvents();

  const [type, setType] = useState<EventType>('KTV');
  const [region, setRegion] = useState('台北市');
  const [place, setPlace] = useState('');
  const [notes, setNotes] = useState('');

  // 人數用 +/- 控制
  const [builtInPeople, setBuiltInPeople] = useState<number>(
    Number(KTV_DEFAULTS.builtInPeople)
  );
  const [maxPeople, setMaxPeople] = useState<number>(
    Number(KTV_DEFAULTS.maxPeople)
  );

  // 日期（用數字年月日＋下拉選單）
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDateDropdown, setShowDateDropdown] = useState(false);

  // 時間顯示字串
  const [timeRange, setTimeRange] = useState('');
  // 只要一個開始時間（字串）＋下拉選單
  const [startTime, setStartTime] = useState<string | null>(null);
  const [showTimeDropdown, setShowTimeDropdown] = useState(false);

  const placeholders = type === 'KTV' ? KTV_DEFAULTS : BAR_DEFAULTS;

  // 檢查會員資料，沒填好就導去 profile
  const checkProfileAndRedirect = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(PROFILE_KEY);

      if (!raw) {
        Alert.alert(
          '請先建立會員資料',
          '完成會員資料後才能發起活動喔！',
          [
            {
              text: '去填資料',
              onPress: () => router.replace('/profile'),
            },
          ]
        );
        return;
      }

      const p = JSON.parse(raw) || {};
      const hasNickname =
        typeof p.nickname === 'string' && p.nickname.trim().length > 0;
      const hasGender = p.gender === '男' || p.gender === '女';
      const ageNum = Number(p.age);
      const ageOK = Number.isFinite(ageNum) && ageNum >= 18;

      if (!hasNickname || !hasGender || !ageOK) {
        Alert.alert(
          '請先完成會員資料',
          '暱稱、性別、年齡（需大於 18）都要填寫完整喔～',
          [
            {
              text: '去填資料',
              onPress: () => router.replace('/profile'),
            },
          ]
        );
      }
    } catch (e) {
      console.log('檢查會員資料錯誤:', e);
    }
  }, []);

  // 進到「發起活動」這個 tab 時就檢查會員資料
  useFocusEffect(
    useCallback(() => {
      checkProfileAndRedirect();
    }, [checkProfileAndRedirect])
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

  // 類型切換時順便帶推薦人數
  function handleChangeType(next: EventType) {
    setType(next);
    if (next === 'KTV') {
      setBuiltInPeople(Number(KTV_DEFAULTS.builtInPeople));
      setMaxPeople(Number(KTV_DEFAULTS.maxPeople));
    } else {
      setBuiltInPeople(Number(BAR_DEFAULTS.builtInPeople));
      setMaxPeople(Number(BAR_DEFAULTS.maxPeople));
    }
  }

  // 人數 + / -
  function incBuilt() {
    setBuiltInPeople(function (prev) {
      return prev + 1;
    });
  }
  function decBuilt() {
    setBuiltInPeople(function (prev) {
      return Math.max(1, prev - 1);
    });
  }
  function incMax() {
    setMaxPeople(function (prev) {
      return prev + 1;
    });
  }
  function decMax() {
    setMaxPeople(function (prev) {
      return Math.max(1, prev - 1);
    });
  }

  async function onSubmit() {
    const regionTrim = region.trim();
    const placeTrim = place.trim();
    const timeTrim = timeRange.trim();
    const notesTrim = notes.trim(); // 備註可以空白

    // 備註不列入必填
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
      Alert.alert(
        '人數錯誤',
        '內建人數必須小於人數上限（不能一樣，也不能比上限多）'
      );
      return;
    }

    const now = dayjs();

    // ⏰ 選擇的日期＋時間（全部數字）
    const parts = startTime.split(':');
    const sh = Number(parts[0]);
    const sm = Number(parts[1]);

    let startTimeMoment = dayjs(selectedDate)
      .hour(sh)
      .minute(sm)
      .second(0)
      .millisecond(0);

    if (startTimeMoment.isBefore(now)) {
      Alert.alert('時間錯誤', '時間已經過去了，請選擇晚一點的日期或時間');
      return;
    }

    const startTimeDate = startTimeMoment.toDate();

    const ev: any = {
      id: String(Date.now()),
      type,
      region: regionTrim,
      place: placeTrim,
      timeRange: timeTrim, // 例如：20:00
      timeISO: startTimeDate.toISOString(),
      builtInPeople: built,
      maxPeople: max,
      notes: notesTrim, // 可以是空字串
      attendees: [],
      createdAt: now.toISOString(),
      createdBy: 'me', // 自己創建的活動
    };

    await addEvent(ev);

    resetForm();

    Alert.alert('成功', '活動已建立', [
      {
        text: '回首頁',
        onPress: function () {
          router.push('/');
        },
      },
    ]);
  }

  // 🔽 一按就先收鍵盤，再送出
  function handlePressSubmit() {
    Keyboard.dismiss();
    onSubmit();
  }

  // 產生可以選的日期（全部用數字顯示）
  // 這裡先給今天起算往後 180 天
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
    <View
      style={{
        flex: 1,
        backgroundColor: '#020617',
      }}
    >
      <View
        style={{
          flex: 1,
          paddingTop: 80,
          paddingHorizontal: 16,
          backgroundColor: '#020617',
        }}
      >
        {/* 標題（固定，不會跟著中間捲動） */}
        <Text
          style={{
            fontSize: 22,
            fontWeight: 'bold',
            marginBottom: 20,
            color: 'white',
          }}
        >
          發起活動
        </Text>

        {/* 中間這塊可以滑動＋跟鍵盤對齊，但不顯示滾輪 */}
        <KeyboardAwareScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 24 }}
          extraScrollHeight={60}
          enableOnAndroid
          keyboardOpeningTime={Platform.OS === 'android' ? 0 : 250}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false} // 👈 不顯示滾輪
        >
          {/* 類型 */}
          <Text style={{ color: 'white', marginBottom: 12 }}>類型</Text>
          <View style={{ flexDirection: 'row', marginBottom: 12 }}>
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
              <Text
                style={{
                  color: type === 'KTV' ? 'black' : 'white',
                  fontWeight: '600',
                }}
              >
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
                backgroundColor: type === 'Bar' ? '#22c55e' : '#111827',
                borderWidth: 1,
                borderColor: '#22c55e',
              }}
            >
              <Text
                style={{
                  color: type === 'Bar' ? 'black' : 'white',
                  fontWeight: '600',
                }}
              >
                🍻 揪喝酒
              </Text>
            </Pressable>
          </View>

          {/* 地區 */}
          <Text style={{ color: 'white', marginBottom: 8 }}>地區</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false} // 👈 不顯示橫向滾輪
            contentContainerStyle={{ paddingVertical: 4 }}
          >
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
                  <Text
                    style={{
                      color: region === city ? 'black' : 'white',
                      fontSize: 13,
                    }}
                  >
                    {city}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* 地點 */}
          <Field
            label="地點"
            value={place}
            onChangeText={setPlace}
            placeholder={placeholders.place}
          />

          {/* 日期＋時間：同一欄位 */}
          <View style={{ marginTop: 20, zIndex: 30 }}>
            <Text style={{ color: 'white', marginBottom: 4 }}>日期時間</Text>

            <View style={{ flexDirection: 'row' }}>
              {/* 日期（純數字＋下拉選單） */}
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
                    borderColor: '#22c55e', // 綠框
                  }}
                >
                  <Text style={{ color: 'white' }}>
                    {dayjs(selectedDate).format('YYYY/MM/DD')}
                  </Text>
                </Pressable>

                {showDateDropdown && (
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
                          dayjs(opt.value).format('YYYY/MM/DD') ===
                          dayjs(selectedDate).format('YYYY/MM/DD');
                        return (
                          <Pressable
                            key={opt.label}
                            onPress={function () {
                              handleSelectDate(opt.value);
                            }}
                            style={{
                              paddingVertical: 10,
                              alignItems: 'center',
                            }}
                          >
                            <Text
                              style={{
                                color: isSelected ? '#22c55e' : 'white',
                              }}
                            >
                              {opt.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* 時間（下拉選單） */}
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
                    borderColor: '#22c55e', // 綠框，跟日期一樣大小風格
                  }}
                >
                  <Text style={{ color: 'white' }}>
                    {startTime || '開始時間'}
                  </Text>
                </Pressable>

                {showTimeDropdown && (
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
                            style={{
                              paddingVertical: 10,
                              alignItems: 'center',
                            }}
                          >
                            <Text
                              style={{
                                color: t === startTime ? '#22c55e' : 'white',
                              }}
                            >
                              {t}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* 內建人數：用 +/- 控制 */}
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
              <Pressable
                onPress={decBuilt}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                }}
              >
                <Text style={{ color: 'white', fontSize: 18 }}>－</Text>
              </Pressable>

              <Text
                style={{
                  color: 'white',
                  fontSize: 18,
                  fontWeight: '600',
                }}
              >
                {builtInPeople}
              </Text>

              <Pressable
                onPress={incBuilt}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                }}
              >
                <Text style={{ color: 'white', fontSize: 18 }}>＋</Text>
              </Pressable>
            </View>
          </View>

          {/* 人數上限：用 +/- 控制 */}
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
              <Pressable
                onPress={decMax}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                }}
              >
                <Text style={{ color: 'white', fontSize: 18 }}>－</Text>
              </Pressable>

              <Text
                style={{
                  color: 'white',
                  fontSize: 18,
                  fontWeight: '600',
                }}
              >
                {maxPeople}
              </Text>

              <Pressable
                onPress={incMax}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                }}
              >
                <Text style={{ color: 'white', fontSize: 18 }}>＋</Text>
              </Pressable>
            </View>
          </View>

          {/* 備註（可留白） */}
          <Field
            label="備註"
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder={placeholders.notes}
          />
        </KeyboardAwareScrollView>

        {/* 建立活動：固定在底部，不跟著滾動、也不會被鍵盤推走 */}
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
};

function Field(props: FieldProps) {
  const {
    label,
    value,
    onChangeText,
    keyboardType,
    multiline,
    placeholder,
  } = props;

  return (
    <View style={{ marginTop: 20 }}>
      <Text style={{ color: 'white', marginBottom: 4 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType || 'default'}
        multiline={!!multiline}
        placeholder={placeholder}
        placeholderTextColor="#6b7280"
        style={{
          backgroundColor: '#111827',
          color: 'white',
          padding: 12,
          borderRadius: 10,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
    </View>
  );
}
