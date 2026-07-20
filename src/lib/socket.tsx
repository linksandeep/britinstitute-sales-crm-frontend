import { io, Socket } from 'socket.io-client';

const isLoopbackHost = (hostname: string) => hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';

const resolveSocketUrl = () => {
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;

    if (import.meta.env.VITE_SOCKET_URL) {
      try {
        const url = new URL(import.meta.env.VITE_SOCKET_URL);
        if (!isLoopbackHost(hostname) && isLoopbackHost(url.hostname)) {
          url.protocol = protocol;
          url.hostname = hostname;
          return url.toString().replace(/\/$/, '');
        }
      } catch {
        return import.meta.env.VITE_SOCKET_URL;
      }

      return import.meta.env.VITE_SOCKET_URL;
    }

    return `${protocol}//${hostname}:8000`;
  }

  return import.meta.env.VITE_SOCKET_URL || 'http://localhost:8000';
};

const SOCKET_URL = resolveSocketUrl();

const socket: Socket = io(SOCKET_URL, {
  autoConnect: false, // ⛔ important: we connect manually
  transports: ['websocket'],
  withCredentials: true,
});

export default socket;
