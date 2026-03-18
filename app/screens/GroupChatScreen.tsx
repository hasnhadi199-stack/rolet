import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Pressable,
  Platform,
  Text,
  ScrollView,
  Dimensions,
  Image,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
  ActivityIndicator,
  RefreshControl,
  Modal,
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
import * as Clipboard from "expo-clipboard";

const MENTION_COLOR = "#38bdf8";

function renderMessageWithMentions(
  text: string,
  baseStyle: object,
  onOpenProfile?: (slot: { userId: string; name?: string; profileImage?: string | null }) => void,
  userIdToProfileImage?: Record<string, string | null | undefined>
) {
  const mentionRegex = /@\[([^\]]+)\]([^\s]*)|(@[^\s]+)/g;
  const parts: { type: "text" | "mention"; text: string; userId?: string; name?: string }[] = [];
  let match;
  let lastIndex = 0;
  while ((match = mentionRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", text: text.slice(lastIndex, match.index) });
    }
    if (match[1]) {
      parts.push({ type: "mention", text: `@${match[2]}`, userId: match[1], name: match[2] });
    } else {
      parts.push({ type: "mention", text: match[3] });
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ type: "text", text: text.slice(lastIndex) });
  }
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignSelf: "flex-start", maxWidth: BUBBLE_WIDTH }}>
      {parts.map((part, i) => {
        if (part.type === "text") {
          return <Text key={i} style={baseStyle}>{part.text}</Text>;
        }
        const mentionStyle = [baseStyle, { color: MENTION_COLOR }];
        if (part.userId && onOpenProfile) {
          const profileImage = userIdToProfileImage?.[part.userId] ?? null;
          return (
            <TouchableOpacity
              key={i}
              onPress={() => onOpenProfile({ userId: part.userId!, name: part.name, profileImage })}
              activeOpacity={0.6}
              style={{ alignSelf: "baseline" }}
            >
              <Text style={mentionStyle}>{part.text}</Text>
            </TouchableOpacity>
          );
        }
        return <Text key={i} style={mentionStyle}>{part.text}</Text>;
      })}
    </View>
  );
}

function getImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
  const base = API_BASE_URL.replace(/\/$/, "");
  return url.startsWith("/") ? `${base}${url}` : `${base}/uploads/${url.replace(/^\//, "")}`;
}

const BG_DARK = "#1a1625";
const TEXT_LIGHT = "#f5f3ff";
const BUBBLE_WIDTH = Math.min(260, Dimensions.get("window").width * 0.78);

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

export default function GroupChatScreen({ user, onBack, onOpenUsers, onOpenProfile }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [mySlotIndex, setMySlotIndex] = useState<number | null>(null);
  const [messages, setMessages] = useState<GroupChatMessage[]>(() => getGroupChatMessagesCache());
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [inputText, setInputText] = useState("");
  const [mentionPrefix, setMentionPrefix] = useState<string | null>(null);
  const [mentionData, setMentionData] = useState<{ userId: string; name: string; profileImage?: string | null } | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [bubbleMenu, setBubbleMenu] = useState<{ text: string; fromId: string; fromName: string } | null>(null);
  const [replyTo, setReplyTo] = useState<{ replyToText: string; replyToFromId: string; replyToFromName: string } | null>(null);
  const flatRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const currentUserId = user?.id || "";

  const userIdToProfileImageMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of messages) {
      if (m.fromId && m.fromProfileImage && !map[m.fromId]) {
        map[m.fromId] = getImageUrl(m.fromProfileImage);
      }
    }
    return map;
  }, [messages]);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

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

  const handleMention = useCallback((fromId: string, fromName: string, fromProfileImage?: string | null) => {
    setMentionPrefix(`@${fromName} `);
    setMentionData({ userId: fromId, name: fromName, profileImage: fromProfileImage });
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleBubbleLongPress = useCallback((item: GroupChatMessage) => {
    setBubbleMenu({ text: item.text, fromId: item.fromId, fromName: item.fromName });
  }, []);

  const handleReplyFromMenu = useCallback(() => {
    if (!bubbleMenu) return;
    setReplyTo({
      replyToText: bubbleMenu.text,
      replyToFromId: bubbleMenu.fromId,
      replyToFromName: bubbleMenu.fromName,
    });
    setBubbleMenu(null);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [bubbleMenu]);

  const handleCopyFromMenu = useCallback(async () => {
    if (!bubbleMenu) return;
    await Clipboard.setStringAsync(bubbleMenu.text);
    setBubbleMenu(null);
  }, [bubbleMenu]);

  const handleSend = useCallback(async () => {
    const prefix = mentionData ? `@[${mentionData.userId}]${mentionData.name} ` : (mentionPrefix || "");
    const fullText = (prefix + inputText).trim();
    if (!fullText) return;
    setInputText("");
    setMentionPrefix(null);
    setMentionData(null);
    const replyPayload = replyTo ? { replyToText: replyTo.replyToText, replyToFromId: replyTo.replyToFromId, replyToFromName: replyTo.replyToFromName } : undefined;
    setReplyTo(null);
    Keyboard.dismiss();
    const tempId = `temp_${Date.now()}`;
    const optimistic: GroupChatMessage = {
      id: tempId,
      fromId: currentUserId,
      fromName: user?.name || "مستخدم",
      fromProfileImage: user?.profileImage ?? null,
      text: fullText,
      createdAt: new Date().toISOString(),
      replyToText: replyPayload?.replyToText ?? null,
      replyToFromId: replyPayload?.replyToFromId ?? null,
      replyToFromName: replyPayload?.replyToFromName ?? null,
    };
    setMessages((prev) => {
      const next = [...prev, optimistic];
      setGroupChatMessagesCache(next);
      return next;
    });
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 50);
    const msg = await sendGroupChatMessage(fullText, replyPayload);
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
  }, [inputText, mentionPrefix, mentionData, replyTo, currentUserId, user?.name, user?.profileImage]);

  const avatarSize = expanded ? (SCREEN_WIDTH - 32 - AVATAR_GAP * (AVATAR_COLS + 1)) / AVATAR_COLS : 32;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: BG_DARK }]}
      behavior={Platform.OS === "ios" ? "padding" : "padding"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
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
            keyboardShouldPersistTaps="handled"
            data={messages}
            renderItem={({ item }) => {
              const isMe = item.fromId === currentUserId;
              const diamonds = item.fromDiamonds ?? 0;
              const chargedGold = item.fromChargedGold ?? 0;
              return (
                <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
                  <View style={[styles.msgSenderCol, isMe && styles.msgSenderColMe]}>
                    <View style={styles.msgImageNameRow}>
                      <TouchableOpacity
                        activeOpacity={1}
                        onLongPress={() => handleMention(item.fromId, item.fromName, item.fromProfileImage)}
                        delayLongPress={400}
                      >
                        {item.fromProfileImage ? (
                          <Image source={{ uri: getImageUrl(item.fromProfileImage) }} style={styles.msgAvatarSquare} />
                        ) : (
                          <View style={[styles.msgAvatarSquare, styles.placeholderAvatar]}>
                            <Ionicons name="person" size={12} color={TEXT_MUTED} />
                          </View>
                        )}
                      </TouchableOpacity>
                      <View style={styles.msgNameGemsCol}>
                        <Text style={styles.msgSenderName} numberOfLines={1}>
                          {item.fromName}
                        </Text>
                        <View style={styles.msgGemsRow}>
                          <View style={styles.msgGemItem}>
                            <Ionicons name="diamond" size={10} color="#60a5fa" />
                            <Text style={styles.msgGemCount}>{diamonds === 0 ? "0" : Number(diamonds).toFixed(1)}</Text>
                          </View>
                          <View style={styles.msgGemItem}>
                            <Ionicons name="diamond" size={10} color="#f472b6" />
                            <Text style={styles.msgGemCount}>{Number(chargedGold)}</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                    <Pressable
                      style={[styles.msgBubble, isMe && styles.msgBubbleMe]}
                      onLongPress={() => handleBubbleLongPress(item)}
                      delayLongPress={400}
                    >
                      {item.replyToText ? (
                        <View style={[styles.msgReplyBox, isMe && styles.msgReplyBoxMe]}>
                          <Text style={[styles.msgReplyLabel, isMe && styles.msgReplyLabelMe]} numberOfLines={1}>
                            {item.replyToFromName || "رد"}
                          </Text>
                          <Text style={[styles.msgReplyText, isMe && styles.msgReplyTextMe]} numberOfLines={2}>
                            {item.replyToText}
                          </Text>
                        </View>
                      ) : null}
                      {renderMessageWithMentions(item.text, [styles.msgText, isMe ? styles.msgTextMe : styles.msgTextOther], onOpenProfile, userIdToProfileImageMap)}
                      <Text style={[styles.msgTime, isMe ? styles.msgTimeMe : styles.msgTimeOther]}>
                        {item.createdAt ? new Date(item.createdAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }) : ""}
                      </Text>
                    </Pressable>
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

      <Modal visible={!!bubbleMenu} transparent animationType="fade">
        <Pressable style={styles.bubbleMenuOverlay} onPress={() => setBubbleMenu(null)}>
          <TouchableOpacity style={styles.bubbleMenuCard} activeOpacity={1} onPress={() => {}}>
            <TouchableOpacity style={styles.bubbleMenuBtn} onPress={handleReplyFromMenu} activeOpacity={0.7}>
              <Ionicons name="arrow-undo" size={16} color={TEXT_LIGHT} />
              <Text style={styles.bubbleMenuBtnText}>رد</Text>
            </TouchableOpacity>
            <View style={styles.bubbleMenuDivider} />
            <TouchableOpacity style={styles.bubbleMenuBtn} onPress={handleCopyFromMenu} activeOpacity={0.7}>
              <Ionicons name="copy-outline" size={16} color={TEXT_LIGHT} />
              <Text style={styles.bubbleMenuBtnText}>نسخ</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </Pressable>
      </Modal>

      {replyTo ? (
        <View style={styles.replyPreviewRow}>
          <TouchableOpacity
            style={styles.replyPreview}
            onPress={() => setReplyTo(null)}
            activeOpacity={0.8}
          >
            <View style={styles.replyPreviewContent}>
              <Text style={styles.replyPreviewLabel}>رد على {replyTo.replyToFromName}</Text>
              <Text style={styles.replyPreviewText} numberOfLines={2}>{replyTo.replyToText}</Text>
            </View>
            <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        </View>
      ) : null}
      <View style={[styles.inputRow, keyboardVisible && styles.inputRowKeyboardUp]}>
        <View style={styles.inputWrap}>
          {mentionPrefix ? (
              <TouchableOpacity onPress={() => { setMentionPrefix(null); setMentionData(null); }} activeOpacity={0.7}>
                <Text style={styles.mentionText}>{mentionPrefix}</Text>
              </TouchableOpacity>
            ) : null}
            <TextInput
              ref={inputRef}
              style={[styles.input, mentionPrefix ? styles.inputWithMention : null]}
              placeholder={mentionPrefix ? "" : "اكتب رسالة..."}
              placeholderTextColor={TEXT_MUTED}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />
        </View>
          <TouchableOpacity style={styles.sendBtn} onPress={handleSend} activeOpacity={0.8}>
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
    </KeyboardAvoidingView>
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
    maxWidth: BUBBLE_WIDTH,
  },
  msgSenderColMe: {
    alignItems: "flex-end",
  },
  msgImageNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  msgNameGemsCol: {
    flexDirection: "column",
    gap: 4,
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
    alignSelf: "flex-start",
    maxWidth: BUBBLE_WIDTH,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  msgBubbleMe: {
    alignSelf: "flex-end",
    backgroundColor: ACCENT,
    borderColor: "rgba(167, 139, 250, 0.5)",
  },
  msgReplyBox: {
    backgroundColor: "rgba(0,0,0,0.06)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: "rgba(0,0,0,0.2)",
  },
  msgReplyBoxMe: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderLeftColor: "rgba(255,255,255,0.5)",
  },
  msgReplyLabel: { fontSize: 10, color: "rgba(0,0,0,0.5)", marginBottom: 2 },
  msgReplyLabelMe: { color: "rgba(255,255,255,0.8)" },
  msgReplyText: { fontSize: 12, color: "#374151" },
  msgReplyTextMe: { color: "rgba(255,255,255,0.95)" },
  msgName: { fontSize: 11, color: ACCENT, marginBottom: 2 },
  msgText: { fontSize: 13, lineHeight: 19 },
  msgTextMe: { color: "#ffffff" },
  msgTextOther: { color: "#1f2937" },
  msgTime: { fontSize: 10, marginTop: 4 },
  msgTimeMe: { color: "rgba(255,255,255,0.85)" },
  msgTimeOther: { color: "rgba(0,0,0,0.5)" },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    paddingBottom: Platform.OS === "ios" ? 36 : 38,
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    backgroundColor: BG_DARK,
  },
  inputRowKeyboardUp: {
    paddingBottom: 6,
  },
  bubbleMenuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  bubbleMenuCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.75)",
    borderRadius: 12,
    paddingHorizontal: 4,
    paddingVertical: 6,
    gap: 4,
  },
  bubbleMenuBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleMenuBtnText: { fontSize: 14, color: TEXT_LIGHT, fontWeight: "600" },
  bubbleMenuDivider: { width: 1, height: 20, backgroundColor: "rgba(255,255,255,0.3)" },
  replyPreviewRow: {
    paddingHorizontal: 10,
    paddingBottom: 6,
    paddingTop: 4,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
    backgroundColor: BG_DARK,
  },
  replyPreview: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  replyPreviewContent: { flex: 1 },
  replyPreviewLabel: { fontSize: 11, color: "rgba(255,255,255,0.8)", marginBottom: 2 },
  replyPreviewText: { fontSize: 12, color: TEXT_LIGHT },
  inputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: CARD_BG,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.2)",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  mentionText: {
    fontSize: 14,
    color: MENTION_COLOR,
    marginRight: 4,
  },
  input: {
    flex: 1,
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    paddingVertical: 0,
    fontSize: 14,
    color: TEXT_LIGHT,
  },
  inputWithMention: {
    minWidth: 60,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
});