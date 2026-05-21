module.exports = (io) => {
  io.on('connection', (socket) => {
    // Join subscription room for currently active wallet
    socket.on('join_enterprise_wallet', (walletAddress) => {
      if (walletAddress) {
        const room = `wallet:${walletAddress.toLowerCase()}`;
        socket.join(room);
        console.log(`[Socket.io] Client joined enterprise room: ${room}`);
      }
    });

    // Unsubscribe and leave room when wallet changes
    socket.on('leave_enterprise_wallet', (walletAddress) => {
      if (walletAddress) {
        const room = `wallet:${walletAddress.toLowerCase()}`;
        socket.leave(room);
        console.log(`[Socket.io] Client left enterprise room: ${room}`);
      }
    });
  });
};
