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

  // determine player number
  const playerCount = Object.keys(players).length;
  const playerNum = playerCount === 0 ? 1 : 2;

  players[socket.id] = {
    playerNum,
    x: 0,
    y: 0
  };

  // send full player list to the new player
  socket.emit("currentPlayers", players);

  // tell the new player what they are
  socket.emit("assignPlayerNum", playerNum);

  // notify everyone else a player joined
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