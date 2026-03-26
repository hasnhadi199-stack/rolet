export type LudoColor = "red" | "green" | "yellow" | "blue";

export type LudoPlayer = {
  id: string; // userId
  name: string;
  color: LudoColor;
  connected: boolean;
};

/**
 * Token position model:
 * - "yard": at home/yard, not entered
 * - "track": on shared outer track, index 0..51 (relative to global track)
 * - "home": in final home stretch, step 0..5 (0 is first home cell, 5 is finish)
 * - "finished": reached finish
 */
export type TokenPos =
  | { kind: "yard" }
  | { kind: "track"; index: number }
  | { kind: "home"; step: number }
  | { kind: "finished" };

export type LudoToken = {
  id: string; // e.g. "red-0"
  color: LudoColor;
  pos: TokenPos;
};

export type LudoState = {
  sessionId: string;
  version: number;
  hostId: string;
  players: LudoPlayer[]; // 2-4
  tokens: LudoToken[]; // 16 max
  turnPlayerId: string;
  lastRoll: number | null;
  lastRollBy: string | null;
  canRoll: boolean;
  /** if lastRoll is set, which token ids are movable for the current player */
  movableTokenIds: string[];
  winners: string[]; // playerIds in order
  updatedAt: number;
};

export type LudoAction =
  | { type: "ludo_join"; sessionId: string; player: { id: string; name: string } }
  | { type: "ludo_leave"; sessionId: string; playerId: string }
  | { type: "ludo_request_state"; sessionId: string; fromId: string }
  | { type: "ludo_roll"; sessionId: string; fromId: string }
  | { type: "ludo_move"; sessionId: string; fromId: string; tokenId: string }
  | { type: "ludo_start"; sessionId: string; fromId: string; players: { id: string; name: string }[] };

export type LudoWireMessage =
  | { type: "ludo_action"; action: LudoAction }
  | { type: "ludo_state"; state: LudoState }
  | { type: "ludo_ping"; t: number };

