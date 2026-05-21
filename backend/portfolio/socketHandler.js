module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('[Socket.io] Portfolio socket connected');

    socket.on('join_portfolio', (walletAddress) => {
      if (walletAddress) {
        const room = `wallet_${walletAddress.toLowerCase()}`;
        socket.join(room);
        console.log(`[Socket.io] Client joined portfolio room: ${room}`);
      }
    });

    socket.on('leave_portfolio', (walletAddress) => {
      if (walletAddress) {
        const room = `wallet_${walletAddress.toLowerCase()}`;
        socket.leave(room);
        console.log(`[Socket.io] Client left portfolio room: ${room}`);
      }
    });

    // Support join/leave room for wallet:<address>
    socket.on('join', (roomName) => {
      if (roomName) {
        const lowerRoom = roomName.toLowerCase();
        socket.join(lowerRoom);
        console.log(`[Socket.io] Client joined channel: ${lowerRoom}`);
      }
    });

    socket.on('leave', (roomName) => {
      if (roomName) {
        const lowerRoom = roomName.toLowerCase();
        socket.leave(lowerRoom);
        console.log(`[Socket.io] Client left channel: ${lowerRoom}`);
      }
    });
  });
};
