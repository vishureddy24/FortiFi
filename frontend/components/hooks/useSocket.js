import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export const useSocket = () => {
  const [socket, setSocket] = useState(null);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const socketIo = io(SOCKET_URL);

    socketIo.on('connect', () => {
      console.log('[Socket] Connected to backend');
    });

    socketIo.on('new-alert', (alert) => {
      setAlerts((prev) => [alert, ...prev].slice(0, 50));
    });

    setSocket(socketIo);

    return () => {
      socketIo.disconnect();
    };
  }, []);

  return { socket, alerts };
};
