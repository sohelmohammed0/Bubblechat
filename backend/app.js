// Connect to the Socket.IO server
const socket = io('http://localhost:5000');

// Elements
const chatBox = document.getElementById('chat-box');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message');

// Add a new message to the chat box
function addMessage(message) {
  const messageElement = document.createElement('div');
  messageElement.textContent = message;
  chatBox.appendChild(messageElement);
}

// Listen for 'receive_message' event from the server
socket.on('receive_message', (data) => {
  addMessage(`User: ${data}`);
});

// Handle message submission
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const message = messageInput.value;

  // Send the message to the server
  socket.emit('send_message', message);

  // Add the message locally
  addMessage(`You: ${message}`);
  messageInput.value = ''; // Clear input
});
