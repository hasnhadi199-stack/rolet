import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const CARD_WIDTH = 160;
const CARD_GAP = 14;

const ACCENT_SOFT = "#c4b5fd";
const ACCENT_MUTED = "rgba(167, 139, 250, 0.25)";
const TEXT_LIGHT = "#f5f3ff";
const TEXT_MUTED = "#a1a1aa";
const CARD_BG = "rgba(45, 38, 64, 0.6)";
const BORDER_SOFT = "rgba(167, 139, 250, 0.2)";
const INPUT_BG = "rgba(255,255,255,0.06)";

type Props = {
  userName: string;
  onNavigate: (tab: string) => void;
  onOpenSearch: () => void;
};

export default function HomeScreen({ userName, onNavigate, onOpenSearch }: Props) {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>مرحباً، {userName || "صديقي"}</Text>
      <Text style={styles.subtitle}>استكشف التطبيق من هنا</Text>

      {/* شريط بحث — عند الضغط يفتح صفحة البحث */}
      <TouchableOpacity
        style={styles.searchBar}
        onPress={onOpenSearch}
        activeOpacity={0.85}
      >
        <Ionicons name="search" size={20} color={TEXT_MUTED} style={styles.searchIcon} />
        <Text style={styles.searchPlaceholder}>ابحث بالمعرف...</Text>
        <Ionicons name="chevron-back" size={18} color={TEXT_MUTED} />
      </TouchableOpacity>

      {/* البطاقات أفقياً */}
      <Text style={styles.sectionTitle}>اختر ما تريد</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cardsRow}
      >
        <TouchableOpacity
          style={styles.card}
          onPress={() => onNavigate("moment")}
          activeOpacity={0.85}
        >
          <View style={styles.cardIcon}>
            <Ionicons name="sparkles" size={28} color={ACCENT_SOFT} />
          </View>
          <Text style={styles.cardTitle}>لحظاتي</Text>
          <Text style={styles.cardSub}>شارك لحظاتك</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          onPress={() => onNavigate("messages")}
          activeOpacity={0.85}
        >
          <View style={styles.cardIcon}>
            <Ionicons name="chatbubble-ellipses" size={28} color={ACCENT_SOFT} />
          </View>
          <Text style={styles.cardTitle}>الرسائل</Text>
          <Text style={styles.cardSub}>تواصل مع الآخرين</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.card}
          onPress={() => onNavigate("club")}
          activeOpacity={0.85}
        >
          <View style={styles.cardIcon}>
            <Ionicons name="globe" size={28} color={ACCENT_SOFT} />
          </View>
          <Text style={styles.cardTitle}>النادي</Text>
          <Text style={styles.cardSub}>انضم للمجتمع</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    padding: 20,
    paddingBottom: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: TEXT_LIGHT,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: TEXT_MUTED,
    marginBottom: 20,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: INPUT_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER_SOFT,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 24,
  },
  searchIcon: { marginLeft: 8 },
  searchPlaceholder: {
    flex: 1,
    fontSize: 15,
    color: TEXT_MUTED,
    textAlign: "right",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: TEXT_LIGHT,
    marginBottom: 14,
  },
  cardsRow: {
    flexDirection: "row",
    gap: CARD_GAP,
    paddingVertical: 4,
  },
  card: {
    width: CARD_WIDTH,
    padding: 18,
    borderRadius: 20,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER_SOFT,
  },
  cardIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: ACCENT_MUTED,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: TEXT_LIGHT,
    marginBottom: 4,
  },
  cardSub: {
    fontSize: 12,
    color: TEXT_MUTED,
  },
});
