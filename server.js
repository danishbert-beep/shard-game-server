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
    y: 0
  };

  socket.emit("assignPlayerNum", playerNum);
  socket.emit("currentPlayers", players);

  socket.broadcast.emit("playerJoined", {
    id: socket.id,
    playerNum,
    x: 0,
    y: 0
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

  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("playerDisconnected", socket.id);
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log("server running");
});