import React, { useEffect, useState, useCallback } from 'react';
import { Tabs, Redirect, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text } from 'react-native';
import { useAuth } from '../../lib/auth';

const API_BASE = 'http://192.168.1.139:4000';

// ✅ 用 globalThis 做「儲存後緩衝期」
function getGraceUntil(): number {
  return typeof (globalThis as any).__PROFILE_GRACE_UNTIL__ === 'number'
    ? (globalThis as any).__PROFILE_GRACE_UNTIL__
    : 0;
}

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

export default function TabLayout() {
  const pathname = usePathname();
  const { booting, loggedIn, accessToken } = useAuth();

  const [checkingOnce, setCheckingOnce] = useState(true);
  const [profileOK, setProfileOK] = useState(false);

  const isOnProfile = pathname === '/(tabs)/profile' || pathname.endsWith('/profile');

  const refreshProfileOK = useCallback(async () => {
    if (!loggedIn || !accessToken) {
      setProfileOK(false);
      return;
    }
    try {
      const me = await fetchMe(accessToken);
      setProfileOK(isProfileOK(me));
    } catch (e) {
      setProfileOK(false);
    }
  }, [loggedIn, accessToken]);

  // ✅ 第一次登入/拿到 token 檢查一次
  useEffect(() => {
    let alive = true;

    (async function () {
      if (!loggedIn || !accessToken) {
        if (!alive) return;
        setProfileOK(false);
        setCheckingOnce(false);
        return;
      }

      setCheckingOnce(true);
      try {
        const me = await fetchMe(accessToken);
        if (!alive) return;
        setProfileOK(isProfileOK(me));
      } catch (e) {
        if (!alive) return;
        setProfileOK(false);
      } finally {
        if (!alive) return;
        setCheckingOnce(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [loggedIn, accessToken]);

  const inGrace = getGraceUntil() > Date.now();

  // ✅ 緩衝期內：背景多抓幾次（hasPhoto 常會慢）
  useEffect(() => {
    if (inGrace) {
      refreshProfileOK();
      const t = setTimeout(() => refreshProfileOK(), 700);
      return () => clearTimeout(t);
    }
    return;
  }, [inGrace, pathname, refreshProfileOK]);

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

  if (checkingOnce) {
    return (
      <View style={{ flex: 1, backgroundColor: '#020617', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: 'white' }}>載入會員資料...</Text>
      </View>
    );
  }

  // ✅ 唯一導回 profile 的地方（緩衝期內不踢）
  if (!profileOK && !isOnProfile && !inGrace) {
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
        listeners={{
          tabPress: (e) => {
            // ✅ 重要：緩衝期內要允許切 tab，不然會被 preventDefault 造成怪跳
            if (!profileOK && !inGrace) e.preventDefault();
          },
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          title: '發起活動',
          tabBarIcon: ({ color }) => <Ionicons name="add-circle-outline" size={22} color={color} />,
        }}
        listeners={{
          tabPress: (e) => {
            if (!profileOK && !inGrace) e.preventDefault();
          },
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: '會員',
          tabBarIcon: ({ color }) => <Ionicons name="person-circle-outline" size={22} color={color} />,
        }}
        listeners={{
          tabPress: () => {
            refreshProfileOK();
          },
        }}
      />
    </Tabs>
  );
}