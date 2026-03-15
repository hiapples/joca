// app/event/[id].tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Keyboard,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import dayjs from 'dayjs';
import * as Clipboard from 'expo-clipboard';
import { useEvents } from '../../lib/useEvents';
import { getSocket } from '../../lib/socket';
import { useAuth } from '../../lib/auth';

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user } = useAuth();

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

  // ✅ myUserId 改用 Auth（不讀 AsyncStorage）
  const myUserId = user && user.userId ? String(user.userId) : null;

  // 活動細節頁用的大頭貼 Modal
  const [imageModalUri, setImageModalUri] = useState<string | null>(null);

  // 聊天室裡的頭貼放大 overlay
  const [chatImageUri, setChatImageUri] = useState<string | null>(null);

  // 聊天室
  const [chatVisible, setChatVisible] = useState(false);
  const [chatText, setChatText] = useState('');
  const [sendingChat, setSendingChat] = useState(false);

  // ✅ 未讀改成「記憶體 lastReadAt」
  const [lastReadAt, setLastReadAt] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const messagesScrollRef = useRef<ScrollView | null>(null);
  const chatInputRef = useRef<TextInput | null>(null);

  const [showRulesModal, setShowRulesModal] = useState(false);

  const load = useCallback(
    async () => {
      if (!id) return;
      try {
        setLoading(true);
        const ev = await getEvent(String(id));
        setEventData(ev);
      } catch (e) {
        console.log('載入單一活動失敗:', e);
        Alert.alert('提示', '這個活動已過期或不存在');
      } finally {
        setLoading(false);
      }
    },
    [id, getEvent]
  );

  useEffect(() => {
    load();
  }, [load]);

  // WebSocket 即時更新
  useEffect(() => {
    if (!id) return;
    const eventId = String(id);
    const socket = getSocket();

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

    return () => {
      socket.emit('leaveEvent', eventId);
      socket.off('event:updated', handleUpdated);
    };
  }, [id]);

  // 下拉重整
  const handleRefresh = useCallback(
    async () => {
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
    },
    [id, getEvent]
  );

  // ✅ 未讀：用 lastReadAt 計算（不落地）
  useEffect(() => {
    try {
      if (!eventData || !eventData.id) {
        setUnreadCount(0);
        return;
      }

      const msgs: any[] = Array.isArray(eventData.messages) ? eventData.messages : [];
      if (!msgs.length) {
        setUnreadCount(0);
        return;
      }

      let count = 0;
      const storedTime = lastReadAt ? dayjs(lastReadAt) : null;

      for (const m of msgs) {
        if (!m || !m.createdAt) continue;
        if (myUserId && String(m.userId) === String(myUserId)) continue;
        if (!storedTime || dayjs(m.createdAt).isAfter(storedTime)) {
          count++;
        }
      }

      setUnreadCount(count);
    } catch (e) {
      console.log('計算未讀錯誤:', e);
      setUnreadCount(0);
    }
  }, [eventData, myUserId, lastReadAt]);

  if (!id) {
    return (
      <View style={{ flex: 1, backgroundColor: '#020617', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: 'white' }}>找不到活動 ID</Text>
      </View>
    );
  }

  if (loading && !eventData) {
    return (
      <View style={{ flex: 1, backgroundColor: '#020617', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: 'white' }}>載入中...</Text>
      </View>
    );
  }

  if (!eventData) {
    return (
      <View style={{ flex: 1, backgroundColor: '#020617', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: 'white' }}>找不到這個活動</Text>
      </View>
    );
  }

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

  const attendees: any[] = Array.isArray(eventData.attendees) ? eventData.attendees : [];

  const myAttend =
    myUserId != null ? attendees.find((a) => String(a.userId) === String(myUserId)) : null;

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

  const canChat = isHost || myStatus === 'confirmed';

  const eventTimeText = dayjs(eventData.timeISO).format('MM/DD HH:mm');
  const typeLabel = eventData.type === 'KTV' ? '🎤 揪唱歌' : '🍻 揪喝酒';

  const confirmedCount = attendees.filter((a) => a.status === 'confirmed').length;
  const pendingCount = attendees.filter((a) => a.status === 'pending').length;

  const builtIn =
    typeof eventData.builtInPeople === 'number' && !Number.isNaN(eventData.builtInPeople)
      ? eventData.builtInPeople
      : 0;

  const totalConfirmedDisplay = confirmedCount + builtIn;

  const messages: any[] = Array.isArray(eventData.messages) ? eventData.messages : [];
  const confirmedAttendees: any[] = attendees.filter((a) => a.status === 'confirmed');

  function openChat() {
    setChatVisible(true);

    setTimeout(() => {
      if (messagesScrollRef.current) {
        messagesScrollRef.current.scrollToEnd({ animated: false });
      }
    }, 0);
  }

  // ✅ 關閉聊天室：把 lastReadAt 設成最新一筆訊息時間，badge 歸 0（不落地）
  async function closeChat() {
    try {
      if (messages.length) {
        const latest = messages[messages.length - 1];
        if (latest && latest.createdAt) {
          setLastReadAt(String(latest.createdAt));
        }
      }
    } catch (e) {
      console.log('closeChat error:', e);
    } finally {
      setUnreadCount(0);
      setChatVisible(false);
    }
  }

  async function handleJoin() {
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

  function handlePressJoin() {
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

    setShowRulesModal(true);
  }

  async function handleAgreeRulesAndJoin() {
    setShowRulesModal(false);
    await handleJoin();
  }

  async function handleCancelJoin() {
    if (!myAttend || !myAttend.id) return;

    Alert.alert('取消報名', '確定要取消這個局的報名嗎？', [
      { text: '先不要', style: 'cancel' },
      {
        text: '取消報名',
        style: 'destructive',
        onPress: async () => {
          try {
            const updated = await cancelAttend(String(eventData.id), String(myAttend.id));
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

  async function handleConfirm(attendee: any, action: 'confirm' | 'reject') {
    try {
      const updated = await confirmAttendee(String(eventData.id), String(attendee.id), action);
      if (updated) setEventData(updated);
    } catch (e: any) {
      console.log('更新報名狀態錯誤:', e);
      Alert.alert('失敗', e?.message || '請稍後再試');
    }
  }

  async function handleRemove(attendee: any) {
    Alert.alert('移除報名者', '確定要把這個人從這局移除嗎？', [
      { text: '先不要', style: 'cancel' },
      {
        text: '移除',
        style: 'destructive',
        onPress: async () => {
          try {
            const updated = await removeAttendee(String(eventData.id), String(attendee.id));
            if (updated) setEventData(updated);
          } catch (e: any) {
            console.log('移除報名者錯誤:', e);
            Alert.alert('移除失敗', e?.message || '請稍後再試');
          }
        },
      },
    ]);
  }

  async function handleCopyMessage(text: string) {
    try {
      await Clipboard.setStringAsync(text || '');
    } catch (e) {
      console.log('複製訊息失敗:', e);
    }
  }

    function handleLongPressMessage(text: string) {
      Alert.alert(
        '訊息功能',
        '',
        [
          { text: '取消', style: 'cancel' },
          {
            text: '複製',
            onPress: function () {
              handleCopyMessage(text);
            },
          },
        ]
      );
    }

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

        setTimeout(() => {
          if (messagesScrollRef.current) {
            messagesScrollRef.current.scrollToEnd({ animated: true });
          }
        }, 0);
      }
    } catch (e: any) {
      console.log('送出訊息錯誤:', e);
      Alert.alert('發送失敗', e?.message || '請稍後再試');
    } finally {
      setSendingChat(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#020617', paddingTop: 60 }}>
      {/* header */}
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
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text
            allowFontScaling={false}
            style={{
              color: 'white',
              fontSize: 22,
              lineHeight: 22,
              fontWeight: 'bold',
            }}
          >
            活動細節
          </Text>
        </View>

        {canChat && (
          <View style={{ position: 'relative' }}>
            <Pressable
              onPress={openChat}
              style={{
                padding: 8,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: '#525453ff',
                backgroundColor: 'rgb(43, 43, 43)',
              }}
            >
              <Text style={{ color: '#525453ff', fontSize: 20, paddingHorizontal: 5 }}>
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
                <Text style={{ color: 'white', fontSize: 10, fontWeight: '700' }}>
                  {unreadCount}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 24,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#22c55e" />
        }
      >
        {/* 主揪資訊 */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 12, marginBottom: 12 }}>
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
                <Text style={{ color: 'white', fontSize: 20 }}>
                  {hostNickname ? hostNickname[0] : '?'}
                </Text>
              </View>
            )}
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={{ color: hostNameColor, fontSize: 16, fontWeight: '600', marginBottom: 2 }}>
              {hostNickname}
              {hostAge}
            </Text>
            {hostIntro ? <Text style={{ color: '#9ca3af' }}>{hostIntro}</Text> : null}
          </View>
        </View>

        {/* 局資訊 */}
        <Text style={{ color: 'white', marginBottom: 2, marginTop: 5 }}>{typeLabel}</Text>
        <Text style={{ color: 'white', marginBottom: 2 }}>
         {eventData?.region || ''}・{eventData?.place || ''}
        </Text>
        <Text style={{ color: 'white', marginBottom: 2 }}>時間： {eventTimeText}</Text>
        <Text style={{ color: 'white', marginBottom: 2 }}>
          人數： {totalConfirmedDisplay}/{eventData.maxPeople}（內建 {builtIn} 人）
        </Text>
        {eventData.notes ? (
          <Text style={{ color: 'white', marginTop: 4 }}>備註： {eventData.notes}</Text>
        ) : null}

        {/* 報名按鈕 */}
        {!isHost && (
          <View style={{ marginTop: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, marginRight: canCancel ? 8 : 0 }}>
                <Pressable
                  onPress={handlePressJoin}
                  disabled={joining || alreadyJoined || isRejected || isRemoved || isCancelled}
                  style={{
                    backgroundColor:
                      isRejected || isRemoved || isCancelled || alreadyJoined ? '#6b7280' : '#22c55e',
                    borderRadius: 999,
                    paddingVertical: 12,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: 'black', fontWeight: '600' }}>
                    {joining
                      ? '送出中...'
                      : isRejected || isRemoved || isCancelled
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
                    <Text style={{ color: '#f97373', fontWeight: '600', fontSize: 12 }}>
                      取消報名
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>

            {isRejected && (
              <Text style={{ color: '#f97373', marginTop: 15, fontSize: 12, textAlign: 'center' }}>
                你已被主揪拒絕，無法再報名這個局。
              </Text>
            )}
            {isRemoved && (
              <Text style={{ color: '#f97373', marginTop: 15, fontSize: 12, textAlign: 'center' }}>
                你已被主揪移除，無法再報名這個局。
              </Text>
            )}
            {isCancelled && (
              <Text style={{ color: '#f97373', marginTop: 15, fontSize: 12, textAlign: 'center' }}>
                你已取消過這個局，無法再重新報名。
              </Text>
            )}
            {myStatus === 'pending' && (
              <Text style={{ color: '#eab308', marginTop: 15, fontSize: 12, textAlign: 'center' }}>
                已送出報名，等主揪確認後才會開啟聊天室。
              </Text>
            )}
          </View>
        )}

        {/* 主揪報名列表 */}
        {isHost && (
          <View style={{ marginTop: 35 }}>
            <Text style={{ color: 'white', fontSize: 22, fontWeight: 'bold', marginBottom: 8, marginTop: 10 }}>
              報名列表 ({totalConfirmedDisplay}/{eventData.maxPeople})
            </Text>

            <Text style={{ color: '#e5e7eb', marginBottom: 6 }}>
              已確認 {confirmedCount} 人，待確認 {pendingCount} 人
            </Text>

            {attendees.filter(
              (a) => a.status !== 'removed' && a.status !== 'cancelled' && a.status !== 'rejected'
            ).length === 0 && <Text style={{ color: 'white' }}>目前還沒有人報名</Text>}

            {attendees
              .filter((a) => a.status !== 'removed' && a.status !== 'cancelled' && a.status !== 'rejected')
              .map((a: any) => {
                const p = a.profile || {};
                const g = p.gender || '';
                const age =
                  typeof p.age === 'number' && !Number.isNaN(p.age) ? String(p.age) : '';
                const nick = p.nickname || '';
                const intro = p.intro || '';
                const photoUri = p.photoUri || '';

                const nameColor =
                  g === '男' ? '#60a5fa' : g === '女' ? '#fb7185' : '#ffffff';

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
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
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
                            <Text style={{ color: 'white', fontSize: 16 }}>
                              {nick ? nick[0] : '?'}
                            </Text>
                          </View>
                        )}
                      </Pressable>

                      <View style={{ flex: 1 }}>
                        <Text style={{ color: nameColor, fontWeight: '600', marginBottom: 2 }}>
                          {nick} {age}
                        </Text>

                        {intro ? <Text style={{ color: '#9ca3af' }}>{intro}</Text> : null}

                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 }}>
                          {a.status === 'pending' && (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
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
                                <Text style={{ color: '#f97373', fontSize: 12 }}>拒絕</Text>
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
                                <Text style={{ color: '#4ade80', fontSize: 12 }}>接受</Text>
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
                              <Text style={{ color: '#f97373', fontSize: 12 }}>移除</Text>
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

        {/* 報名成功看到的人員清單 */}
        {!isHost && myStatus === 'confirmed' && (confirmedAttendees.length > 0 || hostNickname) && (
          <View style={{ marginTop: 35 }}>
            <Text style={{ color: 'white', fontSize: 22, fontWeight: 'bold', marginBottom: 8 }}>
              人員清單 ({totalConfirmedDisplay}/{eventData.maxPeople})
            </Text>

            {confirmedAttendees.map((a: any) => {
              const p = a.profile || {};
              const g = p.gender || '';
              const age =
                typeof p.age === 'number' && !Number.isNaN(p.age) ? String(p.age) : '';
              const nick = p.nickname || '';
              const intro = p.intro || '';
              const photoUri = p.photoUri || '';

              if (!nick && !g && !age) return null;

              const nameColor =
                g === '男' ? '#60a5fa' : g === '女' ? '#fb7185' : '#ffffff';

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
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
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
                          <Text style={{ color: 'white', fontSize: 16 }}>
                            {nick ? nick[0] : '?'}
                          </Text>
                        </View>
                      )}
                    </Pressable>

                    <View style={{ flex: 1 }}>
                      <Text style={{ color: nameColor, fontWeight: '600', marginBottom: 2 }}>
                        {nick} {age}
                      </Text>

                      {intro ? <Text style={{ color: '#9ca3af' }}>{intro}</Text> : null}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* 揪團守則 Modal */}
      <Modal
        visible={showRulesModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRulesModal(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.6)',
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 24,
          }}
        >
          <View style={{ width: '100%', backgroundColor: '#111827', borderRadius: 16, padding: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: 'white', marginBottom: 25 }}>
              ⭐ 揪團守則：一起維持良好參加品質
            </Text>

            <Text style={{ color: '#22c55e', fontWeight: '600', marginTop: 8, marginBottom: 2 }}>
              ✅ 不放鳥
            </Text>
            <Text style={{ color: '#e5e7eb', fontSize: 13, marginBottom: 20 }}>
              報名即代表答應出席，請避免臨時失聯或不來。
            </Text>

            <Text style={{ color: '#22c55e', fontWeight: '600', marginTop: 12, marginBottom: 2 }}>
              ⏰ 準時到
            </Text>
            <Text style={{ color: '#e5e7eb', fontSize: 13, marginBottom: 20 }}>
              主揪與其他參加者都在等你，準時是最基本的尊重。
            </Text>

            <Text style={{ color: '#22c55e', fontWeight: '600', marginTop: 12, marginBottom: 2 }}>
              📢 有事取消
            </Text>
            <Text style={{ color: '#e5e7eb', fontSize: 13 }}>
              若臨時無法前來，請立即取消或告知主揪，讓名額能讓給其他人。
            </Text>

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 18 }}>
              <Pressable
                onPress={() => setShowRulesModal(false)}
                style={{ paddingVertical: 8, paddingHorizontal: 12, marginRight: 8 }}
              >
                <Text style={{ color: '#9ca3af', fontSize: 13, fontWeight: '500' }}>先不要</Text>
              </Pressable>

              <Pressable
                onPress={handleAgreeRulesAndJoin}
                disabled={joining}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  borderRadius: 999,
                  backgroundColor: joining ? '#6b7280' : '#22c55e',
                }}
              >
                <Text style={{ color: 'black', fontSize: 13, fontWeight: '600' }}>
                  {joining ? '送出中...' : '我同意，送出報名'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* 聊天室 Modal */}
      <Modal visible={chatVisible} transparent animationType="slide" onRequestClose={closeChat}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <Pressable style={{ flex: 1 }} onPress={closeChat} />

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={0}
            style={{ height: '80%', marginHorizontal: '5%', marginBottom: '15%' }}
          >
            <View
              style={{
                flex: 1,
                backgroundColor: '#020617',
                borderRadius: 16,
                padding: 12,
                position: 'relative',
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold', marginLeft: 10 }}>
                  聊天室
                </Text>

                <Pressable onPress={closeChat} style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
                  <Text style={{ color: '#9ca3af', fontSize: 14 }}>關閉</Text>
                </Pressable>
              </View>

              <View style={{ flex: 1, backgroundColor: '#111827', borderRadius: 10, padding: 10 }}>
                {messages.length === 0 ? (
                  <Text style={{ color: '#9ca3af' }}>還沒有任何訊息，來打第一句吧～</Text>
                ) : (
                  <ScrollView
                    ref={messagesScrollRef}
                    style={{ flex: 1 }}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ flexGrow: 1, paddingVertical: 4 }}
                    onContentSizeChange={() => {
                      if (messagesScrollRef.current) {
                        messagesScrollRef.current.scrollToEnd({ animated: false });
                      }
                    }}
                  >
                    {messages.map((m: any) => {
                      const p = m.profile || {};
                      const g = p.gender || '';
                      const age =
                        typeof p.age === 'number' && !Number.isNaN(p.age) ? String(p.age) : '';
                      const nick = p.nickname || '';
                      const photoUri = p.photoUri || '';

                      const isMe = myUserId && String(m.userId) === String(myUserId);

                      const nameColor =
                        g === '男' ? '#60a5fa' : g === '女' ? '#fb7185' : '#e5e7eb';

                      const timeText = m.createdAt ? dayjs(m.createdAt).format('MM/DD HH:mm') : '';

                      return (
                        <View
                          key={String(m.id)}
                          style={{
                            marginVertical: 6,
                            flexDirection: 'row',
                            justifyContent: isMe ? 'flex-end' : 'flex-start',
                            alignItems: 'flex-start',
                          }}
                        >
                          {!isMe && (
                            <Pressable
                              style={{ marginRight: 8 }}
                              onPress={() => {
                                Keyboard.dismiss();
                                setChatImageUri(photoUri || 'NO_PHOTO');
                              }}
                            >
                              {photoUri ? (
                                <Image
                                  source={{ uri: photoUri }}
                                  style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 16,
                                    backgroundColor: '#020617',
                                    borderWidth: 1,
                                    borderColor: nameColor,
                                  }}
                                />
                              ) : (
                                <View
                                  style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 16,
                                    backgroundColor: '#020617',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    borderWidth: 1,
                                    borderColor: nameColor,
                                  }}
                                >
                                  <Text style={{ color: 'white', fontSize: 13 }}>
                                    {nick ? nick[0] : '?'}
                                  </Text>
                                </View>
                              )}
                            </Pressable>
                          )}

                          <View style={{ maxWidth: isMe ? '85%' : '75%', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                            {!isMe && (
                              <Text style={{ color: nameColor, marginBottom: 2, fontSize: 12, fontWeight: '600' }}>
                                {nick}
                                {age ? ' ' + age : ''}
                              </Text>
                            )}

                            <Pressable
                              onLongPress={function () {
                                handleLongPressMessage(m.text);
                              }}
                              delayLongPress={250}
                              style={{
                                backgroundColor: isMe ? '#22c55e' : '#374151',
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                                borderRadius: 12,
                                borderTopRightRadius: isMe ? 2 : 12,
                                borderTopLeftRadius: isMe ? 12 : 2,
                              }}
                            >
                              <Text style={{ color: isMe ? '#000' : '#fff' }}>{m.text}</Text>
                            </Pressable>

                            <Text style={{ color: '#9ca3af', fontSize: 10, marginTop: 2, textAlign: isMe ? 'right' : 'left' }}>
                              {timeText}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>
                )}
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                <TextInput
                  ref={chatInputRef}
                  value={chatText}
                  onChangeText={setChatText}
                  placeholder="輸入訊息..."
                  placeholderTextColor="#6b7280"
                  editable={canChat && !sendingChat}
                  blurOnSubmit={false}
                  multiline={false}
                  style={{
                    flex: 1,
                    backgroundColor: '#111827',
                    color: 'white',
                    borderRadius: 999,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    marginRight: 8,
                  }}
                />

                <Pressable
                  onPress={() => {
                    Keyboard.dismiss();
                    handleSendChat();
                  }}
                  disabled={!canChat || sendingChat || !chatText.trim()}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: !canChat || sendingChat || !chatText.trim() ? '#6b7280' : '#22c55e',
                  }}
                >
                  <Text style={{ color: 'black', fontWeight: '600', fontSize: 13, marginVertical: 5 }}>
                    {sendingChat ? '送出中' : '送出'}
                  </Text>
                </Pressable>
              </View>

              {chatImageUri && (
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.9)',
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderRadius: 16,
                  }}
                >
                  <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => setChatImageUri(null)}
                    style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}
                  >
                    {chatImageUri !== 'NO_PHOTO' ? (
                      <Image
                        source={{ uri: chatImageUri }}
                        style={{ width: 260, height: 260, borderRadius: 130, resizeMode: 'cover' }}
                        onError={() => setChatImageUri('NO_PHOTO')}
                      />
                    ) : (
                      <View
                        style={{
                          width: 260,
                          height: 260,
                          borderRadius: 130,
                          borderWidth: 2,
                          borderColor: '#e5e7eb',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ color: '#e5e7eb', fontSize: 60, fontWeight: 'bold' }}>?</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* 活動頁面大頭貼放大 Modal */}
      <Modal
        visible={!!imageModalUri}
        transparent
        animationType="fade"
        onRequestClose={() => setImageModalUri(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setImageModalUri(null)}
            style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}
          >
            {imageModalUri ? (
              <Image
                source={{ uri: imageModalUri }}
                style={{ width: 260, height: 260, borderRadius: 130, resizeMode: 'cover' }}
                onError={() => setImageModalUri(null)}
              />
            ) : null}
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}