const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(express.static('public'));

let waitingPlayer = null;

io.on('connection', (socket) => {
    socket.on('find_match', (playerData) => {
        if (waitingPlayer && waitingPlayer.id === socket.id) return;

        socket.userData = {
            id: socket.id,
            username: playerData.username || 'Oyuncu',
            rp: playerData.rp || 0
        };

        if (waitingPlayer) {
            const opponent = waitingPlayer;
            waitingPlayer = null;

            const roomId = `room_${socket.id}_${opponent.id}`;
            socket.join(roomId);
            opponent.join(roomId);

            const seed = Math.floor(Math.random() * 899999) + 100000;
            
            socket.emit('match_found', {
                roomId,
                seed,
                opponent: { username: opponent.userData.username }
            });

            opponent.emit('match_found', {
                roomId,
                seed,
                opponent: { username: socket.userData.username }
            });
        } else {
            waitingPlayer = socket;
            socket.emit('waiting_opponent', "Dereceli rakip bekleniyor... ⚔️");
        }
    });

    // Biri bulmacayı bitirdiğinde odadaki herkese bildir
    socket.on('game_won', (data) => {
        if (data && data.roomId) {
            // Bitirene zafer yolla
            socket.emit('match_result', { winner: true });
            // Odadaki diğer kişiye mağlubiyet yolla
            socket.to(data.roomId).emit('match_result', { 
                winner: false, 
                winnerName: socket.userData ? socket.userData.username : 'Rakip' 
            });
        }
    });

    socket.on('disconnect', () => {
        if (waitingPlayer && waitingPlayer.id === socket.id) {
            waitingPlayer = null;
        }
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda yayında! 🚀`);
});