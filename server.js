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

  const playerCount = Object.keys(players).length;

  const role = playerCount === 0 ? "p1" : "p2";

  players[socket.id] = {
    role,
    x: 0,
    y: 0
  };

  socket.emit("assignRole", role);

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