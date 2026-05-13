import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cardsDir = path.join(__dirname, "..", "cards");

export const PACKS = {
  main: readJson("main.json"),
  afterdark: readJson("afterdark.json"),
  couples: readJson("couples.json"),
  filthysecrets: readJson("filthysecrets.json")
};

export const HOUSE_RULES = readJson("houserules.json").houseRules;

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(cardsDir, file), "utf8"));
}

export function makeRoomCode(existingCodes) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  do {
    code = Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  } while (existingCodes.has(code));
  return code;
}

export function makePlayer({ id, socketId, name, isHost = false }) {
  return {
    id,
    socketId,
    name: String(name || "Player").trim().slice(0, 24) || "Player",
    score: 0,
    hand: [],
    isHost,
    connected: true
  };
}

export function createRoom({ roomCode, host }) {
  return {
    roomCode,
    hostId: host.id,
    players: [host],
    selectedPacks: ["main"],
    customPacks: [],
    blackDeck: [],
    whiteDeck: [],
    discardPile: [],
    currentPrompt: null,
    currentJudgeIndex: 0,
    submissions: [],
    roundNumber: 0,
    activeHouseRule: null,
    phase: "lobby",
    winner: null,
    roundWinner: null,
    targetScore: 7,
    emptySince: null
  };
}

export function publicRoom(room, viewerId = null) {
  const judge = getJudge(room);
  return {
    ...room,
    blackDeck: undefined,
    whiteDeck: undefined,
    discardPile: undefined,
    availablePacks: getAvailablePacks(room),
    players: room.players.map((player) => ({
      ...player,
      hand: player.id === viewerId ? player.hand : []
    })),
    submissions: room.submissions.map((submission) => ({
      ...submission,
      playerId: room.phase === "roundResult" || room.phase === "gameOver" ? submission.playerId : undefined,
      playerName: room.phase === "roundResult" || room.phase === "gameOver" ? submission.playerName : undefined
    })),
    currentJudge: judge ? { id: judge.id, name: judge.name } : null,
    you: viewerId
  };
}

export function getJudge(room) {
  if (!room.players.length) return null;
  return room.players[room.currentJudgeIndex % room.players.length];
}

export function startGame(room) {
  buildDecks(room);
  room.players.forEach((player) => {
    player.score = 0;
    player.hand = draw(room, 7);
  });
  room.currentJudgeIndex = 0;
  room.roundNumber = 0;
  room.winner = null;
  room.activeHouseRule = null;
  nextRound(room, { keepRule: false });
}

export function buildDecks(room) {
  const packs = room.selectedPacks.length ? room.selectedPacks : ["main"];
  const availablePacks = getPackMap(room);
  const blackCards = packs.flatMap((pack) => availablePacks[pack]?.blackCards || []);
  const whiteCards = packs.flatMap((pack) => availablePacks[pack]?.whiteCards || []);
  console.log("[packs] selected", packs.join(", "));
  console.log("[packs] card counts", { blackCards: blackCards.length, whiteCards: whiteCards.length });
  if (!blackCards.length || !whiteCards.length) {
    throw new Error("Selected packs need at least 1 black card and 1 white card. Add cards to the pack file or select another pack.");
  }
  room.blackDeck = shuffle(blackCards.map((text, index) => ({ id: `b-${index}-${hash(text)}`, text })));
  room.whiteDeck = shuffle(whiteCards.map((text, index) => ({ id: `w-${index}-${hash(text)}`, text })));
  room.discardPile = [];
  console.log("[packs] shuffle complete", { blackDeck: room.blackDeck.length, whiteDeck: room.whiteDeck.length });
}

export function getPackMap(room) {
  return {
    ...PACKS,
    ...Object.fromEntries((room.customPacks || []).map((pack) => [pack.id, pack]))
  };
}

export function getAvailablePacks(room) {
  return Object.entries(getPackMap(room)).map(([id, pack]) => ({
    id,
    name: pack.name,
    warning: pack.warning || null,
    premium: Boolean(pack.premium),
    custom: Boolean(pack.custom),
    blackCards: pack.blackCards.length,
    whiteCards: pack.whiteCards.length
  }));
}

export function addCustomPack(room, input) {
  const pack = normalizeCustomPack(input);
  const id = `custom-${hash(pack.name)}-${Date.now().toString(36)}`;
  const savedPack = {
    ...pack,
    id,
    custom: true,
    premium: true
  };
  room.customPacks.push(savedPack);
  room.selectedPacks = Array.from(new Set([...room.selectedPacks, id]));
  console.log("[packs] custom pack loaded", {
    id,
    name: savedPack.name,
    blackCards: savedPack.blackCards.length,
    whiteCards: savedPack.whiteCards.length
  });
  return savedPack;
}

export function activateHouseRule(room) {
  room.activeHouseRule = HOUSE_RULES[Math.floor(Math.random() * HOUSE_RULES.length)];
  return room.activeHouseRule;
}

export function submitCards(room, playerId, cardIds) {
  const judge = getJudge(room);
  const player = room.players.find((p) => p.id === playerId);
  if (!player || judge?.id === playerId || room.phase !== "playing") {
    throw new Error("You cannot submit right now.");
  }
  if (room.submissions.some((submission) => submission.playerId === playerId)) {
    throw new Error("You already submitted this round.");
  }

  const required = room.activeHouseRule?.id === "submit_two" ? 2 : 1;
  const ids = Array.isArray(cardIds) ? cardIds : [cardIds];
  if (ids.length !== required) {
    throw new Error(`Select ${required} card${required > 1 ? "s" : ""}.`);
  }

  const selected = ids.map((id) => player.hand.find((card) => card.id === id));
  if (selected.some(Boolean) === false || selected.some((card) => !card)) {
    throw new Error("That card is not in your hand.");
  }

  player.hand = player.hand.filter((card) => !ids.includes(card.id));
  room.submissions.push({
    id: `s-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    playerId,
    playerName: player.name,
    cards: selected
  });

  const expected = room.players.filter((p) => p.connected && p.id !== judge?.id).length;
  if (room.submissions.length >= expected) {
    room.phase = "judging";
  }
}

export function pickWinner(room, submissionId, stealFromPlayerId = null) {
  if (room.phase !== "judging") {
    throw new Error("Winner can only be picked while judging.");
  }
  const submission = room.submissions.find((item) => item.id === submissionId);
  if (!submission) throw new Error("Submission not found.");

  const player = room.players.find((p) => p.id === submission.playerId);
  if (!player) throw new Error("Winning player not found.");

  const points = room.activeHouseRule?.id === "double_points" ? 2 : 1;
  player.score += points;

  if (room.activeHouseRule?.id === "steal_point") {
    const victim = room.players.find((p) => p.id === stealFromPlayerId && p.id !== player.id) || room.players.find((p) => p.id !== player.id && p.score > 0);
    if (victim && victim.score > 0) {
      victim.score -= 1;
      player.score += 1;
    }
  }

  room.roundWinner = {
    playerId: player.id,
    playerName: player.name,
    submission,
    pointsAwarded: points
  };
  room.phase = "roundResult";

  if (player.score >= room.targetScore) {
    room.winner = player;
    room.phase = "gameOver";
  }
}

export function nextRound(room, { keepRule = false } = {}) {
  refillHands(room);
  if (!room.blackDeck.length) buildDecks(room);
  room.currentPrompt = room.blackDeck.pop();
  room.submissions = [];
  room.roundWinner = null;
  room.roundNumber += 1;
  room.phase = "playing";

  if (!keepRule && room.activeHouseRule?.id !== "winner_judge") {
    room.activeHouseRule = null;
  }

  if (room.roundNumber > 1) room.currentJudgeIndex = nextConnectedJudgeIndex(room);
}

export function advanceAfterResult(room) {
  const previousRule = room.activeHouseRule;
  const winningId = room.roundWinner?.playerId;
  room.discardPile.push(...room.submissions.flatMap((submission) => submission.cards));
  refillHands(room);
  if (previousRule?.id === "winner_judge" && winningId) {
    const winnerIndex = room.players.findIndex((player) => player.id === winningId);
    if (winnerIndex >= 0) room.currentJudgeIndex = winnerIndex;
  } else {
    room.currentJudgeIndex = nextConnectedJudgeIndex(room);
  }
  room.activeHouseRule = null;
  room.submissions = [];
  room.roundWinner = null;
  room.currentPrompt = room.blackDeck.length ? room.blackDeck.pop() : null;
  if (!room.currentPrompt) {
    buildDecks(room);
    room.currentPrompt = room.blackDeck.pop();
  }
  room.roundNumber += 1;
  room.phase = "playing";
}

export function refillHands(room) {
  room.players.forEach((player) => {
    while (player.hand.length < 7 && room.whiteDeck.length) {
      player.hand.push(...draw(room, 1));
    }
  });
}

export function handleDisconnect(room, socketId) {
  const player = room.players.find((p) => p.socketId === socketId);
  if (!player) return null;
  player.connected = false;
  player.socketId = null;
  if (room.hostId === player.id) transferHost(room);
  room.emptySince = room.players.some((p) => p.connected) ? null : Date.now();
  return player;
}

export function reconnectPlayer(room, { playerId, socketId }) {
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return null;
  player.socketId = socketId;
  player.connected = true;
  room.emptySince = null;
  if (!room.players.some((p) => p.id === room.hostId && p.connected)) transferHost(room);
  return player;
}

export function transferHost(room) {
  const nextHost = room.players.find((p) => p.connected);
  room.players.forEach((p) => {
    p.isHost = nextHost?.id === p.id;
  });
  room.hostId = nextHost?.id || room.hostId;
}

function draw(room, count) {
  if (room.whiteDeck.length < count) {
    room.whiteDeck = shuffle([...room.whiteDeck, ...room.discardPile]);
    room.discardPile = [];
  }
  return room.whiteDeck.splice(0, count);
}

function normalizeCustomPack(input) {
  const pack = typeof input === "string" ? parsePackText(input) : input;
  const name = String(pack?.name || "Custom Pack").trim().slice(0, 60) || "Custom Pack";
  const warning = String(pack?.warning || "18+ ADULT CONTENT").trim().slice(0, 120);
  const blackCards = cleanCards(pack?.blackCards);
  const whiteCards = cleanCards(pack?.whiteCards);

  if (!blackCards.length) throw new Error("Custom pack needs at least 1 black card.");
  if (!whiteCards.length) throw new Error("Custom pack needs at least 1 white card.");

  return { name, warning, blackCards, whiteCards };
}

function parsePackText(text) {
  const source = String(text || "").replace(/\r\n/g, "\n");
  try {
    return JSON.parse(source);
  } catch {
    const blackMatch = source.match(/BLACK CARDS:\s*([\s\S]*?)(?:WHITE CARDS:|$)/i);
    const whiteMatch = source.match(/WHITE CARDS:\s*([\s\S]*)/i);
    return {
      name: source.match(/PACK NAME:\s*(.+)/i)?.[1]?.trim() || "Custom Pack",
      warning: source.match(/WARNING:\s*(.+)/i)?.[1]?.trim() || "18+ ADULT CONTENT",
      blackCards: splitLines(blackMatch?.[1] || ""),
      whiteCards: splitLines(whiteMatch?.[1] || "")
    };
  }
}

function cleanCards(cards) {
  if (!Array.isArray(cards)) return [];
  return cards
    .map((card) => String(card || "").trim())
    .filter(Boolean)
    .slice(0, 500);
}

function splitLines(value) {
  return String(value || "")
    .split("\n")
    .map((line) => line.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter(Boolean);
}

function nextConnectedJudgeIndex(room) {
  if (!room.players.length) return 0;
  for (let offset = 1; offset <= room.players.length; offset += 1) {
    const index = (room.currentJudgeIndex + offset) % room.players.length;
    if (room.players[index]?.connected) return index;
  }
  return room.currentJudgeIndex;
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function hash(value) {
  let output = 0;
  for (let i = 0; i < value.length; i += 1) {
    output = (output << 5) - output + value.charCodeAt(i);
    output |= 0;
  }
  return Math.abs(output).toString(36);
}
