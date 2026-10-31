const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  pingInterval: 2000,
  pingTimeout: 5000
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

let waitingPlayer = null;
const activeRooms = {};

io.on('connection', (socket) => {
  console.log(`Oyuncu bağlandı: ${socket.id}`);

  socket.on('find_match', (data) => {
    const { username, rp } = data;

    if (waitingPlayer) {
      const roomId = `room_${Date.now()}`;
      const seed = Math.floor(Math.random() * 900000) + 100;

      socket.join(roomId);
      waitingPlayer.socket.join(roomId);

      activeRooms[roomId] = {
        players: [
          { id: waitingPlayer.socket.id, username: waitingPlayer.username, rp: waitingPlayer.rp },
          { id: socket.id, username: username, rp: rp }
        ]
      };

      waitingPlayer.socket.emit('match_found', {
        roomId: roomId,
        seed: seed,
        opponent: { username: username, rp: rp }
      });

      socket.emit('match_found', {
        roomId: roomId,
        seed: seed,
        opponent: { username: waitingPlayer.username, rp: waitingPlayer.rp }
      });

      waitingPlayer = null;
    } else {
      waitingPlayer = { socket: socket, username: username, rp: rp };
      socket.emit('waiting_opponent', 'Rakip aranıyor...');
    }
  });

  socket.on('game_won', (data) => {
    const { roomId } = data;
    if (activeRooms[roomId]) {
      io.to(roomId).emit('game_over', { winner: socket.id });
      delete activeRooms[roomId];
    }
  });

  socket.on('disconnect', () => {
    if (waitingPlayer && waitingPlayer.socket.id === socket.id) {
      waitingPlayer = null;
    }

    for (const roomId in activeRooms) {
      const room = activeRooms[roomId];
      const playerInRoom = room.players.find(p => p.id === socket.id);
      
      if (playerInRoom) {
        const remainingPlayer = room.players.find(p => p.id !== socket.id);
        if (remainingPlayer) {
          io.to(roomId).emit('game_over', { winner: remainingPlayer.id });
        }
        delete activeRooms[roomId];
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor.`);
});