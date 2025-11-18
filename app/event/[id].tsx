// app/event/[id].tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
  ScrollView,
  Image,
  Modal,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import dayjs from 'dayjs';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useEvents } from '../../lib/useEvents';
import { getSocket } from '../../lib/socket'; // ⭐ WebSocket

const PROFILE_KEY = 'profile_v1';
const CHAT_READ_PREFIX = 'chat_read_'; // 每個活動聊天室的已讀記錄 key 前綴

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id?: string }>();

  const {
    getEvent,
    joinEvent,
    confirmAttendee,
    cancelAttend,
    removeAttendee,
    sendMessage,
  } = useEvents();

  const [eventData, setEventData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [myUserId, setMyUserId] = useState<string | null>(null);

  // 頭貼放大
  const [imageModalUri, setImageModalUri] = useState<string | null>(null);

  // 聊天室
  const [chatVisible, setChatVisible] = useState(false);
  const [chatText, setChatText] = useState('');
  const [sendingChat, setSendingChat] = useState(false);

  // ⭐ 未讀訊息數量（不是 boolean）
  const [unreadCount, setUnreadCount] = useState(0);

  // 讀自己的 userId
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(PROFILE_KEY);
        if (!raw) {
          setMyUserId(null);
          return;
        }
        const p = JSON.parse(raw) || {};
        if (typeof p.userId === 'string' && p.userId.trim().length > 0) {
          setMyUserId(p.userId.trim());
        } else {
          setMyUserId(null);
        }
      } catch (e) {
        console.log('讀取 profile_v1 失敗:', e);
        setMyUserId(null);
      }
    })();
  }, []);

  // 載入活動資料（第一次進來）
  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const ev = await getEvent(String(id));
      setEventData(ev);
    } catch (e) {
      console.log('載入單一活動失敗:', e);
    } finally {
      setLoading(false);
    }
  }, [id, getEvent]);

  useEffect(() => {
    load();
  }, [load]);

  // WebSocket：進入畫面時加入 event 房間，收到 event:updated 就更新 eventData
  useEffect(() => {
    if (!id) return;
    const eventId = String(id);
    const socket = getSocket();

    // 加入這個活動的房間
    socket.emit('joinEvent', eventId);

    const handleUpdated = (updated: any) => {
      if (!updated || !updated.id) return;
      if (String(updated.id) !== eventId) return;

      if (updated.deleted) {
        Alert.alert('提示', '這個活動已被刪除');
        router.back();
        return;
      }

      setEventData(updated);
    };

    socket.on('event:updated', handleUpdated);

    // 離開畫面就離開房間 + 移除監聽
    return () => {
      socket.emit('leaveEvent', eventId);
      socket.off('event:updated', handleUpdated);
    };
  }, [id]);

  // 下拉重整（手動）
  const handleRefresh = useCallback(async () => {
    if (!id) return;
    setRefreshing(true);
    try {
      const ev = await getEvent(String(id));
      setEventData(ev);
    } catch (e) {
      console.log('重新載入單一活動失敗:', e);
    } finally {
      setRefreshing(false);
    }
  }, [id, getEvent]);

  // ⭐ 未讀訊息數量：
  //   - 只計算「不是自己發的」
  //   - createdAt > 上次已讀時間 的訊息
  //   - 同一個人連發 3 則 → +3
  useEffect(() => {
    (async () => {
      try {
        if (!eventData || !eventData.id) {
          setUnreadCount(0);
          return;
        }

        const msgs: any[] = Array.isArray(eventData.messages)
          ? eventData.messages
          : [];

        if (!msgs.length) {
          setUnreadCount(0);
          return;
        }

        const key = CHAT_READ_PREFIX + String(eventData.id);
        const stored = await AsyncStorage.getItem(key);
        const storedTime = stored ? dayjs(stored) : null;

        let count = 0;

        for (const m of msgs) {
          if (!m || !m.createdAt) continue;

          // 自己發的訊息不算未讀
          if (myUserId && String(m.userId) === String(myUserId)) continue;

          // 沒有已讀時間 → 全部算未讀
          if (!storedTime || dayjs(m.createdAt).isAfter(storedTime)) {
            count++;
          }
        }

        setUnreadCount(count);
      } catch (e) {
        console.log('讀取聊天已讀標記錯誤:', e);
        setUnreadCount(0);
      }
    })();
  }, [eventData, myUserId]);

  // 先處理沒 id 的情況
  if (!id) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#020617',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: 'white' }}>找不到活動 ID</Text>
      </View>
    );
  }

  if (loading && !eventData) {
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

  if (!eventData) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#020617',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: 'white' }}>找不到這個活動</Text>
      </View>
    );
  }

  // ===== 下面開始用 eventData =====
  const isHost =
    myUserId != null && String(eventData.createdBy) === String(myUserId);

  const host = eventData.createdByProfile || {};
  const hostGender = host.gender || '';
  const hostAge =
    typeof host.age === 'number' && !Number.isNaN(host.age)
      ? String(host.age)
      : '';
  const hostNickname = host.nickname || '';
  const hostIntro = host.intro || '';
  const hostPhotoUri = host.photoUri || '';

  const hostNameColor =
    hostGender === '男'
      ? '#60a5fa'
      : hostGender === '女'
      ? '#fb7185'
      : '#ffffff';

  const attendees: any[] = Array.isArray(eventData.attendees)
    ? eventData.attendees
    : [];

  const myAttend =
    myUserId != null ? attendees.find((a) => a.userId === myUserId) : null;

  const myStatus = myAttend ? myAttend.status : null;

  const isRejected = myStatus === 'rejected';
  const isRemoved = myStatus === 'removed';
  const isCancelled = myStatus === 'cancelled';

  const alreadyJoined =
    myAttend != null &&
    myStatus !== 'rejected' &&
    myStatus !== 'removed' &&
    myStatus !== 'cancelled';

  const canCancel =
    myAttend != null && (myStatus === 'pending' || myStatus === 'confirmed');

  // 聊天權限：主揪 + 報名成功
  const canChat = isHost || myStatus === 'confirmed';

  const eventTimeText = dayjs(eventData.timeISO).format('YYYY/MM/DD HH:mm');
  const typeLabel = eventData.type === 'KTV' ? '🎤 揪唱歌' : '🍻 揪喝酒';

  const confirmedCount = attendees.filter(
    (a) => a.status === 'confirmed'
  ).length;
  const pendingCount = attendees.filter(
    (a) => a.status === 'pending'
  ).length;

  const messages: any[] = Array.isArray(eventData.messages)
    ? eventData.messages
    : [];

  const confirmedAttendees: any[] = attendees.filter(
    (a) => a.status === 'confirmed'
  );

  // 打開聊天室：順便把最新訊息時間寫成已讀，並清空未讀
  async function openChat() {
    setChatVisible(true);
    try {
      if (!eventData || !eventData.id) return;

      const msgs: any[] = Array.isArray(eventData.messages)
        ? eventData.messages
        : [];

      if (!msgs.length) {
        setUnreadCount(0);
        return;
      }

      const latest = msgs[msgs.length - 1];
      if (!latest || !latest.createdAt) {
        setUnreadCount(0);
        return;
      }

      const key = CHAT_READ_PREFIX + String(eventData.id);
      await AsyncStorage.setItem(key, latest.createdAt);
      setUnreadCount(0);
    } catch (e) {
      console.log('寫入聊天已讀標記錯誤:', e);
    }
  }

  // ====== 報名 ======
  async function handleJoin() {
    if (isHost) {
      Alert.alert('提示', '主揪不用報名喔');
      return;
    }

    if (isRejected) {
      Alert.alert('提示', '你已被主揪拒絕，不能再報名這個局');
      return;
    }

    if (isRemoved) {
      Alert.alert('提示', '你已被主揪移除，不能再報名這個局');
      return;
    }

    if (isCancelled) {
      Alert.alert('提示', '你已取消過這個局，不能再重新報名');
      return;
    }

    if (alreadyJoined) {
      Alert.alert('提示', '你已經報名過了');
      return;
    }

    setJoining(true);
    try {
      const updated = await joinEvent(String(eventData.id));
      if (updated) {
        setEventData(updated);
        Alert.alert('成功', '已送出報名，等待主揪確認');
      }
    } catch (e: any) {
      console.log('報名錯誤:', e);
      Alert.alert('報名失敗', e?.message || '請稍後再試');
    } finally {
      setJoining(false);
    }
  }

  // ====== 取消報名 ======
  async function handleCancelJoin() {
    if (!myAttend || !myAttend.id) return;

    Alert.alert('取消報名', '確定要取消這個局的報名嗎？', [
      { text: '先不要', style: 'cancel' },
      {
        text: '取消報名',
        style: 'destructive',
        onPress: async () => {
          try {
            const updated = await cancelAttend(
              String(eventData.id),
              String(myAttend.id)
            );
            if (updated) {
              setEventData(updated);
              Alert.alert('已取消', '你已取消這個局，不能再重新報名。');
            }
          } catch (e: any) {
            console.log('取消報名錯誤:', e);
            Alert.alert('取消失敗', e?.message || '請稍後再試');
          }
        },
      },
    ]);
  }

  // ====== 主揪確認 / 拒絕 ======
  async function handleConfirm(attendee: any, action: 'confirm' | 'reject') {
    try {
      const updated = await confirmAttendee(
        String(eventData.id),
        String(attendee.id),
        action
      );
      if (updated) {
        setEventData(updated);
      }
    } catch (e: any) {
      console.log('更新報名狀態錯誤:', e);
      Alert.alert('失敗', e?.message || '請稍後再試');
    }
  }

  // ====== 主揪移除 ======
  async function handleRemove(attendee: any) {
    Alert.alert('移除報名者', '確定要把這個人從這局移除嗎？', [
      { text: '先不要', style: 'cancel' },
      {
        text: '移除',
        style: 'destructive',
        onPress: async () => {
          try {
            const updated = await removeAttendee(
              String(eventData.id),
              String(attendee.id)
            );
            if (updated) {
              setEventData(updated);
            }
          } catch (e: any) {
            console.log('移除報名者錯誤:', e);
            Alert.alert('移除失敗', e?.message || '請稍後再試');
          }
        },
      },
    ]);
  }

  // ====== 送出聊天室訊息 ======
  async function handleSendChat() {
    const text = chatText.trim();
    if (!text) return;

    if (!canChat) {
      Alert.alert('無法發言', '只有主揪或報名成功的人可以發言');
      return;
    }

    setSendingChat(true);
    try {
      const updated = await sendMessage(String(eventData.id), text);
      if (updated) {
        setEventData(updated);
        setChatText('');
      }
    } catch (e: any) {
      console.log('送出訊息錯誤:', e);
      Alert.alert('發送失敗', e?.message || '請稍後再試');
    } finally {
      setSendingChat(false);
    }
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#020617',
        paddingTop: 60,
      }}
    >
      {/* 上方固定：標題 + 返回在上 / 聊天在下，有未讀顯示紅點（數字） */}
      <View
        style={{
          paddingHorizontal: 16,
          marginBottom: 12,
          marginTop: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text
          style={{
            color: 'white',
            fontSize: 22,
            fontWeight: 'bold',
          }}
        >
          活動細節
        </Text>

        <View
          style={{
            flexDirection: 'column',
            alignItems: 'flex-end',
          }}
        >

          {/* 聊天在下面，有未讀顯示紅點（數字） */}
          {canChat && (
            <View style={{ position: 'relative' }}>
              <Pressable
                onPress={openChat}
                style={{
                  padding: 8,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: '#525453ff',
                  backgroundColor:'#525453ff'
                }}
              >
                <Text
                  style={{
                    color: '#525453ff',
                    fontSize: 20,
                    paddingHorizontal: 5, // ⭐ 左右 padding
                  }}
                >
                  💬
                </Text>
              </Pressable>

              {unreadCount > 0 && (
                <View
                  style={{
                    position: 'absolute',
                    top: -2,
                    right: -2,
                    minWidth: 16,
                    height: 16,
                    borderRadius: 8,
                    backgroundColor: '#ef4444',
                    justifyContent: 'center',
                    alignItems: 'center',
                    paddingHorizontal: 3,
                  }}
                >
                  <Text
                    style={{
                      color: 'white',
                      fontSize: 10,
                      fontWeight: '700',
                    }}
                  >
                    {unreadCount}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>

      {/* 內容區 */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 24,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#22c55e"
          />
        }
      >
        {/* 主揪資訊 */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            marginTop: 12,
            marginBottom: 12,
          }}
        >
          <Pressable
            onPress={() => {
              if (hostPhotoUri) setImageModalUri(hostPhotoUri);
            }}
          >
            {hostPhotoUri ? (
              <Image
                source={{ uri: hostPhotoUri }}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  marginRight: 12,
                  backgroundColor: '#111827',
                  borderWidth: 1,
                  borderColor: hostNameColor,
                }}
              />
            ) : (
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: '#111827',
                  marginRight: 12,
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: hostNameColor,
                }}
              >
                <Text
                  style={{
                    color: 'white',
                    fontSize: 20,
                  }}
                >
                  {hostNickname ? hostNickname[0] : '?'}
                </Text>
              </View>
            )}
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: hostNameColor,
                fontSize: 16,
                fontWeight: '600',
                marginBottom: 2,
              }}
            >
               {hostNickname}{hostAge}
            </Text>
            {hostIntro ? (
              <Text
                style={{
                  color: '#9ca3af',
                }}
              >
                {hostIntro}
              </Text>
            ) : null}
          </View>
        </View>

        {/* 局資訊 */}
        <Text
          style={{
            color: 'white',
            marginBottom: 2,
            marginTop: 5,
          }}
        >
          {typeLabel}
        </Text>
        <Text style={{ color: 'white', marginBottom: 2 }}>
          地區：{eventData.region}
        </Text>
        <Text style={{ color: 'white', marginBottom: 2 }}>
          地點：{eventData.place}
        </Text>
        <Text style={{ color: 'white', marginBottom: 2 }}>
          時間：{eventTimeText}
        </Text>
        <Text style={{ color: 'white', marginBottom: 2 }}>
          人數：內建 {eventData.builtInPeople} / 上限 {eventData.maxPeople}
        </Text>
        {eventData.notes ? (
          <Text style={{ color: 'white', marginTop: 4 }}>
            備註：{eventData.notes}
          </Text>
        ) : null}

        {/* 報名按鈕 + 取消報名（非主揪） */}
        {!isHost && (
          <View
            style={{
              marginTop: 20,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View
                style={{ flex: 1, marginRight: canCancel ? 8 : 0 }}
              >
                <Pressable
                  onPress={handleJoin}
                  disabled={
                    joining ||
                    alreadyJoined ||
                    isRejected ||
                    isRemoved ||
                    isCancelled
                  }
                  style={{
                    backgroundColor:
                      isRejected ||
                      isRemoved ||
                      isCancelled ||
                      alreadyJoined
                        ? '#6b7280'
                        : '#22c55e',
                    borderRadius: 999,
                    paddingVertical: 12,
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: 'black',
                      fontWeight: '600',
                    }}
                  >
                    {joining
                      ? '送出中...'
                      : isRejected
                      ? '無法報名'
                      : isRemoved
                      ? '無法報名'
                      : isCancelled
                      ? '無法報名'
                      : alreadyJoined
                      ? '已報名'
                      : '我要報名'}
                  </Text>
                </Pressable>
              </View>

              {canCancel && (
                <View style={{ width: 110 }}>
                  <Pressable
                    onPress={handleCancelJoin}
                    style={{
                      borderRadius: 999,
                      paddingVertical: 12,
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: '#f97373',
                    }}
                  >
                    <Text
                      style={{
                        color: '#f97373',
                        fontWeight: '600',
                        fontSize: 12,
                      }}
                    >
                      取消報名
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>

            {/* 狀態說明 */}
            {isRejected && (
              <Text
                style={{
                  color: '#f97373',
                  marginTop: 15,
                  fontSize: 12,
                  textAlign: 'center',   // ⭐ 水平置中
                }}
              >
                你已被主揪拒絕，無法再報名這個局。
              </Text>
            )}

            {isRemoved && (
              <Text
                style={{
                  color: '#f97373',
                  marginTop: 15,
                  fontSize: 12,
                  textAlign: 'center',   // ⭐ 水平置中
                }}
              >
                你已被主揪移除，無法再報名這個局。
              </Text>
            )}

            {isCancelled && (
              <Text
                style={{
                  color: '#f97373',
                  marginTop: 15,
                  fontSize: 12,
                  textAlign: 'center',   // ⭐ 水平置中
                }}
              >
                你已取消過這個局，無法再重新報名。
              </Text>
            )}

            {myStatus === 'pending' && (
              <Text
                style={{
                  color: '#eab308',
                  marginTop: 15,
                  fontSize: 12,
                  textAlign: 'center',   // ⭐ 水平置中
                }}
              >
                已送出報名，等主揪確認後才會開啟聊天室。
              </Text>
            )}
          </View>
        )}

        {/* 主揪的報名列表（不顯示 removed / cancelled） */}
        {isHost && (
          <View style={{ marginTop: 24 }}>
            <Text
              style={{
                color: 'white',
                fontSize: 22,
                fontWeight: 'bold',
                marginBottom: 8,
                marginTop: 10
              }}
            >
              報名列表
            </Text>

            <Text
              style={{
                color: '#e5e7eb',
                marginBottom: 6,
              }}
            >
              已確認 {confirmedCount} 人，待確認 {pendingCount} 人
            </Text>

            {attendees.filter(
              (a) =>
                a.status !== 'removed' &&
                a.status !== 'cancelled'
            ).length === 0 && (
              <Text style={{ color: 'white' }}>
                目前還沒有人報名
              </Text>
            )}

            {attendees
              .filter(
                (a) =>
                  a.status !== 'removed' &&
                  a.status !== 'cancelled'
              )
              .map((a: any) => {
                const p = a.profile || {};
                const g = p.gender || '';
                const age =
                  typeof p.age === 'number' &&
                  !Number.isNaN(p.age)
                    ? String(p.age)
                    : '';
                const nick = p.nickname || '';
                const intro = p.intro || '';
                const photoUri = p.photoUri || '';

                const nameColor =
                  g === '男'
                    ? '#60a5fa'
                    : g === '女'
                    ? '#fb7185'
                    : '#ffffff';



                return (
                  <View
                    key={String(a.id)}
                    style={{
                      marginTop: 10,
                      padding: 10,
                      borderRadius: 10,
                      backgroundColor: '#111827',
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                      }}
                    >
                      <Pressable
                        onPress={() => {
                          if (photoUri) setImageModalUri(photoUri);
                        }}
                      >
                        {photoUri ? (
                          <Image
                            source={{ uri: photoUri }}
                            style={{
                              width: 56,
                              height: 56,
                              borderRadius: 28,
                              marginRight: 10,
                              backgroundColor: '#020617',
                              borderWidth: 1,
                              borderColor: nameColor,
                            }}
                          />
                        ) : (
                          <View
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 20,
                              marginRight: 10,
                              backgroundColor: '#020617',
                              justifyContent: 'center',
                              alignItems: 'center',
                              borderWidth: 1,
                              borderColor: nameColor,
                            }}
                          >
                            <Text
                              style={{
                                color: 'white',
                                fontSize: 16,
                              }}
                            >
                              {nick ? nick[0] : '?'}
                            </Text>
                          </View>
                        )}
                      </Pressable>

                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            color: nameColor,
                            fontWeight: '600',
                            marginBottom: 2,
                          }}
                        >
                           {nick} {age}
                        </Text>

                        {intro ? (
                          <Text
                            style={{
                              color: '#9ca3af',
                            }}
                          >
                            {intro}
                          </Text>
                        ) : null}

                        <View
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                marginTop: 4,
                            }}
                            >
                            {a.status === 'pending' && (
                                <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                }}
                                >
                                <Pressable
                                    onPress={() => handleConfirm(a, 'reject')}
                                    style={{
                                    paddingHorizontal: 10,
                                    paddingVertical: 6,
                                    borderRadius: 999,
                                    borderWidth: 1,
                                    borderColor: '#f97373',
                                    marginRight: 8,
                                    }}
                                >
                                    <Text
                                    style={{
                                        color: '#f97373',
                                        fontSize: 12,
                                    }}
                                    >
                                    拒絕
                                    </Text>
                                </Pressable>

                                <Pressable
                                    onPress={() => handleConfirm(a, 'confirm')}
                                    style={{
                                    paddingHorizontal: 10,
                                    paddingVertical: 6,
                                    borderRadius: 999,
                                    borderWidth: 1,
                                    borderColor: '#4ade80',
                                    }}
                                >
                                    <Text
                                    style={{
                                        color: '#4ade80',
                                        fontSize: 12,
                                    }}
                                    >
                                    接受
                                    </Text>
                                </Pressable>
                                </View>
                            )}

                            {a.status === 'confirmed' && (
                                <Pressable
                                onPress={() => handleRemove(a)}
                                style={{
                                    paddingHorizontal: 10,
                                    paddingVertical: 6,
                                    borderRadius: 999,
                                    borderWidth: 1,
                                    borderColor: '#f97373',
                                }}
                                >
                                <Text
                                    style={{
                                    color: '#f97373',
                                    fontSize: 12,
                                    }}
                                >
                                    移除
                                </Text>
                                </Pressable>
                            )}
                            </View>

                      </View>
                    </View>
                  </View>
                );
              })}
          </View>
        )}

        {/* 報名成功的人看到的人員清單（主揪 + confirmed） */}
        {!isHost &&
          myStatus === 'confirmed' &&
          (confirmedAttendees.length > 0 || hostNickname) && (
            <View
              style={{
                marginTop: 24,
              }}
            >
              <Text
                style={{
                  color: 'white',
                  fontSize: 22,
                  fontWeight: 'bold',
                  marginBottom: 8,
                }}
              >
                人員清單
              </Text>

              {/* 主揪卡片 */}
              <View
                style={{
                  padding: 10,
                  borderRadius: 10,
                  backgroundColor: '#111827',
                  marginBottom: 6,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                  }}
                >
                  <Pressable
                    onPress={() => {
                      if (hostPhotoUri) setImageModalUri(hostPhotoUri);
                    }}
                  >
                    {hostPhotoUri ? (
                      <Image
                        source={{ uri: hostPhotoUri }}
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 28,
                          marginRight: 10,
                          backgroundColor: '#020617',
                          borderWidth: 1,
                          borderColor: hostNameColor,
                        }}
                      />
                    ) : (
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          marginRight: 10,
                          backgroundColor: '#020617',
                          justifyContent: 'center',
                          alignItems: 'center',
                          borderWidth: 1,
                          borderColor: hostNameColor,
                        }}
                      >
                        <Text
                          style={{
                            color: 'white',
                            fontSize: 16,
                          }}
                        >
                          {hostNickname ? hostNickname[0] : '?'}
                        </Text>
                      </View>
                    )}
                  </Pressable>

                  <View style={{ flex: 1 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginBottom: 2,
                      }}
                    >
                      <Text
                        style={{
                          color: hostNameColor,
                          fontWeight: '600',
                          marginRight: 6,
                        }}
                      >
                        {hostNickname} {hostAge}
                      </Text>
                    </View>

                    {hostIntro ? (
                      <Text
                        style={{
                          color: '#9ca3af',
                        }}
                      >
                        {hostIntro}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>

              {/* 已確認的報名者 */}
              {confirmedAttendees.map((a: any) => {
                const p = a.profile || {};
                const g = p.gender || '';
                const age =
                  typeof p.age === 'number' &&
                  !Number.isNaN(p.age)
                    ? String(p.age)
                    : '';
                const nick = p.nickname || '';
                const intro = p.intro || '';
                const photoUri = p.photoUri || '';

                if (!nick && !g && !age) return null;

                const nameColor =
                  g === '男'
                    ? '#60a5fa'
                    : g === '女'
                    ? '#fb7185'
                    : '#ffffff';

                return (
                  <View
                    key={String(a.id)}
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      backgroundColor: '#111827',
                      marginTop: 6,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                      }}
                    >
                      <Pressable
                        onPress={() => {
                          if (photoUri) setImageModalUri(photoUri);
                        }}
                      >
                        {photoUri ? (
                          <Image
                            source={{ uri: photoUri }}
                            style={{
                              width: 56,
                              height: 56,
                              borderRadius: 28,
                              marginRight: 10,
                              backgroundColor: '#020617',
                              borderWidth: 1,
                              borderColor: nameColor,
                            }}
                          />
                        ) : (
                          <View
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 20,
                              marginRight: 10,
                              backgroundColor: '#020617',
                              justifyContent: 'center',
                              alignItems: 'center',
                              borderWidth: 1,
                              borderColor: nameColor,
                            }}
                          >
                            <Text
                              style={{
                                color: 'white',
                                fontSize: 16,
                              }}
                            >
                              {nick ? nick[0] : '?'}
                            </Text>
                          </View>
                        )}
                      </Pressable>

                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            color: nameColor,
                            fontWeight: '600',
                            marginBottom: 2,
                          }}
                        >
                           {nick} {age}
                        </Text>

                        {intro ? (
                          <Text
                            style={{
                              color: '#9ca3af',
                            }}
                          >
                            {intro}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
      </ScrollView>

      {/* 頭貼放大 Modal */}
      <Modal
        visible={!!imageModalUri}
        transparent
        animationType="fade"
        onRequestClose={() => setImageModalUri(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.9)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setImageModalUri(null)}
            style={{
              width: '100%',
              height: '100%',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {imageModalUri ? (
              <Image
                source={{ uri: imageModalUri }}
                style={{
                  width: 260,
                  height: 260,
                  borderRadius: 130,
                  resizeMode: 'cover',
                  backgroundColor: '#111827',
                }}
              />
            ) : null}
          </TouchableOpacity>
        </View>
      </Modal>

      {/* 聊天室 Modal：點外面空白關閉 + 鍵盤往上推 */}
      <Modal
        visible={chatVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setChatVisible(false)}
      >
        {/* 外層 Pressable：點空白關閉 */}
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.6)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onPress={() => setChatVisible(false)}
        >
          <KeyboardAvoidingView
            style={{ width: '90%', height: '70%' }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
          >
            {/* 內層 Pressable：吃掉事件，點裡面不關閉 */}
            <Pressable onPress={() => {}} style={{ flex: 1 }}>
              <View
                style={{
                  flex: 1,
                  backgroundColor: '#020617',
                  borderRadius: 16,
                  padding: 12,
                }}
              >
                {/* 標題 + 關閉按鈕 */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                  }}
                >
                  <Text
                    style={{
                      color: 'white',
                      fontSize: 18,
                      fontWeight: 'bold',
                    }}
                  >
                    聊天室
                  </Text>

                  <Pressable
                    onPress={() => setChatVisible(false)}
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                    }}
                  >
                    <Text
                      style={{
                        color: '#9ca3af',
                        fontSize: 14,
                      }}
                    >
                      關閉
                    </Text>
                  </Pressable>
                </View>

                {/* 訊息區 */}
                <View
                  style={{
                    flex: 1,
                    backgroundColor: '#111827',
                    borderRadius: 10,
                    padding: 10,
                  }}
                >
                  {messages.length === 0 ? (
                    <Text style={{ color: '#9ca3af' }}>
                      還沒有任何訊息，來打第一句吧～
                    </Text>
                  ) : (
                    <ScrollView
                      style={{ flex: 1 }}
                      showsVerticalScrollIndicator={false}
                    >
                      {messages.map((m: any) => {
                        const p = m.profile || {};
                        const g = p.gender || '';
                        const age =
                          typeof p.age === 'number' &&
                          !Number.isNaN(p.age)
                            ? String(p.age)
                            : '';
                        const nick = p.nickname || '';

                        const nameColor =
                          g === '男'
                            ? '#60a5fa'
                            : g === '女'
                            ? '#fb7185'
                            : '#e5e7eb';

                        const timeText = m.createdAt
                          ? dayjs(m.createdAt).format('MM/DD HH:mm')
                          : '';

                        return (
                          <View
                            key={String(m.id)}
                            style={{
                              marginBottom: 8,
                            }}
                          >
                            <Text
                              style={{
                                color: nameColor,
                                fontWeight: '600',
                              }}
                            >
                              {nick || '匿名'}{' '}
                              <Text
                                style={{
                                  color: '#9ca3af',
                                  fontWeight: 'normal',
                                  fontSize: 11,
                                }}
                              >
                                {g ? g + ' ' : ''}
                                {age ? age + ' ' : ''}
                                {timeText ? '· ' + timeText : ''}
                              </Text>
                            </Text>
                            <Text
                              style={{
                                color: 'white',
                                marginTop: 2,
                              }}
                            >
                              {m.text}
                            </Text>
                          </View>
                        );
                      })}
                    </ScrollView>
                  )}
                </View>

                {/* 輸入區 */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginTop: 10,
                  }}
                >
                  <TextInput
                    value={chatText}
                    onChangeText={setChatText}
                    placeholder="輸入訊息..."
                    placeholderTextColor="#6b7280"
                    editable={canChat && !sendingChat}
                    style={{
                      flex: 1,
                      backgroundColor: '#111827',
                      color: 'white',
                      borderRadius: 999,
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      marginRight: 8,
                    }}
                  />

                  <Pressable
                    onPress={handleSendChat}
                    disabled={
                      !canChat || sendingChat || !chatText.trim()
                    }
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 999,
                      backgroundColor:
                        !canChat ||
                        sendingChat ||
                        !chatText.trim()
                          ? '#6b7280'
                          : '#22c55e',
                    }}
                  >
                    <Text
                      style={{
                        color: 'black',
                        fontWeight: '600',
                        fontSize: 13,
                      }}
                    >
                      {sendingChat ? '送出中' : '送出'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
}
