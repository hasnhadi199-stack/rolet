import { useCallback, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { searchUsersById, type UserSearchResult } from "../../utils/usersApi";
import { getFlagEmoji, getCountryName } from "../../utils/countries";

const ACCENT_SOFT = "#c4b5fd";
const ACCENT_MUTED = "rgba(167, 139, 250, 0.25)";
const TEXT_LIGHT = "#f5f3ff";
const TEXT_MUTED = "#a1a1aa";
const CARD_BG = "rgba(45, 38, 64, 0.6)";
const BORDER_SOFT = "rgba(167, 139, 250, 0.2)";
const INPUT_BG = "rgba(255,255,255,0.06)";

type Props = {
  onBack: () => void;
  onUserPress: (user: UserSearchResult) => void;
};

export default function SearchScreen({ onBack, onUserPress }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    setSearchResults([]);
    try {
      const users = await searchUsersById(q);
      setSearchResults(users);
      if (users.length === 0) setSearchError("لم يتم العثور على مستخدمين");
    } catch {
      setSearchError("حدث خطأ أثناء البحث");
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="arrow-forward" size={22} color={ACCENT_SOFT} />
          <Text style={styles.backText}>رجوع</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>البحث بالمعرف</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* شريط بحث مع زر البحث بداخله */}
        <View style={styles.searchBar}>
          <TouchableOpacity
            style={styles.searchBtnInside}
            onPress={handleSearch}
            activeOpacity={0.85}
            disabled={searching || !searchQuery.trim()}
          >
            {searching ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="search" size={20} color="#fff" />
            )}
          </TouchableOpacity>
          <TextInput
            style={styles.searchInput}
            placeholder="ابحث بالمعرف..."
            placeholderTextColor={TEXT_MUTED}
            value={searchQuery}
            onChangeText={(t) => {
              setSearchQuery(t);
              setSearchError(null);
            }}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            editable={!searching}
          />
        </View>

        {/* نتائج البحث */}
        {searchResults.length > 0 && (
          <View style={styles.resultsSection}>
            <Text style={styles.resultsTitle}>نتائج البحث ({searchResults.length})</Text>
            {searchResults.map((u) => (
              <TouchableOpacity
                key={u.id}
                style={styles.userRow}
                activeOpacity={0.85}
                onPress={() => onUserPress(u)}
              >
                {u.profileImage ? (
                  <Image source={{ uri: u.profileImage }} style={styles.userAvatar} />
                ) : (
                  <View style={[styles.userAvatar, styles.userAvatarPlaceholder]}>
                    <Ionicons name="person" size={24} color={TEXT_MUTED} />
                  </View>
                )}
                <View style={styles.userInfo}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {u.name}
                  </Text>
                  <Text style={styles.userId}>{u.id}</Text>
                  <View style={styles.badgesRow}>
                    {u.country && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeEmoji}>{getFlagEmoji(u.country)}</Text>
                        <Text style={styles.badgeText}>{getCountryName(u.country) || "—"}</Text>
                      </View>
                    )}
                    {(u.gender || u.age != null) && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeIcon}>
                          {u.gender === "male" ? "♂" : u.gender === "female" ? "♀" : "—"}
                        </Text>
                        <Text style={styles.badgeText}>{u.age != null ? String(u.age) : "—"}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <Ionicons name="chevron-back" size={20} color={TEXT_MUTED} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {searchError && !searching && (
          <View style={styles.errorWrap}>
            <Ionicons name="alert-circle-outline" size={24} color={TEXT_MUTED} />
            <Text style={styles.errorText}>{searchError}</Text>
          </View>
        )}

        {!searchQuery.trim() && searchResults.length === 0 && !searchError && (
          <View style={styles.emptyWrap}>
            <Ionicons name="search" size={48} color={TEXT_MUTED} style={{ opacity: 0.5 }} />
            <Text style={styles.emptyText}>أدخل المعرف للبحث عن المستخدمين المسجلين</Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
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
  content: { padding: 20, paddingBottom: 32 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: INPUT_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER_SOFT,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 24,
  },
  searchBtnInside: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: ACCENT_SOFT,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: TEXT_LIGHT,
    paddingVertical: 12,
    textAlign: "right",
  },
  resultsSection: { marginBottom: 24 },
  resultsTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: TEXT_LIGHT,
    marginBottom: 14,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER_SOFT,
  },
  userAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginLeft: 12,
  },
  userAvatarPlaceholder: {
    backgroundColor: ACCENT_MUTED,
    alignItems: "center",
    justifyContent: "center",
  },
  userInfo: { flex: 1 },
  userName: {
    fontSize: 15,
    fontWeight: "600",
    color: TEXT_LIGHT,
    marginBottom: 4,
  },
  userId: { fontSize: 12, color: TEXT_MUTED, marginBottom: 8 },
  badgesRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
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
  errorWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 40,
  },
  errorText: { fontSize: 14, color: TEXT_MUTED },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: { fontSize: 14, color: TEXT_MUTED, marginTop: 16, textAlign: "center" },
});
