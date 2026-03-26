import type { LudoColor } from "./types";

/** نقاط الدخول للمسار العام — مطابقة للمحرك (ludoEngine) */
export const ENTRY_INDEX: Record<LudoColor, number> = {
  red: 0,
  green: 13,
  // ضبط مطابق للصورة: مربع الخروج الأصفر على يمين المسار
  yellow: 26,
  // ضبط مطابق للصورة: مربع الخروج الأزرق على أسفل المسار
  blue: 39,
};

type Cell = readonly [row: number, col: number];

/**
 * تخطيط لودو الحقيقي على شبكة 15×15:
 * هذه هي خلايا المسار الـ52 (المربعات البيضاء) باتجاه عقارب الساعة.
 * نستخدم هذا لعرض الحركة "على الخط الأبيض" كما في صورة اللودو.
 */
export const TRACK_CELLS: readonly Cell[] = [
  // Start near red exit (top-left quadrant), then clockwise
  [6, 1],
  [6, 2],
  [6, 3],
  [6, 4],
  [6, 5],
  [5, 6],
  [4, 6],
  [3, 6],
  [2, 6],
  [1, 6],
  [0, 6],
  [0, 7],
  [0, 8],
  [1, 8],
  [2, 8],
  [3, 8],
  [4, 8],
  [5, 8],
  [6, 9],
  [6, 10],
  [6, 11],
  [6, 12],
  [6, 13],
  [6, 14],
  [7, 14],
  [8, 14],
  [8, 13],
  [8, 12],
  [8, 11],
  [8, 10],
  [8, 9],
  [9, 8],
  [10, 8],
  [11, 8],
  [12, 8],
  [13, 8],
  [14, 8],
  [14, 7],
  [14, 6],
  [13, 6],
  [12, 6],
  [11, 6],
  [10, 6],
  [9, 6],
  [8, 5],
  [8, 4],
  [8, 3],
  [8, 2],
  [8, 1],
  [8, 0],
  [7, 0],
  [6, 0],
];

export const HOME_CELLS: Record<LudoColor, readonly Cell[]> = {
  // 5 خلايا "بيت" قبل الإنهاء (finish)
  // مطابق للصورة: أخضر فوق (عمود)، أزرق تحت (عمود)، أحمر يسار (صف)، أصفر يمين (صف)
  green: [
    [1, 7],
    [2, 7],
    [3, 7],
    [4, 7],
    [5, 7],
  ],
  blue: [
    [13, 7],
    [12, 7],
    [11, 7],
    [10, 7],
    [9, 7],
  ],
  red: [
    [7, 1],
    [7, 2],
    [7, 3],
    [7, 4],
    [7, 5],
  ],
  yellow: [
    [7, 13],
    [7, 12],
    [7, 11],
    [7, 10],
    [7, 9],
  ],
};

export function cellToXY(cell: Cell): { x: number; y: number } {
  // شبكة 15×15 تملأ اللوحة بالكامل (بدون هوامش) مثل صورة اللودو
  const [r, c] = cell;
  const CELL = 100 / 15;
  return { x: (c + 0.5) * CELL, y: (r + 0.5) * CELL };
}

export function trackIndexToXY(index: number): { x: number; y: number } {
  const i = ((index % 52) + 52) % 52;
  return cellToXY(TRACK_CELLS[i] ?? TRACK_CELLS[0]!);
}

const ARROW_W = 5;
const ARROW_H = 9;

/** سهم خروج من البيت نحو المسار — يتبع اتجاه المسار على كل ضلع */
export function entryArrowStyleForTrackIndex(index: number, colorHex: string) {
  const i = ((index % 52) + 52) % 52;
  const side = Math.floor(i / 13);
  const base = {
    position: "absolute" as const,
    width: 0,
    height: 0,
    zIndex: 2,
  };
  switch (side) {
    case 0:
      return {
        ...base,
        borderLeftWidth: ARROW_W,
        borderRightWidth: ARROW_W,
        borderTopWidth: ARROW_H,
        borderLeftColor: "transparent",
        borderRightColor: "transparent",
        borderTopColor: colorHex,
        marginLeft: -ARROW_W,
        marginTop: -ARROW_H,
      };
    case 1:
      return {
        ...base,
        borderTopWidth: ARROW_W,
        borderBottomWidth: ARROW_W,
        borderRightWidth: ARROW_H,
        borderTopColor: "transparent",
        borderBottomColor: "transparent",
        borderRightColor: colorHex,
        marginLeft: -ARROW_H,
        marginTop: -ARROW_W,
      };
    case 2:
      return {
        ...base,
        borderLeftWidth: ARROW_W,
        borderRightWidth: ARROW_W,
        borderBottomWidth: ARROW_H,
        borderLeftColor: "transparent",
        borderRightColor: "transparent",
        borderBottomColor: colorHex,
        marginLeft: -ARROW_W,
        marginTop: -ARROW_W,
      };
    default:
      return {
        ...base,
        borderTopWidth: ARROW_W,
        borderBottomWidth: ARROW_W,
        borderLeftWidth: ARROW_H,
        borderTopColor: "transparent",
        borderBottomColor: "transparent",
        borderLeftColor: colorHex,
        marginLeft: -ARROW_W,
        marginTop: -ARROW_W,
      };
  }
}

/** فسحة البيت (yard) — زاوية كل لون */
const CORNER: Record<LudoColor, { ax: number; ay: number; dx: number; dy: number }> = {
  red: { ax: 8, ay: 8, dx: 1, dy: 1 },
  green: { ax: 92, ay: 8, dx: -1, dy: 1 },
  yellow: { ax: 92, ay: 92, dx: -1, dy: -1 },
  blue: { ax: 8, ay: 92, dx: 1, dy: -1 },
};

export function yardSlotXY(color: LudoColor, slot: number): { x: number; y: number } {
  // مواضع 4 قطع داخل مربع "البيت" (yard) كشبكة 2×2 داخل الربع.
  // الربع حجمه ~42% من اللوحة، والمربع الداخلي (yardInner) داخل الربع:
  // left/top = 16% من الربع، size = 68% من الربع.
  // داخل yardInner نضع المراكز عند 30% و70% (مثل لودو الحقيقي).
  const s = ((slot % 4) + 4) % 4;
  const row = Math.floor(s / 2);
  const col = s % 2;
  const xs = [0.3, 0.7];
  const ys = [0.3, 0.7];

  const QUAD = 42;
  const INNER_OFF = QUAD * 0.16;
  const INNER_SIZE = QUAD * 0.68;
  const xInQuad = INNER_OFF + INNER_SIZE * (xs[col] ?? 0.3);
  const yInQuad = INNER_OFF + INNER_SIZE * (ys[row] ?? 0.3);

  const origin =
    color === "red"
      ? { ox: 0, oy: 0 }
      : color === "green"
        ? { ox: 100 - QUAD, oy: 0 }
        : color === "yellow"
          ? { ox: 100 - QUAD, oy: 100 - QUAD }
          : { ox: 0, oy: 100 - QUAD };

  return { x: origin.ox + xInQuad, y: origin.oy + yInQuad };
}

/** المسار المنزلي (5 خطوات قبل الإنهاء) — على استقامة من زاوية اللون نحو المركز */
export function homeStepXY(color: LudoColor, step: number): { x: number; y: number } {
  const s = Math.max(0, Math.min(4, Math.floor(step)));
  const cell = HOME_CELLS[color][s] ?? HOME_CELLS[color][0]!;
  return cellToXY(cell);
}

export const COLOR_HEX: Record<LudoColor, string> = {
  red: "#ef4444",
  green: "#22c55e",
  yellow: "#eab308",
  blue: "#3b82f6",
};
