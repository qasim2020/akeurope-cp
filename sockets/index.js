const { io } = require('socket.io-client');

const socket = io('http://localhost:3007');

socket.on('connect_error', (err) => {
  console.error('Connection failed:', err);
});

function getSocket() {
  if (!socket) throw new Error('Socket.io not initialized!');
  return socket;
}

module.exports = { getSocket };
