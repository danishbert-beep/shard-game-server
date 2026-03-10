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

// broadcast shared machine state
setInterval(() => {
  sideMachineMover.t += sideMachineMover.speed;
  io.emit("machineOffsets", buildMachineOffsets());
}, 1000 / 60);

io.on("connection", socket => {
  const playerNum = getAvailablePlayerNum();

  if (playerNum === null) {
    socket.emit("serverFull");
    socket.disconnect();
    return;
  }

  players[socket.id] = {
    playerNum,
    x: 0,
    y: 0,
    topLeftX: 0,
    topLeftY: 0,
    attacking: false
  };

  socket.emit("assignPlayerNum", playerNum);
  socket.emit("currentPlayers", players);
  socket.emit("machineOffsets", buildMachineOffsets());

  socket.broadcast.emit("playerJoined", {
    id: socket.id,
    playerNum,
    x: 0,
    y: 0,
    topLeftX: 0,
    topLeftY: 0,
    attacking: false
  });

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

  socket.on("attackState", data => {
    if (!players[socket.id]) return;

    players[socket.id].attacking = !!data.attacking;

    socket.broadcast.emit("playerAttackState", {
      id: socket.id,
      playerNum: players[socket.id].playerNum,
      attacking: players[socket.id].attacking
    });
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("playerDisconnected", socket.id);
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log("server running");
});