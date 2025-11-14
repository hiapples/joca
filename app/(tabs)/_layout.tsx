// app/(tabs)/_layout.tsx
import React, { useEffect } from 'react';
import { Tabs, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const PROFILE_KEY = 'profile_v1';

// 共用：檢查這支手機的會員資料是否「填好」
async function checkProfileOK(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);

    if (!raw) {
      return false;
    }

    const p = JSON.parse(raw) || {};

    const hasNickname =
      typeof p.nickname === 'string' && p.nickname.trim().length > 0;
    const hasGender = p.gender === '男' || p.gender === '女';
    const ageNum = Number(p.age);
    const ageOK = Number.isFinite(ageNum) && ageNum >= 18;
    const hasPhoto =
      typeof p.photoUri === 'string' && p.photoUri.trim().length > 0;

    return hasNickname && hasGender && ageOK && hasPhoto;
  } catch (e) {
    console.log('Profile check error', e);
    return false;
  }
}

export default function TabLayout() {
  // App 一進來先檢查一次：不合格就直接送去會員頁
  useEffect(() => {
    (async () => {
      const ok = await checkProfileOK();
      if (!ok) {
        // 這裡用 '/profile' 就好，Expo Router 會對應到 (tabs)/profile.tsx
        router.replace('/profile');
      }
    })();
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#22c55e',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          backgroundColor: '#020617',
          borderTopColor: '#1f2937',
        },
        tabBarLabelStyle: {
          fontSize: 11,
        },
      }}
    >
      {/* 首頁 tab */}
      <Tabs.Screen
        name="index"
        options={{
          title: '首頁',
          tabBarIcon: ({ color }) => (
            <Ionicons name="home-outline" size={22} color={color} />
          ),
        }}
        listeners={{
          tabPress: (e) => {
            // 先擋住預設切換，自己決定要去哪
            e.preventDefault();
            (async () => {
              const ok = await checkProfileOK();
              if (ok) {
                // ✅ 資料已填好 → 允許進首頁
                // 這裡用 '/'，因為你原本就是用 router.push('/') 回首頁
                router.push('/');
              } else {
                // ❌ 資料沒填好 → 一律送去會員頁
                router.replace('/profile');
              }
            })();
          },
        }}
      />

      {/* 發起活動 tab */}
      <Tabs.Screen
        name="explore"
        options={{
          title: '發起活動',
          tabBarIcon: ({ color }) => (
            <Ionicons name="add-circle-outline" size={22} color={color} />
          ),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            (async () => {
              const ok = await checkProfileOK();
              if (ok) {
                // ✅ 資料已填好 → 允許進發起活動頁
                // 你的檔名是 app/(tabs)/explore.tsx，所以直接 '/explore'
                router.push('/explore');
              } else {
                // ❌ 資料沒填好 → 回會員頁
                router.replace('/profile');
              }
            })();
          },
        }}
      />

      {/* 會員資料 tab：永遠可以進來填資料 */}
      <Tabs.Screen
        name="profile"
        options={{
          title: '會員',
          tabBarIcon: ({ color }) => (
            <Ionicons name="person-circle-outline" size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
