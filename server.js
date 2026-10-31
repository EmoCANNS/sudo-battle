const express = require('http');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Statik dosyaları sunmak için (public klasörü veya ana dizin)
app.use(express.static(path.join(__dirname)));

// Bekleyen ranked oyuncu kuyruğu
let waitingPlayer = null;
// Aktif oyun odaları
const activeRooms = {};

io.on('connection', (socket) => {
  console.log(`Bir oyuncu bağlandı Üstadım: ${socket.id}`);

  // Ranked Rakip Arama
  socket.on('find_match', (data) => {
    const { username, rp } = data;

    if (waitingPlayer) {
      // Eşleşme sağlandı! Bir oda oluşturuyoruz
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

      // Bekleyen oyuncuya haberi ver
      waitingPlayer.socket.emit('match_found', {
        roomId: roomId,
        seed: seed,
        opponent: { username: username, rp: rp }
      });

      // Yeni katılan oyuncuya haberi ver
      socket.emit('match_found', {
        roomId: roomId,
        seed: seed,
        opponent: { username: waitingPlayer.username, rp: waitingPlayer.rp }
      });

      console.log(`Üstadım, ${roomId} odasında kapışma başladı!`);
      waitingPlayer = null;
    } else {
      // Bekleyen kimse yoksa kuyruğa al
      waitingPlayer = { socket: socket, username: username, rp: rp };
      socket.emit('waiting_opponent', 'Rakip bekleniyor Üstadım... ⚔️');
    }
  });

  // Oyunu bitiren taraf
  socket.on('game_won', (data) => {
    const { roomId } = data;
    if (activeRooms[roomId]) {
      // Odadaki diğer oyuncuya kaybettiğini bildir
      io.to(roomId).emit('game_over', { winner: socket.id });
      delete activeRooms[roomId];
    }
  });

  // Oyuncu oyundan ayrıldığında veya bağlantısı koptuğunda
  socket.on('disconnect', () => {
    console.log(`Bir oyuncu ayrıldı Üstadım: ${socket.id}`);
    
    if (waitingPlayer && waitingPlayer.socket.id === socket.id) {
      waitingPlayer = null;
    }

    // Aktif odalarda maçı yarım bırakan var mı kontrol et
    for (const roomId in activeRooms) {
      const room = activeRooms[roomId];
      const playerInRoom = room.players.find(p => p.id === socket.id);
      
      if (playerInRoom) {
        // Kalan diğer oyuncuyu bul
        const remainingPlayer = room.players.find(p => p.id !== socket.id);
        if (remainingPlayer) {
          // Kalan oyuncuya hükmen galibiyet ver
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
  console.log(`Sudo Battle sunucusu ${PORT} portunda ayakta Üstadım! 🚀`);
});