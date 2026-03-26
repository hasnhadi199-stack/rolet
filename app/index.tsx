// LiveKit requires native modules — only works in development build, not Expo Go
try {
  require("@livekit/react-native").registerGlobals();
} catch {
  if (__DEV__) console.warn("[LiveKit] Voice unavailable in Expo Go — use `npx expo run:android` for voice.");
}

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  View,
  Dimensions,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Image,
  Pressable,
  AppState,
  LogBox,
} from "react-native";

// تثبيط رسائل معروفة ولا تؤثر على التشغيل
LogBox.ignoreLogs(["keep awake", "No compatible apps connected", "React Native DevTools"]);
import { useFonts } from "expo-font";
import Ionicons from "@expo/vector-icons/Ionicons";
import LottieView from "lottie-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import * as ImagePicker from "expo-image-picker";
import * as Localization from "expo-localization";
import { checkAuthStatus, checkAuthStatusQuick, API_BASE_URL } from "../utils/authHelper";
import { leaveGroupChat, fetchGroupChatSlots } from "../utils/messagesApi";
import { preloadAppCache, preloadFromBackend } from "../utils/cachePreload";
import { registerPushTokenWithBackend, notifyFriendsOnline, notifyOffline, setupNotificationResponseListener } from "../utils/pushNotifications";
import { getFlagEmoji, getCountryName } from "../utils/countries";
import type { UserSearchResult } from "../utils/usersApi";
import type { SocialUser } from "../utils/socialApi";
import HomeScreen from "./screens/HomeScreen";
import MeScreen from "./screens/MeScreen";
import InfoScreen from "./screens/InfoScreen";
import MessagesScreen from "./screens/MessagesScreen";
import ChatScreen from "./screens/ChatScreen";
import ClubScreen from "./screens/ClubScreen";
import MomentScreen from "./screens/MomentScreen";
import { AppAlertProvider } from "../components/AppAlertProvider";
import TopupScreen from "./screens/TopupScreen";
import RevenuesScreen from "./screens/RevenuesScreen";
import TaskCenterScreen from "./screens/TaskCenterScreen";
import DecorationsScreen from "./screens/DecorationsScreen";
import SettingsScreen from "./screens/SettingsScreen";
import PrivilegesScreen from "./screens/PrivilegesScreen";
import SocialListScreen from "./screens/SocialListScreen";
import VisitorsScreen from "./screens/VisitorsScreen";
import GroupChatScreen from "./screens/GroupChatScreen";
import GroupChatUsersScreen from "./screens/GroupChatUsersScreen";
import GroupChatMiniFloating from "../components/GroupChatMiniFloating";
import { CheckInContinuousModal } from "../components/CheckInContinuousModal";
import SearchScreen from "./screens/SearchScreen";
import UserProfileScreen from "./screens/UserProfileScreen";
import { LanguageProvider, useLanguage } from "./_contexts/LanguageContext";
import { ThemeProvider, useTheme } from "./_contexts/ThemeContext";
import { PrivilegesProvider } from "./_contexts/PrivilegesContext";
import { OfflineBanner } from "../components/OfflineBanner";

const { width } = Dimensions.get("window");

const PURPLE_DARK = "#1a1625";
const ACCENT = "#a78bfa";
const ACCENT_SOFT = "#c4b5fd";
const ACCENT_MUTED = "rgba(167, 139, 250, 0.25)";
const TEXT_LIGHT = "#f5f3ff";
const TEXT_MUTED = "#a1a1aa";
const INPUT_BG = "rgba(255,255,255,0.05)";
const CARD_BG = "rgba(45, 38, 64, 0.6)";
const BORDER_SOFT = "rgba(167, 139, 250, 0.2)";

const MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

type AuthState = "splash" | "email" | "signup" | "pin" | "main";
type User = {
  id: string;
  name: string;
  email: string;
  profileImage?: string;
  age?: number | null;
  dateOfBirth?: string;
  height?: number | null;
  weight?: number | null;
  country?: string;
  gender?: string;
  hobby?: string;
  month?: string;
} | null;

function isProfileComplete(u: User): boolean {
  if (!u) return false;
  return (
    (typeof u.age === "number") ||
    (typeof u.height === "number") ||
    (typeof u.weight === "number") ||
    (u.gender !== "" && u.gender != null) ||
    (u.hobby !== "" && u.hobby != null) ||
    (u.dateOfBirth !== "" && u.dateOfBirth != null)
  );
}

function getDeviceCountryCode(): string {
  try {
    const locale = Localization.getLocales?.()?.[0] as { regionCode?: string; countryCode?: string } | undefined;
    const region = locale?.regionCode || locale?.countryCode || "";
    return region ? String(region).toUpperCase().slice(0, 2) : "";
  } catch {
    return "";
  }
}

function ageFromYearMonth(year: number, month: number): number {
  const now = new Date();
  let age = now.getFullYear() - year;
  if (now.getMonth() + 1 < month) age -= 1;
  return age >= 0 ? age : 0;
}

function ProfileScreen({
  user,
  onUserUpdate,
  onBack,
}: {
  user: NonNullable<User>;
  onUserUpdate: (u: User) => void;
  onBack?: () => void;
}) {
  const { t, lang } = useLanguage();
  const deviceCountry = getDeviceCountryCode();
  const countryCode = user.country || deviceCountry || "";
  const isLocked =
    (typeof user.age === "number") ||
    (typeof user.height === "number") ||
    (typeof user.weight === "number") ||
    (user.gender !== "" && user.gender != null) ||
    (user.hobby !== "" && user.hobby != null) ||
    (user.dateOfBirth !== "" && user.dateOfBirth != null);

  const [name, setName] = useState(user.name || "");
  const [profileImage, setProfileImage] = useState(user.profileImage || "");
  const [height, setHeight] = useState(
    typeof user.height === "number" ? String(user.height) : ""
  );
  const [weight, setWeight] = useState(
    typeof user.weight === "number" ? String(user.weight) : ""
  );
  const [hobby, setHobby] = useState(user.hobby || "");
  const [gender, setGender] = useState(user.gender || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 80 }, (_, i) => currentYear - 79 + i).reverse();
  const [yearIndex, setYearIndex] = useState(() => {
    if (user.dateOfBirth) {
      const y = parseInt(user.dateOfBirth.slice(0, 4), 10);
      const idx = years.indexOf(y);
      return idx >= 0 ? idx : 0;
    }
    return years.indexOf(currentYear - 25) >= 0 ? years.indexOf(currentYear - 25) : 0;
  });
  const [monthIndex, setMonthIndex] = useState(() => {
    if (user.dateOfBirth) {
      const m = parseInt(user.dateOfBirth.slice(5, 7), 10);
      return m >= 1 && m <= 12 ? m - 1 : 0;
    }
    return 0;
  });

  const dateOfBirthStr =
    `${years[yearIndex]}-${String((monthIndex ?? 0) + 1).padStart(2, "0")}-01`;

  const computedAge = ageFromYearMonth(years[yearIndex], (monthIndex ?? 0) + 1);

  const pickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      setError(t("profile.allowPhotos"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      const b64 = result.assets[0].base64;
      setProfileImage(b64 ? `data:image/jpeg;base64,${b64}` : uri);
    }
  }, [t]);

  const saveProfile = useCallback(async () => {
    setError("");
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        setError(t("profile.sessionExpired"));
        setSaving(false);
        return;
      }
      const payload: Record<string, unknown> = {
        name: name.trim() || user.name,
        profileImage: profileImage || user.profileImage,
      };
      if (!isLocked) {
        payload.height = height === "" ? null : Number(height);
        payload.weight = weight === "" ? null : Number(weight);
        payload.hobby = hobby.trim() || "";
        payload.gender = gender || "";
        payload.dateOfBirth = dateOfBirthStr;
        payload.age = computedAge;
        payload.country = countryCode || deviceCountry || "";
        payload.month = String((monthIndex ?? 0) + 1);
      }
      const res = await axios.put(`${API_BASE_URL}/api/auth/profile`, payload, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 12000,
      });
      if (res.data?.success && res.data?.user) {
        const savedName = name.trim() || user.name;
        const updatedUser = { ...user, ...res.data.user, name: res.data.user.name ?? savedName };
        onUserUpdate(updatedUser);
        if (onBack) onBack();
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error)?.message ||
        t("profile.saveFailed");
      setError(msg);
    } finally {
      setSaving(false);
    }
  }, [
    name,
    profileImage,
    height,
    weight,
    hobby,
    gender,
    dateOfBirthStr,
    computedAge,
    countryCode,
    deviceCountry,
    monthIndex,
    isLocked,
    user,
    onUserUpdate,
    onBack,
    t,
  ]);

  return (
    <View style={styles.mainContainer}>
      <ScrollView
        style={styles.profileScroll}
        contentContainerStyle={styles.profileScrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileCard}>
          <View style={styles.profileTitleRow}>
            {onBack ? (
              <TouchableOpacity onPress={onBack} style={styles.backToTabsBtn} activeOpacity={0.8}>
                <Ionicons name="arrow-forward" size={22} color={ACCENT_SOFT} />
                <Text style={styles.backToTabsText}>{t("profile.back")}</Text>
              </TouchableOpacity>
            ) : null}
            <Text style={styles.profileTitle}>{t("profile.title")}</Text>
          </View>

          {/* اسم + صورة + دولة وعلم */}
          <View style={styles.rowNameImage}>
            <TouchableOpacity onPress={pickImage} style={styles.avatarWrap} activeOpacity={0.8}>
              {profileImage ? (
                <Image source={{ uri: profileImage }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarPlaceholderText}>+</Text>
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.nameCountryWrap}>
              <TextInput
                style={styles.inputName}
                value={name}
                onChangeText={setName}
                placeholder={t("profile.namePlaceholder")}
                placeholderTextColor={TEXT_MUTED}
              />
              <View style={styles.countryRow}>
                <Text style={styles.flagText}>{getFlagEmoji(countryCode)}</Text>
                <Text style={styles.countryName} numberOfLines={1}>
                  {getCountryName(countryCode, lang) || t("profile.countryByDevice")}
                </Text>
              </View>
            </View>
          </View>

          {!isLocked && (
            <>
              <Text style={styles.label}>{t("profile.height")}</Text>
              <TextInput
                style={styles.input}
                value={height}
                onChangeText={setHeight}
                placeholder={t("profile.heightPlaceholder")}
                placeholderTextColor={TEXT_MUTED}
                keyboardType="number-pad"
              />
              <Text style={styles.label}>{t("profile.weight")}</Text>
              <TextInput
                style={styles.input}
                value={weight}
                onChangeText={setWeight}
                placeholder={t("profile.weightPlaceholder")}
                placeholderTextColor={TEXT_MUTED}
                keyboardType="number-pad"
              />
              <Text style={styles.label}>{t("profile.hobby")}</Text>
              <TextInput
                style={styles.input}
                value={hobby}
                onChangeText={setHobby}
                placeholder={t("profile.hobbyPlaceholder")}
                placeholderTextColor={TEXT_MUTED}
              />
              <Text style={styles.label}>{t("profile.birthMonthYear")}</Text>
              <View style={styles.rowMonthYear}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerScroll}>
                  {MONTHS.map((m, i) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.pickerChip, monthIndex === i && styles.pickerChipActive]}
                      onPress={() => setMonthIndex(i)}
                    >
                      <Text style={[styles.pickerChipText, monthIndex === i && styles.pickerChipTextActive]}>
                        {m}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerScroll}>
                  {years.map((y, i) => (
                    <TouchableOpacity
                      key={y}
                      style={[styles.pickerChip, yearIndex === i && styles.pickerChipActive]}
                      onPress={() => setYearIndex(i)}
                    >
                      <Text style={[styles.pickerChipText, yearIndex === i && styles.pickerChipTextActive]}>
                        {y}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <Text style={styles.label}>{t("profile.ageAuto")}: {computedAge}</Text>

              <Text style={styles.label}>{t("profile.gender")}</Text>
              <View style={styles.genderRow}>
                <TouchableOpacity
                  style={[styles.genderBtn, gender === "male" && styles.genderBtnActive]}
                  onPress={() => setGender("male")}
                >
                  <Text style={styles.genderIcon}>♂</Text>
                  <Text style={[styles.genderLabel, gender === "male" && styles.genderLabelActive]}>{t("profile.male")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.genderBtn, gender === "female" && styles.genderBtnActive]}
                  onPress={() => setGender("female")}
                >
                  <Text style={styles.genderIcon}>♀</Text>
                  <Text style={[styles.genderLabel, gender === "female" && styles.genderLabelActive]}>{t("profile.female")}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {isLocked && (
            <Text style={styles.lockedHint}>{t("profile.lockedHint")}</Text>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.primaryBtn, saving && styles.primaryBtnDisabled]}
            onPress={saveProfile}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color={PURPLE_DARK} />
            ) : (
              <Text style={styles.primaryBtnText}>{isLocked ? t("profile.saveEdits") : t("profile.saveData")}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

type TabId = "home" | "me" | "messages" | "club" | "moment";

const TAB_THEMES: Record<TabId, { bg: string; color: string; border: string; shadow: string }> = {
  moment: {
    bg: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
    color: "#FF6B00",
    border: "#FFD700",
    shadow: "#FFD700",
  },
  home: {
    bg: "linear-gradient(135deg, #FF6B9D 0%, #FF3D7F 100%)",
    color: "#FF1F6B",
    border: "#FF6B9D",
    shadow: "#FF6B9D",
  },
  club: {
    bg: "linear-gradient(135deg, #00FF87 0%, #00D68F 100%)",
    color: "#00B377",
    border: "#00FF87",
    shadow: "#00FF87",
  },

    messages: {
    bg: "linear-gradient(135deg, #00D4FF 0%, #5B7FFF 100%)",
    color: "#0066FF",
    border: "#00D4FF",
    shadow: "#00D4FF",
  },

  me: {
    bg: "linear-gradient(135deg, #A855F7 0%, #7C3AED 100%)",
    color: "#8B5CF6",
    border: "#A855F7",
    shadow: "#A855F7",
  },
};

const TABS: { id: TabId; labelKey: string; emoji: string }[] = [
  { id: "home", labelKey: "tabs.home", emoji: "🏠" },
  { id: "moment", labelKey: "tabs.moment", emoji: "✨" },
  { id: "club", labelKey: "tabs.club", emoji: "🎯" },
  { id: "messages", labelKey: "tabs.messages", emoji: "💬" },
  { id: "me", labelKey: "tabs.me", emoji: "😊" },
];

function TabIcon({
  tab,
  active,
  onPress,
}: {
  tab: (typeof TABS)[number];
  active: boolean;
  onPress: () => void;
}) {
  const { t } = useLanguage();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const theme = TAB_THEMES[tab.id];

  const handlePressIn = useCallback(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 0.8, useNativeDriver: true }),
      Animated.timing(rotateAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
  }, [scaleAnim, rotateAnim]);

  const handlePressOut = useCallback(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 3, tension: 200 }),
      Animated.timing(rotateAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start();
  }, [scaleAnim, rotateAnim]);

  
  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "-8deg"],
  });

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.tabItem}
    >
      <Animated.View
        style={[
          styles.tabIconWrap,
          { transform: [{ scale: scaleAnim }, { rotate: rotation }] },
        ]}
      >
        {active && (
          <View
            style={[
              styles.tabGlow,
              {
                backgroundColor: theme.shadow,
                opacity: 0.45,
              },
            ]}
          />
        )}
        <View
          style={[
            styles.tabIconBubble,
            active && {
              backgroundColor: theme.border,
              borderColor: "rgba(255,255,255,0.5)",
              borderWidth: 1.5,
              shadowColor: theme.shadow,
              shadowOpacity: 0.8,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              elevation: 6,
            },
          ]}
        >
          <Text style={[styles.tabEmoji, !active && styles.tabEmojiInactive]}>
            {tab.emoji}
          </Text>
        </View>
        <Text
          style={[
            styles.tabLabel,
            active && { color: theme.color, fontWeight: "800" },
          ]}
        >
          {t(tab.labelKey)}
        </Text>
        {active && <View style={[styles.tabDot, { backgroundColor: theme.color }]} />}
      </Animated.View>
    </Pressable>
  );
}

function MainTabsScreen({
  user,
  onEditProfile,
  onOpenInfoPage,
  onOpenTopup,
  onOpenRevenues,
  onOpenTaskCenter,
  onOpenDecorations,
  onOpenSettings,
  onOpenAdmirers,
  onOpenVisitors,
  onOpenProfileLikers,
  onOpenFollowing,
  onOpenFriends,
  onOpenSearch,
  onOpenChat,
  onOpenGroupChat,
  onOpenMyProfile,
  onWalletUpdate,
  initialTab,
  onTabRestored,
  onMessagesTabActive,
}: {
  user: NonNullable<User>;
  onEditProfile: () => void;
  onOpenInfoPage: () => void;
  onOpenTopup: () => void;
  onOpenRevenues: () => void;
  onOpenTaskCenter: () => void;
  onOpenDecorations: () => void;
  onOpenSettings: () => void;
  onOpenAdmirers: () => void;
  onOpenVisitors: () => void;
  onOpenProfileLikers?: () => void;
  onOpenFollowing: () => void;
  onOpenFriends: () => void;
  onOpenSearch: () => void;
  onOpenChat: (user: UserSearchResult) => void;
  onOpenGroupChat?: () => void;
  onOpenMyProfile?: () => void;
  onWalletUpdate?: () => void;
  initialTab?: TabId | null;
  onTabRestored?: () => void;
  onMessagesTabActive?: () => void;
}) {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<TabId>(initialTab ?? "home");

  useEffect(() => {
    preloadAppCache();
  }, []);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
      onTabRestored?.();
    }
  }, [initialTab]);

  useEffect(() => {
    if (activeTab === "messages") onMessagesTabActive?.();
  }, [activeTab, onMessagesTabActive]);

  const hidden = {
    position: "absolute" as const,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    opacity: 0,
    pointerEvents: "none" as const,
    zIndex: 0,
  };
  const visible = { flex: 1, zIndex: 1 };

  return (
    <View style={[styles.tabsContainer, { backgroundColor: theme.bg }]}>
      <View style={styles.tabsContent}>
        <View style={activeTab === "home" ? visible : hidden}>
          <HomeScreen
            userName={user.name || ""}
            onNavigate={(t) => setActiveTab(t as TabId)}
            onOpenSearch={onOpenSearch}
          />
        </View>
        <View style={activeTab === "me" ? visible : hidden}>
          <MeScreen
            user={user}
            onEditProfile={onEditProfile}
            onOpenMyProfile={onOpenMyProfile}
            onOpenInfoPage={onOpenInfoPage}
            onOpenTopup={onOpenTopup}
            onOpenRevenues={onOpenRevenues}
            onOpenTaskCenter={onOpenTaskCenter}
            onOpenDecorations={onOpenDecorations}
            onOpenSettings={onOpenSettings}
            onOpenAdmirers={onOpenAdmirers}
            onOpenVisitors={onOpenVisitors}
            onOpenProfileLikers={onOpenProfileLikers}
            onOpenFollowing={onOpenFollowing}
            onOpenFriends={onOpenFriends}
          />
        </View>
        <View style={activeTab === "messages" ? visible : hidden}>
          <MessagesScreen onOpenChat={onOpenChat} onOpenGroupChat={onOpenGroupChat} />
        </View>
        <View style={activeTab === "club" ? visible : hidden}>
          <ClubScreen />
        </View>
        <View style={activeTab === "moment" ? visible : hidden}>
          <MomentScreen user={user} onWalletUpdate={onWalletUpdate} />
        </View>
      </View>
      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <TabIcon
            key={tab.id}
            tab={tab}
            active={activeTab === tab.id}
            onPress={() => setActiveTab(tab.id)}
          />
        ))}
      </View>
    </View>
  );
}

export default function Page() {
  const [fontsLoaded, fontError] = useFonts({ ...Ionicons.font });
  const [authState, setAuthState] = useState<AuthState>("splash");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [pinFromSignup, setPinFromSignup] = useState(false);
  const [user, setUser] = useState<User>(null);
  const [authResult, setAuthResult] = useState<Awaited<ReturnType<typeof checkAuthStatus>> | null>(null);
  const [splashDone, setSplashDone] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [showInfoPage, setShowInfoPage] = useState(false);
  const [showTopupPage, setShowTopupPage] = useState(false);
  const [showRevenuesPage, setShowRevenuesPage] = useState(false);
  const [showTaskCenterPage, setShowTaskCenterPage] = useState(false);
  const [showDecorationsPage, setShowDecorationsPage] = useState(false);
  const [showGroupChatPage, setShowGroupChatPage] = useState(false);
  const [returnToGroupChatAfterTopup, setReturnToGroupChatAfterTopup] = useState(false);
  const [showGroupChatUsersPage, setShowGroupChatUsersPage] = useState(false);
  const [showGroupChatMini, setShowGroupChatMini] = useState(false);
  const [userDismissedGroupChatMini, setUserDismissedGroupChatMini] = useState(false);
  const [groupChatSelectedSlot, setGroupChatSelectedSlot] = useState<string | null>(null);
  const [showSettingsPage, setShowSettingsPage] = useState(false);
  const [showPrivilegesPage, setShowPrivilegesPage] = useState(false);
  const [tabToReturnTo, setTabToReturnTo] = useState<TabId | null>(null);
  const [socialListType, setSocialListType] = useState<"admirers" | "following" | "friends" | "blocked" | null>(null);
  const [visitorsPageMode, setVisitorsPageMode] = useState<"visitors" | "profileLikers" | null>(null);
  const [selectedAdmirer, setSelectedAdmirer] = useState<{ user: SocialUser; isFriend: boolean } | null>(null);
  const [showSearchPage, setShowSearchPage] = useState(false);
  const [selectedSearchUser, setSelectedSearchUser] = useState<UserSearchResult | null>(null);
  const [selectedChatUser, setSelectedChatUser] = useState<UserSearchResult | null>(null);
  const [profileFromChatUser, setProfileFromChatUser] = useState<UserSearchResult | null>(null);
  const [profileFromGroupChatUser, setProfileFromGroupChatUser] = useState<UserSearchResult | null>(null);
  const [showMyProfilePage, setShowMyProfilePage] = useState(false);

  const openTaskCenter = useCallback(() => {
    setSelectedChatUser(null);
    setSelectedAdmirer(null);
    setSocialListType(null);
    setVisitorsPageMode(null);
    setSelectedSearchUser(null);
    setShowProfileEdit(false);
    setShowInfoPage(false);
    setShowTopupPage(false);
    setShowRevenuesPage(false);
    setShowSearchPage(false);
    setShowDecorationsPage(false);
    setShowGroupChatPage(false);
    setShowGroupChatMini(false);
    setGroupChatSelectedSlot(null);
    setShowSettingsPage(false);
    setShowPrivilegesPage(false);
    setShowMyProfilePage(false);
    setTabToReturnTo("me");
    setShowTaskCenterPage(true);
  }, []);

  const refreshUser = useCallback(async () => {
    const r = await checkAuthStatus();
    if (r.authenticated && r.user) setUser(r.user as User);
  }, []);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const pinRefs = useRef<(TextInput | null)[]>([]);

  // ——— تحقق سريع من AsyncStorage أولاً — عرض التطبيق فوراً ———
  // إعادة المحاولة بعد 400ms إذا فشل (AsyncStorage قد لا يكون جاهزاً فوراً عند التشغيل البارد)
  useEffect(() => {
    let cancelled = false;
    const run = (retry = false) => {
      checkAuthStatusQuick().then((r) => {
        if (cancelled) return;
        if (r.authenticated && r.user) {
          setAuthResult(r);
          setUser(r.user as User);
          setAuthState("main");
        } else if ((r.reason === "no_data" || r.reason === "error") && !retry) {
          setTimeout(() => run(true), 400);
        } else {
          setAuthResult(r);
          setAuthState("email");
        }
      });
    };
    run();
    return () => { cancelled = true; };
  }, []);

  // ——— Splash قصير (0.4 ثانية) ثم اختفاء ———
  useEffect(() => {
    if (authState !== "splash") return;
    const t = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setSplashDone(true));
    }, 400);
    return () => clearTimeout(t);
  }, [authState, fadeAnim]);

  // ——— عند عدم وجود جلسة محلية: الانتقال لشاشة البريد ———
  useEffect(() => {
    if (!splashDone || authResult === null) return;
    if (authState === "splash") {
      if (authResult.authenticated && authResult.user) {
        setUser(authResult.user as User);
        setAuthState("main");
      } else {
        setAuthState("email");
      }
    }
  }, [splashDone, authResult, authState]);


  // ——— عند ظهور شاشة البريد أو التسجيل: تحقق إضافي ———
  useEffect(() => {
    if (authState !== "email" && authState !== "signup") return;
    let cancelled = false;
    checkAuthStatus().then((r) => {
      if (cancelled) return;
      if (r.authenticated && r.user) {
        setUser(r.user as User);
        setAuthState("main");
      }
    });
    return () => { cancelled = true; };
  }, [authState]);

  // ——— تسجيل رمز الإشعارات + إشعار الأصدقاء بالاتصال عند فتح التطبيق ———
  useEffect(() => {
    if (authState === "main" && user) {
      registerPushTokenWithBackend();
      notifyFriendsOnline();
    }
  }, [authState, user?.id]);

  // ——— عند الضغط على إشعار رسالة — فتح المحادثة مع المرسل ———
  useEffect(() => {
    if (authState !== "main" || !user) return;
    const remove = setupNotificationResponseListener((u) => {
      setTabToReturnTo("messages");
      setSelectedChatUser({
        id: u.id,
        name: u.name,
        profileImage: u.profileImage || "",
        age: null,
        country: "",
        gender: "",
      });
    });
    return () => remove();
  }, [authState, user]);

  // ——— إعادة التحقق + إشعار الأصدقاء عند العودة للتطبيق + نبض اتصال ———
  useEffect(() => {
    if (authState !== "main" || !user) return;

    const verifySession = () => {
      checkAuthStatus().then((r) => {
        if (!r.authenticated || !r.user) {
          setUser(null);
          setAuthState("email");
        } else if (r.user) {
          setUser(r.user as User);
        }
      });
    };

    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        verifySession();
        notifyFriendsOnline();
        // نبض كل 2 ثانية — النقطة تختفي فوراً عند الإغلاق
        heartbeatInterval = setInterval(notifyFriendsOnline, 2000);
      } else {
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }
        notifyOffline();
      }
    });

    if (AppState.currentState === "active") {
      verifySession();
      heartbeatInterval = setInterval(notifyFriendsOnline, 2000);
    }

    const interval = setInterval(verifySession, 45000);

    return () => {
      sub.remove();
      clearInterval(interval);
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    };
  }, [authState, user]);

  // ——— نبض عند وجود المربع المصغر — لإبقاء المستخدم في الغرفة حتى يُحدّث الباك اند lastSeen ———
  useEffect(() => {
    if (!showGroupChatMini || showGroupChatPage) return;
    const t = setInterval(() => fetchGroupChatSlots().catch(() => {}), 1200);
    return () => clearInterval(t);
  }, [showGroupChatMini, showGroupChatPage]);

  const handleLogout = useCallback(async () => {
    try {
      await AsyncStorage.multiRemove(["token", "user", "userId", "authEmail"]);
      setUser(null);
      setAuthState("email");
      setEmail("");
      setPin(["", "", "", "", "", ""]);
    } catch (err) {
      console.error("Logout error:", err);
    }
  }, []);

  const requestPin = useCallback(async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError("أدخل بريدك الإلكتروني أو Gmail");
      return;
    }
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(trimmed)) {
      setError("أدخل بريداً إلكترونياً صحيحاً");
      return;
    }
    setError("");
    setSuccessMsg("");
    setLoading(true);
    const doRequest = async (retries = 3) => {
      try {
        const res = await axios.post(
          `${API_BASE_URL}/api/auth/request-pin`,
          { email: trimmed, mode: "login" },
          { timeout: 15000 }
        );
        if (res.data?.success) {
          setEmail(trimmed);
          setSuccessMsg("تم إرسال الكود إلى بريدك");
          setPinFromSignup(false);
          setAuthState("pin");
          setPin(["", "", "", "", "", ""]);
          setTimeout(() => pinRefs.current[0]?.focus(), 300);
        } else {
          setError(res.data?.message || "فشل إرسال الكود");
        }
      } catch (err: unknown) {
        const isNetwork =
          (err as { code?: string })?.code === "ERR_NETWORK" ||
          (err as { code?: string })?.code === "ECONNABORTED" ||
          String((err as Error)?.message || "").toLowerCase().includes("network");
        if (retries > 0 && isNetwork) {
          await new Promise((r) => setTimeout(r, 500));
          return doRequest(retries - 1);
        }
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          (err as Error)?.message ||
          "تحقق من الاتصال وحاول مرة أخرى";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    await doRequest();
  }, [email]);

  const requestPinSignup = useCallback(async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError("أدخل بريدك الإلكتروني أو Gmail");
      return;
    }
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(trimmed)) {
      setError("أدخل بريداً إلكترونياً صحيحاً");
      return;
    }
    setError("");
    setSuccessMsg("");
    setLoading(true);
    const doRequest = async (retries = 3) => {
      try {
        const res = await axios.post(
          `${API_BASE_URL}/api/auth/request-pin`,
          { email: trimmed, mode: "signup" },
          { timeout: 15000 }
        );
        if (res.data?.success) {
          setEmail(trimmed);
          setSuccessMsg("تم إرسال كود التفعيل إلى بريدك");
          setPinFromSignup(true);
          setAuthState("pin");
          setPin(["", "", "", "", "", ""]);
          setTimeout(() => pinRefs.current[0]?.focus(), 300);
        } else {
          setError(res.data?.message || "فشل إرسال الكود");
        }
      } catch (err: unknown) {
        const isNetwork =
          (err as { code?: string })?.code === "ERR_NETWORK" ||
          (err as { code?: string })?.code === "ECONNABORTED" ||
          String((err as Error)?.message || "").toLowerCase().includes("network");
        if (retries > 0 && isNetwork) {
          await new Promise((r) => setTimeout(r, 500));
          return doRequest(retries - 1);
        }
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          (err as Error)?.message ||
          "تحقق من الاتصال وحاول مرة أخرى";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    await doRequest();
  }, [email]);

  const verifyPin = useCallback(async () => {
    const pinStr = pin.join("");
    if (pinStr.length !== 6) {
      setError("أدخل الكود المكوّن من 6 أرقام");
      return;
    }
    setError("");
    setLoading(true);
    const doVerify = async (retries = 2) => {
      try {
        const res = await axios.post(
          `${API_BASE_URL}/api/auth/verify-pin`,
          { email: email.trim().toLowerCase(), pin: pinStr },
          { timeout: 12000 }
        );
        if (res.data?.success && res.data.token && res.data.user) {
          const u = res.data.user;
          await AsyncStorage.multiSet([
            ["token", res.data.token],
            ["user", JSON.stringify(u)],
            ["userId", String(u?.id ?? "")],
          ]);
          setUser(u);
          preloadFromBackend();
          setAuthState("main");
        } else {
          setError(res.data?.message || "فشل التحقق");
        }
      } catch (err: unknown) {
        const isNetwork =
          (err as { code?: string })?.code === "ERR_NETWORK" ||
          (err as { code?: string })?.code === "ECONNABORTED" ||
          String((err as Error)?.message || "").toLowerCase().includes("network");
        if (retries > 0 && isNetwork) {
          await new Promise((r) => setTimeout(r, 500));
          return doVerify(retries - 1);
        }
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          (err as Error)?.message ||
          "تحقق من الاتصال وحاول مرة أخرى";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    await doVerify();
  }, [email, pin]);

  const handlePinChange = (index: number, value: string) => {
    if (value.length > 1) {
      const digits = value.replace(/\D/g, "").slice(0, 6).split("");
      const next = [...pin];
      digits.forEach((d, i) => {
        if (index + i < 6) next[index + i] = d;
      });
      setPin(next);
      const nextIdx = Math.min(index + digits.length, 5);
      pinRefs.current[nextIdx]?.focus();
      return;
    }
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...pin];
    next[index] = digit;
    setPin(next);
    if (digit && index < 5) pinRefs.current[index + 1]?.focus();
  };

  const handlePinKeyPress = (index: number, key: string) => {
    if (key === "Backspace" && !pin[index] && index > 0) {
      pinRefs.current[index - 1]?.focus();
    }
  };

  const resendPin = useCallback(async () => {
    setError("");
    setLoading(true);
    const body: { email: string; mode?: string } = { email: email.trim().toLowerCase() };
    if (!pinFromSignup) body.mode = "login";
    if (pinFromSignup) body.mode = "signup";
    const doResend = async (retries = 3) => {
      try {
        const res = await axios.post(
          `${API_BASE_URL}/api/auth/request-pin`,
          body,
          { timeout: 15000 }
        );
        if (res.data?.success) {
          setSuccessMsg("تم إعادة إرسال الكود");
          setPin(["", "", "", "", "", ""]);
          pinRefs.current[0]?.focus();
        } else {
          setError(res.data?.message || "فشل إعادة الإرسال");
        }
      } catch (err: unknown) {
        const isNetwork =
          (err as { code?: string })?.code === "ERR_NETWORK" ||
          (err as { code?: string })?.code === "ECONNABORTED" ||
          String((err as Error)?.message || "").toLowerCase().includes("network");
        if (retries > 0 && isNetwork) {
          await new Promise((r) => setTimeout(r, 500));
          return doResend(retries - 1);
        }
        setError("تحقق من الاتصال وحاول مرة أخرى");
      } finally {
        setLoading(false);
      }
    };
    await doResend();
  }, [email, pinFromSignup]);

  // ——— انتظار تحميل الخطوط (Ionicons) قبل عرض أي واجهة ———
  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1 }}>
        <OfflineBanner />
        <View style={{ flex: 1, backgroundColor: "#1a1625" }} />
      </View>
    );
  }

  // ——— شاشة البداية (Splash) ———
  if (authState === "splash") {
    return (
      <View style={{ flex: 1 }}>
        <OfflineBanner />
        <ThemeProvider>
        <LanguageProvider>
        <AppAlertProvider>
        <Animated.View style={[styles.splashContainer, { opacity: fadeAnim }]}>
          <View style={styles.splashContent}>
            <LottieView
              source={require("../assets/images/3D Treasure Box (1).json")}
              autoPlay
              loop={false}
              style={styles.lottie}
            />
          </View>
        </Animated.View>
      </AppAlertProvider>
      </LanguageProvider>
      </ThemeProvider>
      </View>
    );
  }

  // ——— الشاشة الرئيسية: تبويبات (أنا، رسائل، نادي، لحظة) أو صفحة الملف إذا غير مكتمل ———
  if (authState === "main" && user) {
    if (selectedChatUser) {
      const meAsProfile: UserSearchResult = {
        id: user.id,
        name: user.name,
        profileImage: user.profileImage || "",
        age: user.age ?? null,
        country: user.country || "",
        gender: user.gender || "",
      };
      if (profileFromChatUser) {
        return (
          <View style={{ flex: 1 }}>
            <OfflineBanner />
            <ThemeProvider>
            <LanguageProvider>
            <PrivilegesProvider>
            <>
            <AppAlertProvider>
              <UserProfileScreen
                user={profileFromChatUser}
                currentUser={user ? { id: user.id, name: user.name, profileImage: user.profileImage, age: user.age, country: user.country, gender: user.gender } : null}
                onBack={() => setProfileFromChatUser(null)}
                onOpenChat={() => setProfileFromChatUser(null)}
                onWalletUpdate={refreshUser}
                onOpenTopup={() => { setProfileFromChatUser(null); setTabToReturnTo("messages"); setShowTopupPage(true); }}
              />
            </AppAlertProvider>
            <CheckInContinuousModal visible onClose={() => {}} onOpenTaskCenter={openTaskCenter} onWalletUpdate={refreshUser} />
          </>
          </PrivilegesProvider>
          </LanguageProvider>
        </ThemeProvider>
          </View>
        );
      }
      return (
        <View style={{ flex: 1 }}>
          <OfflineBanner />
          <ThemeProvider>
        <LanguageProvider>
        <>
          <AppAlertProvider>
            <ChatScreen
              me={{ id: user.id, name: user.name, profileImage: user.profileImage }}
              other={selectedChatUser}
              onBack={() => setSelectedChatUser(null)}
              onOpenMyProfile={() => setProfileFromChatUser(meAsProfile)}
              onOpenOtherProfile={() => setProfileFromChatUser(selectedChatUser)}
              onOpenTopup={() => {
                setTabToReturnTo("messages");
                setSelectedChatUser(null);
                setShowTopupPage(true);
              }}
              onWalletUpdate={refreshUser}
            />
          </AppAlertProvider>
          <CheckInContinuousModal visible onClose={() => {}} onOpenTaskCenter={openTaskCenter} onWalletUpdate={refreshUser} />
        </>
        </LanguageProvider>
      </ThemeProvider>
        </View>
      );
    }
    const profileComplete = isProfileComplete(user);
    if (showProfileEdit || !profileComplete) {
      return (
        <View style={{ flex: 1 }}>
          <OfflineBanner />
          <ThemeProvider>
        <LanguageProvider>
        <>
          <AppAlertProvider>
            <ProfileScreen
              user={user}
              onUserUpdate={setUser}
              onBack={profileComplete ? () => setShowProfileEdit(false) : undefined}
            />
          </AppAlertProvider>
          <CheckInContinuousModal visible onClose={() => {}} onOpenTaskCenter={openTaskCenter} onWalletUpdate={refreshUser} />
        </>
        </LanguageProvider>
      </ThemeProvider>
        </View>
      );
    }
    if (showInfoPage) {
      return (
        <View style={{ flex: 1 }}>
          <OfflineBanner />
          <ThemeProvider>
        <LanguageProvider>
        <>
          <AppAlertProvider>
            <InfoScreen user={user} onBack={() => setShowInfoPage(false)} />
          </AppAlertProvider>
          <CheckInContinuousModal visible onClose={() => {}} onOpenTaskCenter={openTaskCenter} onWalletUpdate={refreshUser} />
        </>
        </LanguageProvider>
      </ThemeProvider>
        </View>
      );
    }
    if (showMyProfilePage) {
      const meAsProfile: UserSearchResult = {
        id: user.id,
        name: user.name,
        profileImage: user.profileImage || "",
        age: user.age ?? null,
        country: user.country || "",
        gender: user.gender || "",
      };
      return (
        <View style={{ flex: 1 }}>
          <OfflineBanner />
          <ThemeProvider>
        <LanguageProvider>
        <PrivilegesProvider>
        <>
          <AppAlertProvider>
            <UserProfileScreen
              user={meAsProfile}
              currentUser={{ id: user.id, name: user.name, profileImage: user.profileImage, age: user.age, country: user.country, gender: user.gender }}
              onBack={() => setShowMyProfilePage(false)}
              onWalletUpdate={refreshUser}
              onOpenTopup={() => { setShowMyProfilePage(false); setTabToReturnTo("me"); setShowTopupPage(true); }}
            />
          </AppAlertProvider>
          <CheckInContinuousModal visible onClose={() => {}} onOpenTaskCenter={openTaskCenter} onWalletUpdate={refreshUser} />
        </>
        </PrivilegesProvider>
        </LanguageProvider>
      </ThemeProvider>
        </View>
      );
    }
    if (showTopupPage) {
      return (
        <View style={{ flex: 1 }}>
          <OfflineBanner />
          <ThemeProvider>
        <LanguageProvider>
        <>
          <AppAlertProvider>
            <TopupScreen
              onBack={() => {
                setShowTopupPage(false);
                if (returnToGroupChatAfterTopup) {
                  setReturnToGroupChatAfterTopup(false);
                  setShowGroupChatPage(true);
                  setShowGroupChatMini(false);
                }
              }}
            />
          </AppAlertProvider>
          <CheckInContinuousModal visible onClose={() => {}} onOpenTaskCenter={openTaskCenter} onWalletUpdate={refreshUser} />
        </>
        </LanguageProvider>
      </ThemeProvider>
        </View>
      );
    }
    if (showRevenuesPage) {
      return (
        <View style={{ flex: 1 }}>
          <OfflineBanner />
          <ThemeProvider>
        <LanguageProvider>
        <>
          <AppAlertProvider>
            <RevenuesScreen onBack={() => setShowRevenuesPage(false)} />
          </AppAlertProvider>
          <CheckInContinuousModal visible onClose={() => {}} onOpenTaskCenter={openTaskCenter} onWalletUpdate={refreshUser} />
        </>
        </LanguageProvider>
      </ThemeProvider>
        </View>
      );
    }
    if (showTaskCenterPage) {
      const handleNavigateTo = (section: "messages" | "moments" | "profile" | "social") => {
        setShowTaskCenterPage(false);
        if (section === "social") {
          setSocialListType("friends");
        } else {
          const map: Record<string, TabId> = { messages: "messages", moments: "moment", profile: "me" };
          setTabToReturnTo(map[section] ?? "home");
        }
      };
      return (
        <View style={{ flex: 1 }}>
          <OfflineBanner />
          <ThemeProvider>
        <LanguageProvider>
        <>
          <AppAlertProvider>
            <TaskCenterScreen
              onBack={() => setShowTaskCenterPage(false)}
              onWalletUpdate={refreshUser}
              onNavigateTo={handleNavigateTo}
            />
          </AppAlertProvider>
          <CheckInContinuousModal visible onClose={() => {}} onWalletUpdate={refreshUser} />
        </>
        </LanguageProvider>
      </ThemeProvider>
        </View>
      );
    }
    if (showDecorationsPage) {
      return (
        <View style={{ flex: 1 }}>
          <OfflineBanner />
          <ThemeProvider>
        <LanguageProvider>
        <>
          <AppAlertProvider>
            <DecorationsScreen onBack={() => setShowDecorationsPage(false)} />
          </AppAlertProvider>
          <CheckInContinuousModal visible onClose={() => {}} onOpenTaskCenter={openTaskCenter} onWalletUpdate={refreshUser} />
        </>
        </LanguageProvider>
      </ThemeProvider>
        </View>
      );
    }
    if (showSettingsPage) {
      return (
        <View style={{ flex: 1 }}>
          <OfflineBanner />
          <ThemeProvider>
        <LanguageProvider>
        <PrivilegesProvider>
        <>
          <AppAlertProvider>
            {showPrivilegesPage ? (
              <PrivilegesScreen onBack={() => setShowPrivilegesPage(false)} />
            ) : (
              <SettingsScreen
                onBack={() => { setShowSettingsPage(false); setShowPrivilegesPage(false); }}
                onLogout={handleLogout}
                onOpenPrivileges={() => setShowPrivilegesPage(true)}
              />
            )}
          </AppAlertProvider>
          <CheckInContinuousModal visible onClose={() => {}} onOpenTaskCenter={openTaskCenter} onWalletUpdate={refreshUser} />
        </>
        </PrivilegesProvider>
        </LanguageProvider>
      </ThemeProvider>
        </View>
      );
    }
    if (socialListType || visitorsPageMode) {
      if (selectedAdmirer) {
        const { user: admirerUser, isFriend } = selectedAdmirer;
        const profileUser: UserSearchResult = {
          id: admirerUser.id,
          name: admirerUser.name,
          profileImage: admirerUser.profileImage,
          age: admirerUser.age,
          country: admirerUser.country,
          gender: admirerUser.gender,
        };
        return (
          <View style={{ flex: 1 }}>
            <OfflineBanner />
            <ThemeProvider>
          <LanguageProvider>
          <PrivilegesProvider>
          <>
            <AppAlertProvider>
              <UserProfileScreen
                user={profileUser}
                currentUser={user ? { id: user.id, name: user.name, profileImage: user.profileImage, age: user.age, country: user.country, gender: user.gender } : null}
                onBack={() => setSelectedAdmirer(null)}
                fromAdmirers={!!socialListType}
                isFriend={isFriend}
                onAcceptFriend={() => setSelectedAdmirer(null)}
                onOpenChat={(u: UserSearchResult) => setSelectedChatUser(u)}
                onWalletUpdate={refreshUser}
                onOpenTopup={() => { setSocialListType(null); setVisitorsPageMode(null); setSelectedAdmirer(null); setShowTopupPage(true); }}
              />
            </AppAlertProvider>
            <CheckInContinuousModal visible onClose={() => {}} onOpenTaskCenter={openTaskCenter} onWalletUpdate={refreshUser} />
          </>
          </PrivilegesProvider>
          </LanguageProvider>
        </ThemeProvider>
          </View>
        );
      }
      if (socialListType) {
        return (
          <View style={{ flex: 1 }}>
            <OfflineBanner />
            <ThemeProvider>
          <LanguageProvider>
          <>
            <AppAlertProvider>
              <SocialListScreen
                type={socialListType}
                currentUserId={user?.id}
                onBack={() => { setSocialListType(null); setVisitorsPageMode(null); setSelectedAdmirer(null); }}
                onSwitchType={setSocialListType}
                onAdmirerPress={(u, isFriend) => setSelectedAdmirer({ user: u, isFriend })}
              />
            </AppAlertProvider>
            <CheckInContinuousModal visible onClose={() => {}} onOpenTaskCenter={openTaskCenter} onWalletUpdate={refreshUser} />
          </>
          </LanguageProvider>
        </ThemeProvider>
          </View>
        );
      }
      return (
        <View style={{ flex: 1 }}>
          <OfflineBanner />
          <ThemeProvider>
        <LanguageProvider>
        <>
          <AppAlertProvider>
            <VisitorsScreen
              mode={visitorsPageMode}
              currentUserId={user?.id}
              onBack={() => { setVisitorsPageMode(null); setSelectedAdmirer(null); }}
              onUserPress={(u, isFriend) => setSelectedAdmirer({ user: u, isFriend })}
            />
          </AppAlertProvider>
          <CheckInContinuousModal visible onClose={() => {}} onOpenTaskCenter={openTaskCenter} onWalletUpdate={refreshUser} />
        </>
        </LanguageProvider>
      </ThemeProvider>
        </View>
      );
    }
    if (showSearchPage) {
      if (selectedSearchUser) {
        return (
          <View style={{ flex: 1 }}>
            <OfflineBanner />
            <ThemeProvider>
          <LanguageProvider>
          <PrivilegesProvider>
          <>
            <AppAlertProvider>
              <UserProfileScreen
                user={selectedSearchUser}
                currentUser={user ? { id: user.id, name: user.name, profileImage: user.profileImage, age: user.age, country: user.country, gender: user.gender } : null}
                onBack={() => setSelectedSearchUser(null)}
                onOpenChat={(u: UserSearchResult) => setSelectedChatUser(u)}
                onWalletUpdate={refreshUser}
                onOpenTopup={() => { setShowSearchPage(false); setSelectedSearchUser(null); setShowTopupPage(true); }}
              />
            </AppAlertProvider>
            <CheckInContinuousModal visible onClose={() => {}} onOpenTaskCenter={openTaskCenter} onWalletUpdate={refreshUser} />
          </>
          </PrivilegesProvider>
          </LanguageProvider>
        </ThemeProvider>
          </View>
        );
      }
      return (
        <View style={{ flex: 1 }}>
          <OfflineBanner />
          <ThemeProvider>
        <LanguageProvider>
        <>
          <AppAlertProvider>
            <SearchScreen
              onBack={() => {
                setShowSearchPage(false);
                setSelectedSearchUser(null);
              }}
              onUserPress={(u: UserSearchResult) => setSelectedSearchUser(u)}
            />
          </AppAlertProvider>
          <CheckInContinuousModal visible onClose={() => {}} onOpenTaskCenter={openTaskCenter} onWalletUpdate={refreshUser} />
        </>
        </LanguageProvider>
      </ThemeProvider>
        </View>
      );
    }
    return (
      <View style={{ flex: 1 }}>
        <OfflineBanner />
        <ThemeProvider>
      <LanguageProvider>
      <PrivilegesProvider>
      <>
        <AppAlertProvider>
          <View style={{ flex: 1 }}>
            <MainTabsScreen
              user={user}
              onEditProfile={() => { setTabToReturnTo("me"); setShowProfileEdit(true); }}
              onOpenInfoPage={() => { setTabToReturnTo("me"); setShowInfoPage(true); }}
              onOpenTopup={() => { setTabToReturnTo("me"); setShowTopupPage(true); }}
              onOpenRevenues={() => { setTabToReturnTo("me"); setShowRevenuesPage(true); }}
              onOpenTaskCenter={() => { setTabToReturnTo("me"); setShowTaskCenterPage(true); }}
              onOpenDecorations={() => { setTabToReturnTo("me"); setShowDecorationsPage(true); }}
              onOpenSettings={() => { setTabToReturnTo("me"); setShowSettingsPage(true); }}
              onOpenAdmirers={() => { setTabToReturnTo("me"); setSocialListType("admirers"); }}
              onOpenVisitors={() => { setTabToReturnTo("me"); setVisitorsPageMode("visitors"); }}
              onOpenProfileLikers={() => { setTabToReturnTo("me"); setVisitorsPageMode("profileLikers"); }}
              onOpenFollowing={() => { setTabToReturnTo("me"); setSocialListType("following"); }}
              onOpenFriends={() => { setTabToReturnTo("me"); setSocialListType("friends"); }}
              onOpenSearch={() => { setTabToReturnTo("home"); setShowSearchPage(true); }}
              onOpenChat={(u: UserSearchResult) => setSelectedChatUser(u)}
              onOpenGroupChat={() => {
                setTabToReturnTo("messages");
                setUserDismissedGroupChatMini(false);
                setShowGroupChatPage(true);
              }}
              onMessagesTabActive={() => {}}
              onOpenMyProfile={() => { setTabToReturnTo("me"); setShowMyProfilePage(true); }}
              onWalletUpdate={refreshUser}
              initialTab={tabToReturnTo}
              onTabRestored={() => setTabToReturnTo(null)}
            />
            {showGroupChatPage && user && (
              <View style={[StyleSheet.absoluteFill, { zIndex: 9999 }]}>
                <GroupChatScreen
                  user={user}
                  selectedSlot={groupChatSelectedSlot}
                  onSelectedSlotChange={setGroupChatSelectedSlot}
                  onBack={() => {
                    setShowGroupChatPage(false);
                    setShowGroupChatUsersPage(false);
                    setShowGroupChatMini(true);
                  }}
                  onOpenTopup={() => {
                    setTabToReturnTo("messages");
                    setReturnToGroupChatAfterTopup(true);
                    setShowGroupChatPage(false);
                    setShowTopupPage(true);
                  }}
                  onOpenUsers={() => setShowGroupChatUsersPage(true)}
                  onOpenProfile={(slot) => {
                    const profileUser: UserSearchResult = {
                      id: slot.userId,
                      name: slot.name || "",
                      profileImage: slot.profileImage || "",
                      age: null,
                      country: "",
                      gender: "",
                    };
                    setProfileFromGroupChatUser(profileUser);
                  }}
                />
              </View>
            )}
            {showGroupChatUsersPage && (
              <View style={[StyleSheet.absoluteFill, { zIndex: 10000 }]}>
                <GroupChatUsersScreen onBack={() => setShowGroupChatUsersPage(false)} currentUserId={user?.id} />
              </View>
            )}
            {profileFromGroupChatUser && showGroupChatPage && user && (
              <View style={[StyleSheet.absoluteFill, { zIndex: 10001 }]}>
                <UserProfileScreen
                  user={profileFromGroupChatUser}
                  currentUser={{ id: user.id, name: user.name, profileImage: user.profileImage, age: user.age, country: user.country, gender: user.gender }}
                  onBack={() => setProfileFromGroupChatUser(null)}
                  onOpenChat={() => {
                    setSelectedChatUser(profileFromGroupChatUser);
                    setProfileFromGroupChatUser(null);
                    setTabToReturnTo("messages");
                  }}
                  onWalletUpdate={refreshUser}
                  onOpenTopup={() => {
                    setProfileFromGroupChatUser(null);
                    setTabToReturnTo("messages");
                    setShowGroupChatPage(false);
                    setShowTopupPage(true);
                  }}
                />
              </View>
            )}
            {showGroupChatMini && !showGroupChatPage && (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    zIndex: 9998,
                    pointerEvents: "box-none",
                    elevation: 9998,
                    backgroundColor: "transparent",
                  },
                ]}
                pointerEvents="box-none"
                collapsable={false}
              >
                <GroupChatMiniFloating
                  onOpen={() => {
                    setTabToReturnTo("messages");
                    setUserDismissedGroupChatMini(false);
                    setShowGroupChatPage(true);
                  }}
                  onClose={() => {
                    setShowGroupChatMini(false);
                    setUserDismissedGroupChatMini(true);
                    setGroupChatSelectedSlot(null);
                    leaveGroupChat().catch(() => {});
                  }}
                />
              </View>
            )}
          </View>
        </AppAlertProvider>
        <CheckInContinuousModal visible onClose={() => {}} onOpenTaskCenter={openTaskCenter} onWalletUpdate={refreshUser} />
      </>
      </PrivilegesProvider>
      </LanguageProvider>
    </ThemeProvider>
      </View>
    );
  }

  // ——— تسجيل الدخول / التسجيل: البريد ثم الكود ———
  const isPinStep = authState === "pin";
  const isSignup = authState === "signup";

  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
      <AppAlertProvider>
      <KeyboardAvoidingView
        style={styles.loginContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 0}
      >
        <ScrollView
          style={styles.loginScroll}
          contentContainerStyle={styles.loginScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.loginInner}>
          {/* أنيميشن صندوق الكنز فوق النموذج */}
          <View style={styles.lottieWrap}>
            <LottieView
              source={require("../assets/images/3D Treasure Box (1).json")}
              autoPlay
              loop
              style={styles.loginLottie}
            />
          </View>

          <View style={styles.loginHeader}>
            <Text style={styles.loginTitle}>
              {isPinStep ? "أدخل الكود" : isSignup ? "إنشاء حساب" : "تسجيل الدخول"}
            </Text>
            <Text style={styles.loginSub}>
              {isPinStep
                ? `تم إرسال كود مكوّن من 6 أرقام إلى ${email}`
                : isSignup
                  ? "أدخل بريدك الإلكتروني وسنرسل لك كوداً لتفعيل حسابك"
                  : "أدخل بريدك الإلكتروني المسجّل وسنرسل لك كوداً للدخول"}
            </Text>
          </View>

          {/* محتوى بدون كارت — إطار ذهبي فقط */}
          <View style={styles.goldFrame}>
            {!isPinStep ? (
              <>
                <Text style={styles.label}>البريد الإلكتروني</Text>
                <TextInput
                  style={styles.input}
                  placeholder="example@gmail.com"
                  placeholderTextColor={TEXT_MUTED}
                  value={email}
                  onChangeText={(t) => { setEmail(t); setError(""); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
                <TouchableOpacity
                  style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
                  onPress={isSignup ? requestPinSignup : requestPin}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#0d1b2a" />
                  ) : (
                    <Text style={styles.primaryBtnText}>{isSignup ? "إرسال كود التفعيل" : "إرسال الكود"}</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.switchAuthBtn}
                  onPress={() => { setAuthState(isSignup ? "email" : "signup"); setError(""); setSuccessMsg(""); }}
                  disabled={loading}
                >
                  <Text style={styles.switchAuthText}>
                    {isSignup ? "لديك حساب؟ سجّل دخولك" : "ليس لديك حساب؟ قم بالتسجيل"}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
            <>
              <View style={styles.pinRow}>
                {pin.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={(r) => { pinRefs.current[i] = r; }}
                    style={[styles.pinBox, digit ? styles.pinBoxFilled : null]}
                    value={digit}
                    onChangeText={(v) => handlePinChange(i, v)}
                    onKeyPress={({ nativeEvent }) => handlePinKeyPress(i, nativeEvent.key)}
                    keyboardType="number-pad"
                    maxLength={6}
                    selectTextOnFocus
                    editable={!loading}
                  />
                ))}
              </View>
              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
                onPress={verifyPin}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#0d1b2a" />
                ) : (
                  <Text style={styles.primaryBtnText}>تأكيد الدخول</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.resendBtn}
                onPress={resendPin}
                disabled={loading}
              >
                <Text style={styles.resendText}>إعادة إرسال الكود</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => { setAuthState(pinFromSignup ? "signup" : "email"); setError(""); setSuccessMsg(""); }}
                disabled={loading}
              >
                <Text style={styles.backBtnText}>تغيير البريد</Text>
              </TouchableOpacity>
            </>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {successMsg ? <Text style={styles.successText}>{successMsg}</Text> : null}
        </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppAlertProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: PURPLE_DARK,
    justifyContent: "center",
    alignItems: "center",
  },
  splashContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  lottie: {
    width: width * 0.7,
    height: width * 0.7,
    maxWidth: 320,
    maxHeight: 320,
  },
  loginContainer: {
    flex: 1,
    backgroundColor: PURPLE_DARK,
  },
  loginScroll: {
    flex: 1,
  },
  loginScrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  loginInner: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
  },
  lottieWrap: {
    alignItems: "center",
    marginBottom: 8,
  },
  loginLottie: {
    width: width * 0.36,
    height: width * 0.36,
    maxWidth: 130,
    maxHeight: 130,
  },
  loginHeader: {
    marginBottom: 16,
  },
  loginTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: TEXT_LIGHT,
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  loginSub: {
    fontSize: 13,
    color: TEXT_MUTED,
    lineHeight: 20,
  },
  goldFrame: {
    borderRadius: 20,
    padding: 20,
  },
  label: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginBottom: 8,
    fontWeight: "400",
  },
  input: {
    backgroundColor: INPUT_BG,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: TEXT_LIGHT,
    borderWidth: 0,
    marginBottom: 16,
  },
  primaryBtn: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    borderWidth: 0,
  },
  primaryBtnDisabled: {
    opacity: 0.65,
  },
  primaryBtnText: {
    color: PURPLE_DARK,
    fontSize: 14,
    fontWeight: "600",
  },
  switchAuthBtn: {
    marginTop: 16,
    alignItems: "center",
    paddingVertical: 8,
  },
  switchAuthText: {
    fontSize: 13,
    color: ACCENT_SOFT,
    fontWeight: "500",
  },
  pinRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
    gap: 8,
  },
  pinBox: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 44,
    backgroundColor: INPUT_BG,
    borderRadius: 12,
    borderWidth: 0,
    fontSize: 18,
    fontWeight: "600",
    color: TEXT_LIGHT,
    textAlign: "center",
  },
  pinBoxFilled: {
    backgroundColor: ACCENT_MUTED,
  },
  resendBtn: {
    marginTop: 14,
    alignItems: "center",
  },
  resendText: {
    color: ACCENT_SOFT,
    fontSize: 13,
    fontWeight: "500",
  },
  backBtn: {
    marginTop: 10,
    alignItems: "center",
  },
  backBtnText: {
    color: TEXT_MUTED,
    fontSize: 12,
  },
  errorText: {
    color: "#fca5a5",
    fontSize: 12,
    marginTop: 14,
    textAlign: "center",
  },
  successText: {
    color: "#86efac",
    fontSize: 12,
    marginTop: 14,
    textAlign: "center",
  },
  mainContainer: {
    flex: 1,
    backgroundColor: PURPLE_DARK,
  },
  profileScroll: {
    flex: 1,
  },
  profileScrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  profileCard: {
    padding: 20,
  },
  profileTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: TEXT_LIGHT,
    marginBottom: 20,
  },
  rowNameImage: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    gap: 16,
  },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: "hidden",
    backgroundColor: INPUT_BG,
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarPlaceholderText: {
    fontSize: 28,
    color: TEXT_MUTED,
  },
  nameCountryWrap: {
    flex: 1,
  },
  inputName: {
    backgroundColor: INPUT_BG,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: TEXT_LIGHT,
    marginBottom: 8,
  },
  countryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  flagText: {
    fontSize: 18,
  },
  countryName: {
    fontSize: 12,
    color: TEXT_MUTED,
    flex: 1,
  },
  rowMonthYear: {
    flexDirection: "column",
    gap: 10,
    marginBottom: 12,
  },
  pickerScroll: {
    maxHeight: 44,
    marginBottom: 4,
  },
  pickerChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: INPUT_BG,
    marginHorizontal: 4,
    alignSelf: "flex-start",
  },
  pickerChipActive: {
    backgroundColor: ACCENT_MUTED,
  },
  pickerChipText: {
    fontSize: 13,
    color: TEXT_LIGHT,
  },
  pickerChipTextActive: {
    color: ACCENT_SOFT,
    fontWeight: "600",
  },
  genderRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  genderBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: INPUT_BG,
    alignItems: "center",
  },
  genderBtnActive: {
    backgroundColor: ACCENT_MUTED,
  },
  genderIcon: {
    fontSize: 24,
    color: TEXT_LIGHT,
    marginBottom: 4,
  },
  genderLabel: {
    fontSize: 13,
    color: TEXT_MUTED,
  },
  genderLabelActive: {
  
    fontWeight: "600",
  },
  lockedHint: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginBottom: 16,
  },
  profileTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    gap: 12,
  },
  backToTabsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  backToTabsText: {
    fontSize: 14,
    color: ACCENT_SOFT,
    fontWeight: "500",
  },
  tabsContainer: {
    flex: 1,
    backgroundColor: PURPLE_DARK,
  },
  tabsContent: {
    flex: 1,
    paddingBottom: 1,
  },
  floatingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  tabBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 4,
    paddingHorizontal: 6,
    paddingBottom: Platform.OS === "ios" ? 8 : 6,
    marginHorizontal: 12,
    marginBottom: Platform.OS === "ios" ? 0 : 70,
    backgroundColor: CARD_BG,
    borderRadius: 18,
    borderWidth: 0,
    borderColor: BORDER_SOFT,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: -4,
  },
  tabIconWrap: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  tabGlow: {
    position: "absolute",
    width: 44,
    height: 36,
    borderRadius: 22,
    top: -2,
    zIndex: -1,
  },
  tabIconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1.5,
    borderColor: "transparent",
    shadowOffset: { width: 0, height: 2 },
  },
  tabEmoji: {
    fontSize: 18,
  },
  tabEmojiInactive: {
    opacity: 0.6,
  },
  tabDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  tabLabel: {
    fontSize: 10,
    color: TEXT_MUTED,
    fontWeight: "500",
    marginTop: 2,
 },
});
