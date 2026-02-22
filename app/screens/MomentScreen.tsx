import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { fetchMoments, createMoment, toggleMomentLike, type Moment } from "../../utils/momentsApi";

const TEXT_LIGHT = "#f5f3ff";
const TEXT_MUTED = "#a1a1aa";
const ACCENT_SOFT = "#c4b5fd";
const ACCENT_MUTED = "rgba(167, 139, 250, 0.25)";
const CARD_BG = "rgba(45, 38, 64, 0.8)";
const PURPLE_DARK = "#1a1625";
const MAX_VIDEO_SEC = 13;
const CARD_SHADOW = Platform.select({
  ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12 },
  android: { elevation: 6 },
});

function ageFromUser(user: { age?: number | null; dateOfBirth?: string }): number | null {
  if (typeof user.age === "number") return user.age;
  if (!user.dateOfBirth) return null;
  const y = parseInt(user.dateOfBirth.slice(0, 4), 10);
  const m = parseInt(user.dateOfBirth.slice(5, 7), 10);
  if (isNaN(y) || isNaN(m)) return null;
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m) age -= 1;
  return age >= 0 ? age : null;
}

type User = {
  id?: string;
  name?: string;
  email: string;
  age?: number | null;
  dateOfBirth?: string;
};

type Props = { user: User };

export default function MomentScreen({ user }: Props) {
  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [posting, setPosting] = useState(false);

  const loadMoments = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const list = await fetchMoments();
      setMoments(list);
    } catch {
      setMoments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadMoments();
  }, [loadMoments]);

  const handleAddMoment = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("تنبيه", "يجب السماح بالوصول للصور والفيديو");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const isVideo = asset.type === "video";
    const durationMillis = asset.duration ?? 0;
    const durationSec = Math.ceil(durationMillis / 1000);

    if (isVideo && durationSec > MAX_VIDEO_SEC) {
      Alert.alert("فيديو طويل", `الحد الأقصى للفيديو ${MAX_VIDEO_SEC} ثوانٍ. المدة المختارة: ${durationSec} ثانية.`);
      return;
    }

    setPosting(true);
    try {
      const userId = user.id || user.email?.split("@")[0] || "";
      const moment = await createMoment({
        uri: asset.uri,
        mediaType: isVideo ? "video" : "image",
        durationSeconds: isVideo ? durationSec : undefined,
        userId,
        userName: user.name || "مستخدم",
        userAge: ageFromUser(user),
      });
      if (moment) {
        setMoments((prev) => [moment, ...prev]);
      } else {
        Alert.alert("تنبيه", "تعذر النشر. تأكد من الاتصال أو أن الخادم يدعم اللحظات.");
      }
    } catch (e) {
      Alert.alert("خطأ", (e as Error)?.message || "تعذر رفع اللحظة");
    } finally {
      setPosting(false);
    }
  }, [user]);

  const handleLike = useCallback(async (moment: Moment) => {
    const res = await toggleMomentLike(moment.id);
    if (res)
      setMoments((prev) =>
        prev.map((m) =>
          m.id === moment.id ? { ...m, likeCount: res.likeCount, likedByMe: res.likedByMe } : m
        )
      );
  }, []);

  const renderMoment = useCallback(
    ({ item }: { item: Moment }) => (
      <View style={[styles.card, CARD_SHADOW]}>
        <View style={styles.mediaWrap}>
          {item.mediaType === "image" ? (
            <Image source={{ uri: item.mediaUrl }} style={styles.media} resizeMode="cover" />
          ) : (
            <View style={styles.videoPlaceholder}>
              <Ionicons name="videocam" size={48} color={ACCENT_SOFT} />
              <Text style={styles.videoLabel}>فيديو {item.durationSeconds ? `(${item.durationSeconds} ث)` : ""}</Text>
            </View>
          )}
        </View>
        <View style={styles.cardFooter}>
          <View style={styles.userRow}>
            <View style={styles.avatarSmall}>
              <Ionicons name="person" size={18} color={ACCENT_SOFT} />
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.momentLabel}>لحظة</Text>
              <Text style={styles.userName}>{item.userName}</Text>
              <Text style={styles.userMeta}>
                {item.userAge != null ? `${item.userAge} سنة` : ""}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.likeBtn}
            onPress={() => handleLike(item)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={item.likedByMe ? "heart" : "heart-outline"}
              size={24}
              color={item.likedByMe ? "#f43f5e" : TEXT_LIGHT}
            />
            <Text style={styles.likeCount}>{item.likeCount}</Text>
          </TouchableOpacity>
        </View>
      </View>
    ),
    [handleLike]
  );

  if (loading && moments.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={ACCENT_SOFT} />
        <Text style={styles.loadingText}>جاري تحميل اللحظات...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>لحظة</Text>
        <Text style={styles.subtitle}>شارك لحظاتك مع الجميع (صورة أو فيديو حتى ١٣ ثانية)</Text>
      </View>

      <FlatList
        data={moments}
        renderItem={renderMoment}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadMoments(true)} tintColor={ACCENT_SOFT} />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="images-outline" size={56} color={TEXT_MUTED} />
            <Text style={styles.emptyTitle}>لا توجد لحظات بعد</Text>
            <Text style={styles.emptySub}>انشر أول لحظة بالضغط على الزر أدناه</Text>
            <Text style={styles.emptyHint}>
              إذا ظهر خطأ 404 فمعناه أن الخادم لم يفعّل مسار اللحظات بعد. سيظهر المحتوى عند تفعيله.
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={[styles.fab, posting && styles.fabDisabled]}
        onPress={handleAddMoment}
        disabled={posting}
        activeOpacity={0.85}
      >
        {posting ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Ionicons name="add" size={28} color="#fff" />
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PURPLE_DARK, paddingTop: 16 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: PURPLE_DARK, gap: 12 },
  loadingText: { fontSize: 14, color: TEXT_MUTED },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  title: { fontSize: 24, fontWeight: "800", color: TEXT_LIGHT, marginBottom: 4 },
  subtitle: { fontSize: 13, color: TEXT_MUTED },
  listContent: { paddingHorizontal: 20, paddingBottom: 100 },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.12)",
  },
  mediaWrap: { width: "100%", aspectRatio: 1, backgroundColor: ACCENT_MUTED },
  media: { width: "100%", height: "100%" },
  videoPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  videoLabel: { fontSize: 12, color: TEXT_MUTED, marginTop: 8 },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
  },
  userRow: { flexDirection: "row", alignItems: "center", flex: 1 },
  avatarSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ACCENT_MUTED,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
  userInfo: { flex: 1 },
  momentLabel: { fontSize: 11, color: ACCENT_SOFT, fontWeight: "600", marginBottom: 2 },
  userName: { fontSize: 15, fontWeight: "700", color: TEXT_LIGHT },
  userMeta: { fontSize: 12, color: TEXT_MUTED, marginTop: 2 },
  likeBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 12 },
  likeCount: { fontSize: 14, fontWeight: "700", color: TEXT_LIGHT },
  emptyWrap: { alignItems: "center", paddingVertical: 48, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: TEXT_LIGHT },
  emptySub: { fontSize: 14, color: TEXT_MUTED },
  emptyHint: {
    fontSize: 12,
    color: TEXT_MUTED,
    textAlign: "center",
    marginTop: 16,
    paddingHorizontal: 24,
  },
  fab: {
    position: "absolute",
    bottom: 24,
    left: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#A855F7",
    alignItems: "center",
    justifyContent: "center",
    ...CARD_SHADOW,
  },
  fabDisabled: { opacity: 0.7 },
});
