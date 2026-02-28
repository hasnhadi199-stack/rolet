import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const PURPLE_DARK = "#1a1625";
const ACCENT_SOFT = "#c4b5fd";
const TEXT_LIGHT = "#f5f3ff";
const TEXT_MUTED = "#a1a1aa";

type Props = {
  type: "admirers" | "following" | "friends";
  onBack: () => void;
  onSwitchType: (t: "admirers" | "following" | "friends") => void;
};

const TITLES = {
  admirers: "المعجبون",
  following: "أتابع",
  friends: "صديق",
};

export default function SocialListScreen({ type, onBack, onSwitchType }: Props) {
  const title = TITLES[type];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="arrow-forward" size={22} color={ACCENT_SOFT} />
          <Text style={styles.backText}>رجوع</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statsCard}>
          <View style={styles.statsRow}>
            <TouchableOpacity style={styles.statItem} onPress={() => onSwitchType("friends")} activeOpacity={0.7}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>صديق</Text>
            </TouchableOpacity>
            <View style={styles.statDivider} />
            <TouchableOpacity style={styles.statItem} onPress={() => onSwitchType("following")} activeOpacity={0.7}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>أتابع</Text>
            </TouchableOpacity>
            <View style={styles.statDivider} />
            <TouchableOpacity style={styles.statItem} onPress={() => onSwitchType("admirers")} activeOpacity={0.7}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>معجب</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>👋</Text>
          <Text style={styles.emptyTitle}>لا يوجد أحد بعد</Text>
          <Text style={styles.emptySub}>
            {type === "admirers" && "لم يعجبك أحد بعد"}
            {type === "following" && "لم تتابع أحداً بعد"}
            {type === "friends" && "لم تضف أصدقاء بعد"}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PURPLE_DARK, paddingTop: Platform.OS === "ios" ? 40 : 20 },
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
  content: { padding: 20, flex: 1, gap: 20 },
  statsCard: {
    backgroundColor: "rgba(45, 38, 64, 0.6)",
    borderRadius: 20,
    paddingVertical: 16,
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
    height: 24,
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
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: TEXT_LIGHT, marginBottom: 8 },
  emptySub: { fontSize: 14, color: TEXT_MUTED },
});
