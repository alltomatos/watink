import openSocket from "socket.io-client";
import { getBackendUrl } from "../config";

function connectToSocket() {
  const token = localStorage.getItem("token");
  if (!token) {
    return;
  }
  return openSocket(getBackendUrl(), {
    transports: ["websocket"],
    query: {
      token: token,
    },
  });
}

export default connectToSocket;