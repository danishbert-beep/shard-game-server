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

io.on("connection", socket => {

  console.log("player joined", socket.id);

  players[socket.id] = { x: 0, y: 0 };

  socket.emit("currentPlayers", players);

  socket.broadcast.emit("playerJoined", {
    id: socket.id,
    x: 0,
    y: 0
  });

  socket.on("move", data => {

    if (!players[socket.id]) return;

    players[socket.id] = data;

    socket.broadcast.emit("playerMoved", {
      id: socket.id,
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