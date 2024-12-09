const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: '*',
  },
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let users = [];
let friends = {};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('userConnected', (username) => {
    socket.username = username;

    // Add user to the users list if not already present
    if (!users.some((u) => u.username === username)) {
      users.push({ username, status: 'online', lastSeen: null });
    } else {
      const user = users.find((u) => u.username === username);
      user.status = 'online';
    }

    // Emit the updated user list to all clients
    io.emit('userList', users);
  });

  socket.on('searchUsers', (query) => {
    const searchResults = users.filter((user) =>
      user.username.toLowerCase().includes(query.toLowerCase())
    );
    socket.emit('searchResults', searchResults);
  });

  socket.on('addFriend', ({ friendUsername, username }) => {
    if (!friends[username]) friends[username] = [];
    if (!friends[username].includes(friendUsername)) {
      friends[username].push(friendUsername);
    }
  });

  socket.on('privateMessage', ({ from, to, message }) => {
    const recipientSocket = Array.from(io.sockets.sockets.values()).find(
      (s) => s.username === to
    );

    if (recipientSocket) {
      recipientSocket.emit('receivePrivateMessage', { from, message });
    }

    socket.emit('receivePrivateMessage', { from, message });
  });

  socket.on('userTyping', ({ room, username }) => {
    socket.to(room).emit('typing', { username });
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    const user = users.find((u) => u.username === socket.username);
    if (user) {
      user.status = 'offline';
      user.lastSeen = new Date().toISOString();
      io.emit('userList', users);
    }
  });
});

server.listen(5000, () => {
  console.log('Server running on http://localhost:5000');
});
