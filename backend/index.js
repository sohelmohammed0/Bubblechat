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
const messages = {};

// Helper function to format date
function formatDate() {
  const date = new Date();
  return date.toISOString();
}

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

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  console.log('A user connected.');

  socket.on('userConnected', (username) => {
    activeUsers[username] = {
      socketId: socket.id,
      status: 'online',
      lastSeen: formatDate()
    };
    console.log(`${username} connected.`);

    // Send any pending messages
    if (messages[username]) {
      io.to(socket.id).emit('pendingMessages', messages[username]);
      delete messages[username];
    }
  });

  socket.on('joinRoom', (room) => {
    socket.join(room);
  });

  socket.on('sendMessage', (data) => {
    const messageData = {
      ...data,
      timestamp: formatDate()
    };
    
    const { room, message, sender } = messageData;
    const [user1, user2] = room.split('-');
    const receiver = user1 === sender ? user2 : user1;

    // Store message
    if (!messages[room]) {
      messages[room] = [];
    }
    messages[room].push(messageData);

    // Send to room
    io.to(room).emit(`receiveMessage-${room}`, messageData);

    // Handle offline user messages
    if (!activeUsers[receiver]) {
      if (!messages[receiver]) {
        messages[receiver] = [];
      }
      messages[receiver].push(messageData);
    } else {
      // Send notification to online user
      const receiverSocketId = activeUsers[receiver].socketId;
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('messageNotification', { from: sender });
      }
    }
  });

  socket.on('getChatHistory', (room, callback) => {
    const roomMessages = messages[room] || [];
    callback(roomMessages);
  });

  socket.on('sendFriendRequest', ({ from, to }) => {
    if (!friendRequests[to]) {
      friendRequests[to] = [];
    }
    if (!friends[to]) {
      friends[to] = [];
    }
    if (!friends[from]) {
      friends[from] = [];
    }

    if (!friendRequests[to].includes(from) && !friends[from].includes(to) && !friends[to].includes(from)) {
      friendRequests[to].push(from);
      const toSocketId = activeUsers[to]?.socketId;
      if (toSocketId) {
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
      io.to(fromSocketId).emit('friendListUpdated');
    }
    if (toSocketId) {
      io.to(toSocketId).emit('friendListUpdated');
    }
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

  socket.on('searchUsers', (query) => {
    const results = users
      .filter(user => user.username.toLowerCase().includes(query.toLowerCase()))
      .map(user => ({
        username: user.username,
        status: activeUsers[user.username]?.status || 'offline',
        isFriend: (friends[query] || []).includes(user.username)
      }));
    socket.emit('searchResults', results);
  });

  socket.on('getUserFriends', ({ username }, callback) => {
    const userFriends = friends[username] || [];
    const friendDetails = userFriends.map(friend => {
      const user = users.find(u => u.username === friend);
      return {
        username: friend,
        status: activeUsers[friend]?.status || 'offline'
      };
    });
    callback(friendDetails);
  });

  socket.on('disconnect', () => {
    const disconnectedUser = Object.keys(activeUsers).find(
      (user) => activeUsers[user].socketId === socket.id
    );

    if (disconnectedUser) {
      activeUsers[disconnectedUser].status = 'offline';
      activeUsers[disconnectedUser].lastSeen = formatDate();
      console.log(`${disconnectedUser} disconnected.`);
      
      // Notify friends about status change
      if (friends[disconnectedUser]) {
        friends[disconnectedUser].forEach(friend => {
          const friendSocketId = activeUsers[friend]?.socketId;
          if (friendSocketId) {
            io.to(friendSocketId).emit('friendListUpdated');
          }
        });
      }
    }
  });
});

server.listen(5000, () => {
  console.log('Server is running on port 5000');
});