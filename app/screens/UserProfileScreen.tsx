import { useCallback, useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  Platform,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Video, ResizeMode } from "expo-av";
import * as Clipboard from "expo-clipboard";
import { getFlagEmoji, getCountryName } from "../../utils/countries";
import { API_BASE_URL } from "../../utils/authHelper";
import { fetchMoments, toggleMomentLike, type Moment } from "../../utils/momentsApi";
import type { UserSearchResult } from "../../utils/usersApi";

function getFullMediaUrl(url: string): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const base = API_BASE_URL.replace(/\/$/, "");
  return url.startsWith("/") ? `${base}${url}` : `${base}/uploads/${url.replace(/^\//, "")}`;
}

const ACCENT_SOFT = "#c4b5fd";
const ACCENT_MUTED = "rgba(167, 139, 250, 0.25)";
const TEXT_LIGHT = "#f5f3ff";
const TEXT_MUTED = "#a1a1aa";
const CARD_BG = "rgba(45, 38, 64, 0.6)";
const BORDER_SOFT = "rgba(167, 139, 250, 0.2)";
const HEART_COLOR = "#f472b6";
const ADD_COLOR = "#34d399";
const MESSAGE_COLOR = "#60a5fa";
const GIFT_COLOR = "#fbbf24";
const PINK_BG = "rgba(244,114,182,0.25)";
const BLUE_BG = "rgba(96,165,250,0.25)";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const IMAGE_SIZE = Math.min(SCREEN_WIDTH - 32, 340);
const CARD_SHADOW = Platform.select({
  ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8 },
  android: { elevation: 4 },
});

function formatRelativeTime(input: string | Date | null | undefined): string {
  if (!input) return "";
  const date = typeof input === "string" ? new Date(input) : input;
  if (isNaN(date.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "منذ لحظات";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `منذ ${diffMin} د`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `منذ ${diffHours} س`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `منذ ${diffDays} يوم`;
  return new Date(input).toLocaleDateString("ar-SA", { month: "short", day: "numeric" });
}

type Props = {
  user: UserSearchResult;
  onBack: () => void;
};

export default function UserProfileScreen({ user, onBack }: Props) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"info" | "moment">("info");
  const [moments, setMoments] = useState<Moment[]>([]);
  const [momentsLoading, setMomentsLoading] = useState(false);
  const [momentsError, setMomentsError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [mediaModal, setMediaModal] = useState<Moment | null>(null);

  const copyId = async () => {
    await Clipboard.setStringAsync(user.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const loadMoments = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setMomentsLoading(true);
    setMomentsError(null);
    try {
      const list = await fetchMoments();
      setMoments(list.filter((m) => m.userId === user.id));
    } catch {
      setMomentsError("تعذر جلب اللحظات");
      setMoments([]);
    } finally {
      setMomentsLoading(false);
      setRefreshing(false);
    }
  }, [user.id]);

  useEffect(() => {
    if (activeTab === "moment") loadMoments();
  }, [activeTab, loadMoments]);

  const handleLike = useCallback(async (moment: Moment) => {
    const res = await toggleMomentLike(moment.id);
    if (res)
      setMoments((prev) =>
        prev.map((m) => (m.id === moment.id ? { ...m, likeCount: res.likeCount, likedByMe: res.likedByMe } : m))
      );
  }, []);

  const genderColor = user.gender === "female" ? "#f472b6" : user.gender === "male" ? "#60a5fa" : ACCENT_SOFT;
  const genderBg = user.gender === "female" ? "rgba(244,114,182,0.35)" : user.gender === "male" ? "rgba(96,165,250,0.35)" : ACCENT_MUTED;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="arrow-forward" size={22} color={ACCENT_SOFT} />
          <Text style={styles.backText}>رجوع</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>الملف الشخصي</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => activeTab === "moment" && loadMoments(true)}
            tintColor={ACCENT_SOFT}
          />
        }
      >
        {/* صورة شخصية مربعة مع إطار — معلومات داخل الصورة أسفل يسار */}
        <View style={styles.profileImageWrap}>
          {user.profileImage ? (
            <Image source={{ uri: user.profileImage }} style={styles.profileImage} resizeMode="cover" />
          ) : (
            <View style={[styles.profileImage, styles.profileImagePlaceholder]}>
              <Ionicons name="person" size={100} color={TEXT_MUTED} />
            </View>
          )}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.7)"]}
            style={styles.imageOverlay}
          >
            <View style={styles.overlayContent}>
              <View style={styles.nameRow}>
                <Text style={styles.overlayName}>{user.name}</Text>
                {(user.gender || user.age != null) && (
                  <View style={[styles.ageBadge, { backgroundColor: genderBg }]}>
                    <Ionicons
                      name={user.gender === "female" ? "female" : user.gender === "male" ? "male" : "person"}
                      size={12}
                      color={genderColor}
                    />
                    <Text style={[styles.ageText, { color: genderColor }]}>
                      {user.age != null ? String(user.age) : "—"}
                    </Text>
                  </View>
                )}
              </View>
              <TouchableOpacity style={styles.idRow} onPress={copyId} activeOpacity={0.8}>
                <Text style={styles.overlayId}>{user.id}</Text>
                <Ionicons
                  name={copied ? "checkmark-circle" : "copy-outline"}
                  size={16}
                  color={copied ? "#34d399" : TEXT_MUTED}
                />
              </TouchableOpacity>
              {user.country && (
                <View style={styles.flagRow}>
                  <Text style={styles.flagEmoji}>{getFlagEmoji(user.country)}</Text>
                  <Text style={styles.flagText}>{getCountryName(user.country) || user.country}</Text>
                </View>
              )}
            </View>
          </LinearGradient>
        </View>

        {/* ماسة قيمة سحر + ماسة سحر ثروة + ليفل */}
        <View style={styles.statsRow}>
          <View style={[styles.statBadge, styles.statPink]}>
            <Ionicons name="diamond" size={16} color="#f472b6" />
            <Text style={styles.statLabel}>قيمة سحر</Text>
            <Text style={styles.statValue}>0</Text>
          </View>
          <View style={[styles.statBadge, styles.statBlue]}>
            <Ionicons name="diamond" size={16} color="#60a5fa" />
            <Text style={styles.statLabel}>سحر ثروة</Text>
            <Text style={styles.statValue}>0</Text>
          </View>
          <View style={styles.levelBadge}>
            <Ionicons name="trophy" size={14} color="#fbbf24" />
            <Text style={styles.levelText}>ليفل</Text>
          </View>
        </View>

        {/* تبويبان: معلومات | لحظة — كتابة صغيرة وجذابة */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "info" && styles.tabActive]}
            onPress={() => setActiveTab("info")}
            activeOpacity={0.8}
          >
            <Ionicons name="person-outline" size={14} color={activeTab === "info" ? "#0f172a" : TEXT_MUTED} />
            <Text style={[styles.tabText, activeTab === "info" && styles.tabTextActive]}>معلومات</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "moment" && styles.tabActive]}
            onPress={() => setActiveTab("moment")}
            activeOpacity={0.8}
          >
            <Ionicons name="sparkles-outline" size={14} color={activeTab === "moment" ? "#0f172a" : TEXT_MUTED} />
            <Text style={[styles.tabText, activeTab === "moment" && styles.tabTextActive]}>لحظة</Text>
          </TouchableOpacity>
        </View>

        {/* المحتوى حسب التبويب */}
        {activeTab === "info" ? (
          <View style={styles.infoContent}>
            <View style={[styles.infoCard, CARD_SHADOW]}>
              <View style={styles.infoRow}>
                <Ionicons name="finger-print-outline" size={18} color={ACCENT_SOFT} />
                <Text style={styles.infoLabel}>المعرف</Text>
                <Text style={styles.infoValue} numberOfLines={1}>{user.id}</Text>
                <TouchableOpacity onPress={copyId} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name={copied ? "checkmark-circle" : "copy-outline"} size={18} color={copied ? "#34d399" : ACCENT_SOFT} />
                </TouchableOpacity>
              </View>
              {user.country && (
                <>
                  <View style={styles.infoDivider} />
                  <View style={styles.infoRow}>
                    <Text style={styles.infoFlag}>{getFlagEmoji(user.country)}</Text>
                    <Text style={styles.infoLabel}>الدولة</Text>
                    <Text style={styles.infoValue}>{getCountryName(user.country) || user.country}</Text>
                  </View>
                </>
              )}
              {(user.gender || user.age != null) && (
                <>
                  <View style={styles.infoDivider} />
                  <View style={styles.infoRow}>
                    <Ionicons name={user.gender === "female" ? "female" : "male"} size={18} color={genderColor} />
                    <Text style={styles.infoLabel}>الجنس والعمر</Text>
                    <Text style={[styles.infoValue, { color: genderColor }]}>
                      {[user.gender === "male" ? "ذكر" : user.gender === "female" ? "أنثى" : "", user.age != null ? `${user.age} سنة` : ""].filter(Boolean).join(" · ") || "—"}
                    </Text>
                  </View>
                </>
              )}
              <View style={styles.infoDivider} />
              <View style={styles.infoRow}>
                <Ionicons name="resize-outline" size={18} color={ACCENT_SOFT} />
                <Text style={styles.infoLabel}>الطول</Text>
                <Text style={styles.infoValue}>
                  {user.height != null && Number(user.height) > 0 ? `${user.height} سم` : "—"}
                </Text>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoRow}>
                <Ionicons name="barbell-outline" size={18} color={ACCENT_SOFT} />
                <Text style={styles.infoLabel}>الوزن</Text>
                <Text style={styles.infoValue}>
                  {user.weight != null && Number(user.weight) > 0 ? `${user.weight} كغ` : "—"}
                </Text>
              </View>
            </View>

            {/* كارت منفصل: اركب + العيلة */}
            <View style={[styles.quickActionsCard, CARD_SHADOW]}>
              <TouchableOpacity style={styles.quickRow} activeOpacity={0.8}>
                <View style={styles.quickLeft}>
                  <Ionicons name="car-outline" size={18} color={ACCENT_SOFT} />
                  <Text style={styles.quickTitle}>اركب</Text>
                </View>
                <Ionicons name="chevron-back" size={18} color={TEXT_MUTED} />
              </TouchableOpacity>
              <View style={styles.quickDivider} />
              <TouchableOpacity style={styles.quickRow} activeOpacity={0.8}>
                <View style={styles.quickLeft}>
                  <Ionicons name="people-outline" size={18} color={ACCENT_SOFT} />
                  <Text style={styles.quickTitle}>العيلة</Text>
                </View>
                <Ionicons name="chevron-back" size={18} color={TEXT_MUTED} />
              </TouchableOpacity>
            </View>

            {/* كارت جدار الهدايا */}
            <View style={[styles.giftCard, CARD_SHADOW]}>
              <View style={styles.giftHeaderRow}>
                <View style={styles.giftTitleRow}>
                  <Ionicons name="gift-outline" size={18} color={GIFT_COLOR} />
                  <Text style={styles.giftTitle}>جدار الهدايا</Text>
                </View>
                <Ionicons name="chevron-back" size={18} color={TEXT_MUTED} />
              </View>
              <Text style={styles.giftSub}>
                نظرة سريعة على أجمل الهدايا التي حصل عليها هذا المستخدم.
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.momentContent}>
            {momentsLoading ? (
              <View style={styles.momentLoadingWrap}>
                <ActivityIndicator size="small" color={ACCENT_SOFT} />
                <Text style={styles.momentLoadingText}>جاري التحميل...</Text>
              </View>
            ) : momentsError ? (
              <View style={styles.momentErrorWrap}>
                <Ionicons name="alert-circle-outline" size={20} color={TEXT_MUTED} />
                <Text style={styles.momentErrorText}>{momentsError}</Text>
              </View>
            ) : moments.length === 0 ? (
              <View style={styles.momentEmptyWrap}>
                <Ionicons name="images-outline" size={36} color={TEXT_MUTED} />
                <Text style={styles.momentEmptyTitle}>لا توجد لحظات</Text>
                <Text style={styles.momentEmptySub}>لم ينشر هذا المستخدم أي لحظات بعد</Text>
              </View>
            ) : (
              <View style={styles.momentGrid}>
                {moments.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.momentCard, CARD_SHADOW]}
                    activeOpacity={0.9}
                    onPress={() => setMediaModal(m)}
                  >
                    <View style={styles.momentMediaWrap}>
                      <Image source={{ uri: getFullMediaUrl(m.thumbnailUrl || m.mediaUrl) }} style={styles.momentImage} resizeMode="cover" />
                      {m.mediaType === "video" && (
                        <View style={styles.momentPlayOverlay}>
                          <Ionicons name="play-circle" size={32} color="rgba(255,255,255,0.95)" />
                        </View>
                      )}
                    </View>
                    <View style={styles.momentFooter}>
                      <Text style={styles.momentTime}>{formatRelativeTime(m.createdAt)}</Text>
                      <TouchableOpacity style={styles.momentLikeBtn} onPress={() => handleLike(m)} activeOpacity={0.7}>
                        <Ionicons name={m.likedByMe ? "heart" : "heart-outline"} size={14} color={m.likedByMe ? "#f472b6" : TEXT_MUTED} />
                        <Text style={styles.momentLikeCount}>{m.likeCount}</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* مودال عرض الصور والفيديو على طول الصفحة */}
      <Modal visible={!!mediaModal} animationType="fade" transparent onRequestClose={() => setMediaModal(null)}>
        <Pressable style={styles.mediaModalOverlay} onPress={() => setMediaModal(null)}>
          <View style={styles.mediaModalContent}>
            {mediaModal && (
              <Pressable onPress={(e) => e.stopPropagation()} style={styles.mediaModalInner}>
                {mediaModal.mediaType === "video" ? (
                  <Video
                    source={{
                      uri: getFullMediaUrl(mediaModal.mediaUrl),
                      headers: { "bypass-tunnel-reminder": "true" },
                    }}
                    style={styles.mediaFullScreen}
                    useNativeControls
                    resizeMode={ResizeMode.CONTAIN}
                    shouldPlay
                    onError={(e) => console.warn("Video error:", e)}
                  />
                ) : (
                  <Image
                    source={{ uri: getFullMediaUrl(mediaModal.mediaUrl) }}
                    style={styles.mediaFullScreen}
                    resizeMode="contain"
                  />
                )}
                <TouchableOpacity style={styles.mediaCloseBtn} onPress={() => setMediaModal(null)}>
                  <Ionicons name="close" size={26} color="#fff" />
                </TouchableOpacity>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Modal>
      {/* صف الأيقونات — ثابت في أسفل الصفحة */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.8}>
          <View style={[styles.actionIconWrap, { backgroundColor: "rgba(244,114,182,0.2)" }]}>
            <Ionicons name="heart" size={24} color={HEART_COLOR} />
          </View>
          <Text style={styles.actionLabel}>إعجاب</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.8}>
          <View style={[styles.actionIconWrap, { backgroundColor: "rgba(52,211,153,0.2)" }]}>
            <Ionicons name="person-add" size={24} color={ADD_COLOR} />
          </View>
          <Text style={styles.actionLabel}>إضافة</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.8}>
          <View style={[styles.actionIconWrap, { backgroundColor: "rgba(96,165,250,0.2)" }]}>
            <Ionicons name="chatbubble-ellipses" size={24} color={MESSAGE_COLOR} />
          </View>
          <Text style={styles.actionLabel}>رسالة</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.8}>
          <View style={[styles.actionIconWrap, { backgroundColor: "rgba(251,191,36,0.2)" }]}>
            <Ionicons name="gift" size={24} color={GIFT_COLOR} />
          </View>
          <Text style={styles.actionLabel}>هدية</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1a1625", paddingTop: Platform.OS === "ios" ? 40 : 20 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(167, 139, 250, 0.12)",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginRight: 12,
  },
  backText: { fontSize: 15, fontWeight: "600", color: ACCENT_SOFT },
  headerTitle: { fontSize: 18, fontWeight: "700", color: TEXT_LIGHT, flex: 1, textAlign: "center" },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 24, alignItems: "center" },
  profileImageWrap: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: BORDER_SOFT,
    marginBottom: 16,
  },
  profileImage: {
    width: "100%",
    height: "100%",
    borderRadius: 13,
  },
  profileImagePlaceholder: {
    backgroundColor: ACCENT_MUTED,
    alignItems: "center",
    justifyContent: "center",
  },
  imageOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 60,
    paddingHorizontal: 14,
    paddingBottom: 14,
    justifyContent: "flex-end",
  },
  overlayContent: {
    gap: 6,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  overlayName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
  },
  ageBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  ageText: {
    fontSize: 13,
    fontWeight: "700",
  },
  idRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  overlayId: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  flagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  flagEmoji: { fontSize: 16 },
  flagText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "500",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 14,
  },
  tabRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "rgba(45, 38, 64, 0.5)",
    borderWidth: 1,
    borderColor: BORDER_SOFT,
  },
  tabActive: {
    backgroundColor: "rgba(167, 139, 250, 0.25)",
    borderColor: ACCENT_SOFT,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: TEXT_MUTED,
  },
  tabTextActive: {
    color: ACCENT_SOFT,
    fontWeight: "700",
  },
  infoContent: {
    width: "100%",
    paddingHorizontal: 4,
  },
  infoCard: {
    width: "100%",
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER_SOFT,
    overflow: "hidden",
  },
  quickActionsCard: {
    width: "100%",
    marginTop: 12,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER_SOFT,
    paddingVertical: 4,
  },
  quickRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  quickLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  quickTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_LIGHT,
  },
  quickDivider: {
    height: 1,
    backgroundColor: "rgba(148, 163, 184, 0.35)",
    marginHorizontal: 14,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  infoLabel: {
    fontSize: 12,
    color: TEXT_MUTED,
    width: 70,
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_LIGHT,
  },
  infoDivider: {
    height: 1,
    backgroundColor: BORDER_SOFT,
    marginLeft: 42,
  },
  infoFlag: { fontSize: 18 },
  giftCard: {
    width: "100%",
    marginTop: 12,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER_SOFT,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  giftHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  giftTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  giftTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: TEXT_LIGHT,
  },
  giftSub: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginTop: 4,
  },
  momentContent: {
    width: SCREEN_WIDTH - 32,
    paddingBottom: 24,
  },
  momentLoadingWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 32,
  },
  momentLoadingText: {
    fontSize: 13,
    color: TEXT_MUTED,
  },
  momentErrorWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
  },
  momentErrorText: {
    fontSize: 13,
    color: TEXT_MUTED,
  },
  momentEmptyWrap: {
    alignItems: "center",
    paddingVertical: 28,
    gap: 8,
  },
  momentEmptyTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: TEXT_LIGHT,
  },
  momentEmptySub: {
    fontSize: 12,
    color: TEXT_MUTED,
  },
  momentGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  momentCard: {
    width: (SCREEN_WIDTH - 32 - 12) / 2,
    marginBottom: 12,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BORDER_SOFT,
  },
  momentMediaWrap: {
    width: "100%",
    aspectRatio: 1,
    position: "relative",
  },
  momentImage: {
    width: "100%",
    height: "100%",
  },
  momentPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  momentFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  momentTime: {
    fontSize: 11,
    color: TEXT_MUTED,
  },
  momentLikeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  momentLikeCount: {
    fontSize: 12,
    fontWeight: "600",
    color: TEXT_LIGHT,
  },
  mediaModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  mediaModalContent: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  mediaModalInner: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  mediaFullScreen: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  mediaCloseBtn: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 24,
    right: 16,
    padding: 10,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  statBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  statPink: { backgroundColor: PINK_BG },
  statBlue: { backgroundColor: BLUE_BG },
  statLabel: { fontSize: 11, fontWeight: "600", color: TEXT_LIGHT },
  statValue: { fontSize: 13, fontWeight: "800", color: TEXT_LIGHT },
  levelBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "rgba(251,191,36,0.2)",
  },
  levelText: { fontSize: 11, fontWeight: "700", color: "#fbbf24" },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 12,
    paddingBottom: Platform.OS === "ios" ? 28 : 16,
    backgroundColor: CARD_BG,
    borderTopWidth: 1,
    borderTopColor: BORDER_SOFT,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: "100%",
  },
  actionBtn: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  actionIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: TEXT_MUTED,
  },
});
