import express from "express";
import http from "node:http";
import cors from "cors";
import { Server } from "socket.io";
import {
  PACKS,
  addCustomPack,
  activateHouseRule,
  advanceAfterResult,
  createRoom,
  handleDisconnect,
  getPackMap,
  makePlayer,
  makeRoomCode,
  pickWinner,
  publicRoom,
  reconnectPlayer,
  startGame,
  submitCards
} from "./utils/gameLogic.js";

const PORT = process.env.PORT || 3001;
const allowedOriginPatterns = [
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
  /^https:\/\/[a-z0-9-]+\.netlify\.app$/,
  /^https:\/\/[a-z0-9-]+\.onrender\.com$/
];
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin(origin, callback) {
      if (!origin || allowedOriginPatterns.some((pattern) => pattern.test(origin))) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed"));
    },
    methods: ["GET", "POST"]
  }
});

const rooms = new Map();

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOriginPatterns.some((pattern) => pattern.test(origin))) {
      callback(null, true);
      return;
    }
    callback(new Error("Origin not allowed"));
  }
}));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, rooms: rooms.size });
});

app.get("/packs", (_req, res) => {
  res.json(
    Object.entries(PACKS).map(([id, pack]) => ({
      id,
      name: pack.name,
      blackCards: pack.blackCards.length,
      whiteCards: pack.whiteCards.length
    }))
  );
});

io.on("connection", (socket) => {
  socket.on("createRoom", ({ name }, callback) => {
    try {
      const roomCode = makeRoomCode(rooms);
      const host = makePlayer({ id: crypto.randomUUID(), socketId: socket.id, name, isHost: true });
      const room = createRoom({ roomCode, host });
      rooms.set(roomCode, room);
      socket.join(roomCode);
      socket.data.roomCode = roomCode;
      socket.data.playerId = host.id;
      emitRoom(room);
      callback?.({ ok: true, playerId: host.id, room: publicRoom(room, host.id) });
    } catch (error) {
      callback?.({ ok: false, error: error.message });
    }
  });

  socket.on("joinRoom", ({ roomCode, name }, callback) => {
    try {
      const code = String(roomCode || "").trim().toUpperCase();
      const room = rooms.get(code);
      if (!room) throw new Error("Room not found.");
      if (room.phase !== "lobby") throw new Error("That game is already in progress.");
      const player = makePlayer({ id: crypto.randomUUID(), socketId: socket.id, name });
      room.players.push(player);
      socket.join(code);
      socket.data.roomCode = code;
      socket.data.playerId = player.id;
      io.to(code).emit("playerJoined", { player: { ...player, hand: [] } });
      emitRoom(room);
      callback?.({ ok: true, playerId: player.id, room: publicRoom(room, player.id) });
    } catch (error) {
      callback?.({ ok: false, error: error.message });
    }
  });

  socket.on("reconnectPlayer", ({ roomCode, playerId }, callback) => {
    try {
      const room = rooms.get(String(roomCode || "").trim().toUpperCase());
      if (!room) throw new Error("Room not found.");
      const player = reconnectPlayer(room, { playerId, socketId: socket.id });
      if (!player) throw new Error("Player not found.");
      socket.join(room.roomCode);
      socket.data.roomCode = room.roomCode;
      socket.data.playerId = player.id;
      emitRoom(room);
      callback?.({ ok: true, room: publicRoom(room, player.id) });
    } catch (error) {
      callback?.({ ok: false, error: error.message });
    }
  });

  socket.on("selectPacks", ({ packs }, callback) => {
    withRoom(socket, callback, (room, player) => {
      requireHost(room, player);
      const availablePacks = getPackMap(room);
      const valid = Array.isArray(packs) ? packs.filter((pack) => availablePacks[pack]) : ["main"];
      room.selectedPacks = valid.length ? Array.from(new Set(valid)) : ["main"];
      emitRoom(room);
      callback?.({ ok: true });
    });
  });

  socket.on("importCustomPack", ({ packText, pack }, callback) => {
    withRoom(socket, callback, (room, player) => {
      requireHost(room, player);
      if (room.phase !== "lobby") throw new Error("Import custom packs before starting the game.");
      const savedPack = addCustomPack(room, pack || packText);
      emitRoom(room);
      callback?.({ ok: true, pack: savedPack });
    });
  });

  socket.on("activateHouseRule", (_payload, callback) => {
    withRoom(socket, callback, (room, player) => {
      requireHost(room, player);
      if (room.phase !== "playing" && room.phase !== "lobby") throw new Error("House rules can be activated before or during a round.");
      const rule = activateHouseRule(room);
      emitRoom(room);
      callback?.({ ok: true, rule });
    });
  });

  socket.on("startGame", (_payload, callback) => {
    withRoom(socket, callback, (room, player) => {
      requireHost(room, player);
      if (room.players.length < 2) throw new Error("You need at least 2 players.");
      startGame(room);
      io.to(room.roomCode).emit("dealCards");
      emitRoom(room);
      callback?.({ ok: true });
    });
  });

  socket.on("submitCard", ({ cardIds }, callback) => {
    withRoom(socket, callback, (room, player) => {
      submitCards(room, player.id, cardIds);
      if (room.phase === "judging") io.to(room.roomCode).emit("revealSubmissions");
      emitRoom(room);
      callback?.({ ok: true });
    });
  });

  socket.on("pickWinner", ({ submissionId, stealFromPlayerId }, callback) => {
    withRoom(socket, callback, (room, player) => {
      const judge = room.players[room.currentJudgeIndex];
      if (judge?.id !== player.id) throw new Error("Only the judge can pick.");
      pickWinner(room, submissionId, stealFromPlayerId);
      if (room.phase === "gameOver") io.to(room.roomCode).emit("endGame", { winner: room.winner });
      emitRoom(room);
      callback?.({ ok: true });
    });
  });

  socket.on("nextRound", (_payload, callback) => {
    withRoom(socket, callback, (room, player) => {
      requireHostOrJudge(room, player);
      if (room.phase !== "roundResult") throw new Error("Finish judging first.");
      advanceAfterResult(room);
      io.to(room.roomCode).emit("dealCards");
      emitRoom(room);
      callback?.({ ok: true });
    });
  });

  socket.on("leaveRoom", (_payload, callback) => {
    withRoom(socket, callback, (room) => {
      const roomCode = room.roomCode;
      handleDisconnect(room, socket.id);
      socket.leave(roomCode);
      socket.data.roomCode = null;
      socket.data.playerId = null;
      emitRoom(room);
      callback?.({ ok: true });
    });
  });

  socket.on("disconnect", () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return;
    handleDisconnect(room, socket.id);
    emitRoom(room);
  });
});

setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [code, room] of rooms) {
    if (room.emptySince && room.emptySince < cutoff) {
      rooms.delete(code);
    }
  }
}, 60 * 1000);

function withRoom(socket, callback, handler) {
  try {
    const room = rooms.get(socket.data.roomCode);
    if (!room) throw new Error("You are not in a room.");
    const player = room.players.find((p) => p.id === socket.data.playerId);
    if (!player) throw new Error("Player not found.");
    handler(room, player);
  } catch (error) {
    callback?.({ ok: false, error: error.message });
  }
}

function requireHost(room, player) {
  if (room.hostId !== player.id) throw new Error("Only the host can do that.");
}

function requireHostOrJudge(room, player) {
  const judge = room.players[room.currentJudgeIndex];
  if (room.hostId !== player.id && judge?.id !== player.id) {
    throw new Error("Only the host or judge can do that.");
  }
}

function emitRoom(room) {
  for (const player of room.players) {
    if (player.socketId) {
      io.to(player.socketId).emit("roomUpdated", publicRoom(room, player.id));
    }
  }
}

server.listen(PORT, "0.0.0.0", () => {
  console.log(`My House My Rules server running on http://localhost:${PORT}`);
});
