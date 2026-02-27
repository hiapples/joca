// app/(tabs)/profile.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

const PROFILE_KEY = 'profile_v1';
const API_BASE = 'http://192.168.1.139:4000';

type GenderType = '男' | '女' | null;

type ProfileData = {
  userId: string;
  nickname: string;
  gender: GenderType;
  age: number;
  intro?: string;
  photoUri?: string;
};

function generateUserId() {
  const now = Date.now().toString(36);
  const rand = Math.floor(Math.random() * 1e8)
    .toString(36)
    .slice(0, 5);
  return 'u_' + now + '_' + rand;
}

// 從 photoUri 抽出 photoId
// 例如: http://xxx:4000/photos/65abc -> 65abc
function extractPhotoIdFromUri(uri: string | null) {
  if (!uri) return null;
  const key = '/photos/';
  const idx = uri.lastIndexOf(key);
  if (idx === -1) return null;
  const id = uri.substring(idx + key.length).trim();
  if (!id) return null;
  return id;
}

// 上傳頭貼到 /photos，並把舊照片 id 一起帶給後端刪除
async function uploadAvatarAndGetUrl(localUri: string, oldRemotePhotoUri: string | null) {
  const formData = new FormData();

  formData.append(
    'file',
    {
      uri: localUri,
      type: 'image/jpeg',
      name: 'avatar.jpg',
    } as any
  );

  const oldId = extractPhotoIdFromUri(oldRemotePhotoUri);
  if (oldId) {
    formData.append('oldPhotoId', oldId);
  }

  const res = await fetch(API_BASE + '/photos', {
    method: 'POST',
    body: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    console.log('上傳頭貼失敗:', res.status, text);
    throw new Error('上傳頭貼失敗');
  }

  const json = await res.json();
  const id = json.id;
  const url = API_BASE + '/photos/' + id;
  return url;
}

export default function ProfileScreen() {
  const [userId, setUserId] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string>('');
  const [gender, setGender] = useState<GenderType>(null);
  const [ageText, setAgeText] = useState<string>('');
  const [intro, setIntro] = useState<string>('');

  // avatarUri：畫面顯示用（file:// 或 http://）
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  // avatarIsLocal：true 代表剛選的 file://，要上傳；false 代表已是遠端 URL
  const [avatarIsLocal, setAvatarIsLocal] = useState<boolean>(false);

  // ✅ 記住「目前遠端的舊頭貼 URL」
  // 當你換照片時，upload 會用它抽出 oldPhotoId 給後端刪舊圖
  const [oldRemotePhotoUri, setOldRemotePhotoUri] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    (async function () {
      try {
        const raw = await AsyncStorage.getItem(PROFILE_KEY);
        if (!raw) {
          setLoading(false);
          return;
        }

        let p: any = {};
        try {
          p = JSON.parse(raw) || {};
        } catch (e) {
          console.log('解析 profile_v1 失敗:', e);
          p = {};
        }

        if (typeof p.userId === 'string' && p.userId.trim().length > 0) {
          setUserId(p.userId.trim());
        }

        if (typeof p.nickname === 'string') {
          setNickname(p.nickname);
        }

        if (p.gender === '男' || p.gender === '女') {
          setGender(p.gender);
        }

        const ageNum = Number(p.age);
        if (Number.isFinite(ageNum) && ageNum > 0) {
          setAgeText(String(ageNum));
        }

        if (typeof p.intro === 'string') {
          setIntro(p.intro);
        }

        if (typeof p.photoUri === 'string' && p.photoUri.trim().length > 0) {
          const remote = p.photoUri.trim();
          setAvatarUri(remote);
          setAvatarIsLocal(false);
          // ✅ 初始化舊遠端頭貼（之後換照片要用）
          setOldRemotePhotoUri(remote);
        }
      } catch (e) {
        console.log('讀取 profile_v1 失敗:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 選擇大頭貼
  async function handlePickAvatar() {
    try {
      const permResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permResult.granted) {
        Alert.alert('權限不足', '需要相簿權限才能選擇照片');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets && result.assets[0];
      if (!asset || !asset.uri) {
        Alert.alert('錯誤', '選取照片失敗');
        return;
      }

      // ✅ 如果目前顯示的是遠端頭貼，先記住它，等等上傳要刪掉這張
      if (!avatarIsLocal && avatarUri && avatarUri.indexOf('http') === 0) {
        setOldRemotePhotoUri(avatarUri);
      }

      setAvatarUri(asset.uri);     // file://xxx
      setAvatarIsLocal(true);      // 代表要上傳
    } catch (e) {
      console.log('選擇頭貼錯誤:', e);
      Alert.alert('錯誤', '選擇照片失敗，請稍後再試');
    }
  }

  // 年齡輸入只允許 0-9，最多 2 位數
  function handleAgeChange(text: string) {
    const onlyDigits = text.replace(/[^0-9]/g, '');
    const limited = onlyDigits.slice(0, 2);
    setAgeText(limited);
  }

  // 儲存會員資料
  async function handleSave() {
    const nicknameTrim = nickname.trim();
    const introTrim = intro.trim();
    const ageNum = Number(ageText);

    if (!nicknameTrim) {
      Alert.alert('請輸入暱稱', '暱稱不能空白喔！');
      return;
    }

    if (gender !== '男' && gender !== '女') {
      Alert.alert('請選擇性別', '性別請選「男」或「女」。');
      return;
    }

    if (!Number.isFinite(ageNum) || ageNum <= 0) {
      Alert.alert('年齡錯誤', '請輸入正確的年齡');
      return;
    }

    if (ageNum < 18) {
      Alert.alert('未滿 18 歲', '使用活動功能需要年滿 18 歲喔～');
      return;
    }

    if (!introTrim) {
      Alert.alert('請填寫自我介紹', '自我介紹不能空白喔！');
      return;
    }

    if (!avatarUri) {
      Alert.alert('請上傳大頭貼', '請選擇一張大頭貼照片');
      return;
    }

    setSaving(true);

    try {
      // 1) 決定 userId
      let finalUserId = userId;
      if (!finalUserId) {
        finalUserId = generateUserId();
        setUserId(finalUserId);
      }

      // 2) 處理頭貼：如果是本機 file://，就上傳取得 URL（並刪掉舊圖）
      let finalPhotoUri = avatarUri;

      if (avatarIsLocal && avatarUri) {
        finalPhotoUri = await uploadAvatarAndGetUrl(avatarUri, oldRemotePhotoUri);
        setAvatarUri(finalPhotoUri);
        setAvatarIsLocal(false);

        // ✅ 上傳成功後，新的遠端頭貼就是「目前使用中的」，更新 oldRemotePhotoUri
        setOldRemotePhotoUri(finalPhotoUri);
      }

      // 3) 組成要存的 profile 物件
      const profileToSave: ProfileData = {
        userId: finalUserId as string,
        nickname: nicknameTrim,
        gender: gender,
        age: ageNum,
        intro: introTrim,
        photoUri: finalPhotoUri,
      };

      // 4) 寫入 AsyncStorage
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profileToSave));

      Alert.alert('已儲存', '會員資料已更新完成！', [
        {
          text: '去發起活動',
          onPress: function () {
            router.push('/explore');
          },
        },
      ]);
    } catch (e) {
      console.log('儲存會員資料錯誤:', e);
      Alert.alert('儲存失敗', '請稍後再試試看');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#020617',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: 'white' }}>載入中...</Text>
      </View>
    );
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

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        enableOnAndroid={true}
        extraScrollHeight={80}
        keyboardShouldPersistTaps="handled"
      >
        {/* 大頭貼 */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <Pressable onPress={handlePickAvatar}>
            {avatarUri ? (
              <Image
                source={{ uri: avatarUri }}
                style={{
                  width: 150,
                  height: 150,
                  borderRadius: 75,
                  backgroundColor: '#111827',
                }}
              />
            ) : (
              <View
                style={{
                  width: 150,
                  height: 150,
                  borderRadius: 75,
                  backgroundColor: '#111827',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    color: '#9ca3af',
                    fontSize: 12,
                  }}
                >
                  加入照片
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* 暱稱 */}
        <Text style={{ color: 'white', marginBottom: 4 }}>暱稱</Text>
        <TextInput
          value={nickname}
          onChangeText={setNickname}
          placeholder="輸入暱稱"
          placeholderTextColor="#6b7280"
          style={{
            backgroundColor: '#111827',
            color: 'white',
            padding: 12,
            borderRadius: 10,
            marginBottom: 16,
          }}
        />

        {/* 性別 */}
        <Text style={{ color: 'white', marginBottom: 4 }}>性別</Text>
        <View style={{ flexDirection: 'row', marginBottom: 16 }}>
          <Pressable
            onPress={function () {
              setGender('男');
            }}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 999,
              alignItems: 'center',
              marginRight: 8,
              backgroundColor: gender === '男' ? '#22c55e' : '#111827',
              borderWidth: 1,
              borderColor: '#22c55e',
            }}
          >
            <Text
              style={{
                color: gender === '男' ? 'black' : 'white',
                fontWeight: '600',
              }}
            >
              男
            </Text>
          </Pressable>

          <Pressable
            onPress={function () {
              setGender('女');
            }}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 999,
              alignItems: 'center',
              backgroundColor: gender === '女' ? '#22c55e' : '#111827',
              borderWidth: 1,
              borderColor: '#22c55e',
            }}
          >
            <Text
              style={{
                color: gender === '女' ? 'black' : 'white',
                fontWeight: '600',
              }}
            >
              女
            </Text>
          </Pressable>
        </View>

        {/* 年齡 */}
        <Text style={{ color: 'white', marginBottom: 4 }}>年齡</Text>
        <TextInput
          value={ageText}
          onChangeText={handleAgeChange}
          placeholder="例如：24"
          placeholderTextColor="#6b7280"
          keyboardType="number-pad"
          maxLength={2}
          style={{
            backgroundColor: '#111827',
            color: 'white',
            padding: 12,
            borderRadius: 10,
            marginBottom: 16,
          }}
        />

        {/* 自我介紹 */}
        <Text style={{ color: 'white', marginBottom: 4 }}>自我介紹</Text>
        <TextInput
          value={intro}
          onChangeText={setIntro}
          placeholder="簡單介紹一下自己～"
          placeholderTextColor="#6b7280"
          multiline
          style={{
            backgroundColor: '#111827',
            color: 'white',
            padding: 12,
            borderRadius: 10,
            minHeight: 120,
            textAlignVertical: 'top',
            marginBottom: 24,
          }}
        />
      </KeyboardAwareScrollView>

      {/* 儲存按鈕 */}
      <View style={{ paddingVertical: 16 }}>
        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={{
            backgroundColor: saving ? '#6b7280' : '#22c55e',
            borderRadius: 999,
            paddingVertical: 12,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: 'black', fontWeight: '600' }}>
            {saving ? '儲存中...' : '儲存會員資料'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}