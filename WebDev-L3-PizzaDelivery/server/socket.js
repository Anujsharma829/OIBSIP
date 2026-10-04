// Real-time updates with Socket.IO.
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, CLIENT_URL } = require('./config');

let io;

function initSocket(httpServer) {
  io = new Server(httpServer, { cors: { origin: CLIENT_URL } });

  // Only logged in people can connect (they send their token when connecting).
  io.use((socket, next) => {
    try {
      socket.user = jwt.verify(socket.handshake.auth.token, JWT_SECRET);
      next();
    } catch {
      next(new Error('auth'));
    }
  });

  // Every customer joins a private "room" named after their user id.
  // Admins join the shared room called "admin".
  io.on('connection', (socket) => {
    socket.join(socket.user.role === 'admin' ? 'admin' : String(socket.user.id));
  });
}

// Other files call getIO() to send events, for example "order:update".
const getIO = () => io;

module.exports = { initSocket, getIO };
