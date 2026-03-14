import React, { useRef, useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/auth';

const API_BASE = 'http://192.168.1.139:4000';

export default function LoginScreen() {
  const router = useRouter();
  const { setSession } = useAuth();

  const [phone, setPhone] = useState('09');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [loading, setLoading] = useState(false);

  // ✅ 防止重複導頁
  const navLockRef = useRef(false);

  // ✅ 手機號碼輸入框 ref
  const phoneInputRef = useRef<TextInput>(null);

  // ✅ 每次回到 phone 步驟時，自動 focus 跳出鍵盤
  useEffect(() => {
    if (step === 'phone') {
      const timer = setTimeout(function () {
        if (phoneInputRef.current) {
          phoneInputRef.current.focus();
        }
      }, 100);

      return function () {
        clearTimeout(timer);
      };
    }
  }, [step]);

  function handlePhoneChange(text: string) {
    const onlyDigits = text.replace(/[^0-9]/g, '');

    if (onlyDigits.length <= 2) {
      setPhone('09');
      return;
    }

    let fixed = onlyDigits;
    if (fixed.slice(0, 2) !== '09') fixed = '09' + fixed.slice(2);

    setPhone(fixed.slice(0, 10));
  }

  async function sendOtp() {
    if (!/^09\d{8}$/.test(phone)) {
      Alert.alert('手機錯誤', '請輸入正確的手機號碼');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(API_BASE + '/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.log('sendOtp fail:', res.status, text);
        Alert.alert('發送失敗');
        return;
      }

      setStep('code');
      Alert.alert('已發送驗證碼');
    } catch (e) {
      console.log('sendOtp error:', e);
      Alert.alert('發送失敗');
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    if (code.length !== 6) {
      Alert.alert('請輸入 6 位數驗證碼');
      return;
    }
    if (navLockRef.current) return;

    setLoading(true);
    try {
      const res = await fetch(API_BASE + '/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.log('verifyOtp fail:', res.status, text);
        Alert.alert('驗證失敗');
        return;
      }

      const json = await res.json();
      const at = json.accessToken;
      const rt = json.refreshToken;
      const u = json.user;

      if (!at || !rt || !u) {
        console.log('verifyOtp response missing fields:', json);
        Alert.alert('登入失敗', '後端回傳缺少 token/user');
        return;
      }

      await setSession(at, rt, u);

      console.log('LOGIN OK user=', u, 'at=', String(at).length, 'rt=', String(rt).length);

      // ✅ 只導一次：登入成功就直接去 tabs/profile
      navLockRef.current = true;
      router.replace('/(tabs)/profile');
    } catch (e) {
      console.log('verifyOtp error:', e);
      Alert.alert('驗證失敗');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#020617', padding: 20, paddingTop: 100 }}>
      <Text style={{ color: 'white', fontSize: 22, fontWeight: 'bold', marginBottom: 20 }}>
        手機登入
      </Text>

      {step === 'phone' ? (
        <>
          <Text style={{ color: 'white', marginBottom: 8 }}>手機號碼</Text>
          <TextInput
            ref={phoneInputRef}
            autoFocus
            value={phone}
            onChangeText={handlePhoneChange}
            keyboardType="number-pad"
            style={{
              backgroundColor: '#111827',
              color: 'white',
              padding: 12,
              borderRadius: 10,
              marginBottom: 16,
            }}
          />

          <Pressable
            onPress={sendOtp}
            disabled={loading}
            style={{ backgroundColor: '#22c55e', padding: 12, borderRadius: 999, alignItems: 'center' }}
          >
            <Text style={{ color: 'black', fontWeight: '600' }}>
              {loading ? '發送中...' : '發送驗證碼'}
            </Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={{ color: 'white', marginBottom: 8 }}>驗證碼</Text>
          <TextInput
            value={code}
            onChangeText={(t) => setCode(t.replace(/[^0-9]/g, '').slice(0, 6))}
            keyboardType="number-pad"
            style={{
              backgroundColor: '#111827',
              color: 'white',
              padding: 12,
              borderRadius: 10,
              marginBottom: 16,
            }}
          />

          <Pressable
            onPress={verifyOtp}
            disabled={loading}
            style={{ backgroundColor: '#22c55e', padding: 12, borderRadius: 999, alignItems: 'center' }}
          >
            <Text style={{ color: 'black', fontWeight: '600' }}>
              {loading ? '登入中...' : '登入'}
            </Text>
          </Pressable>

          <Pressable
            onPress={function () {
              setPhone('09');   // ✅ 清空手機號碼
              setCode('');      // ✅ 清空驗證碼
              setStep('phone'); // ✅ 回到 phone 頁
            }}
            style={{ marginTop: 14 }}
          >
            <Text style={{ color: '#9ca3af', marginTop: 5 }}>返回重填手機號碼</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}