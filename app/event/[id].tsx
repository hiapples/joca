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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams } from 'expo-router';
import dayjs from 'dayjs';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useEvents } from '../../lib/useEvents';
import { getSocket } from '../../lib/socket';
import { useAuth } from '../../lib/auth';

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user } = useAuth();

  const {
    getEvent,
    joinEvent,
    cancelAttend,
    removeAttendee,
    sendMessage,
    sendImageMessage,
    retractMessage,
  } = useEvents();

  const [eventData, setEventData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const myUserId = user && user.userId ? String(user.userId) : null;
  const LAST_READ_KEY =
    id && myUserId ? 'event_last_read_' + String(id) + '_' + String(myUserId) : '';

  const [imageModalUri, setImageModalUri] = useState<string | null>(null);
  const [chatImageUri, setChatImageUri] = useState<string | null>(null);

  const [chatVisible, setChatVisible] = useState(false);
  const [chatText, setChatText] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [sendingImage, setSendingImage] = useState(false);

  const [pendingImageAsset, setPendingImageAsset] = useState<any | null>(null);
  const [confirmImageModalVisible, setConfirmImageModalVisible] = useState(false);

  const [lastReadAt, setLastReadAt] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const messagesScrollRef = useRef<ScrollView | null>(null);
  const chatInputRef = useRef<TextInput | null>(null);

  const [showRulesModal, setShowRulesModal] = useState(false);

  const [messageMenuVisible, setMessageMenuVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<any | null>(null);
  const [selectedIsMe, setSelectedIsMe] = useState(false);

  const loadLastReadAt = useCallback(async () => {
    try {
      if (!LAST_READ_KEY) return;
      const saved = await AsyncStorage.getItem(LAST_READ_KEY);
      if (saved) {
        setLastReadAt(saved);
      } else {
        setLastReadAt(null);
      }
    } catch (e) {
      console.log('讀取 lastReadAt 失敗:', e);
      setLastReadAt(null);
    }
  }, [LAST_READ_KEY]);

  const saveLastReadAt = useCallback(
    async (value: string) => {
      try {
        if (!LAST_READ_KEY) return;
        await AsyncStorage.setItem(LAST_READ_KEY, value);
        setLastReadAt(value);
      } catch (e) {
        console.log('儲存 lastReadAt 失敗:', e);
      }
    },
    [LAST_READ_KEY]
  );

  const load = useCallback(async () => {
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
  }, [id, getEvent]);

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

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadLastReadAt();
  }, [loadLastReadAt]);

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

  const attendees: any[] = Array.isArray(eventData?.attendees) ? eventData.attendees : [];
  const messages: any[] = Array.isArray(eventData?.messages) ? eventData.messages : [];

  useEffect(() => {
    try {
      if (!eventData || !eventData.id) {
        setUnreadCount(0);
        return;
      }

      if (!messages.length) {
        setUnreadCount(0);
        return;
      }

      let count = 0;
      const storedTime = lastReadAt ? dayjs(lastReadAt) : null;

      for (const m of messages) {
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
  }, [eventData, messages, myUserId, lastReadAt]);

  useEffect(() => {
    async function markLatestAsReadWhenChatOpen() {
      try {
        if (!chatVisible) return;
        if (!messages.length) return;

        const latest = messages[messages.length - 1];
        if (!latest || !latest.createdAt) return;

        await saveLastReadAt(String(latest.createdAt));
        setUnreadCount(0);
      } catch (e) {
        console.log('聊天室開啟中自動已讀失敗:', e);
      }
    }

    markLatestAsReadWhenChatOpen();
  }, [chatVisible, messages, saveLastReadAt]);

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

  const myAttend =
    myUserId != null ? attendees.find((a: any) => String(a.userId) === String(myUserId)) : null;

  const myStatus = myAttend?.status ?? null;

  const isRemoved = myStatus === 'removed';
  const isCancelled = myStatus === 'cancelled';
  const isJoined = myStatus === 'joined';

  const alreadyJoined = isJoined;
  const canLeave = isJoined;
  const canChat = isHost || isJoined;

  const eventTimeText = dayjs(eventData.timeISO).format('MM/DD HH:mm');
  const typeLabel =
    eventData.type === 'KTV'
      ? '🎤 揪唱歌'
      : eventData.type === 'Mahjong'
      ? '🀄 揪麻將'
      : '🍻 揪喝酒';

  const joinedCount = attendees.filter((a: any) => a.status === 'joined').length;

  const builtIn =
    typeof eventData.builtInPeople === 'number' && !Number.isNaN(eventData.builtInPeople)
      ? eventData.builtInPeople
      : 0;

  const totalJoinedDisplay = joinedCount + builtIn;
  const joinedAttendees: any[] = attendees.filter((a: any) => a.status === 'joined');

  async function openChat() {
    setChatVisible(true);
    setUnreadCount(0);

    try {
      if (messages.length) {
        const latest = messages[messages.length - 1];
        if (latest && latest.createdAt) {
          await saveLastReadAt(String(latest.createdAt));
        }
      }
    } catch (e) {
      console.log('openChat 已讀錯誤:', e);
    }

    setTimeout(() => {
      if (messagesScrollRef.current) {
        messagesScrollRef.current.scrollToEnd({ animated: false });
      }
    }, 0);
  }

  async function closeChat() {
    try {
      if (messages.length) {
        const latest = messages[messages.length - 1];
        if (latest && latest.createdAt) {
          await saveLastReadAt(String(latest.createdAt));
        }
      }
    } catch (e) {
      console.log('closeChat error:', e);
    } finally {
      setUnreadCount(0);
      setChatVisible(false);
      closeMessageMenu();
      setConfirmImageModalVisible(false);
      setPendingImageAsset(null);
      setChatImageUri(null);
    }
  }

  async function handleJoin() {
    if (!eventData?.id) return;

    setJoining(true);
    try {
      const updated = await joinEvent(String(eventData.id));
      if (updated) {
        setEventData(updated);
        Alert.alert('成功', '你已加入房間');
      }
    } catch (e: any) {
      console.log('加入房間錯誤:', e);
      Alert.alert('加入失敗', e?.message || '請稍後再試');
    } finally {
      setJoining(false);
    }
  }

  function handlePressJoin() {
    if (isHost) {
      Alert.alert('提示', '主揪已在房間內');
      return;
    }
    if (isRemoved) {
      Alert.alert('提示', '你已被主揪移除，不能重新加入這個房間');
      return;
    }
    if (isCancelled) {
      Alert.alert('提示', '你已離開過這個房間，不能重新加入');
      return;
    }
    if (alreadyJoined) {
      Alert.alert('提示', '你已經在這個房間裡了');
      return;
    }

    setShowRulesModal(true);
  }

  async function handleAgreeRulesAndJoin() {
    setShowRulesModal(false);
    await handleJoin();
  }

  async function handleLeaveRoom() {
    if (!myAttend || !myAttend.id || !eventData?.id) return;

    Alert.alert('離開房間', '確定要離開這個房間嗎？離開後不能再重新加入。', [
      { text: '先不要', style: 'cancel' },
      {
        text: '離開',
        style: 'destructive',
        onPress: async () => {
          try {
            const updated = await cancelAttend(String(eventData.id), String(myAttend.id));
            if (updated) {
              setEventData(updated);
              setChatVisible(false);
              Alert.alert('已離開', '你已離開這個房間。');
            }
          } catch (e: any) {
            console.log('離開房間錯誤:', e);
            Alert.alert('離開失敗', e?.message || '請稍後再試');
          }
        },
      },
    ]);
  }

  async function handleRemove(attendee: any) {
    if (!eventData?.id || !attendee?.id) return;

    Alert.alert('移除成員', '確定要把這個人從房間移除嗎？', [
      { text: '先不要', style: 'cancel' },
      {
        text: '移除',
        style: 'destructive',
        onPress: async () => {
          try {
            const updated = await removeAttendee(String(eventData.id), String(attendee.id));
            if (updated) setEventData(updated);
          } catch (e: any) {
            console.log('移除房間成員錯誤:', e);
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

  function closeMessageMenu() {
    setMessageMenuVisible(false);
    setSelectedMessage(null);
    setSelectedIsMe(false);
  }

  function handleCopySelected() {
    if (!selectedMessage) return;
    if (selectedMessage.type === 'image') return;
    handleCopyMessage(selectedMessage.text);
    closeMessageMenu();
  }

  async function handleRetractSelected() {
    if (!selectedMessage || !eventData?.id) return;

    try {
      const updated = await retractMessage(
        String(eventData.id),
        String(selectedMessage.id)
      );
      if (updated) {
        setEventData(updated);
      }
    } catch (e: any) {
      console.log('收回訊息失敗:', e);
      Alert.alert('失敗', e?.message || '無法收回訊息');
    }

    closeMessageMenu();
  }

  async function handleSendChat() {
    const text = chatText.trim();
    if (!text || !eventData?.id) return;

    if (!canChat) {
      Alert.alert('無法發言', '只有主揪或已進房的人可以發言');
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

  async function handlePickAndSendImage() {
    if (!canChat) {
      Alert.alert('無法發言', '只有主揪或已進房的人可以發言');
      return;
    }

    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('提示', '需要相簿權限才能選照片');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        selectionLimit: 1,
      });

      if (result.canceled || !result.assets || !result.assets.length) return;

      const asset = result.assets[0];
      setPendingImageAsset(asset);
      setConfirmImageModalVisible(true);
    } catch (e: any) {
      console.log('選取圖片錯誤:', e);
      Alert.alert('失敗', e?.message || '無法開啟相簿');
    }
  }

  async function handleConfirmSendImage() {
    if (!pendingImageAsset || !eventData?.id) return;

    try {
      setSendingImage(true);

      const updated = await sendImageMessage(String(eventData.id), pendingImageAsset);
      if (updated) {
        setEventData(updated);
        setConfirmImageModalVisible(false);
        setPendingImageAsset(null);

        setTimeout(() => {
          if (messagesScrollRef.current) {
            messagesScrollRef.current.scrollToEnd({ animated: true });
          }
        }, 0);
      }
    } catch (e: any) {
      console.log('送出圖片訊息錯誤:', e);
      Alert.alert('發送失敗', e?.message || '圖片上傳失敗');
    } finally {
      setSendingImage(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#020617', paddingTop: 60 }}>
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

            {unreadCount > 0 && !chatVisible && (
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

        <View
          style={{
            marginTop: 10,
            backgroundColor: '#111827',
            borderRadius: 14,
            padding: 14,
            borderWidth: 1,
            borderColor: '#1f2937',
          }}
        >
          <View
            style={{
              alignSelf: 'flex-start',
              backgroundColor: '#0f172a',
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 5,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: '#1f2937',
            }}
          >
            <Text style={{ color: '#22c55e', fontSize: 13, fontWeight: '700' }}>
              {typeLabel}
            </Text>
          </View>

          <View style={{ marginBottom: 10 }}>
            <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 3 }}>地點</Text>
            <Text style={{ color: 'white', fontSize: 15, lineHeight: 22 }}>
              {eventData?.region || ''}・{eventData?.place || ''}
            </Text>
          </View>

          <View style={{ marginBottom: 10 }}>
            <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 3 }}>時間</Text>
            <Text style={{ color: 'white', fontSize: 15, lineHeight: 22 }}>
              {eventTimeText}
            </Text>
          </View>

          <View style={{ marginBottom: eventData.notes ? 10 : 0 }}>
            <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 3 }}>人數</Text>
            <Text style={{ color: 'white', fontSize: 15, lineHeight: 22 }}>
              {totalJoinedDisplay}/{eventData.maxPeople}（內建 {builtIn} 人）
            </Text>
          </View>

          {eventData.notes ? (
            <View>
              <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 3 }}>備註</Text>
              <Text style={{ color: 'white', fontSize: 15, lineHeight: 22 }}>
                {eventData.notes}
              </Text>
            </View>
          ) : null}
        </View>

        {!isHost && (
          <View style={{ marginTop: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, marginRight: canLeave ? 8 : 0 }}>
                <Pressable
                  onPress={handlePressJoin}
                  disabled={joining || alreadyJoined || isRemoved || isCancelled}
                  style={{
                    backgroundColor:
                      isRemoved || isCancelled || alreadyJoined ? '#6b7280' : '#22c55e',
                    borderRadius: 999,
                    paddingVertical: 12,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: 'black', fontWeight: '600' }}>
                    {joining
                      ? '加入中...'
                      : isRemoved || isCancelled
                      ? '無法加入'
                      : alreadyJoined
                      ? '已在房間'
                      : '我要加入'}
                  </Text>
                </Pressable>
              </View>

              {canLeave && (
                <View style={{ width: 110 }}>
                  <Pressable
                    onPress={handleLeaveRoom}
                    style={{
                      borderRadius: 999,
                      paddingVertical: 12,
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: '#f97373',
                    }}
                  >
                    <Text style={{ color: '#f97373', fontWeight: '600', fontSize: 12 }}>
                      離開房間
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>

            {isRemoved && (
              <Text style={{ color: '#f97373', marginTop: 15, fontSize: 12, textAlign: 'center' }}>
                你已被主揪移除，無法再加入這個房間。
              </Text>
            )}
            {isCancelled && (
              <Text style={{ color: '#f97373', marginTop: 15, fontSize: 12, textAlign: 'center' }}>
                你已離開過這個房間，無法再重新加入。
              </Text>
            )}
          </View>
        )}

        {isHost && (
          <View style={{ marginTop: 35 }}>
            <Text style={{ color: 'white', fontSize: 22, fontWeight: 'bold', marginBottom: 8, marginTop: 10 }}>
              房間成員 ({totalJoinedDisplay}/{eventData.maxPeople})
            </Text>

            {attendees.filter((a: any) => a.status === 'joined').length === 0 && (
              <Text style={{ color: 'white' }}>目前還沒有人加入</Text>
            )}

            {attendees
              .filter((a: any) => a.status === 'joined')
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
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })}
          </View>
        )}

        {!isHost && isJoined && (joinedAttendees.length > 0 || hostNickname) && (
          <View style={{ marginTop: 35 }}>
            <Text style={{ color: 'white', fontSize: 22, fontWeight: 'bold', marginBottom: 8 }}>
              房間成員 ({totalJoinedDisplay}/{eventData.maxPeople})
            </Text>

            {joinedAttendees.map((a: any) => {
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
              ⭐ 房間守則：一起維持良好參加品質
            </Text>

            <Text style={{ color: '#22c55e', fontWeight: '600', marginTop: 8, marginBottom: 2 }}>
              ✅ 不放鳥
            </Text>
            <Text style={{ color: '#e5e7eb', fontSize: 13, marginBottom: 20 }}>
              加入房間即代表答應出席，請避免臨時失聯或不來。
            </Text>

            <Text style={{ color: '#22c55e', fontWeight: '600', marginTop: 12, marginBottom: 2 }}>
              ⏰ 準時到
            </Text>
            <Text style={{ color: '#e5e7eb', fontSize: 13, marginBottom: 20 }}>
              主揪與其他參加者都在等你，準時是最基本的尊重。
            </Text>

            <Text style={{ color: '#22c55e', fontWeight: '600', marginTop: 12, marginBottom: 2 }}>
              📢 有事離開
            </Text>
            <Text style={{ color: '#e5e7eb', fontSize: 13 }}>
              若臨時無法前來，請立即離開房間或告知主揪，讓名額能讓給其他人。
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
                  {joining ? '加入中...' : '我同意，加入房間'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

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

                      const isMe = !!(myUserId && String(m.userId) === String(myUserId));

                      const nameColor =
                        g === '男' ? '#60a5fa' : g === '女' ? '#fb7185' : '#e5e7eb';

                      const timeText = m.createdAt
                        ? dayjs(m.createdAt).format('MM/DD HH:mm')
                        : '';

                      const isImageMessage = m.type === 'image' && !!m.imageUri;
                      const isTextMessage = !isImageMessage;

                      const canLongPressMessage =
                        isTextMessage || (isImageMessage && !!isMe);

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

                          <View
                            style={{
                              maxWidth: isImageMessage ? '72%' : isMe ? '85%' : '75%',
                              alignItems: isMe ? 'flex-end' : 'flex-start',
                            }}
                          >
                            {!isMe && (
                              <Text
                                style={{
                                  color: nameColor,
                                  marginBottom: 2,
                                  fontSize: 12,
                                  fontWeight: '600',
                                }}
                              >
                                {nick}
                                {age ? ' ' + age : ''}
                              </Text>
                            )}

                            <Pressable
                              onLongPress={
                                canLongPressMessage
                                  ? () => {
                                      setSelectedMessage(m);
                                      setSelectedIsMe(!!isMe);
                                      setMessageMenuVisible(true);
                                    }
                                  : undefined
                              }
                              delayLongPress={250}
                              onPress={() => {
                                if (isImageMessage) {
                                  Keyboard.dismiss();
                                  setChatImageUri(m.imageUri);
                                }
                              }}
                              style={{
                                backgroundColor: isImageMessage
                                  ? 'transparent'
                                  : isMe
                                  ? '#22c55e'
                                  : '#374151',
                                paddingHorizontal: isImageMessage ? 0 : 12,
                                paddingVertical: isImageMessage ? 0 : 8,
                                borderRadius: 12,
                                borderTopRightRadius: isImageMessage
                                  ? 12
                                  : isMe
                                  ? 2
                                  : 12,
                                borderTopLeftRadius: isImageMessage
                                  ? 12
                                  : isMe
                                  ? 12
                                  : 2,
                                overflow: 'hidden',
                              }}
                            >
                              {isImageMessage ? (
                                <Image
                                  source={{ uri: m.imageUri }}
                                  style={{
                                    width: 180,
                                    height: 180,
                                    borderRadius: 12,
                                    backgroundColor: '#1f2937',
                                  }}
                                  resizeMode="cover"
                                />
                              ) : (
                                <Text style={{ color: isMe ? '#000' : '#fff' }}>
                                  {m.text}
                                </Text>
                              )}
                            </Pressable>

                            <Text
                              style={{
                                color: '#9ca3af',
                                fontSize: 10,
                                marginTop: 2,
                                textAlign: isMe ? 'right' : 'left',
                              }}
                            >
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
                <Pressable
                  onPress={() => {
                    Keyboard.dismiss();
                    handlePickAndSendImage();
                  }}
                  disabled={!canChat || sendingImage || sendingChat}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: !canChat || sendingImage || sendingChat ? '#6b7280' : '#111827',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 8,
                  }}
                >
                  <Text style={{ color: 'white', fontSize: 22, marginTop: -2 }}>
                    {sendingImage ? '…' : '+'}
                  </Text>
                </Pressable>

                <TextInput
                  ref={chatInputRef}
                  value={chatText}
                  onChangeText={setChatText}
                  placeholder="輸入訊息..."
                  placeholderTextColor="#6b7280"
                  editable={canChat && !sendingChat && !sendingImage}
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
                  disabled={!canChat || sendingChat || sendingImage || !chatText.trim()}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor:
                      !canChat || sendingChat || sendingImage || !chatText.trim() ? '#6b7280' : '#22c55e',
                  }}
                >
                  <Text style={{ color: 'black', fontWeight: '600', fontSize: 13, marginVertical: 5 }}>
                    {sendingChat ? '送出中' : '送出'}
                  </Text>
                </Pressable>
              </View>

              {messageMenuVisible && (
                <Pressable
                  onPress={closeMessageMenu}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.35)',
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderRadius: 16,
                    zIndex: 999,
                  }}
                >
                  <Pressable
                    onPress={(e) => {
                      if (e && (e as any).stopPropagation) (e as any).stopPropagation();
                    }}
                    style={{
                      width: 220,
                      backgroundColor: '#111827',
                      borderRadius: 14,
                      overflow: 'hidden',
                      borderWidth: 1,
                      borderColor: '#1f2937',
                    }}
                  >
                    {selectedMessage?.type !== 'image' && (
                      <Pressable
                        onPress={handleCopySelected}
                        style={{
                          paddingVertical: 14,
                          alignItems: 'center',
                          borderBottomWidth: 1,
                          borderColor: '#1f2937',
                        }}
                      >
                        <Text style={{ color: 'white', fontSize: 15 }}>複製</Text>
                      </Pressable>
                    )}

                    {selectedIsMe && (
                      <Pressable
                        onPress={handleRetractSelected}
                        style={{
                          paddingVertical: 14,
                          alignItems: 'center',
                          borderBottomWidth: 1,
                          borderColor: '#1f2937',
                        }}
                      >
                        <Text style={{ color: '#f87171', fontSize: 15 }}>收回</Text>
                      </Pressable>
                    )}

                    <Pressable
                      onPress={closeMessageMenu}
                      style={{
                        paddingVertical: 14,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: '#9ca3af', fontSize: 15 }}>取消</Text>
                    </Pressable>
                  </Pressable>
                </Pressable>
              )}

              {confirmImageModalVisible && (
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.82)',
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderRadius: 16,
                    zIndex: 1000,
                    paddingHorizontal: 14,
                  }}
                >
                  <View
                    style={{
                      width: '100%',
                      backgroundColor: '#111827',
                      borderRadius: 18,
                      padding: 16,
                    }}
                  >
                    <Text
                      style={{
                        color: 'white',
                        fontSize: 18,
                        fontWeight: 'bold',
                        marginBottom: 14,
                      }}
                    >
                      確認送出這張照片？
                    </Text>

                    {pendingImageAsset?.uri ? (
                      <Image
                        source={{ uri: pendingImageAsset.uri }}
                        style={{
                          width: '100%',
                          height: 280,
                          borderRadius: 14,
                          backgroundColor: '#1f2937',
                          marginBottom: 16,
                        }}
                        resizeMode="contain"
                      />
                    ) : (
                      <View
                        style={{
                          width: '100%',
                          height: 280,
                          borderRadius: 14,
                          backgroundColor: '#1f2937',
                          marginBottom: 16,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ color: '#9ca3af' }}>預覽失敗</Text>
                      </View>
                    )}

                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                      <Pressable
                        disabled={sendingImage}
                        onPress={() => {
                          setConfirmImageModalVisible(false);
                          setPendingImageAsset(null);
                        }}
                        style={{
                          paddingVertical: 10,
                          paddingHorizontal: 14,
                          marginRight: 8,
                        }}
                      >
                        <Text style={{ color: '#9ca3af', fontSize: 14, fontWeight: '600' }}>
                          取消
                        </Text>
                      </Pressable>

                      <Pressable
                        disabled={sendingImage}
                        onPress={handleConfirmSendImage}
                        style={{
                          paddingVertical: 10,
                          paddingHorizontal: 16,
                          borderRadius: 999,
                          backgroundColor: sendingImage ? '#6b7280' : '#22c55e',
                        }}
                      >
                        <Text style={{ color: 'black', fontSize: 14, fontWeight: '700' }}>
                          {sendingImage ? '送出中...' : '確定送出'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              )}

              {chatImageUri && (
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.95)',
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderRadius: 16,
                    zIndex: 1001,
                  }}
                >
                  <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => setChatImageUri(null)}
                    style={{
                      width: '100%',
                      height: '100%',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    {chatImageUri !== 'NO_PHOTO' ? (
                      <Image
                        source={{ uri: chatImageUri }}
                        style={{
                          width: '92%',
                          height: '72%',
                          resizeMode: 'contain',
                        }}
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

      <Modal
        visible={!!imageModalUri}
        transparent
        animationType="fade"
        onRequestClose={() => setImageModalUri(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.95)',
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
                  width: '88%',
                  height: '68%',
                  resizeMode: 'contain',
                }}
                onError={() => setImageModalUri(null)}
              />
            ) : null}
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}