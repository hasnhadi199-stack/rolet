import { useCallback, useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Localization from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFlagEmoji, getCountryName } from "../../utils/countries";

const PURPLE_DARK = "#1a1625";
const ACCENT_SOFT = "#c4b5fd";
const ACCENT_MUTED = "rgba(167, 139, 250, 0.25)";
const CARD_BG = "rgba(45, 38, 64, 0.6)";
const TEXT_LIGHT = "#f5f3ff";
const TEXT_MUTED = "#a1a1aa";
const BORDER_ACCENT = "rgba(167, 139, 250, 0.5)";
const GOLD = "#facc15";
const ORANGE_FINANCE = "#f59e0b";
const CARD_SHADOW = Platform.select({
  ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8 },
  android: { elevation: 4 },
});

function getDeviceCountryCode(): string {
  try {
    const locale = Localization.getLocales?.()?.[0] as {
      regionCode?: string;
      countryCode?: string;
    } | undefined;
    const region = locale?.regionCode || locale?.countryCode || "";
    return region ? String(region).toUpperCase().slice(0, 2) : "";
  } catch {
    return "";
  }
}

function ageFromDateOfBirth(dateStr?: string): number | null {
  if (!dateStr) return null;
  const y = parseInt(dateStr.slice(0, 4), 10);
  const m = parseInt(dateStr.slice(5, 7), 10);
  if (isNaN(y) || isNaN(m)) return null;

  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m) age -= 1;
  return age >= 0 ? age : null;
}

type Props = {
  user: {
    id?: string;
    name?: string;
    email: string;
    profileImage?: string;
    age?: number | null;
    dateOfBirth?: string;
    country?: string;
    gender?: string;
  };
  onEditProfile: () => void;
  onOpenInfoPage: () => void;
};

export default function MeScreen({ user, onEditProfile, onOpenInfoPage }: Props) {
  const deviceCountry = getDeviceCountryCode();
  const countryCode = user.country || deviceCountry || "";
  const flag = getFlagEmoji(countryCode);
  const countryName = getCountryName(countryCode);

  const age = user.age ?? ageFromDateOfBirth(user.dateOfBirth);
  const userId = user.id || user.email?.split("@")[0] || "—";
  const profileId = user.id || user.email || "";
  const [likeCount, setLikeCount] = useState(0);

  useEffect(() => {
    if (!profileId) return;
    AsyncStorage.getItem(`profile_likes_count_${profileId}`).then((v) => {
      if (v != null) setLikeCount(parseInt(v, 10) || 0);
    });
  }, [profileId]);

  const copyUserId = useCallback(async () => {
    await Clipboard.setStringAsync(String(userId));
    Alert.alert("تم النسخ", "تم نسخ المعرف بنجاح");
  }, [userId]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.row}>
        <View style={styles.infoSection}>
          <TouchableOpacity
            style={styles.photoWrap}
            onPress={onEditProfile}
            activeOpacity={0.8}
          >
            {user.profileImage ? (
              <Image source={{ uri: user.profileImage }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={32} color={TEXT_MUTED} />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.infoCol}
            onPress={onOpenInfoPage}
            activeOpacity={0.8}
          >
            <Text style={styles.name}>{user.name || "أنا"}</Text>

            <TouchableOpacity style={styles.idRow} onPress={copyUserId}>
              <Text style={styles.userId}>{userId}</Text>
              <Ionicons name="copy-outline" size={14} color={ACCENT_SOFT} />
            </TouchableOpacity>

            <View style={styles.badgesRow}>
              <View style={styles.badge}>
                <Text style={styles.badgeEmoji}>{flag}</Text>
                <Text style={styles.badgeText}>{countryName || "—"}</Text>
              </View>

              {user.gender && age != null && (
                <View style={styles.badge}>
                  <Text style={styles.badgeIcon}>
                    {user.gender === "male" ? "♂" : "♀"}
                  </Text>
                  <Text style={styles.badgeText}>{age}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.arrowBtn} onPress={onOpenInfoPage}>
          <Ionicons name="chevron-forward" size={22} color={ACCENT_SOFT} />
        </TouchableOpacity>
      </View>

      {/* الإحصائيات — بطاقة واحدة حديثة */}
      <View style={styles.order}>
        <View style={[styles.statsCard, CARD_SHADOW]}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>صديق</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>أتابع</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{likeCount}</Text>
              <Text style={styles.statLabel}>معجب</Text>
            </View>
          </View>
        </View>

        {/* الشحن والإيرادات — بطاقات حديثة */}
        <View style={styles.financeRow}>
          <TouchableOpacity style={[styles.financeCard, CARD_SHADOW]} activeOpacity={0.85}>
            <View style={styles.financeCardInner}>
              <View>
                <Ionicons name="cash-outline" size={24} color="#fff7ed" />
                <Text style={styles.financeLabel}>شحن</Text>
              </View>
              <Ionicons name="chevron-forward-outline" size={20} color="#fff7ed" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.financeCardPurple, CARD_SHADOW]} activeOpacity={0.85}>
            <View style={styles.financeCardInner}>
              <View>
                <Ionicons name="wallet-outline" size={24} color={GOLD} />
                <Text style={styles.financeLabel}>الإيرادات</Text>
              </View>
              <Ionicons name="chevron-forward-outline" size={20} color={TEXT_LIGHT} />
            </View>
          </TouchableOpacity>
        </View>

        {/* الأقسام الجديدة تحت شحن وإيرادات */}
        <View style={styles.newSections}>
          {[
            { title: "مركز المهام", icon: "list" },
            { title: "ديكورات", icon: "color-palette" },
            { title: "زواري", icon: "people" },
            { title: "كيفية استخدام men", icon: "help-circle" },
            { title: "إعدادات", icon: "settings" },
             // القسم الجديد

          ].map((item, index) => (
            <TouchableOpacity key={index} style={styles.newSectionCard}>
              <View style={styles.newSectionRow}>
                <Ionicons name={item.icon as any} size={22} color={ACCENT_SOFT} />
                <Text style={styles.newSectionText}>{item.title}</Text>
                <Ionicons
                  name="chevron-forward-outline"
                  size={20}
                  color={ACCENT_SOFT}
                  style={{ marginLeft: "auto" }}
                />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PURPLE_DARK, marginTop: 40 },
  content: { padding: 20 },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  arrowBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ACCENT_MUTED,
    alignItems: "center",
    justifyContent: "center",
  },

  infoSection: { flex: 1, flexDirection: "row", gap: 14 },

  photoWrap: {
    width: 80,
    height: 80,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: BORDER_ACCENT,
  },

  avatar: { width: "100%", height: "100%" },

  avatarPlaceholder: {
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },

  infoCol: { flex: 1, gap: 6 },

  name: { fontSize: 18, fontWeight: "700", color: TEXT_LIGHT },

  idRow: { flexDirection: "row", gap: 6 },

  userId: { fontSize: 12, color: TEXT_MUTED },

  badgesRow: { flexDirection: "row", gap: 8, marginTop: 4 },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: ACCENT_MUTED,
  },

  badgeEmoji: { fontSize: 14 },
  badgeIcon: { fontSize: 14, color: ACCENT_SOFT },
  badgeText: { fontSize: 11, color: TEXT_LIGHT },

  order: { marginTop: 28 },

  statsCard: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.12)",
  },

  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },

  statItem: { flex: 1, alignItems: "center" },

  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(167, 139, 250, 0.2)",
    borderRadius: 1,
  },

  statNumber: {
    fontSize: 18,
    fontWeight: "800",
    color: TEXT_LIGHT,
  },

  statLabel: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginTop: 4,
  },

  financeRow: {
    flexDirection: "row",
    gap: 14,
    marginTop: 24,
    alignItems: "center",
  },

  financeCard: {
    flex: 1,
    backgroundColor: ORANGE_FINANCE,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 20,
    justifyContent: "center",
  },

  financeCardPurple: {
    flex: 1,
    backgroundColor: "#A855F7",
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 20,
    justifyContent: "center",
  },

  financeCardInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  financeLabel: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "600",
    color: TEXT_LIGHT,
  },

  newSections: {
    marginTop: 24,
    gap: 14,
  },

  newSectionCard: {
    backgroundColor: CARD_BG,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.12)",
    ...CARD_SHADOW,
  },

  newSectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  newSectionText: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_LIGHT,
  },
});