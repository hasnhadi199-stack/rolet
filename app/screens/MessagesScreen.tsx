import { StyleSheet, Text, View, Image, TouchableOpacity, ScrollView, AppState } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState, useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";
import { fetchInbox, getCachedInbox, fetchOnlineUserIds, fetchGroupChatMessages, getGroupChatMessagesCache, type InboxItem } from "../../utils/messagesApi";
import type { UserSearchResult } from "../../utils/usersApi";
import { API_BASE_URL } from "../../utils/authHelper";
import { useLanguage } from "../_contexts/LanguageContext";
import { useTheme } from "../_contexts/ThemeContext";

const TEXT_LIGHT = "#f5f3ff";
const TEXT_MUTED = "#a1a1aa";
const ONLINE_GREEN = "#22c55e";

function toFullImageUrl(url: string | null | undefined): string {
  if (!url?.trim()) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
  const base = API_BASE_URL.replace(/\/$/, "");
  if (url.startsWith("/")) return `${base}${url}`;
  if (url.startsWith("uploads/")) return `${base}/${url}`;
  return `${base}/uploads/${url.replace(/^\//, "")}`;
}

type Props = {
  onOpenChat: (user: UserSearchResult) => void;
  onOpenGroupChat?: () => void;
};

export default function MessagesScreen({ onOpenChat, onOpenGroupChat }: Props) {
  const { t, lang } = useLanguage();
  const { theme } = useTheme();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [lastGroupMsg, setLastGroupMsg] = useState<{ text: string; createdAt: string } | null>(null);

  const loadData = useCallback(() => {
    fetchInbox().then(setItems);
    fetchOnlineUserIds().then((ids) => setOnlineIds(new Set(ids)));
    fetchGroupChatMessages().then((msgs) => {
      const last = msgs[msgs.length - 1] ?? getGroupChatMessagesCache().slice(-1)[0];
      setLastGroupMsg(last ? { text: last.text || "رسالة", createdAt: last.createdAt } : null);
    }).catch(() => {
      const cached = getGroupChatMessagesCache();
      const last = cached[cached.length - 1];
      setLastGroupMsg(last ? { text: last.text || "رسالة", createdAt: last.createdAt } : null);
    });
  }, []);

  useEffect(() => {
    getCachedInbox().then(setItems);
    loadData();
    const interval = setInterval(loadData, 1500);
    return () => clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") loadData();
    });
    return () => sub.remove();
  }, [loadData]);

  const itemsWithOnline = items.map((m) => ({
    ...m,
    otherIsOnline: m.otherIsOnline ?? onlineIds.has(m.otherId),
  }));

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Text style={[styles.title, { color: theme.textLight }]}>{t("messages.title")}</Text>

      {/* مسؤول men — أيقونة جميلة مع خلفية جذابة */}
      <LinearGradient
        colors={["#7c3aed", "#a78bfa", "#c4b5fd", "#a78bfa"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.menAdminBanner}
      >
        <View style={styles.menAdminIconWrap}>
          <Ionicons name="shield-checkmark" size={22} color="#fff" />
        </View>
        <View style={styles.menAdminTextCol}>
          <Text style={styles.menAdminText}>مسؤول men</Text>
          <Text style={styles.menAdminSub}>الدعم الرسمي</Text>
        </View>
      </LinearGradient>

      {/* دردشة جماعية — صف شبيه بالرسائل الخاصة */}
      <TouchableOpacity
        activeOpacity={0.5}
        onPress={onOpenGroupChat}
        disabled={!onOpenGroupChat}
        style={styles.row}
      >
        <View style={styles.avatarWrap}>
          <View style={[styles.avatar, styles.groupChatAvatar]}>
            <Ionicons name="people" size={22} color="#14b8a6" />
          </View>
        </View>
        <View style={styles.rowText}>
          <Text style={styles.name} numberOfLines={1}>دردشة جماعية</Text>
          <Text style={styles.preview} numberOfLines={1}>
            {lastGroupMsg?.text ?? "تواصل مع الجميع"}
          </Text>
        </View>
        <Text style={styles.time}>
          {lastGroupMsg?.createdAt
            ? new Date(lastGroupMsg.createdAt).toLocaleTimeString(lang === "ar" ? "ar-SA" : "en-US", { hour: "2-digit", minute: "2-digit" })
            : ""}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={TEXT_MUTED} />
      </TouchableOpacity>

      {items.length === 0 ? (
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>{t("messages.empty")}</Text>
      ) : (
        <ScrollView scrollEventThrottle={16}>
          {itemsWithOnline.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={styles.row}
              activeOpacity={0.5}
              onPress={() =>
                onOpenChat({
                  id: m.otherId,
                  name: m.otherName,
                  profileImage: m.otherProfileImage,
                  age: m.otherAge ?? null,
                  country: m.otherCountry ?? "",
                  gender: m.otherGender ?? "",
                })
              }
            >
              <View style={styles.avatarWrap}>
                {m.otherProfileImage ? (
                  <Image
                    source={{ uri: toFullImageUrl(m.otherProfileImage) || m.otherProfileImage }}
                    style={styles.avatar}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Ionicons name="person" size={20} color={TEXT_MUTED} />
                  </View>
                )}
                {m.otherIsOnline === true && <View style={styles.onlineDot} />}
              </View>
              <View style={styles.rowText}>
                <Text style={styles.name} numberOfLines={1}>
                  {m.otherName}
                </Text>
                <Text style={styles.preview} numberOfLines={1}>
                  {m.direction === "out" ? t("messages.mePrefix") : ""}{m.text}
                </Text>
              </View>
              <Text style={styles.time}>
                {new Date(m.createdAt).toLocaleTimeString(lang === "ar" ? "ar-SA" : "en-US", { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 20,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: TEXT_LIGHT,
    marginBottom: 6,
    paddingHorizontal: 18,
    letterSpacing: 0.25,
  },
  subtitle: {
    fontSize: 12,
    paddingHorizontal: 18,
    letterSpacing: 0.2,
  },
  menAdminBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 18,
    marginBottom: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    gap: 10,
    overflow: "hidden",
    shadowColor: "#7c3aed",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  menAdminIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  menAdminTextCol: {
    flex: 1,
    gap: 1,
  },
  menAdminText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.25,
  },
  menAdminSub: {
    fontSize: 10,
    color: "rgba(255,255,255,0.9)",
    letterSpacing: 0.2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 10,
    gap: 12,
  },
  avatarWrap: {
    position: "relative",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "rgba(15,23,42,0.9)",
  },
  avatarPlaceholder: {
    backgroundColor: "rgba(45,38,64,0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  groupChatAvatar: {
    backgroundColor: "#0d948822",
    alignItems: "center",
    justifyContent: "center",
  },
  onlineDot: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ONLINE_GREEN,
    borderWidth: 1.5,
    borderColor: "#1a1625",
  },
  rowText: {
    flex: 1,
    gap: 1,
  },
  name: {
    fontSize: 13,
    fontWeight: "600",
    color: TEXT_LIGHT,
    letterSpacing: 0.2,
  },
  preview: {
    fontSize: 11,
    color: TEXT_MUTED,
    letterSpacing: 0.15,
  },
  time: {
    fontSize: 10,
    color: TEXT_MUTED,
    letterSpacing: 0.2,
  },
});
