import { StyleSheet, Text, View, TouchableOpacity, Image, TextInput, Platform, ScrollView, KeyboardAvoidingView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { UserSearchResult } from "../../utils/usersApi";
import { useEffect, useRef, useState } from "react";
import { sendMessage, fetchThread, type ChatMessage } from "../../utils/messagesApi";

type CurrentUser = {
  id?: string;
  name?: string;
  profileImage?: string;
};

type Props = {
  me: CurrentUser | null;
  other: UserSearchResult;
  onBack: () => void;
};

const BG = "#141028";
const TEXT_LIGHT = "#f5f3ff";
const TEXT_MUTED = "#a1a1aa";
const INPUT_BG = "rgba(255,255,255,0.04)";

export default function ChatScreen({ me, other, onBack }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const scrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    fetchThread(other.id).then((list) => setMessages(list));
  }, [other.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const handleSend = async () => {
    if (!me?.id || !text.trim()) return;
    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`,
      fromId: me.id,
      toId: other.id,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setText("");
    const sent = await sendMessage(other.id, optimistic.text);
    if (sent) {
      setMessages((prev) =>
        prev.map((m) => (m.id === optimistic.id ? sent : m))
      );
    }
  };
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 0}
    >
      <View style={styles.container}>
        {/* Header مع الصورتين و ID */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={22} color={TEXT_LIGHT} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.avatarsRow}>
              {me?.profileImage ? (
                <Image source={{ uri: me.profileImage }} style={styles.headerAvatarSmall} />
              ) : (
                <View style={[styles.headerAvatarSmall, styles.avatarPlaceholder]}>
                  <Ionicons name="person" size={18} color={TEXT_MUTED} />
                </View>
              )}
              {other.profileImage ? (
                <Image source={{ uri: other.profileImage }} style={styles.headerAvatarSmall} />
              ) : (
                <View style={[styles.headerAvatarSmall, styles.avatarPlaceholder]}>
                  <Ionicons name="person" size={18} color={TEXT_MUTED} />
                </View>
              )}
            </View>
            <Text style={styles.otherName} numberOfLines={1}>
              {other.name}
            </Text>
            <Text style={styles.otherId}>{other.id}</Text>
          </View>
          <View style={{ width: 32 }} />
        </View>

        {/* محتوى المحادثة */}
        <ScrollView style={styles.messagesContainer} ref={scrollRef}>
        {messages.map((m) => {
          const isMine = m.fromId === me?.id;
          return (
            <View key={m.id} style={isMine ? styles.myMsgRow : styles.otherMsgRow}>
              {!isMine && (
                other.profileImage ? (
                  <Image source={{ uri: other.profileImage }} style={styles.msgAvatar} />
                ) : (
                  <View style={[styles.msgAvatar, styles.avatarPlaceholder]}>
                    <Ionicons name="person" size={18} color={TEXT_MUTED} />
                  </View>
                )
              )}
              <View style={isMine ? styles.myMsgBubble : styles.otherMsgBubble}>
                <Text style={isMine ? styles.myMsgText : styles.otherMsgText}>{m.text}</Text>
              </View>
              {isMine && (
                me?.profileImage ? (
                  <Image source={{ uri: me.profileImage }} style={styles.msgAvatar} />
                ) : (
                  <View style={[styles.msgAvatar, styles.avatarPlaceholder]}>
                    <Ionicons name="person" size={18} color={TEXT_MUTED} />
                  </View>
                )
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* شريط الإدخال في الأسفل */}
      <View style={styles.inputArea}>
        <View style={styles.topInputRow}>
          <TouchableOpacity style={styles.doubleArrow} activeOpacity={0.8}>
            <Ionicons name="chevron-back-outline" size={18} color={TEXT_LIGHT} />
          </TouchableOpacity>
          <View style={styles.sharedLabelWrap}>
            <Text style={styles.sharedLabel}>رسائل مشتركة</Text>
            <Ionicons name="pencil" size={14} color={TEXT_MUTED} />
          </View>
        </View>

        <View style={styles.mainInputRow}>
          <TextInput
            style={styles.textInput}
            placeholder="اكتب رسالة..."
            placeholderTextColor={TEXT_MUTED}
            multiline
            value={text}
            onChangeText={setText}
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleSend}
            disabled={!text.trim()}
          >
            <Ionicons name="send" size={22} color={text.trim() ? "#4ade80" : TEXT_MUTED} />
          </TouchableOpacity>
        </View>

        <View style={styles.bottomActions}>
          <View style={styles.leftActions}>
            <TouchableOpacity activeOpacity={0.8}>
              <Ionicons name="mic-outline" size={22} color={TEXT_MUTED} />
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.8}>
              <Ionicons name="happy-outline" size={22} color={TEXT_MUTED} />
            </TouchableOpacity>
          </View>
          <View style={styles.rightActions}>
            <TouchableOpacity activeOpacity={0.8}>
              <Ionicons name="image-outline" size={22} color={TEXT_MUTED} />
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.8}>
              <Ionicons name="gift-outline" size={22} color="#fbbf24" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, paddingTop: Platform.OS === "ios" ? 40 : 20 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.25)",
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.85)",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  avatarsRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    marginBottom: 2,
  },
  headerAvatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.9)",
    marginLeft: -8,
  },
  avatarPlaceholder: {
    backgroundColor: "rgba(31,41,55,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  otherName: {
    fontSize: 15,
    fontWeight: "700",
    color: TEXT_LIGHT,
  },
  otherId: {
    fontSize: 11,
    color: TEXT_MUTED,
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  timeChip: {
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.9)",
    marginBottom: 12,
  },
  timeChipText: {
    fontSize: 11,
    color: TEXT_MUTED,
  },
  myMsgRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-end",
    marginBottom: 8,
  },
  otherMsgRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 8,
  },
  myMsgBubble: {
    maxWidth: "70%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    backgroundColor: "#a855f7",
  },
  myMsgText: {
    fontSize: 14,
    color: "#fff",
  },
  otherMsgBubble: {
    maxWidth: "70%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    backgroundColor: "rgba(15,23,42,0.9)",
  },
  otherMsgText: {
    fontSize: 14,
    color: TEXT_LIGHT,
  },
  msgAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginLeft: 8,
  },
  inputArea: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(15,23,42,0.9)",
    backgroundColor: BG,
    gap: 8,
  },
  topInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  doubleArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(79,70,229,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  sharedLabelWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  sharedLabel: {
    fontSize: 12,
    color: TEXT_MUTED,
  },
  mainInputRow: {
    backgroundColor: INPUT_BG,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  textInput: {
    flex: 1,
    minHeight: 22,
    maxHeight: 80,
    color: TEXT_LIGHT,
    textAlignVertical: "center",
  },
  bottomActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  leftActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  rightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
});

