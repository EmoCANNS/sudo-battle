const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let waitingPlayer = null;

// Rank belirleme fonksiyonu
function getRank(rp) {
    if (rp < 100) return { name: 'Bronz', icon: '#rank-bronze' };
    if (rp < 300) return { name: 'Gümüş', icon: '#rank-silver' };
    if (rp < 600) return { name: 'Altın', icon: '#rank-gold' };
    if (rp < 1000) return { name: 'Platin', icon: '#rank-platinum' };
    if (rp < 1500) return { name: 'Elmas', icon: '#rank-diamond' };
    return { name: 'Üstat', icon: '#rank-master' };
}

io.on('connection', (socket) => {
    console.log(`Bir oyuncu bağlandı: ${socket.id}`);

    socket.on('find_match', (playerData) => {
        socket.userData = {
            id: socket.id,
            username: playerData.username || 'Oyuncu',
            rp: playerData.rp || 0
        };

        if (waitingPlayer) {
            const roomId = `room_${socket.id}_${waitingPlayer.id}`;
            socket.join(roomId);
            waitingPlayer.join(roomId);

            const seed = Math.floor(Math.random() * 900000) + 100;
            
            socket.emit('match_found', {
                roomId,
                seed,
                opponent: {
                    username: waitingPlayer.userData.username,
                    rank: getRank(waitingPlayer.userData.rp)
                }
            });

            waitingPlayer.emit('match_found', {
                roomId,
                seed,
                opponent: {
                    username: socket.userData.username,
                    rank: getRank(socket.userData.rp)
                }
            });

            waitingPlayer = null;
        } else {
            waitingPlayer = socket;
            socket.emit('waiting_opponent', "Dereceli rakip aranıyor... ⚔️");
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

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor! 🚀`);
});