// app/(tabs)/profile.tsx
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TextInput, Pressable, Alert, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useAuth } from '../../lib/auth';
import { router } from 'expo-router';

const API_BASE = 'http://192.168.1.139:4000';

type GenderType = '男' | '女' | null;

function makePhotoUrl(userId: string) {
  return API_BASE + '/users/' + userId + '/photo?ts=' + Date.now();
}

async function fetchMe(accessToken: string) {
  const res = await fetch(API_BASE + '/users/me', {
    headers: { Authorization: 'Bearer ' + accessToken },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error('GET /users/me failed: ' + res.status + ' ' + text);
  }

  return await res.json();
}

async function saveMe(
  accessToken: string,
  body: { nickname: string; gender: string; age: number; intro: string }
) {
  const res = await fetch(API_BASE + '/users/me', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + accessToken,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error('PUT /users/me failed: ' + res.status + ' ' + text);
  }

  return await res.json();
}

async function uploadMePhoto(accessToken: string, localUri: string) {
  const formData = new FormData();
  formData.append(
    'file',
    {
      uri: localUri,
      type: 'image/jpeg',
      name: 'avatar.jpg',
    } as any
  );

  // ✅ 不要手動設 multipart/form-data，Expo 會自動補 boundary
  const res = await fetch(API_BASE + '/users/me/photo', {
    method: 'PUT',
    headers: {
      Authorization: 'Bearer ' + accessToken,
    },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error('PUT /users/me/photo failed: ' + res.status + ' ' + text);
  }

  return await res.json();
}

function isProfileOKLocal(me: any): boolean {
  if (!me) return false;
  const hasNickname = typeof me.nickname === 'string' && me.nickname.trim().length > 0;
  const hasGender = me.gender === '男' || me.gender === '女';
  const ageOK = typeof me.age === 'number' && me.age >= 18;
  const hasPhoto = !!me.hasPhoto;
  return hasNickname && hasGender && ageOK && hasPhoto;
}

async function waitProfileOK(accessToken: string) {
  for (let i = 0; i < 12; i++) {
    try {
      const me = await fetchMe(accessToken);

      const ok =
        typeof me.nickname === 'string' &&
        me.nickname.trim().length > 0 &&
        (me.gender === '男' || me.gender === '女') &&
        typeof me.age === 'number' &&
        me.age >= 18 &&
        !!me.hasPhoto;

      if (ok) return true;
    } catch (e) {}

    await new Promise((r) => setTimeout(r, 250 + i * 50));
  }
  return false;
}

export default function ProfileScreen() {
  const { accessToken, user } = useAuth();

  const [nickname, setNickname] = useState('');
  const [gender, setGender] = useState<GenderType>(null);
  const [ageText, setAgeText] = useState('');
  const [intro, setIntro] = useState('');

  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarIsLocal, setAvatarIsLocal] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ✅ 記錄「進到 profile 畫面時」是否已完成，用來決定彈窗文案（登入成功 vs 儲存成功）
  const wasProfileOKAtLoadRef = useRef(false);

  useEffect(() => {
    (async function () {
      try {
        if (!accessToken) return;

        const me = await fetchMe(accessToken);

        // ✅ 記錄「進來當下」是否完整（不要在 handleSave 又多打一個 fetchMe，避免跳轉抖動）
        wasProfileOKAtLoadRef.current = isProfileOKLocal(me);

        if (typeof me.nickname === 'string') setNickname(me.nickname);
        if (me.gender === '男' || me.gender === '女') setGender(me.gender);
        if (typeof me.age === 'number' && me.age > 0) setAgeText(String(me.age));
        if (typeof me.intro === 'string') setIntro(me.intro);

        const uid = String(me.userId || (user && (user as any).userId) || '');
        if (uid && me.hasPhoto) {
          setAvatarUri(makePhotoUrl(uid));
          setAvatarIsLocal(false);
        } else {
          setAvatarUri(null);
          setAvatarIsLocal(false);
        }
      } catch (e) {
        console.log('Profile init error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [accessToken, user]);

  async function handlePickAvatar() {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('權限不足', '需要相簿權限才能選擇照片');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled) return;

      const asset = result.assets && result.assets[0];
      if (!asset || !asset.uri) {
        Alert.alert('錯誤', '選取照片失敗');
        return;
      }

      setAvatarUri(asset.uri);
      setAvatarIsLocal(true);
    } catch (e) {
      console.log('Pick avatar error:', e);
      Alert.alert('錯誤', '選擇照片失敗');
    }
  }

  function handleAgeChange(text: string) {
    const onlyDigits = text.replace(/[^0-9]/g, '');
    setAgeText(onlyDigits.slice(0, 2));
  }

  async function handleSave() {
  if (!accessToken) {
    Alert.alert('尚未登入', '請先登入');
    return;
  }

  if (saving) return;

  const nicknameTrim = nickname.trim();
  const introTrim = intro.trim();
  const ageNum = Number(ageText);

  if (!avatarUri) {
    Alert.alert('請上傳大頭貼', '請點「加入照片」選一張照片');
    return;
  }
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

  setSaving(true);

  try {
    // ✅ 儲存前先看「原本」是否已完成（用它判斷是不是第一次完成）
    const beforeMe = await fetchMe(accessToken);
    const beforeOK =
      !!beforeMe &&
      typeof beforeMe.nickname === 'string' &&
      beforeMe.nickname.trim().length > 0 &&
      (beforeMe.gender === '男' || beforeMe.gender === '女') &&
      typeof beforeMe.age === 'number' &&
      beforeMe.age >= 18 &&
      !!beforeMe.hasPhoto;

    const saved = await saveMe(accessToken, {
      nickname: nicknameTrim,
      gender: gender,
      age: ageNum,
      intro: introTrim,
    });

    const uid = String(saved.userId || (user && (user as any).userId) || '');
    if (!uid) throw new Error('missing userId');

    if (avatarIsLocal) {
      await uploadMePhoto(accessToken, avatarUri);
      setAvatarIsLocal(false);
    }

    setAvatarUri(makePhotoUrl(uid));

    // ✅ 等後端 hasPhoto / 欄位同步完成（避免 TabLayout 誤判）
    const ok = await waitProfileOK(accessToken);

    // ✅ 給 TabLayout 一個緩衝期（避免剛跳就被踢回）
    (globalThis as any).__PROFILE_GRACE_UNTIL__ = Date.now() + 5000;

    // ✅ 第一次完成：按 OK 才跳到發起活動
    if (!beforeOK && ok) {
      Alert.alert('登入成功', '開始發起活動吧！', [
        {
          text: 'OK',
          onPress: function () {
            router.replace({
              pathname: '/(tabs)/explore',
              params: { toast: 'saved' },
            });
          },
        },
      ]);
      return;
    }

    // ✅ 之後的儲存：按 OK 留在原地，不跳轉
    Alert.alert('儲存成功', '會員資料已更新', [
      {
        text: 'OK',
        onPress: function () {},
      },
    ]);
  } catch (e) {
    console.log('Save profile error:', e);
    Alert.alert('儲存失敗', '請稍後再試');
  } finally {
    setSaving(false);
  }
}

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#020617', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: 'white' }}>載入中...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#020617', paddingTop: 80, paddingHorizontal: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 20, color: 'white' }}>
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
        <View style={{ alignItems: 'center', marginBottom: 16 }}>
          <Pressable onPress={handlePickAvatar}>
            {avatarUri ? (
              <Image
                source={{ uri: avatarUri }}
                style={{ width: 150, height: 150, borderRadius: 75, backgroundColor: '#111827' }}
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
                    color: '#22c55e',
                    fontSize: 68,
                    fontWeight: '300',
                    lineHeight: 72,
                    textAlign: 'center',
                  }}
                >
                  +
                </Text>
                <Text style={{ color: '#9ca3af', fontSize: 12, marginTop: 6 }}>加入照片</Text>
              </View>
            )}
          </Pressable>
        </View>

        <Text style={{ color: 'white', marginBottom: 4 }}>暱稱</Text>
        <TextInput
          value={nickname}
          onChangeText={setNickname}
          placeholder="輸入暱稱"
          placeholderTextColor="#6b7280"
          style={{ backgroundColor: '#111827', color: 'white', padding: 12, borderRadius: 10, marginBottom: 16 }}
        />

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
            <Text style={{ color: gender === '男' ? 'black' : 'white', fontWeight: '600' }}>男</Text>
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
            <Text style={{ color: gender === '女' ? 'black' : 'white', fontWeight: '600' }}>女</Text>
          </Pressable>
        </View>

        <Text style={{ color: 'white', marginBottom: 4 }}>年齡</Text>
        <TextInput
          value={ageText}
          onChangeText={handleAgeChange}
          placeholder="例如：24"
          placeholderTextColor="#6b7280"
          keyboardType="number-pad"
          maxLength={2}
          style={{ backgroundColor: '#111827', color: 'white', padding: 12, borderRadius: 10, marginBottom: 16 }}
        />

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
          <Text style={{ color: 'black', fontWeight: '600' }}>{saving ? '儲存中...' : '儲存會員資料'}</Text>
        </Pressable>
      </View>
    </View>
  );
}