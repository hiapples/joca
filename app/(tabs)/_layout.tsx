import React, { useEffect, useState } from 'react';
import { Tabs, Redirect, usePathname } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { View, Text } from 'react-native';
import { useAuth } from '../../lib/auth';

const PROFILE_KEY = 'profile_v1';

async function checkProfileOK(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    if (!raw) return false;

    const p = JSON.parse(raw) || {};
    const hasNickname = typeof p.nickname === 'string' && p.nickname.trim().length > 0;
    const hasGender = p.gender === '男' || p.gender === '女';
    const ageNum = Number(p.age);
    const ageOK = Number.isFinite(ageNum) && ageNum >= 18;
    const hasPhoto = typeof p.photoUri === 'string' && p.photoUri.trim().length > 0;

    return hasNickname && hasGender && ageOK && hasPhoto;
  } catch (e) {
    console.log('Profile check error', e);
    return false;
  }
}

export default function TabLayout() {
  const pathname = usePathname();
  const { booting, loggedIn } = useAuth();

  const [checkingProfile, setCheckingProfile] = useState(true);
  const [profileOK, setProfileOK] = useState(false);

  useEffect(() => {
    (async function () {
      if (!loggedIn) {
        setCheckingProfile(false);
        setProfileOK(false);
        return;
      }

      setCheckingProfile(true);
      const ok = await checkProfileOK();
      setProfileOK(ok);
      setCheckingProfile(false);
    })();
  }, [loggedIn]);

  if (booting) {
    return (
      <View style={{ flex: 1, backgroundColor: '#020617', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: 'white' }}>啟動中...</Text>
      </View>
    );
  }

  if (!loggedIn) {
    return <Redirect href="/login" />;
  }

  if (checkingProfile) {
    return (
      <View style={{ flex: 1, backgroundColor: '#020617', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: 'white' }}>載入會員資料...</Text>
      </View>
    );
  }

  // ✅ 這裡用 tabs 群組路徑，最穩
  if (!profileOK && pathname !== '/profile') {
    return <Redirect href="/(tabs)/profile" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#22c55e',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: { backgroundColor: '#020617', borderTopColor: '#1f2937' },
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '首頁',
          tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={22} color={color} />,
        }}
        listeners={{ tabPress: (e) => { if (!profileOK) e.preventDefault(); } }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: '發起活動',
          tabBarIcon: ({ color }) => <Ionicons name="add-circle-outline" size={22} color={color} />,
        }}
        listeners={{ tabPress: (e) => { if (!profileOK) e.preventDefault(); } }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '會員',
          tabBarIcon: ({ color }) => <Ionicons name="person-circle-outline" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}