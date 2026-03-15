import React, { useEffect, useRef, useState } from 'react';
import { Stack } from 'expo-router';
import { View, Animated, Easing, Image } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from '../lib/auth';

SplashScreen.preventAutoHideAsync();

function OpeningScreen() {
  const screenOpacity = useRef(new Animated.Value(1)).current;

  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.82)).current;
  const logoTranslateY = useRef(new Animated.Value(14)).current;

  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(16)).current;

  const subOpacity = useRef(new Animated.Value(0)).current;
  const subTranslateY = useRef(new Animated.Value(12)).current;

  const glowScale = useRef(new Animated.Value(0.9)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.back(1.35)),
        useNativeDriver: true,
      }),
      Animated.timing(logoTranslateY, {
        toValue: 0,
        duration: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(glowOpacity, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    Animated.parallel([
      Animated.sequence([
        Animated.delay(250),
        Animated.parallel([
          Animated.timing(titleOpacity, {
            toValue: 1,
            duration: 320,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(titleTranslateY, {
            toValue: 0,
            duration: 320,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(420),
        Animated.parallel([
          Animated.timing(subOpacity, {
            toValue: 1,
            duration: 280,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(subTranslateY, {
            toValue: 0,
            duration: 280,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowScale, {
          toValue: 1.12,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glowScale, {
          toValue: 0.96,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    glowLoop.start();

    return function () {
      glowLoop.stop();
    };
  }, [
    glowOpacity,
    glowScale,
    logoOpacity,
    logoScale,
    logoTranslateY,
    subOpacity,
    subTranslateY,
    titleOpacity,
    titleTranslateY,
  ]);

  return (
    <Animated.View
      style={{
        flex: 1,
        opacity: screenOpacity,
        backgroundColor: '#020617',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 28,
      }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          width: 240,
          height: 240,
          borderRadius: 999,
          backgroundColor: '#22c55e',
          opacity: glowOpacity.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 0.1],
          }),
          transform: [{ scale: glowScale }],
        }}
      />

      <Animated.View
        style={{
          opacity: logoOpacity,
          transform: [{ scale: logoScale }, { translateY: logoTranslateY }],
          alignItems: 'center',
        }}
      >
        <View
          style={{
            width: 112,
            height: 112,
            borderRadius: 32,
            backgroundColor: '#111827',
            borderWidth: 1.5,
            borderColor: '#1f2937',
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.3,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 12 },
            elevation: 12,
          }}
        >
          <Image
            source={require('../assets/images/JOCA.png')}
            style={{
              width: 68,
              height: 68,
              borderRadius: 18,
            }}
            resizeMode="contain"
          />
        </View>
      </Animated.View>

      <Animated.Text
        style={{
          marginTop: 28,
          color: 'white',
          fontSize: 18,
          fontWeight: '800',
          letterSpacing: 1.2,
          opacity: titleOpacity,
          transform: [{ translateY: titleTranslateY }],
        }}
      >
        揪唱歌・揪喝酒・揪麻將
      </Animated.Text>
    </Animated.View>
  );
}

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);
  const [showOpening, setShowOpening] = useState(true);
  const fadeOut = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    async function prepare() {
      try {
        await new Promise(function (resolve) {
          setTimeout(resolve, 250);
        });
      } finally {
        setAppReady(true);
      }
    }

    prepare();
  }, []);

  useEffect(() => {
    if (!appReady) return;

    async function run() {
      await SplashScreen.hideAsync();

      setTimeout(function () {
        Animated.timing(fadeOut, {
          toValue: 0,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(function () {
          setShowOpening(false);
        });
      }, 3000);
    }

    run();
  }, [appReady, fadeOut]);

  if (!appReady) {
    return null;
  }

  return (
    <AuthProvider>
      {showOpening ? (
        <Animated.View style={{ flex: 1, opacity: fadeOut }}>
          <OpeningScreen />
        </Animated.View>
      ) : (
        <Stack screenOptions={{ headerShown: false }} />
      )}
    </AuthProvider>
  );
}