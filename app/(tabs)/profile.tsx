// app/(tabs)/profile.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useAuth } from '../../lib/auth';

const API_BASE = 'http://192.168.1.139:4000';

type GenderType = '男' | '女' | null;

function buildPhotoUrl(userId: string) {
  // 加時間戳避免快取看不到新照片
  return API_BASE + '/users/' + userId + '/photo?t=' + Date.now();
}

async function apiGetMe(accessToken: string) {
  const res = await fetch(API_BASE + '/users/me', {
    headers: { Authorization: 'Bearer ' + accessToken },
  });
  if (!res.ok) throw new Error('GET /users/me failed');
  return await res.json();
}

async function apiUpdateMe(accessToken: string, payload: any) {
  const res = await fetch(API_BASE + '/users/me', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + accessToken,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    console.log('PUT /users/me fail:', res.status, text);
    throw new Error('update failed');
  }
  return await res.json();
}

async function apiUploadPhoto(accessToken: string, localUri: string) {
  const formData = new FormData();
  formData.append(
    'file',
    { uri: localUri, type: 'image/jpeg', name: 'avatar.jpg' } as any
  );

  const res = await fetch(API_BASE + '/users/me/photo', {
    method: 'PUT',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'multipart/form-data',
    },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    console.log('PUT /users/me/photo fail:', res.status, text);
    throw new Error('upload failed');
  }
  return await res.json(); // { ok, photoUrl }
}

export default function ProfileScreen() {
  const { booting, loggedIn, accessToken, user, refreshSession } = useAuth();

  const [nickname, setNickname] = useState('');
  const [gender, setGender] = useState<GenderType>(null);
  const [ageText, setAgeText] = useState('');
  const [intro, setIntro] = useState('');

  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarIsLocal, setAvatarIsLocal] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 未登入就去 login
  useEffect(() => {
    if (booting) return;
    if (!loggedIn) {
      router.replace({ pathname: '/login' } as any);
      return;
    }
  }, [booting, loggedIn]);

  // 進來抓自己的資料
  useEffect(() => {
    (async () => {
      if (!accessToken || !user?.userId) return;

      setLoading(true);
      try {
        const me = await apiGetMe(accessToken);

        setNickname(me.nickname || '');
        setGender(me.gender === '男' || me.gender === '女' ? me.gender : null);
        setAgeText(me.age ? String(me.age) : '');
        setIntro(me.intro || '');

        setAvatarUri(buildPhotoUrl(user.userId));
        setAvatarIsLocal(false);
      } catch (e) {
        console.log(e);
        // token 可能過期，嘗試 refresh
        const ok = await refreshSession();
        if (!ok) router.replace({ pathname: '/login' } as any);
      } finally {
        setLoading(false);
      }
    })();
  }, [accessToken, user?.userId]);

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
      if (!asset?.uri) {
        Alert.alert('錯誤', '選取照片失敗');
        return;
      }

      setAvatarUri(asset.uri); // file://
      setAvatarIsLocal(true);
    } catch (e) {
      console.log(e);
      Alert.alert('錯誤', '選擇照片失敗');
    }
  }

  function handleAgeChange(text: string) {
    const onlyDigits = text.replace(/[^0-9]/g, '');
    setAgeText(onlyDigits.slice(0, 2));
  }

  async function handleSave() {
    if (!accessToken || !user?.userId) return;

    const nicknameTrim = nickname.trim();
    const introTrim = intro.trim();
    const ageNum = Number(ageText);

    if (!nicknameTrim) return Alert.alert('請輸入暱稱', '暱稱不能空白喔！');
    if (gender !== '男' && gender !== '女') return Alert.alert('請選擇性別', '性別請選「男」或「女」。');
    if (!Number.isFinite(ageNum) || ageNum <= 0) return Alert.alert('年齡錯誤', '請輸入正確的年齡');
    if (ageNum < 18) return Alert.alert('未滿 18 歲', '使用活動功能需要年滿 18 歲喔～');
    if (!introTrim) return Alert.alert('請填寫自我介紹', '自我介紹不能空白喔！');

    setSaving(true);
    try {
      // 1) 更新基本資料
      await apiUpdateMe(accessToken, {
        nickname: nicknameTrim,
        gender,
        age: ageNum,
        intro: introTrim,
      });

      // 2) 如果選了新照片（file://），就上傳覆蓋
      if (avatarIsLocal && avatarUri) {
        await apiUploadPhoto(accessToken, avatarUri);
        setAvatarUri(buildPhotoUrl(user.userId)); // 換成遠端 url
        setAvatarIsLocal(false);
      } else {
        // 確保顯示遠端
        setAvatarUri(buildPhotoUrl(user.userId));
        setAvatarIsLocal(false);
      }

      Alert.alert('已儲存', '會員資料已更新完成！', [
        { text: '去發起活動', onPress: () => router.push('/explore') },
      ]);
    } catch (e) {
      console.log(e);
      Alert.alert('儲存失敗', '請稍後再試');
    } finally {
      setSaving(false);
    }
  }

  if (booting || loading) {
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
        {/* 大頭貼 */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 16 }}>
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
                <Text style={{ color: '#9ca3af', fontSize: 12 }}>加入照片</Text>
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
          style={{ backgroundColor: '#111827', color: 'white', padding: 12, borderRadius: 10, marginBottom: 16 }}
        />

        {/* 性別 */}
        <Text style={{ color: 'white', marginBottom: 4 }}>性別</Text>
        <View style={{ flexDirection: 'row', marginBottom: 16 }}>
          <Pressable
            onPress={() => setGender('男')}
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
            onPress={() => setGender('女')}
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

        {/* 年齡 */}
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