# قائمة مستخدمي الدردشة الجماعية — مخزنة في الباك اند

## المطلوب في الباك اند

### 1. قائمة دائمة للمستخدمين الذين دخلوا الدردشة الجماعية

- عند دخول أي مستخدم للدردشة الجماعية (عبر `POST /api/group-chat/join`)، يُضاف إلى قائمة مخزنة في الباك اند.
- القائمة تبقى حتى لو أغلق المستخدم التطبيق أو خرج من الدردشة.
- الحد الأقصى: **100 مستخدم** في القائمة.
- إذا دخل المستخدم مرة أخرى وكان موجوداً، يُحدَّث وقت آخر دخول له (أو يبقى في مكانه).

---

### 2. تعديل مسار POST /api/group-chat/join

عند استدعاء هذا المسار:

1. إضافة المستخدم الحالي إلى جدول/قائمة `GroupChatVisitors` (أو ما شابه).
2. إذا كان المستخدم موجوداً مسبقاً، تحديث `lastJoinedAt` أو نقله لنهاية القائمة (حسب منطقك).
3. إذا تجاوزت القائمة 100 مستخدم، احذف الأقدم (أو الأقل نشاطاً).

**مثال بنية جدول (Prisma):**

```prisma
model GroupChatVisitor {
  id        String   @id @default(cuid())
  userId    String   @unique  // أو بدون unique إذا تسمح بتكرار الدخول
  name      String?
  profileImage String?
  gender    String?
  joinedAt  DateTime @default(now())
  lastJoinedAt DateTime @default(now())
  @@index([lastJoinedAt])
}
```

**مثال كود (Node.js + Prisma):**

```js
const MAX_VISITORS = 100;

router.post("/api/group-chat/join", authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.json({ success: false });

    // جلب بيانات المستخدم (اسم، صورة، إلخ)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, profileImage: true, gender: true },
    });

    await prisma.groupChatVisitor.upsert({
      where: { userId },
      create: {
        userId,
        name: user?.name ?? null,
        profileImage: user?.profileImage ?? null,
        gender: user?.gender ?? null,
        lastJoinedAt: new Date(),
      },
      update: {
        name: user?.name ?? undefined,
        profileImage: user?.profileImage ?? undefined,
        gender: user?.gender ?? undefined,
        lastJoinedAt: new Date(),
      },
    });

    // حذف الأقدم إذا تجاوزنا 100
    const count = await prisma.groupChatVisitor.count();
    if (count > MAX_VISITORS) {
      const toDelete = await prisma.groupChatVisitor.findMany({
        orderBy: { lastJoinedAt: "asc" },
        take: count - MAX_VISITORS,
      });
      await prisma.groupChatVisitor.deleteMany({
        where: { id: { in: toDelete.map((v) => v.id) } },
      });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("group-chat join error:", err);
    return res.status(500).json({ success: false });
  }
});
```

---

### 3. تعديل مسار GET /api/group-chat/users

يُرجع القائمة المخزنة (وليس المستخدمين المتصلين فقط):

- ترتيب حسب `lastJoinedAt` تنازلياً (الأحدث أولاً).
- حد أقصى 100 مستخدم.
- الصيغة المتوقعة من التطبيق:

```json
{
  "success": true,
  "users": [
    {
      "userId": "...",
      "name": "...",
      "profileImage": "...",
      "gender": "..."
    }
  ]
}
```

**مثال كود:**

```js
router.get("/api/group-chat/users", authMiddleware, async (req, res) => {
  try {
    const visitors = await prisma.groupChatVisitor.findMany({
      orderBy: { lastJoinedAt: "desc" },
      take: 100,
    });

    const users = visitors.map((v) => ({
      userId: v.userId,
      name: v.name ?? "مستخدم",
      profileImage: v.profileImage ?? null,
      gender: v.gender ?? null,
    }));

    return res.json({ success: true, users });
  } catch (err) {
    console.error("group-chat users error:", err);
    return res.status(500).json({ success: false, users: [] });
  }
});
```

---

### 4. ملاحظات

- **لا حذف عند المغادرة**: عند استدعاء `POST /api/group-chat/leave`، لا تحذف المستخدم من القائمة. يبقى في القائمة.
- **المستخدم يظهر في القائمة**: عند دخوله للمجموعة، يُضاف ويظهر لجميع من يفتح "من في الدردشة" أو قائمة All في الهدايا.
- القائمة مشتركة لجميع المستخدمين — أي شخص يدخل المجموعة يرى نفس القائمة (حتى 100 مستخدم).
