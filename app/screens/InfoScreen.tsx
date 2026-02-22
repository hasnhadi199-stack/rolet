import { useCallback, useEffect, useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  Image,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Localization from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { getFlagEmoji, getCountryName } from "../../utils/countries";
import { API_BASE_URL } from "../../utils/authHelper";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SLIDER_HEIGHT = 320;
const CARD_MARGIN = 16;
const CARD_WIDTH = SCREEN_WIDTH - CARD_MARGIN * 2;

const PURPLE_DARK = "#1a1625";
const ACCENT_SOFT = "#c4b5fd";
const ACCENT_MUTED = "rgba(167, 139, 250, 0.25)";
const ACCENT_MUTED_DARK = "rgba(45, 38, 64, 0.8)";
const TEXT_LIGHT = "#f5f3ff";
const TEXT_MUTED = "#a1a1aa";
const BORDER_ACCENT = "rgba(167, 139, 250, 0.4)";
const CARD_SHADOW = Platform.select({
  ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12 },
  android: { elevation: 6 },
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

const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
function formatDateOfBirth(dateStr: string): string {
  const y = dateStr.slice(0, 4);
  const m = parseInt(dateStr.slice(5, 7), 10);
  const monthName = m >= 1 && m <= 12 ? MONTHS_AR[m - 1] : "";
  return monthName ? `${monthName} ${y}` : dateStr;
}

function InfoRow({
  icon,
  label,
  value,
  trailing,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  trailing?: "copy";
}) {
  return (
    <View style={rowStyles.row}>
      <View style={rowStyles.iconWrap}>
        <Ionicons name={icon} size={20} color={ACCENT_SOFT} />
      </View>
      <View style={rowStyles.textWrap}>
        <Text style={rowStyles.label}>{label}</Text>
        <Text style={rowStyles.value} numberOfLines={2}>{value}</Text>
      </View>
      {trailing === "copy" && (
        <Ionicons name="copy-outline" size={18} color={ACCENT_SOFT} style={rowStyles.trailing} />
      )}
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: ACCENT_MUTED, alignItems: "center", justifyContent: "center", marginLeft: 12 },
  textWrap: { flex: 1 },
  label: { fontSize: 12, color: TEXT_MUTED, marginBottom: 2 },
  value: { fontSize: 15, fontWeight: "600", color: TEXT_LIGHT },
  trailing: { marginRight: 4 },
});

function InfoRowSeparator() {
  return <View style={{ height: 1, backgroundColor: "rgba(167, 139, 250, 0.12)", marginLeft: 64 }} />;
}

type UserProfile = {
  id?: string;
  name?: string;
  email: string;
  profileImage?: string;
  age?: number | null;
  dateOfBirth?: string;
  country?: string;
  gender?: string;
  height?: number | null;
  weight?: number | null;
  hobby?: string;
  month?: string;
};

type Props = {
  user: UserProfile;
  onBack: () => void;
};

export default function InfoScreen({ user: userProp, onBack }: Props) {
  const deviceCountry = getDeviceCountryCode();
  const [profile, setProfile] = useState<UserProfile | null>(userProp);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const user = profile || userProp;
  const countryCode = user.country || deviceCountry || "";
  const flag = getFlagEmoji(countryCode);
  const countryName = getCountryName(countryCode);
  const age = user.age ?? ageFromDateOfBirth(user.dateOfBirth);
  const userId = user.id || user.email?.split("@")[0] || "—";

  const scrollRef = useRef<ScrollView>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<"info" | "moment">("info");
  const photos = user.profileImage ? [user.profileImage] : [];

  const profileId = user.id || user.email || "";
  const [likeCount, setLikeCount] = useState(0);
  const [hasLiked, setHasLiked] = useState(false);

  useEffect(() => {
    if (!profileId) return;
    const keyLiked = `profile_liked_${profileId}`;
    const keyCount = `profile_likes_count_${profileId}`;
    AsyncStorage.multiGet([keyLiked, keyCount]).then(([[, vLiked], [, vCount]]) => {
      if (vLiked === "1") setHasLiked(true);
      if (vCount != null) setLikeCount(parseInt(vCount, 10) || 0);
    });
  }, [profileId]);

  const onLikePress = useCallback(async () => {
    if (hasLiked) {
      Alert.alert("تم بالفعل", "لا يمكن الإعجاب أكثر من مرة واحدة.");
      return;
    }
    const newCount = likeCount + 1;
    setLikeCount(newCount);
    setHasLiked(true);
    const keyLiked = `profile_liked_${profileId}`;
    const keyCount = `profile_likes_count_${profileId}`;
    await AsyncStorage.multiSet([[keyLiked, "1"], [keyCount, String(newCount)]]);
  }, [hasLiked, likeCount, profileId]);

  const fetchProfile = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        setProfile(userProp);
        return;
      }
      const res = await axios.get(`${API_BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });
      if (res.data?.success && res.data?.user) {
        setProfile(res.data.user as UserProfile);
      }
    } catch (e) {
      setError((e as Error)?.message || "تعذر جلب البيانات");
      setProfile(userProp);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userProp]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const onScrollSlider = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const index = Math.round(x / (CARD_WIDTH + CARD_MARGIN));
    setSlideIndex(Math.min(index, photos.length));
  }, [photos.length]);

  const copyUserId = useCallback(async () => {
    await Clipboard.setStringAsync(String(userId));
    Alert.alert("تم النسخ", "تم نسخ المعرف بنجاح");
  }, [userId]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="arrow-forward" size={22} color={ACCENT_SOFT} />
          <Text style={styles.backText}>رجوع</Text>
        </TouchableOpacity>
      </View>

      {/* سلايدر الصورة الشخصية — يبقى فوق دائماً */}
      <View style={styles.sliderWrap}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          onMomentumScrollEnd={onScrollSlider}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sliderContent}
          snapToInterval={CARD_WIDTH + CARD_MARGIN}
          snapToAlignment="center"
          decelerationRate="fast"
        >
          {photos.length > 0 ? (
              photos.map((uri, i) => (
                  <View key={i} style={styles.slideCard}>
                    <Image source={{ uri }} style={styles.slideImage} resizeMode="cover" />
                    <TouchableOpacity
                      style={styles.likeIconWrap}
                      onPress={onLikePress}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={hasLiked ? "heart" : "heart-outline"}
                        size={22}
                        color={hasLiked ? "#f43f5e" : "#f5f3ff"}
                      />
                      <Text style={styles.likeCountText}>{likeCount}</Text>
                    </TouchableOpacity>
                  </View>
                ))
          ) : (
              <View style={[styles.slideCard, styles.slidePlaceholder]}>
                  <Ionicons name="person" size={64} color={TEXT_MUTED} />
                  <Text style={styles.slidePlaceholderText}>لا توجد صورة شخصية</Text>
                </View>
          )}
        </ScrollView>
        {photos.length > 1 ? (
          <View style={styles.pagination}>
            {photos.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, slideIndex === i && styles.dotActive]}
              />
            ))}
          </View>
        ) : null}
      </View>

      {/* تبويبان: لحظة | معلومات — جنب بعض مع مسافة بينهم */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "moment" && styles.tabActive]}
          onPress={() => setActiveTab("moment")}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === "moment" && styles.tabTextActive]}>
            لحظة
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "info" && styles.tabActive]}
          onPress={() => setActiveTab("info")}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === "info" && styles.tabTextActive]}>
            معلومات
          </Text>
        </TouchableOpacity>
      </View>

      {/* المحتوى يتغير حسب التبويب — الصورة والتبويبان يبقون */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          activeTab === "info" ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchProfile(true)}
              tintColor={ACCENT_SOFT}
            />
          ) : undefined
        }
      >
        {activeTab === "moment" ? (
          <View style={styles.momentContent}>
            <Text style={styles.momentTitle}>لحظة</Text>
            <Text style={styles.momentSubtitle}>لحظاتك تظهر هنا</Text>
          </View>
        ) : loading && !profile ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={ACCENT_SOFT} />
            <Text style={styles.loadingText}>جاري جلب معلوماتك...</Text>
          </View>
        ) : (
          <View style={styles.infoSections}>
            {error ? (
              <View style={styles.errorBanner}>
                <Ionicons name="cloud-offline-outline" size={20} color={TEXT_MUTED} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* قسم معلومات الحساب */}
            <Text style={styles.sectionTitle}>معلومات الحساب</Text>
            <View style={[styles.sectionCard, CARD_SHADOW]}>
              <InfoRow icon="person-outline" label="الاسم" value={user.name || "—"} />
              <InfoRowSeparator />
              <TouchableOpacity style={styles.infoRowTouch} onPress={copyUserId} activeOpacity={0.7}>
                <InfoRow icon="finger-print-outline" label="المعرف" value={userId} trailing="copy" />
              </TouchableOpacity>
              <InfoRowSeparator />
              <InfoRow icon="mail-outline" label="البريد الإلكتروني" value={user.email || "—"} />
            </View>

            {/* قسم التفاصيل الشخصية */}
            <Text style={styles.sectionTitle}>التفاصيل الشخصية</Text>
            <View style={[styles.sectionCard, CARD_SHADOW]}>
              <InfoRow icon="globe-outline" label="الدولة" value={countryName ? `${flag} ${countryName}` : "—"} />
              {(user.gender || age != null) && (
                <>
                  <InfoRowSeparator />
                  <InfoRow
                    icon="people-outline"
                    label="الجنس والعمر"
                    value={[user.gender === "male" ? "ذكر" : user.gender === "female" ? "أنثى" : "", age != null ? `${age} سنة` : ""].filter(Boolean).join(" · ") || "—"}
                  />
                </>
              )}
              {(user.height != null && user.height > 0) && (
                <>
                  <InfoRowSeparator />
                  <InfoRow icon="resize-outline" label="الطول" value={`${user.height} سم`} />
                </>
              )}
              {(user.weight != null && user.weight > 0) && (
                <>
                  <InfoRowSeparator />
                  <InfoRow icon="barbell-outline" label="الوزن" value={`${user.weight} كغ`} />
                </>
              )}
              {(user.hobby && user.hobby.trim()) && (
                <>
                  <InfoRowSeparator />
                  <InfoRow icon="heart-outline" label="الهوايات" value={user.hobby.trim()} />
                </>
              )}
              {(user.dateOfBirth || user.month) && (
                <>
                  <InfoRowSeparator />
                  <InfoRow icon="calendar-outline" label="تاريخ الميلاد" value={user.dateOfBirth ? formatDateOfBirth(user.dateOfBirth) : user.month || "—"} />
                </>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PURPLE_DARK, paddingTop: 40 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: ACCENT_MUTED,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  backText: { fontSize: 16, color: ACCENT_SOFT, fontWeight: "600" },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: TEXT_LIGHT,
    textAlign: "center",
  },
  scroll: { flex: 1 },
  content: { paddingBottom: 24 },
  sliderWrap: { marginBottom: 20 },
  sliderContent: {
    paddingHorizontal: CARD_MARGIN,
    gap: CARD_MARGIN,
  },
  slideCard: {
    width: CARD_WIDTH,
    height: SLIDER_HEIGHT,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BORDER_ACCENT,
  },
  slideImage: { width: "100%", height: "100%" },
  likeIconWrap: {
    position: "absolute",
    bottom: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  likeCountText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#f5f3ff",
  },
  slidePlaceholder: {
    backgroundColor: ACCENT_MUTED,
    alignItems: "center",
    justifyContent: "center",
  },
  slidePlaceholderText: {
    marginTop: 12,
    fontSize: 14,
    color: TEXT_MUTED,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ACCENT_MUTED,
  },
  dotActive: {
    width: 24,
    backgroundColor: ACCENT_SOFT,
  },
  tabRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: ACCENT_MUTED,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: ACCENT_MUTED,
  },
  tabActive: {
    backgroundColor: "rgba(167, 139, 250, 0.45)",
    borderWidth: 1,
    borderColor: BORDER_ACCENT,
  },
  tabText: {
    fontSize: 15,
    fontWeight: "600",
    color: TEXT_MUTED,
  },
  tabTextActive: {
    color: ACCENT_SOFT,
    fontWeight: "700",
  },
  momentContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
  },
  momentTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: TEXT_LIGHT,
    marginBottom: 8,
  },
  momentSubtitle: {
    fontSize: 14,
    color: TEXT_MUTED,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 48,
    gap: 16,
  },
  loadingText: { fontSize: 14, color: TEXT_MUTED },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderRadius: 12,
  },
  errorText: { fontSize: 13, color: TEXT_MUTED, flex: 1 },
  infoSections: { paddingBottom: 32, paddingTop: 8 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: TEXT_MUTED,
    marginLeft: 20,
    marginBottom: 10,
    marginTop: 20,
    letterSpacing: 0.5,
  },
  sectionCard: {
    marginHorizontal: 20,
    marginBottom: 4,
    backgroundColor: ACCENT_MUTED_DARK,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.15)",
  },
  infoRowTouch: { minHeight: 1 },
});
