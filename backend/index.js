const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
app.use(express.json());

const users = [];
const friendRequests = {};
const friends = {};
const activeUsers = {};

// User Registration
app.post('/api/signup', (req, res) => {
  const { email, password, username, phone } = req.body;

  if (!email || !password || !username || !phone) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const existingUser = users.some((user) => user.email === email || user.phone === phone);
  if (existingUser) {
    return res.status(400).json({ error: 'User already exists' });
  }

  users.push({ email, password, username, phone, status: 'offline' });
  res.status(201).json({ message: 'User registered successfully' });
});

// User Login
app.post('/api/login', (req, res) => {
  const { loginContact, loginPassword } = req.body;
  const user = users.find(
    (u) =>
      (u.email === loginContact || u.username === loginContact || u.phone === loginContact) &&
      u.password === loginPassword
  );

  if (!user) {
    return res.status(401).json({ error: 'Invalid login credentials' });
  }

  user.status = 'online';
  res.json({ user });
});

// Setting up Socket.io
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  console.log('A user connected.');

  socket.on('userConnected', (username) => {
    activeUsers[username] = { socketId: socket.id, lastSeen: 'Online' };
    console.log(`${username} connected.`);
  });

  socket.on('joinRoom', (room) => {
    socket.join(room);
  });

  socket.on('sendMessage', (data) => {
    io.to(data.room).emit(`receiveMessage-${data.room}`, data);
  });

  socket.on('sendFile', (data) => {
    io.to(data.room).emit('receiveFile', data);
  });

  socket.on('sendFriendRequest', ({ from, to }) => {
    console.log(`Friend request from ${from} to ${to}`);
    if (!friendRequests[to]) {
      friendRequests[to] = [];
    }
    if (!friends[to]) {
      friends[to] = [];
    }
    if (!friends[from]) {
      friends[from] = [];
    }
    
    // Check if the request already exists
    if (!friendRequests[to].includes(from) && !friends[from].includes(to) && !friends[to].includes(from)) {
      friendRequests[to].push(from);
      const toSocketId = activeUsers[to]?.socketId;
      if (toSocketId) {
        console.log(`Notifying ${to} about the friend request from ${from}`);
        io.to(toSocketId).emit('friendRequestReceived', { from });
      }
    }
  });

  socket.on('acceptFriendRequest', ({ from, to }) => {
    if (!friends[to]) {
      friends[to] = [];
    }
    if (!friends[from]) {
      friends[from] = [];
    }
    friends[to].push(from);
    friends[from].push(to);
    friendRequests[to] = friendRequests[to].filter(request => request !== from);

    const fromSocketId = activeUsers[from]?.socketId;
    const toSocketId = activeUsers[to]?.socketId;
    if (fromSocketId) {
      io.to(fromSocketId).emit('friendRequestAccepted', { from: to });
    }
    if (toSocketId) {
      io.to(toSocketId).emit('friendRequestAccepted', { from });
    }
    io.to(fromSocketId).emit('friendListUpdated');
    io.to(toSocketId).emit('friendListUpdated');
  });

  socket.on('unfriend', ({ from, to }) => {
    if (friends[from]) {
      friends[from] = friends[from].filter(friend => friend !== to);
    }
    if (friends[to]) {
      friends[to] = friends[to].filter(friend => friend !== from);
    }

    const fromSocketId = activeUsers[from]?.socketId;
    const toSocketId = activeUsers[to]?.socketId;
    if (fromSocketId) {
      io.to(fromSocketId).emit('friendListUpdated');
    }
    if (toSocketId) {
      io.to(toSocketId).emit('friendListUpdated');
    }
  });

  socket.on('disconnect', () => {
    const disconnectedUser = Object.keys(activeUsers).find(
      (user) => activeUsers[user].socketId === socket.id
    );

    if (disconnectedUser) {
      activeUsers[disconnectedUser].lastSeen = new Date().toLocaleString();
      console.log(`${disconnectedUser} disconnected.`);
    }
  });

  socket.on('searchUsers', (query) => {
    const results = users.filter(user => user.username.includes(query))
      .map(user => ({ username: user.username, status: user.status }));

    socket.emit('searchResults', results);
  });

  socket.on('getUserFriends', ({ username }, callback) => {
    const userFriends = friends[username] || [];
    const friendDetails = userFriends.map(friend => {
      const user = users.find(u => u.username === friend);
      return { username: friend, status: user.status };
    });
    callback(friendDetails);
  });

  socket.on('getLastSeen', (username) => {
    const user = activeUsers[username];
    const lastSeen = user ? 'Online' : user?.lastSeen || 'Offline';
    socket.emit('lastSeen', { username, lastSeen });
  });
});

server.listen(5000, () => {
  console.log('Server is running on port 5000');
});