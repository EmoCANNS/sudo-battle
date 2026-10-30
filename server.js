const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let waitingPlayer = null;

io.on('connection', (socket) => {
    console.log(`Bir oyuncu bağlandı: ${socket.id}`);

    socket.on('find_match', () => {
        if (waitingPlayer) {
            const roomId = `room_${socket.id}_${waitingPlayer.id}`;
            socket.join(roomId);
            waitingPlayer.join(roomId);

            const seed = Math.floor(Math.random() * 900000) + 100;
            io.to(roomId).emit('match_found', { roomId, seed });

            waitingPlayer = null;
        } else {
            waitingPlayer = socket;
            socket.emit('waiting_opponent', "Rakip bekleniyor...");
        }
    });

    socket.on('progress_update', (data) => {
        socket.to(data.roomId).emit('opponent_progress', data.progress);
    });

    socket.on('game_won', (data) => {
        io.to(data.roomId).emit('game_over', { winner: socket.id });
    });

    socket.on('disconnect', () => {
        if (waitingPlayer === socket) {
            waitingPlayer = null;
        }
        console.log(`Oyuncu ayrıldı: ${socket.id}`);
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor! 🚀`);
});