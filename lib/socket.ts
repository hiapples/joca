// myapp/lib/socket.ts
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = 'http://192.168.1.139:4000'; // 跟 API_BASE 一樣

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket'], // 優先用 websocket
    });
  }
  return socket;
}
