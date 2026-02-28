import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  Platform,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getFlagEmoji, getCountryName } from "../../utils/countries";
import type { UserSearchResult } from "../../utils/usersApi";

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

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const AVATAR_SIZE = Math.min(SCREEN_WIDTH - 0, 200);

type Props = {
  user: UserSearchResult;
  onBack: () => void;
};

export default function UserProfileScreen({ user, onBack }: Props) {
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
      >
        {/* صورة كاملة — شبيه تطبيقات حديثة */}
        <View style={styles.avatarWrap}>
          {user.profileImage ? (
            <Image source={{ uri: user.profileImage }} style={styles.avatarFull} resizeMode="cover" />
          ) : (
            <View style={[styles.avatarFull, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={80} color={TEXT_MUTED} />
            </View>
          )}
        </View>

        {/* ماسة قيمة سحر + ماسة سحر ثروة + ليفل — تحت الصورة */}
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

        {/* الاسم والمعلومات */}
        <View style={styles.infoCard}>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.userId}>{user.id}</Text>
          <View style={styles.badgesRow}>
            {user.country && (
              <View style={styles.badge}>
                <Text style={styles.badgeEmoji}>{getFlagEmoji(user.country)}</Text>
                <Text style={styles.badgeText}>{getCountryName(user.country) || "—"}</Text>
              </View>
            )}
            {(user.gender || user.age != null) && (
              <View style={styles.badge}>
                <Text style={styles.badgeIcon}>
                  {user.gender === "male" ? "♂" : user.gender === "female" ? "♀" : "—"}
                </Text>
                <Text style={styles.badgeText}>{user.age != null ? String(user.age) : "—"}</Text>
              </View>
            )}
          </View>
        </View>

        {/* صف الأيقونات */}
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
      </ScrollView>
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
  content: { padding: 20, paddingBottom: 32, alignItems: "center" },
  avatarWrap: {
    width: "100%",
    alignItems: "center",
    marginBottom: 14,
  },
  avatarFull: {
    width: 320,
    height: AVATAR_SIZE,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    backgroundColor: ACCENT_MUTED,
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 20,
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
  infoCard: {
    width: "100%",
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: BORDER_SOFT,
    alignItems: "center",
    marginBottom: 20,
  },
  name: {
    fontSize: 22,
    fontWeight: "700",
    color: TEXT_LIGHT,
    marginBottom: 8,
  },
  userId: {
    fontSize: 13,
    color: TEXT_MUTED,
    marginBottom: 12,
  },
  badgesRow: { flexDirection: "row", gap: 12, flexWrap: "wrap", justifyContent: "center" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: ACCENT_MUTED,
  },
  badgeEmoji: { fontSize: 18 },
  badgeIcon: { fontSize: 18, color: ACCENT_SOFT },
  badgeText: { fontSize: 14, color: TEXT_LIGHT },
  actionsRow: {
    marginTop:160,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 0,
    paddingHorizontal: 12,
    backgroundColor: CARD_BG,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER_SOFT,
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
