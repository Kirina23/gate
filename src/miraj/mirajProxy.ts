import { createServer, Socket } from "net";
import { MirajPacket } from "./mirajPacket";

const decode = (data: Buffer) => {
  const packet = new MirajPacket(data);
  console.log(packet.toJSON());
  first = false;
};
let first = true;

const server = createServer((socket) => {
  console.log("connected");
  const client = new Socket();
  let buffer: Buffer | undefined;
  socket.on("data", (data) => {
    console.log("Received from client:");
    // if(first) {
    decode(data);
    // }
    if (client.connecting) {
      buffer = data;
    } else {
      client.write(data);
    }
  });
  socket.on("close", () => {
    console.log("Connection closed by client");
    if (client) {
      client.end();
    }
  });
  client.connect(6000, "10.10.17.234", () => {
    if (buffer) {
      client.write(buffer);
      buffer = undefined;
    }
  });
  client.on("data", (data) => {
    console.log("!!!SERVER!!! Received from server: ");
    // decode(data);
    socket.write(data);
  });

  client.on("close", () => {
    console.log("Connection closed by server");
    if (socket) {
      socket.end();
    }
  });
});

server.listen(6000, () => {
  console.log("start listen on 6000");
});
