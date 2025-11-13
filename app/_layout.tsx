// app/_layout.tsx
import React from 'react';
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // ⭐ 統一所有畫面的背景顏色（避免變成白底）
        contentStyle: {
          backgroundColor: '#020617',
        },
      }}
    >
      {/* 底部 Tabs 群組 */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

      {/* 活動詳細頁：/event/[id] */}
      <Stack.Screen name="event/[id]" options={{ headerShown: false }} />
    </Stack>
  );
}
