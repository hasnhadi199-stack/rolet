import React, { useRef, useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Animated,
  Modal,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import LottieView from "lottie-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { API_BASE_URL } from "../../utils/authHelper";

const { width } = Dimensions.get("window");

type Props = {
  onBack: () => void;
};

export default function TopupScreen({ onBack }: Props) {
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);
  const spinValue = useRef(new Animated.Value(0)).current;
  const contentRef = useRef<ScrollView>(null);

  const [wheelVisible, setWheelVisible] = useState(false);
  const [boxRewardsVisible, setBoxRewardsVisible] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rewardText, setRewardText] = useState<string | null>(null);
  const [lastBonusPercent, setLastBonusPercent] = useState(0);

  const [totalGold, setTotalGold] = useState(0);
  const [chargedGold, setChargedGold] = useState(0);
  const [freeGold, setFreeGold] = useState(0);

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [pendingPrice, setPendingPrice] = useState("");
  const [isPurchasing, setIsPurchasing] = useState(false);

  // شرائح الدولاب (الترتيب مطابق تماماً لمواقع الدوائر على العجلة)
  const rewardSegments = [
    { label: "3%", angle: 0 },
    { label: "5%", angle: 60 },
    { label: "7%", angle: 120 },
    { label: "8%", angle: 180 },
    { label: "2%", angle: 240 },
    { label: "10%", angle: 300 },
  ];

  const handleOpenWheel = () => {
    setRewardText(null);
    setLastBonusPercent(0);
    setWheelVisible(true);
  };

  const handleOpenBoxRewards = () => {
    setBoxRewardsVisible(true);
  };

  const handleSpin = () => {
    if (isSpinning) return;

    setIsSpinning(true);
    setRewardText(null);
    setLastBonusPercent(0);

    spinValue.setValue(0);

    const randomIndex = Math.floor(Math.random() * rewardSegments.length);
    const chosen = rewardSegments[randomIndex];

    // مؤشر السهم ثابت في الأعلى، لذلك يجب أن نلفّ العجلة عكس اتجاه
    // موضع الشريحة (زاوية سالبة) حتى تتحرك الشريحة المختارة إلى الأعلى بدقة.
    const fullRotations = 4; // لفّات كاملة قبل التوقف
    const targetAngle = fullRotations * 360 - chosen.angle;

    Animated.timing(spinValue, {
      toValue: targetAngle / 360,
      duration: 2600,
      useNativeDriver: true,
    }).start(() => {
      setIsSpinning(false);
      setRewardText(chosen.label);

      const numeric = parseInt(chosen.label.replace("%", ""), 10);
      setLastBonusPercent(Number.isNaN(numeric) ? 0 : numeric);
    });
  };

  const handleGoToTopup = () => {
    // إغلاق دولاب الحظ والانتقال إلى قسم باقات الشحن
    setWheelVisible(false);
    setTimeout(() => {
      contentRef.current?.scrollTo({ y: 0, animated: true });
    }, 250);
  };

  const handleOfferPress = (amount: number, price: string) => {
    setPendingAmount(amount);
    setPendingPrice(price);
    setConfirmVisible(true);
  };

  const handleConfirmPurchase = async () => {
    if (isPurchasing) return;
    setIsPurchasing(true);
    try {
      const ok = await handlePurchase(pendingAmount);
      if (ok) {
        setConfirmVisible(false);
        setPendingAmount(0);
        setPendingPrice("");
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  const handlePurchase = async (amount: number): Promise<boolean> => {
    const bonus = Math.round((amount * lastBonusPercent) / 100);
    const token = await AsyncStorage.getItem("token");

    if (!token) {
      Alert.alert("تنبيه", "يجب تسجيل الدخول لتأكيد الشراء وحفظ الذهب.");
      return false;
    }

    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/wallet/topup`,
        { amount, bonus },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          timeout: 10000,
        }
      );
      if (res.data?.success && res.data?.wallet) {
        const w = res.data.wallet;
        setTotalGold(w.totalGold ?? 0);
        setChargedGold(w.chargedGold ?? 0);
        setFreeGold(w.freeGold ?? 0);
        return true;
      }
      Alert.alert("خطأ", "لم يتم حفظ الشراء. حاول مرة أخرى.");
      return false;
    } catch {
      Alert.alert("لا يوجد اتصال", "يجب الاتصال بالإنترنت لتأكيد الشراء وحفظ الذهب في قاعدة البيانات.");
      return false;
    }
  };

  const rotate = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const fetchWallet = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const res = await axios.get(`${API_BASE_URL}/api/wallet`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });
      if (res.data?.success && res.data?.wallet) {
        const w = res.data.wallet;
        setTotalGold(w.totalGold ?? 0);
        setChargedGold(w.chargedGold ?? 0);
        setFreeGold(w.freeGold ?? 0);
      }
    } catch {
      // المستخدم غير مسجّل أو خطأ شبكة
    }
  };

  useEffect(() => {
    fetchWallet();
  }, []);

  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      index = index === 0 ? 1 : 0;
      scrollRef.current?.scrollTo({ x: index * width, animated: true });
    }, 3500);

    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="arrow-forward" size={22} color="#c4b5fd" />
          <Text style={styles.backText}>رجوع</Text>
        </TouchableOpacity>
        <Text style={styles.title}>شحن الرصيد</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Slider */}
      <View style={styles.rewardSliderWrapper}>
        <LinearGradient
          colors={["#111827", "#020617"]}
          style={styles.rewardBackground}
        >
          <Animated.ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { useNativeDriver: false }
            )}
            scrollEventThrottle={16}
          >
            {/* Slide 1 - مكافأة شحن */}
            <View style={styles.slide}>
              <View style={styles.wheelRow}>
                <View style={styles.wheelContainer}>
                  <LinearGradient
                    colors={["#f97316", "#facc15"]}
                    style={styles.wheelOuter}
                  >
                    <View style={styles.wheelInner}>
                      <View style={styles.wheelSegmentRow}>
                        <Text style={styles.wheelSegmentText}>+10%</Text>
                        <Text style={styles.wheelSegmentText}>+20%</Text>
                      </View>
                      <View style={styles.wheelSegmentRow}>
                        <Text style={styles.wheelSegmentText}>+50%</Text>
                        <Text style={styles.wheelSegmentText}>x2</Text>
                      </View>
                      <View style={styles.wheelCenter} />
                    </View>
                  </LinearGradient>
                  <View style={styles.wheelPointer} />
                </View>
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={styles.wheelTextBox}
                  onPress={handleOpenWheel}
                >
                  <Text style={styles.slideTag}>مكافأة شحن</Text>
                  <Text style={styles.slideTitle}>اشحن واربح ذهب إضافي</Text>
                  <Text style={styles.slideSub}>
                    اضغط هنا لفتح دولاب الحظ والحصول على مكافأة إضافية على الشحن.
                  </Text>
                  <View style={styles.slideCta}>
                    <Text style={styles.slideCtaText}>فتح دولاب الحظ</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Slide 2 - مكافأة صندوق */}
            <View style={styles.slide}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={handleOpenBoxRewards}
                style={styles.wheelRow}
              >
                <View style={styles.wheelContainer}>
                  <LinearGradient
                    colors={["#4f46e5", "#7c3aed"]}
                    style={styles.wheelOuter}
                  >
                    <View style={styles.wheelInner}>
                      <View style={styles.wheelSegmentRow}>
                        <Text style={styles.wheelSegmentText}>صندوق ذهبي</Text>
                      </View>
                      <View style={styles.wheelSegmentRow}>
                        <Text style={styles.wheelSegmentText}>صندوق ماسي</Text>
                      </View>
                      <View style={styles.wheelSegmentRow}>
                        <Text style={styles.wheelSegmentText}>صندوق نادر</Text>
                      </View>
                      <View style={styles.wheelCenter} />
                    </View>
                  </LinearGradient>
                  <View style={styles.wheelPointer} />
                </View>
                <View style={styles.wheelTextBox}>
                  <Text style={styles.slideTag}>مكافآت الصندوق</Text>
                  <Text style={styles.slideTitle}>افتح الصندوق واربح جوائز</Text>
                  <Text style={styles.slideSub}>
                    اجمع الذهب وافتح صناديق المكافآت اليومية لتحصل على هدايا
                    مميزة وعناصر نادرة داخل اللعبة.
                  </Text>
                  <View style={styles.slideCta}>
                    <Text style={styles.slideCtaText}>افتح الصندوق</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          </Animated.ScrollView>

          {/* Pagination Dots */}
          <View style={styles.pagination}>
            {[0, 1].map((_, i) => {
              const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
              const dotWidth = scrollX.interpolate({
                inputRange,
                outputRange: [6, 16, 6],
                extrapolate: "clamp",
              });
              const dotOpacity = scrollX.interpolate({
                inputRange,
                outputRange: [0.4, 1, 0.4],
                extrapolate: "clamp",
              });

              return (
                <Animated.View
                  key={i}
                  style={[styles.dot, { width: dotWidth, opacity: dotOpacity }]}
                />
              );
            })}
          </View>
        </LinearGradient>
      </View>

      {/* Wheel of Fortune Modal */}
      <Modal visible={wheelVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>دولاب مكافآت الشحن</Text>
            <Text style={styles.modalSubtitle}>
              قم بالدوران لتحصل على نسبة ذهب إضافي فوق عملية الشحن الحالية.
            </Text>

            <View style={styles.modalWheelWrapper}>
              <View style={styles.modalWheelPointer} />
              <Animated.View style={[styles.modalWheelOuter, { transform: [{ rotate }] }]}>
                <LinearGradient
                  colors={["#f97316", "#facc15"]}
                  style={styles.modalWheelGradient}
                >
                  <View style={styles.modalWheelInner}>
                    <View style={[styles.modalSegmentBadge, styles.modalSegment1]}>
                      <Text style={styles.modalSegmentText}>3%</Text>
                    </View>
                    <View style={[styles.modalSegmentBadge, styles.modalSegment2]}>
                      <Text style={styles.modalSegmentText}>5%</Text>
                    </View>
                    <View style={[styles.modalSegmentBadge, styles.modalSegment3]}>
                      <Text style={styles.modalSegmentText}>7%</Text>
                    </View>
                    <View style={[styles.modalSegmentBadge, styles.modalSegment4]}>
                      <Text style={styles.modalSegmentText}>8%</Text>
                    </View>
                    <View style={[styles.modalSegmentBadge, styles.modalSegment5]}>
                      <Text style={styles.modalSegmentText}>2%</Text>
                    </View>
                    <View style={[styles.modalSegmentBadge, styles.modalSegment6]}>
                      <Text style={styles.modalSegmentText}>10%</Text>
                    </View>
                    <View style={styles.modalWheelCenter} />
                  </View>
                </LinearGradient>
              </Animated.View>
            </View>

            {rewardText && (
              <View style={styles.rewardBanner}>
                <Text style={styles.rewardBannerValue}>
                  {`مبروك! ${rewardText} ذهب إضافي`}
                </Text>
              </View>
            )}

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setWheelVisible(false)}
                disabled={isSpinning}
              >
                <Text style={styles.modalButtonSecondaryText}>إغلاق</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary, isSpinning && styles.modalButtonDisabled]}
                onPress={
                  !isSpinning && rewardText
                    ? handleGoToTopup
                    : handleSpin
                }
                activeOpacity={0.9}
                disabled={isSpinning}
              >
                <Text style={styles.modalButtonPrimaryText}>
                  {isSpinning
                    ? "جارِ الدوران..."
                    : rewardText
                    ? "اذهب للشحن"
                    : "دَوِّر الدولاب"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* صفحة مكافآت الصندوق - خلفية ملكية فاخرة */}
      <Modal visible={boxRewardsVisible} animationType="slide">
        <View style={styles.boxRewardsScreen}>
          <LinearGradient
            colors={["#0d0221", "#1a0a2e", "#2d1b4e", "#1a0a2e", "#0d0221"]}
            style={StyleSheet.absoluteFill}
          />
          {/* طبقة ذهبية علوية */}
          <LinearGradient
            colors={["rgba(212,175,55,0.15)", "transparent"]}
            style={styles.boxRewardsGoldTop}
          />
          {/* زخارف ملكية */}
          <View style={styles.boxRewardsPattern}>
            <View style={[styles.boxRewardsDiamond, styles.boxDiamond1]} />
            <View style={[styles.boxRewardsDiamond, styles.boxDiamond2]} />
            <View style={[styles.boxRewardsDiamond, styles.boxDiamond3]} />
          </View>

          <View style={styles.boxRewardsContent}>
            <TouchableOpacity
              onPress={() => setBoxRewardsVisible(false)}
              style={styles.boxRewardsBackBtn}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-forward" size={24} color="#D4AF37" />
              <Text style={styles.boxRewardsBackText}>رجوع</Text>
            </TouchableOpacity>

            <View style={styles.boxRewardsHeader}>
              <View style={styles.boxRewardsCrownWrap}>
                <LottieView
                  source={require("../../assets/images/3D Treasure Box (1).json")}
                  autoPlay
                  loop
                  style={{ width: 140, height: 140, marginHorizontal: -10, marginVertical: -10 }}
                />
              </View>
              <Text style={styles.boxRewardsTitle}>مكافآت الصندوق</Text>
              <Text style={styles.boxRewardsSubtitle}>
                افتح الصندوق واربح جوائز مميزة
              </Text>
            </View>

            <LinearGradient
              colors={["rgba(212,175,55,0.25)", "rgba(124,58,237,0.2)"]}
              style={styles.boxRewardsCard}
            >
              <View style={styles.boxRewardsCardInner}>
                <View style={styles.boxRewardsBoxRow}>
                  <View style={styles.boxRewardItem}>
                    <LinearGradient
                      colors={["#D4AF37", "#facc15"]}
                      style={styles.boxRewardBox}
                    >
                      <Text style={styles.boxRewardBoxLabel}>ذهبي</Text>
                    </LinearGradient>
                  </View>
                  <View style={styles.boxRewardItem}>
                    <LinearGradient
                      colors={["#7c3aed", "#a78bfa"]}
                      style={styles.boxRewardBox}
                    >
                      <Text style={styles.boxRewardBoxLabel}>ماسي</Text>
                    </LinearGradient>
                  </View>
                  <View style={styles.boxRewardItem}>
                    <LinearGradient
                      colors={["#0ea5e9", "#38bdf8"]}
                      style={styles.boxRewardBox}
                    >
                      <Text style={styles.boxRewardBoxLabel}>نادر</Text>
                    </LinearGradient>
                  </View>
                </View>
                <Text style={styles.boxRewardsHint}>
                  اجمع الذهب وافتح صناديق المكافآت اليومية لتحصل على هدايا مميزة وعناصر نادرة داخل اللعبة.
                </Text>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* نافذة تأكيد الشراء */}
      <Modal visible={confirmVisible} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>تأكيد شراء الذهب</Text>
            <View style={styles.confirmRow}>
              <Text style={styles.confirmLabel}>الذهب:</Text>
              <Text style={styles.confirmValue}>{pendingAmount} G</Text>
            </View>
            {lastBonusPercent > 0 && (
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>مكافأة شحن ({lastBonusPercent}%):</Text>
                <Text style={styles.confirmValue}>
                  +{Math.round((pendingAmount * lastBonusPercent) / 100)} G
                </Text>
              </View>
            )}
            <View style={styles.confirmRow}>
              <Text style={styles.confirmLabel}>السعر:</Text>
              <Text style={styles.confirmValue}>{pendingPrice}</Text>
            </View>
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.confirmBtnCancel]}
                onPress={() => {
                  setConfirmVisible(false);
                  setPendingAmount(0);
                  setPendingPrice("");
                }}
                disabled={isPurchasing}
              >
                <Text style={styles.confirmBtnCancelText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.confirmBtnOk, isPurchasing && styles.confirmBtnDisabled]}
                onPress={handleConfirmPurchase}
                disabled={isPurchasing}
              >
                <Text style={styles.confirmBtnOkText}>
                  {isPurchasing ? "جاري الشراء..." : "تأكيد الشراء"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView
        ref={contentRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Card */}
        <View style={styles.card}>
          <View style={styles.totalRow}>
            <View style={styles.totalLeft}>
              <View style={styles.coinBigOuter}>
                <View style={styles.coinBigInner}>
                  <Text style={styles.coinBigLetter}>G</Text>
                </View>
              </View>
              <View>
                <Text style={styles.cardTitle}>مجموع الذهب</Text>
                <Text style={styles.totalValue}>{totalGold}</Text>
              </View>
            </View>

            <View style={styles.totalRight}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>مشحون {chargedGold}</Text>
              </View>

              <View style={styles.badgeSecondary}>
                <Text style={styles.badgeTextSecondary}>مجاني {freeGold}</Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>باقات شحن الذهب</Text>
            <Text style={styles.sectionSubtitle}>
              اختر الباقة المناسبة لك، وكل عملية شحن تضيف مكافآت لدولاب الحظ.
            </Text>
          </View>

          <View style={styles.carch}>

  {/* Item 1 */}
  <TouchableOpacity
    style={styles.offerContainer}
    activeOpacity={0.9}
    onPress={() => handleOfferPress(20, "0.35$")}
  >
    <View style={styles.coin3DOuter}>
      <View style={styles.coin3DMiddle}>
        <View style={styles.coin3DInner}>
          <Text style={styles.coin3DText}>G</Text>
        </View>
      </View>
    </View>

    <Text style={styles.offerAmount}>20</Text>
    <View style={styles.offerDivider} />
    <Text style={styles.offerPrice}>0.35$</Text>
  </TouchableOpacity>

  {/* Item 2 */}
  <TouchableOpacity
    style={styles.offerContainer}
    activeOpacity={0.9}
    onPress={() => handleOfferPress(110, "0.99$")}
  >
    <View style={styles.coin3DOuter}>
      <View style={styles.coin3DMiddle}>
        <View style={styles.coin3DInner}>
          <Text style={styles.coin3DText}>G</Text>
        </View>
      </View>
    </View>

    <Text style={styles.offerAmount}>110</Text>
    <View style={styles.offerDivider} />
    <Text style={styles.offerPrice}>0.99$</Text>
  </TouchableOpacity>

  {/* Item 3 */}
  <TouchableOpacity
    style={styles.offerContainer}
    activeOpacity={0.9}
    onPress={() => handleOfferPress(210, "1.99$")}
  >
    <View style={styles.coin3DOuter}>
      <View style={styles.coin3DMiddle}>
        <View style={styles.coin3DInner}>
          <Text style={styles.coin3DText}>G</Text>
        </View>
      </View>
    </View>

    <Text style={styles.offerAmount}>210</Text>
    <View style={styles.offerDivider} />
    <Text style={styles.offerPrice}>1.99$</Text>
  </TouchableOpacity>

  {/* Item 4 */}
  <TouchableOpacity
    style={styles.offerContainer}
    activeOpacity={0.9}
    onPress={() => handleOfferPress(505, "4.99$")}
  >
    <View style={styles.coin3DOuter}>
      <View style={styles.coin3DMiddle}>
        <View style={styles.coin3DInner}>
          <Text style={styles.coin3DText}>G</Text>
        </View>
      </View>
    </View>

    <Text style={styles.offerAmount}>505</Text>
    <View style={styles.offerDivider} />
    <Text style={styles.offerPrice}>4.99$</Text>
          </TouchableOpacity>
          
           <TouchableOpacity
    style={styles.offerContainer}
    activeOpacity={0.9}
    onPress={() => handleOfferPress(1121, "9.99$")}
  >
    <View style={styles.coin3DOuter}>
      <View style={styles.coin3DMiddle}>
        <View style={styles.coin3DInner}>
          <Text style={styles.coin3DText}>G</Text>
        </View>
      </View>
    </View>

    <Text style={styles.offerAmount}>1121</Text>
    <View style={styles.offerDivider} />
    <Text style={styles.offerPrice}>9.99$</Text>
          </TouchableOpacity>
          



            <TouchableOpacity
    style={styles.offerContainer}
    activeOpacity={0.9}
    onPress={() => handleOfferPress(2010, "19.99$")}
  >
    <View style={styles.coin3DOuter}>
      <View style={styles.coin3DMiddle}>
        <View style={styles.coin3DInner}>
          <Text style={styles.coin3DText}>G</Text>
        </View>
      </View>
    </View>

    <Text style={styles.offerAmount}>2010</Text>
    <View style={styles.offerDivider} />
    <Text style={styles.offerPrice}>19.99$</Text>
          </TouchableOpacity>
          


          
            <TouchableOpacity
    style={styles.offerContainer}
    activeOpacity={0.9}
    onPress={() => handleOfferPress(5022, "49.99$")}
  >
    <View style={styles.coin3DOuter}>
      <View style={styles.coin3DMiddle}>
        <View style={styles.coin3DInner}>
          <Text style={styles.coin3DText}>G</Text>
        </View>
      </View>
    </View>

    <Text style={styles.offerAmount}>5022</Text>
    <View style={styles.offerDivider} />
    <Text style={styles.offerPrice}>49.99$</Text>
  </TouchableOpacity>

       
        




        
            <TouchableOpacity
    style={styles.offerContainer}
    activeOpacity={0.9}
    onPress={() => handleOfferPress(10000, "99.99$")}
  >
    <View style={styles.coin3DOuter}>
      <View style={styles.coin3DMiddle}>
        <View style={styles.coin3DInner}>
          <Text style={styles.coin3DText}>G</Text>
        </View>
      </View>
    </View>

    <Text style={styles.offerAmount}>10000</Text>
    <View style={styles.offerDivider} />
    <Text style={styles.offerPrice}>99.99$</Text>
        </TouchableOpacity>
        




        
            <TouchableOpacity
    style={styles.offerContainer}
    activeOpacity={0.9}
    onPress={() => handleOfferPress(20010, "199.99$")}
  >
    <View style={styles.coin3DOuter}>
      <View style={styles.coin3DMiddle}>
        <View style={styles.coin3DInner}>
          <Text style={styles.coin3DText}>G</Text>
        </View>
      </View>
    </View>

    <Text style={styles.offerAmount}>20010</Text>
    <View style={styles.offerDivider} />
    <Text style={styles.offerPrice}>199.99$</Text>
          </TouchableOpacity>




         <TouchableOpacity
    style={styles.offerContainer}
    activeOpacity={0.9}
    onPress={() => handleOfferPress(30010, "399.99$")}
  >
    <View style={styles.coin3DOuter}>
      <View style={styles.coin3DMiddle}>
        <View style={styles.coin3DInner}>
          <Text style={styles.coin3DText}>G</Text>
        </View>
      </View>
    </View>

    <Text style={styles.offerAmount}>30010</Text>
    <View style={styles.offerDivider} />
    <Text style={styles.offerPrice}>399.99$</Text>
          </TouchableOpacity>

                   <TouchableOpacity
    style={styles.offerContainer}
    activeOpacity={0.9}
    onPress={() => handleOfferPress(40010, "499.99$")}
  >
    <View style={styles.coin3DOuter}>
      <View style={styles.coin3DMiddle}>
        <View style={styles.coin3DInner}>
          <Text style={styles.coin3DText}>G</Text>
        </View>
      </View>
    </View>

    <Text style={styles.offerAmount}>40010</Text>
    <View style={styles.offerDivider} />
    <Text style={styles.offerPrice}>499.99$</Text>
          </TouchableOpacity>
                   <TouchableOpacity
    style={styles.offerContainer}
    activeOpacity={0.9}
    onPress={() => handleOfferPress(50010, "599.99$")}
  >
    <View style={styles.coin3DOuter}>
      <View style={styles.coin3DMiddle}>
        <View style={styles.coin3DInner}>
          <Text style={styles.coin3DText}>G</Text>
        </View>
      </View>
    </View>

    <Text style={styles.offerAmount}>50010</Text>
    <View style={styles.offerDivider} />
    <Text style={styles.offerPrice}>599.99$</Text>
          </TouchableOpacity>

                   <TouchableOpacity
    style={styles.offerContainer}
    activeOpacity={0.9}
    onPress={() => handleOfferPress(70010, "799.99$")}
  >
    <View style={styles.coin3DOuter}>
      <View style={styles.coin3DMiddle}>
        <View style={styles.coin3DInner}>
          <Text style={styles.coin3DText}>G</Text>
        </View>
      </View>
    </View>

    <Text style={styles.offerAmount}>70010</Text>
    <View style={styles.offerDivider} />
    <Text style={styles.offerPrice}>799.99$</Text>
          </TouchableOpacity>

          
                   <TouchableOpacity
    style={styles.offerContainer}
    activeOpacity={0.9}
    onPress={() => handleOfferPress(80010, "899.99$")}
  >
    <View style={styles.coin3DOuter}>
      <View style={styles.coin3DMiddle}>
        <View style={styles.coin3DInner}>
          <Text style={styles.coin3DText}>G</Text>
        </View>
      </View>
    </View>

    <Text style={styles.offerAmount}>80010</Text>
    <View style={styles.offerDivider} />
    <Text style={styles.offerPrice}>899.99$</Text>
          </TouchableOpacity>



                   <TouchableOpacity
    style={styles.offerContainer}
    activeOpacity={0.9}
    onPress={() => handleOfferPress(90010, "999.99$")}
  >
    <View style={styles.coin3DOuter}>
      <View style={styles.coin3DMiddle}>
        <View style={styles.coin3DInner}>
          <Text style={styles.coin3DText}>G</Text>
        </View>
      </View>
    </View>

    <Text style={styles.offerAmount}>90010</Text>
    <View style={styles.offerDivider} />
    <Text style={styles.offerPrice}>999.99$</Text>
          </TouchableOpacity>
          


          




          </View>
        </View>
      </ScrollView>
    </View>


    
    
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#050816", paddingTop: 40 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },

  backBtn: { flexDirection: "row", alignItems: "center", gap: 6 },

  backText: { fontSize: 15, color: "#c4b5fd", fontWeight: "600" },

  title: { fontSize: 18, fontWeight: "700", color: "#fff" },

  rewardSliderWrapper: {
    paddingHorizontal: 20,
    marginTop: 10,
  },

  rewardBackground: {
    borderRadius: 24,
    overflow: "hidden",
    paddingVertical: 14,
  },

  slide: {
    width,
    paddingHorizontal: 24,
  },

  wheelRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  wheelContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 12,
    marginRight: 20,
  },

  wheelOuter: {
    width: "100%",
    height: "100%",
    borderRadius: 55,
    padding: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(250,250,250,0.4)",
  },

  wheelInner: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.9)",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 6,
  },

  wheelSegmentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 6,
  },

  wheelSegmentText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#facc15",
  },

  wheelCenter: {
    position: "absolute",
    left: "50%",
    top: "50%",
    marginLeft: -10,
    marginTop: -10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#facc15",
    borderWidth: 2,
    borderColor: "#fff",
  },

  wheelPointer: {
    position: "absolute",
    right: -6,
    top: "50%",
    marginTop: -8,
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderLeftWidth: 10,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderLeftColor: "#facc15",
  },

  wheelTextBox: {
    flex: 1,
    paddingRight: 20,
  },

  slideTag: {
    fontSize: 12,
    fontWeight: "700",
    color: "#a5b4fc",
    marginBottom: 4,
  },

  slideTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
  },

  slideSub: {
    fontSize: 13,
    marginTop: 6,
    color: "#e5e7eb",
    lineHeight: 20,
  },

  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },

  dot: {
    height: 6,
    borderRadius: 999,
    backgroundColor: "#4b5563",
    marginHorizontal: 4,
  },

  slideCta: {
    marginTop: 10,
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#22c55e",
  },

  slideCtaText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#f9fafb",
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
  },

  card: {
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1.5,
    borderColor: "#7c3aed",
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },

  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  totalLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  totalRight: {
    alignItems: "flex-end",
    gap: 8,
  },

  cardTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },

  totalValue: {
    fontSize: 26,
    fontWeight: "800",
    color: "#facc15",
  },

  badge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#facc15",
  },

  badgeSecondary: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#38bdf8",
  },

  badgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#000",
  },

  badgeTextSecondary: {
    fontSize: 12,
    fontWeight: "700",
    color: "#000",
  },

  coinBigOuter: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#3f2a11",
    alignItems: "center",
    justifyContent: "center",
  },

  coinBigInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#facc15",
    alignItems: "center",
    justifyContent: "center",
  },

  coinBigLetter: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
  },

  sectionHeader: {
    marginTop: 20,
    marginBottom: 12,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#e5e7eb",
    marginBottom: 4,
  },

  sectionSubtitle: {
    fontSize: 12,
    color: "#9ca3af",
    lineHeight: 18,
  },

  carch: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 10,
  },
  coin3DOuter: {
    flexDirection: "row",
    gap:10,
  width: 26,
  height: 26,
  borderRadius: 13,
  alignItems: "center",
  justifyContent: "center",
},

coin3DMiddle: {
  width: 22,
  height: 22,
  borderRadius: 11,
  backgroundColor: "#b45309",
  alignItems: "center",
  justifyContent: "center",
},

  coin3DInner: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#facc15",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#fde68a",
  },

  coin3DText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#fff",
  },

  offerContainer: {
    width: "31%",
    marginBottom: 18,
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 18,
    backgroundColor: "rgba(15,23,42,0.95)",
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.45)",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },

  offerAmount: {
    fontSize: 16,
    fontWeight: "900",
    color: "#facc15",
  },

  offerDivider: {
    width: "60%",
    height: 1,
    backgroundColor: "rgba(255,255,255,0.16)",
    marginVertical: 8,
  },

  offerPrice: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#22c55e",
    width: 70,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
    color: "#f9fafb",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },

  modalCard: {
    width: "100%",
    borderRadius: 24,
    padding: 20,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.6)",
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#f9fafb",
    textAlign: "center",
  },

  modalSubtitle: {
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 6,
  },

  modalWheelWrapper: {
    marginTop: 24,
    alignItems: "center",
    justifyContent: "center",
  },

  modalWheelOuter: {
    width: 210,
    height: 210,
    borderRadius: 105,
    overflow: "hidden",
  },

  modalWheelGradient: {
    flex: 1,
    borderRadius: 105,
    padding: 10,
  },

  modalWheelInner: {
    flex: 1,
    borderRadius: 95,
    backgroundColor: "#020617",
    borderWidth: 2,
    borderColor: "rgba(248,250,252,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },

  modalWheelCenter: {
    position: "absolute",
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#facc15",
    borderWidth: 2,
    borderColor: "#fefce8",
    justifyContent: "center",
    alignItems: "center",
  },

  modalSegmentBadge: {
    position: "absolute",
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(15,23,42,0.96)",
    borderWidth: 2,
    borderColor: "rgba(248,250,252,0.35)",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },

  modalSegmentText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#facc15",
  },

  // 6 شرائح حول الدائرة لتمثيل 3% 5% 7% 8% 2% 10%
  modalSegment1: {
    top: 14,
  },

  modalSegment2: {
    top: 44,
    right: 22,
  },

  modalSegment3: {
    bottom: 44,
    right: 22,
  },

  modalSegment4: {
    bottom: 14,
  },

  modalSegment5: {
    bottom: 44,
    left: 22,
  },

  modalSegment6: {
    top: 44,
    left: 22,
  },

  modalWheelPointer: {
    position: "absolute",
    top: -6,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 16,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#facc15",
    zIndex: 2,
  },

  rewardBanner: {
    marginTop: 20,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(22,163,74,0.1)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.6)",
    alignItems: "center",
  },

  rewardBannerText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#bbf7d0",
  },

  rewardBannerValue: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: "800",
    color: "#4ade80",
  },

  modalButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 22,
  },

  modalButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: "center",
  },

  modalButtonSecondary: {
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#4b5563",
  },

  modalButtonPrimary: {
    marginLeft: 8,
    backgroundColor: "#22c55e",
  },

  modalButtonDisabled: {
    opacity: 0.6,
  },

  modalButtonSecondaryText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#e5e7eb",
  },

  modalButtonPrimaryText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#022c22",
  },

  confirmOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  confirmCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#0f172a",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.5)",
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#f9fafb",
    textAlign: "center",
    marginBottom: 20,
  },
  confirmRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  confirmLabel: {
    fontSize: 14,
    color: "#94a3b8",
    fontWeight: "600",
  },
  confirmValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#facc15",
  },
  confirmButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
    gap: 12,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  confirmBtnCancel: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#64748b",
  },
  confirmBtnCancelText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#e2e8f0",
  },
  confirmBtnOk: {
    backgroundColor: "#22c55e",
  },
  confirmBtnOkText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#022c22",
  },
  confirmBtnDisabled: {
    opacity: 0.6,
  },

  // صفحة مكافآت الصندوق - خلفية ملكية
  boxRewardsScreen: {
    flex: 1,
    paddingTop: 50,
  },
  boxRewardsGoldTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 280,
  },
  boxRewardsPattern: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
  },
  boxRewardsDiamond: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.15)",
  },
  boxDiamond1: { top: 120, left: -30 },
  boxDiamond2: { top: 200, right: -20 },
  boxDiamond3: { bottom: 150, left: "40%" },
  boxRewardsContent: {
    flex: 1,
    paddingHorizontal: 24,
  },
  boxRewardsBackBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 24,
  },
  boxRewardsBackText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#D4AF37",
  },
  boxRewardsHeader: {
    alignItems: "center",
    marginBottom: 32,
  },
  boxRewardsCrownWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: "hidden",
    backgroundColor: "rgba(212,175,55,0.15)",
    borderWidth: 2,
    borderColor: "rgba(212,175,55,0.4)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#D4AF37",
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
  },
  boxRewardsTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#fefce8",
    textAlign: "center",
  },
  boxRewardsSubtitle: {
    fontSize: 15,
    color: "#e9d5ff",
    marginTop: 8,
    textAlign: "center",
  },
  boxRewardsCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.35)",
    padding: 24,
  },
  boxRewardsCardInner: {
    backgroundColor: "rgba(13,2,33,0.6)",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.2)",
  },
  boxRewardsBoxRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 24,
  },
  boxRewardItem: {
    alignItems: "center",
  },
  boxRewardBox: {
    width: 80,
    height: 80,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.4)",
    shadowColor: "#D4AF37",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  boxRewardBoxLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
  },
  boxRewardsHint: {
    fontSize: 14,
    color: "#c4b5fd",
    lineHeight: 22,
    textAlign: "center",
  },
});