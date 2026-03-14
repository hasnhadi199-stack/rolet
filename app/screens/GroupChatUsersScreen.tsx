import React, { useCallback, useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Platform,
  ScrollView,
  Image,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_SIZE = (SCREEN_WIDTH - 10 * 2 - 8 * 2) / 3;
import { Ionicons } from "@expo/vector-icons";
import { fetchGroupChatUsers, type GroupChatUser } from "../../utils/messagesApi";
import { API_BASE_URL } from "../../utils/authHelper";

const BG_DARK = "#1a1625";
const TEXT_LIGHT = "#f5f3ff";
const TEXT_MUTED = "#a1a1aa";
const CARD_BG = "rgba(45, 38, 64, 0.6)";

function getImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
  const base = API_BASE_URL.replace(/\/$/, "");
  return url.startsWith("/") ? `${base}${url}` : `${base}/uploads/${url.replace(/^\//, "")}`;
}

type Props = {
  onBack: () => void;
};

export default function GroupChatUsersScreen({ onBack }: Props) {
  const [users, setUsers] = useState<GroupChatUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadUsers = useCallback(async () => {
    const list = await fetchGroupChatUsers();
    setUsers(list);
  }, []);

  useEffect(() => {
    setLoading(true);
    loadUsers().finally(() => setLoading(false));
  }, [loadUsers]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadUsers();
    setRefreshing(false);
  }, [loadUsers]);

  return (
    <View style={[styles.container, { backgroundColor: BG_DARK }]}>
      <View style={styles.bgIconWrap}>
        <Ionicons name="chatbubbles" size={140} color="rgba(167, 139, 250, 0.06)" />
      </View>

      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={22} color={TEXT_LIGHT} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>المشاركون</Text>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color="#a78bfa" />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#a78bfa" size="small" />
          }
        >
          {users.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="people-outline" size={32} color={TEXT_MUTED} />
              <Text style={styles.emptyText}>لا يوجد مشاركون حالياً</Text>
            </View>
          ) : (
            <View style={styles.userGrid}>
              {users.map((u) => (
                <View key={u.userId} style={styles.userCard}>
                  {u.profileImage ? (
                    <Image source={{ uri: getImageUrl(u.profileImage) }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <Ionicons name="person" size={16} color={TEXT_MUTED} />
                    </View>
                  )}
                  <Text style={styles.userName} numberOfLines={1}>{u.name || u.userId}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: Platform.OS === "ios" ? 40 : 20 },
  bgIconWrap: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -70,
    marginTop: -70,
    opacity: 0.5,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 2,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: TEXT_LIGHT,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { flex: 1 },
  content: { padding: 10, paddingBottom: 24 },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: TEXT_MUTED,
  },
  userGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "flex-start",
  },
  userCard: {
    width: CARD_SIZE,
    alignItems: "center",
    backgroundColor: CARD_BG,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.1)",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginBottom: 4,
  },
  avatarPlaceholder: {
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  userName: {
    fontSize: 11,
    fontWeight: "600",
    color: TEXT_LIGHT,
    textAlign: "center",
  },
});
