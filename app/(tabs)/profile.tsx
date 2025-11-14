// app/(tabs)/profile.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  Text,
  TextInput,
  View,
  Pressable,
  Platform,
  Keyboard,
  Image,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import * as ImagePicker from 'expo-image-picker';

const PROFILE_KEY = 'profile_v1';

export default function Profile() {
  const [nickname, setNickname] = useState('');
  const [gender, setGender] = useState<'男' | '女' | null>(null);
  const [age, setAge] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [intro, setIntro] = useState(''); // 🌟 自我介紹（可空白）

  // 讀取已儲存的會員資料
  async function loadProfile() {
    try {
      const raw = await AsyncStorage.getItem(PROFILE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) || {};
        const savedNickname =
          typeof parsed.nickname === 'string' ? parsed.nickname : '';
        const savedGender =
          parsed.gender === '男' || parsed.gender === '女'
            ? parsed.gender
            : null;
        const savedAge =
          typeof parsed.age === 'number' || typeof parsed.age === 'string'
            ? String(parsed.age)
            : '';
        const savedPhotoUri =
          typeof parsed.photoUri === 'string' ? parsed.photoUri : null;
        const savedIntro =
          typeof parsed.intro === 'string' ? parsed.intro : '';

        setNickname(savedNickname);
        setGender(savedGender);
        setAge(savedAge);
        setPhotoUri(savedPhotoUri);
        setIntro(savedIntro);
      } else {
        // 沒存過就清空
        setNickname('');
        setGender(null);
        setAge('');
        setPhotoUri(null);
        setIntro('');
      }
    } catch (e) {
      console.log('讀取會員資料錯誤:', e);
    }
  }

  // 一進頁面載一次
  useEffect(() => {
    loadProfile();
  }, []);

  // 點到會員 tab 也重載一次
  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [])
  );

  // 選擇大頭貼
  async function handlePickPhoto() {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('權限需要', '請到設定開啟相簿權限，才能上傳照片喔～');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (e) {
      console.log('選擇照片錯誤:', e);
    }
  }

  async function handleSave() {
    const nicknameTrim = nickname.trim();
    const ageTrim = age.trim();
    const introTrim = intro.trim(); // 自我介紹可留白

    if (!nicknameTrim) {
      Alert.alert('提醒', '暱稱一定要填喔～');
      return;
    }

    // 暱稱最多 10 個字
    if (nicknameTrim.length > 10) {
      Alert.alert('暱稱太長', '暱稱最多 10 個字以內');
      return;
    }

    if (!gender) {
      Alert.alert('提醒', '性別一定要選擇喔～');
      return;
    }

    // ✅ 大頭貼也必填
    if (!photoUri) {
      Alert.alert('提醒', '大頭貼一定要選喔～');
      return;
    }

    if (!ageTrim) {
      Alert.alert('提醒', '年齡一定要填喔～');
      return;
    }

    const n = Number(ageTrim);
    if (!Number.isFinite(n)) {
      Alert.alert('年齡錯誤', '年齡請輸入數字');
      return;
    }

    // 年齡必須「大於 18」
    if (n < 18) {
      Alert.alert('年齡限制', '本服務僅限年齡滿 18 歲使用喔～');
      return;
    }

    // 年齡最多 100 歲
    if (n > 100) {
      Alert.alert('年齡範圍', '年齡請填 18～100 歲之間');
      return;
    }

    // 儲存到 AsyncStorage
    try {
      await AsyncStorage.setItem(
        PROFILE_KEY,
        JSON.stringify({
          nickname: nicknameTrim,
          gender,
          age: n,
          photoUri,      // 大頭貼必填
          intro: introTrim, // 自我介紹可空白
        })
      );
    } catch (e) {
      console.log('儲存會員資料錯誤:', e);
    }

    // ✅ 儲存成功 → 跳到「發起活動」頁
    Alert.alert('已儲存', '會員資料已更新！', [
      {
        text: '去發起活動',
        onPress: function () {
          router.replace('/explore');
        },
      },
    ]);
  }

  // 一按就先收鍵盤，再跑驗證＆儲存
  function handlePressSave() {
    Keyboard.dismiss();
    handleSave();
  }

  // 🔴 刪除會員資料（測試用）
  async function handleDeleteProfile() {
    Alert.alert(
      '刪除會員資料',
      '確定要刪除這支手機的會員資料嗎？（暱稱、性別、年齡、大頭貼、自我介紹都會清空）',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '刪除',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem(PROFILE_KEY);
            } catch (e) {
              console.log('刪除會員資料錯誤:', e);
            }

            // 清空畫面上的欄位
            setNickname('');
            setGender(null);
            setAge('');
            setPhotoUri(null);
            setIntro('');

            Alert.alert('已刪除', '這支手機的會員資料已經清空（方便測試用）');
          },
        },
      ]
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#020617' }}>
      <View
        style={{
          flex: 1,
          paddingTop: 80,
          paddingHorizontal: 16,
          backgroundColor: '#020617',
        }}
      >
        {/* 標題：固定在上面 */}
        <Text
          style={{
            fontSize: 22,
            fontWeight: 'bold',
            marginBottom: 20,
            color: 'white',
          }}
        >
          會員資料
        </Text>

        {/* 中間表單：可以滑動＋跟鍵盤對齊，但不顯示滾輪 */}
        <KeyboardAwareScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 32, flexGrow: 1 }}
          extraScrollHeight={40}
          enableOnAndroid
          keyboardOpeningTime={Platform.OS === 'android' ? 0 : 250}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* 大頭貼（必填） */}
          <View
            style={{
              alignItems: 'center',
              marginTop: 8,
              marginBottom: 5,
            }}
          >
            <Pressable
              onPress={handlePickPhoto}
              style={{
                width: 130,
                height: 130,
                borderRadius: 999,
                borderWidth: 2,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                backgroundColor: '#111827',
                borderColor: photoUri ? '#22c55e' : '#4b5563',
              }}
            >
              {photoUri ? (
                <Image
                  source={{ uri: photoUri }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              ) : (
                <Text style={{ color: '#9ca3af', fontSize: 12 }}>
                  + 加入照片（必填）
                </Text>
              )}
            </Pressable>
            <Pressable
              onPress={handlePickPhoto}
              style={{ marginTop: 8, paddingHorizontal: 8, paddingVertical: 4 }}
            >
              <Text style={{ color: '#9ca3af', fontSize: 12 }}>
                點一下變更大頭貼
              </Text>
            </Pressable>
          </View>

          {/* 暱稱 */}
          <Field
            label="暱稱（必填）"
            value={nickname}
            onChangeText={setNickname}
            placeholder="想讓別人怎麼叫你？（最多 10 個字）"
          />

          {/* 性別（男／女） */}
          <View style={{ marginTop: 20 }}>
            <Text style={{ color: 'white', marginBottom: 12 }}>性別（必填）</Text>
            <View style={{ flexDirection: 'row', columnGap: 8 }}>
              {(['男', '女'] as const).map((g) => (
                <Pressable
                  key={g}
                  onPress={() => setGender(g)}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 999,
                    alignItems: 'center',
                    backgroundColor: gender === g ? '#22c55e' : '#111827',
                    borderWidth: 1,
                    borderColor: '#22c55e',
                  }}
                >
                  <Text
                    style={{
                      color: gender === g ? 'black' : 'white',
                      fontWeight: '600',
                    }}
                  >
                    {g}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* 年齡（必填，大於18，最多100） */}
          <Field
            label="年齡（必填）"
            value={age}
            onChangeText={setAge}
            keyboardType="number-pad"
            placeholder="例如：24（18～100 歲）"
          />

          {/* 🌟 自我介紹（可多行，可留白） */}
          <Field
            label="自我介紹（選填）"
            value={intro}
            onChangeText={setIntro}
            multiline
            placeholder="可以簡單介紹一下自己～（興趣、個性、想玩的類型等等）"
          />
        </KeyboardAwareScrollView>

        {/* 底部按鈕區：儲存 & 刪除 */}
        <View style={{ paddingVertical: 16 }}>
          {/* 儲存資料 */}
          <Pressable
            onPress={handlePressSave}
            style={{
              backgroundColor: '#22c55e',
              borderRadius: 999,
              paddingVertical: 12,
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <Text style={{ color: 'black', fontWeight: '600' }}>
              儲存資料
            </Text>
          </Pressable>

          {/* 🔴 刪除會員資料（測試用） */}
          <Pressable
            onPress={handleDeleteProfile}
            style={{
              borderRadius: 999,
              paddingVertical: 10,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: '#f97373',
            }}
          >
            <Text style={{ color: '#f97373', fontWeight: '600', fontSize: 13 }}>
              刪除這支手機的會員資料（測試用）
            </Text>
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

function Field({
  label,
  value,
  onChangeText,
  keyboardType = 'default',
  multiline = false,
  placeholder,
}: FieldProps) {
  return (
    <View style={{ marginTop: 20 }}>
      <Text style={{ color: 'white', marginBottom: 4 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor="#6b7280"
        style={{
          backgroundColor: '#111827',
          color: 'white',
          padding: 12,
          borderRadius: 10,
          textAlignVertical: multiline ? 'top' : 'center',
          minHeight: multiline ? 80 : undefined,
        }}
      />
    </View>
  );
}
