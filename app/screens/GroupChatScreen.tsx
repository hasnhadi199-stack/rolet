import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Platform,
  Text,
  ScrollView,
  Dimensions,
  Image,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  joinGroupChat,
  leaveGroupChat,
  fetchGroupChatMessages,
  getCachedGroupChatMessages,
  sendGroupChatMessage,
  setGroupChatMessagesCache,
  getGroupChatMessagesCache,
  type GroupChatMessage,
} from "../../utils/messagesApi";
import { API_BASE_URL } from "../../utils/authHelper";

function getImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
  const base = API_BASE_URL.replace(/\/$/, "");
  return url.startsWith("/") ? `${base}${url}` : `${base}/uploads/${url.replace(/^\//, "")}`;
}

const BG_DARK = "#1a1625";
const TEXT_LIGHT = "#f5f3ff";
const BUBBLE_WIDTH = Math.min(280, Dimensions.get("window").width * 0.82);

type UserInfo = { id?: string; name?: string; profileImage?: string };
type SlotInfo = { userId: string; name?: string; profileImage?: string | null };
type Props = {
  user: UserInfo | null;
  selectedSlot?: string | null;
  onSelectedSlotChange?: (userId: string | null) => void;
  onBack: () => void;
  onOpenTopup?: () => void;
  onOpenUsers?: () => void;
  onOpenProfile?: (slot: SlotInfo) => void;
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const AVATAR_COLS = 4;
const AVATAR_GAP = 10;
const CARD_BG = "rgba(45, 38, 64, 0.6)";
const TEXT_MUTED = "#a1a1aa";
const ACCENT = "#a78bfa";

export default function GroupChatScreen({ user, onBack, onOpenUsers }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [mySlotIndex, setMySlotIndex] = useState<number | null>(null);
  const [messages, setMessages] = useState<GroupChatMessage[]>(() => getGroupChatMessagesCache());
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [inputText, setInputText] = useState("");
  const flatRef = useRef<FlatList>(null);
  const currentUserId = user?.id || "";

  const loadMessages = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const memCached = getGroupChatMessagesCache();
    if (memCached.length > 0) setMessages(memCached);
    getCachedGroupChatMessages().then((stored) => {
      if (stored.length > 0) setMessages(stored);
    });
    const msgs = await fetchGroupChatMessages();
    setMessages(msgs);
    setGroupChatMessagesCache(msgs);
    setLoading(false);
  }, []);

  useEffect(() => {
    joinGroupChat().catch(() => {});
    return () => {
      void leaveGroupChat().catch(() => {});
    };
  }, []);

  useEffect(() => {
    getCachedGroupChatMessages().then((stored) => {
      if (stored.length > 0) setMessages(stored);
    });
    loadMessages(true);
  }, [loadMessages]);

  useEffect(() => {
    const t = setInterval(() => loadMessages(true), 1500);
    return () => clearInterval(t);
  }, [loadMessages]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMessages();
    setRefreshing(false);
  }, [loadMessages]);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text) return;
    setInputText("");
    const tempId = `temp_${Date.now()}`;
    const optimistic: GroupChatMessage = {
      id: tempId,
      fromId: currentUserId,
      fromName: user?.name || "مستخدم",
      fromProfileImage: user?.profileImage ?? null,
      text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => {
      const next = [...prev, optimistic];
      setGroupChatMessagesCache(next);
      return next;
    });
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 50);
    const msg = await sendGroupChatMessage(text);
    if (msg) {
      setMessages((prev) => {
        const next = prev.map((m) => (m.id === tempId ? { ...msg, id: String(msg.id) } : m));
        setGroupChatMessagesCache(next);
        return next;
      });
    } else {
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== tempId);
        setGroupChatMessagesCache(filtered);
        return filtered;
      });
    }
  }, [inputText, currentUserId, user?.name, user?.profileImage]);

  const avatarSize = expanded ? (SCREEN_WIDTH - 32 - AVATAR_GAP * (AVATAR_COLS + 1)) / AVATAR_COLS : 32;

  return (
    <View style={[styles.container, { backgroundColor: BG_DARK }]}>
      <View style={styles.header}>
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.headerIconBtn} activeOpacity={0.8}>
            <Ionicons name="chatbubbles" size={18} color={TEXT_LIGHT} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} activeOpacity={0.8} onPress={onOpenUsers}>
            <Ionicons name="person" size={18} color={TEXT_LIGHT} />
          </TouchableOpacity>
        </View>
        <Text style={styles.headerTitle}>دردشه جماعيه</Text>
        <TouchableOpacity onPress={onBack} style={styles.headerSide} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={20} color={TEXT_LIGHT} />
        </TouchableOpacity>
      </View>
      <View style={styles.avatarsRow}>
        {expanded ? (
          <View style={styles.expandedGrid}>
            <View style={styles.gridRow}>
              {[1, 2, 3, 4].map((i) => {
                const isMySlot = mySlotIndex === i;
                const showMyPhoto = isMySlot && user?.profileImage;
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.avatarSmall, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2, overflow: "hidden" }]}
                    activeOpacity={0.8}
                    onPress={() => setMySlotIndex(i)}
                  >
                    {showMyPhoto ? (
                      <Image source={{ uri: getImageUrl(user.profileImage) }} style={[styles.avatarImage, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]} resizeMode="cover" />
                    ) : (
                      <Ionicons name="add" size={avatarSize * 0.45} color={TEXT_LIGHT} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.gridRow}>
              {[5, 6, 7, 8].map((i) => {
                const isMySlot = mySlotIndex === i;
                const showMyPhoto = isMySlot && user?.profileImage;
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.avatarSmall, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2, overflow: "hidden" }]}
                    activeOpacity={0.8}
                    onPress={() => setMySlotIndex(i)}
                  >
                    {showMyPhoto ? (
                      <Image source={{ uri: getImageUrl(user.profileImage) }} style={[styles.avatarImage, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]} resizeMode="cover" />
                    ) : (
                      <Ionicons name="add" size={avatarSize * 0.45} color={TEXT_LIGHT} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.controlBar}>
              <TouchableOpacity style={styles.arrowUpCircle} activeOpacity={0.8} onPress={() => setExpanded(false)}>
                <Ionicons name="chevron-up" size={16} color={TEXT_LIGHT} />
              </TouchableOpacity>
              <View style={styles.controlBarRight}>
                {mySlotIndex != null && (
                  <>
                    <TouchableOpacity style={styles.controlIcon} activeOpacity={0.8}>
                      <Ionicons name="musical-notes-outline" size={16} color={TEXT_LIGHT} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.controlIcon} activeOpacity={0.8}>
                      <Ionicons name="mic-off-outline" size={16} color={TEXT_LIGHT} />
                    </TouchableOpacity>
                  </>
                )}
                <TouchableOpacity style={styles.controlIcon} activeOpacity={0.8}>
                  <Ionicons name="volume-high-outline" size={16} color={TEXT_LIGHT} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.controlIcon} activeOpacity={0.8}>
                  <Ionicons name="paw-outline" size={16} color="#a78bfa" />
                </TouchableOpacity>
                {mySlotIndex != null && (
                  <TouchableOpacity style={styles.hangUpBtn} activeOpacity={0.8} onPress={() => setMySlotIndex(null)}>
                    <Ionicons name="call" size={18} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.avatarsScroll}>
            <View style={styles.addWithArrow}>
              <TouchableOpacity style={styles.arrowBtn} activeOpacity={0.8} onPress={() => setExpanded(true)}>
                <Ionicons name="chevron-down" size={18} color={TEXT_LIGHT} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.avatarSmall} activeOpacity={0.8} onPress={() => setMySlotIndex(1)}>
                {mySlotIndex === 1 && user?.profileImage ? (
                  <Image source={{ uri: getImageUrl(user.profileImage) }} style={styles.avatarImageSmall} resizeMode="cover" />
                ) : (
                  <Ionicons name="add" size={16} color={TEXT_LIGHT} />
                )}
              </TouchableOpacity>
            </View>
            {[2, 3, 4, 5, 6, 7, 8].map((i) => {
              const isMySlot = mySlotIndex === i;
              const showMyPhoto = isMySlot && user?.profileImage;
              return (
                <TouchableOpacity key={i} style={styles.avatarSmall} activeOpacity={0.8} onPress={() => setMySlotIndex(i)}>
                  {showMyPhoto ? (
                    <Image source={{ uri: getImageUrl(user.profileImage) }} style={styles.avatarImageSmall} resizeMode="cover" />
                  ) : (
                    <Ionicons name="add" size={16} color={TEXT_LIGHT} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>
      <View style={styles.content}>
        {loading && messages.length === 0 ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={ACCENT} />
          </View>
        ) : (
          <FlatList
            ref={flatRef}
            data={messages}
            renderItem={({ item }) => {
              const isMe = item.fromId === currentUserId;
              const diamonds = item.fromDiamonds ?? 0;
              const chargedGold = item.fromChargedGold ?? 0;
              return (
                <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
                  <View style={styles.msgSenderCol}>
                    <View style={styles.msgImageNameRow}>
                      {item.fromProfileImage ? (
                        <Image source={{ uri: getImageUrl(item.fromProfileImage) }} style={styles.msgAvatarSquare} />
                      ) : (
                        <View style={[styles.msgAvatarSquare, styles.placeholderAvatar]}>
                          <Ionicons name="person" size={12} color={TEXT_MUTED} />
                        </View>
                      )}
                      <Text style={styles.msgSenderName} numberOfLines={1}>
                        {item.fromName}
                      </Text>
                    </View>
                    <View style={styles.msgGemsRow}>
                      <View style={styles.msgGemItem}>
                        <Ionicons name="diamond" size={10} color="#60a5fa" />
                        <Text style={styles.msgGemCount}>{Number(diamonds).toFixed(1)}</Text>
                      </View>
                      <View style={styles.msgGemItem}>
                        <Ionicons name="diamond" size={10} color="#f472b6" />
                        <Text style={styles.msgGemCount}>{Number(chargedGold).toFixed(0)}</Text>
                      </View>
                    </View>
                    <View style={[styles.msgBubble, isMe && styles.msgBubbleMe]}>
                      <Text style={styles.msgText}>{item.text}</Text>
                      <Text style={styles.msgTime}>
                        {item.createdAt ? new Date(item.createdAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }) : ""}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            }}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Ionicons name="chatbubbles-outline" size={48} color={TEXT_MUTED} />
                <Text style={styles.emptyText}>لا توجد رسائل بعد. ابدأ المحادثة!</Text>
              </View>
            }
          />
        )}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="اكتب رسالة..."
            placeholderTextColor={TEXT_MUTED}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <TouchableOpacity style={styles.sendBtn} onPress={handleSend} activeOpacity={0.8}>
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: Platform.OS === "ios" ? 44 : 24 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  headerSide: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: TEXT_LIGHT,
    textAlign: "center",
  },
  headerIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  headerIconBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarsRow: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  avatarsScroll: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 8,
  },
  addWithArrow: {
    flexDirection: "row",
    alignItems: "center",

    gap: 2,
    marginLeft:-10
  },
  arrowBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  expandedGrid: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  controlBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingHorizontal: 8,
  },
  controlBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  controlIcon: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  hangUpBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 6,
  },
  arrowUpCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(167, 139, 250, 0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 74,
  },
  gridRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: AVATAR_GAP,
    marginBottom: AVATAR_GAP,
  },
  avatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(167, 139, 250, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(167, 139, 250, 0.35)",
    overflow: "hidden",
  },
  avatarImage: {},
  avatarImageSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  content: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { padding: 10, paddingBottom: 24 },
  emptyWrap: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, color: TEXT_MUTED },
  msgRow: { flexDirection: "column", marginBottom: 14, alignItems: "flex-start" },
  msgRowMe: { alignItems: "flex-end" },
  msgSenderCol: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 8,
    width: BUBBLE_WIDTH,
  },
  msgImageNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  msgAvatarSquare: {
    width: 36,
    height: 36,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "rgba(167, 139, 250, 0.15)",
  },
  placeholderAvatar: { alignItems: "center", justifyContent: "center" },
  msgSenderName: {
    fontSize: 11,
    color: TEXT_LIGHT,
    maxWidth: 80,
  },
  msgGemsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  msgGemItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  msgGemCount: {
    fontSize: 9,
    color: TEXT_MUTED,
  },
  msgBubble: {
    width: "100%",
    alignSelf: "stretch",
    backgroundColor: "rgba(30, 27, 45, 0.95)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.2)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  msgBubbleMe: {
    backgroundColor: "rgba(139, 92, 246, 0.2)",
    borderColor: "rgba(167, 139, 250, 0.35)",
  },
  msgName: { fontSize: 11, color: ACCENT, marginBottom: 2 },
  msgText: { fontSize: 15, color: TEXT_LIGHT, lineHeight: 22 },
  msgTime: { fontSize: 11, color: TEXT_MUTED, marginTop: 6 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    paddingBottom: Platform.OS === "ios" ? 28 : 76,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    backgroundColor: BG_DARK,
  },
  input: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: TEXT_LIGHT,
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.2)",
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
});