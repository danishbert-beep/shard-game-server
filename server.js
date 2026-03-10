const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

let players = {};

const ROUND_DURATION_MS = 30000;
let roundStartTime = null;

function resetRoundTimer() {
  roundStartTime = Date.now();

  console.log("RESET TIMER", {
    roundStartTime,
    iso: new Date(roundStartTime).toISOString()
  });

  io.emit("roundTimerSync", {
    roundStartTime,
    roundDurationMs: ROUND_DURATION_MS
  });

  io.emit("roundReset");
}

function getUsedPlayerNums() {
  return Object.values(players).map(player => player.playerNum);
}

function getAvailablePlayerNum() {
  const used = getUsedPlayerNums();

  if (!used.includes(1)) return 1;
  if (!used.includes(2)) return 2;

  return null;
}

// -------------------------
// shared moving machines
// -------------------------
const sideMachineMover = {
  machineIds: [6, 7],
  amplitude: 45,
  speed: 0.03,
  phase: Math.PI,
  t: 0
};

function buildMachineOffsets() {
  const machineOffsets = {};

  sideMachineMover.machineIds.forEach((id, index) => {
    const phase = index === 0 ? 0 : sideMachineMover.phase;
    machineOffsets[id] =
      Math.sin(sideMachineMover.t + phase) * sideMachineMover.amplitude;
  });

  return machineOffsets;
}

// broadcast shared machine motion
setInterval(() => {
  sideMachineMover.t += sideMachineMover.speed;
  io.emit("machineOffsets", buildMachineOffsets());
}, 1000 / 60);

io.on("connection", socket => {
  const playerNum = getAvailablePlayerNum();

  if (playerNum === null) {
    console.log("SERVER FULL - rejecting socket", socket.id);
    socket.emit("serverFull");
    socket.disconnect();
    return;
  }

  players[socket.id] = {
    playerNum,
    topLeftX: 0,
    topLeftY: 0,
    attacking: false
  };

  console.log("PLAYER CONNECTED", {
    socketId: socket.id,
    playerNum,
    playerCount: Object.keys(players).length
  });

  socket.emit("assignPlayerNum", playerNum);
  socket.emit("currentPlayers", players);
  socket.emit("machineOffsets", buildMachineOffsets());

  // only send timer if a round already exists
  if (roundStartTime !== null) {
    console.log("SENDING EXISTING roundTimerSync TO NEW CLIENT", {
      socketId: socket.id,
      roundStartTime,
      roundDurationMs: ROUND_DURATION_MS,
      now: Date.now(),
      elapsed: Date.now() - roundStartTime
    });

    socket.emit("roundTimerSync", {
      roundStartTime,
      roundDurationMs: ROUND_DURATION_MS
    });
  }

  socket.broadcast.emit("playerJoined", {
    id: socket.id,
    playerNum,
    topLeftX: 0,
    topLeftY: 0,
    attacking: false
  });

  // start timer only when 2 players are connected
  if (Object.keys(players).length === 2) {
    console.log("TWO PLAYERS PRESENT - RESETTING ROUND");
    resetRoundTimer();
  }

  // -------------------------
  // movement sync
  // -------------------------
  socket.on("move", data => {
    if (!players[socket.id]) return;

    players[socket.id] = {
      ...players[socket.id],
      ...data
    };

    socket.broadcast.emit("playerMoved", {
      id: socket.id,
      playerNum: players[socket.id].playerNum,
      ...data
    });
  });

  // -------------------------
  // attack sync
  // -------------------------
  socket.on("attackState", data => {
    if (!players[socket.id]) return;

    players[socket.id].attacking = !!data.attacking;

    socket.broadcast.emit("playerAttackState", {
      id: socket.id,
      playerNum: players[socket.id].playerNum,
      attacking: players[socket.id].attacking
    });
  });

  // -------------------------
  // round reset request
  // -------------------------
  socket.on("requestRoundReset", () => {
    console.log("ROUND RESET REQUESTED", {
      socketId: socket.id,
      now: Date.now(),
      playerCount: Object.keys(players).length
    });

    // only allow resets if 2 players are still present
    if (Object.keys(players).length === 2) {
      resetRoundTimer();
    }
  });

  // -------------------------
  // disconnect
  // -------------------------
  socket.on("disconnect", reason => {
    console.log("PLAYER DISCONNECTED", {
      socketId: socket.id,
      playerNum: players[socket.id]?.playerNum,
      reason
    });

    delete players[socket.id];

    console.log("PLAYERS REMAINING", {
      playerCount: Object.keys(players).length
    });

    // no full match anymore, so clear active round
    if (Object.keys(players).length < 2) {
      roundStartTime = null;
      console.log("LESS THAN 2 PLAYERS - CLEARED roundStartTime");
    }

    io.emit("playerDisconnected", socket.id);
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log("SERVER VERSION: two-player round timer build");
  console.log("server running");
});