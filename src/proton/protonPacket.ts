import { CRCError, IncorrectPacketError } from "./errors.interface";
import { v4 as uuidv4 } from "uuid";
import * as eventMap from "./eventMap.json";
import {
  bufferPrint,
  getBitFromZones,
  getZonesFromBit,
} from "../common/helper";
import {
  ACTION_EVENT_CODES,
  ALARM_EVENT_CODES,
  ALL_EVENT_CODES_WITH_STATE,
} from "./commandLists";
import { Logger } from "../common/logger";

export enum ProtonCMD {
  CLOSE_REQUEST = 0x0001,
  ACK = 0x2001,
  AUTH = 0xc002,
  EVENT = 0xe002,
  CONTROL = 0xe003,
  PING = 0x0002,
}

export enum ProtonRemoteCmd {
  TEST = 0x3003,
  ARM = 0x3002,
  DISARM = 0x3001,
}

export enum ProtonChannelType {
  "ANY" = 0,
  "GPRS" = 1,
  "GSM" = 2,
  "RADIO" = 3,
}

export interface ProtonEvent {
  objectNumber: number;
  systemNumber: number;
  eventCode: number; // ENUM
  eventName?: string;
  channel?: ProtonChannelType;
  time?: Date;
  simCard?: 1 | 2;
  signalLevel?: number;
  relay?: number;
  relayLevel?: number;
  eventData?: Buffer;
  zones?: Array<1 | 0>;
  active?: Array<1 | 0>;
  userId?: number;
}

interface ProtonCmdInterface {
  cmd: ProtonCMD;
}

interface ProtonAckCmd extends ProtonCmdInterface {
  cmd: ProtonCMD.ACK;
  id: string;
  crcPassed: boolean;
}

interface ProtonAuthCmd extends ProtonCmdInterface {
  cmd: ProtonCMD.AUTH;
  username: string;
  password: string;
}

interface ProtonDeviceCmd extends ProtonCmdInterface {
  cmd: ProtonCMD.CONTROL;
  objNumber: number;
  systemNumber: number;
  channel: ProtonChannelType;
  remoteCmd: ProtonRemoteCmd;
}

interface ProtonDeviceTestCmd extends ProtonDeviceCmd {
  remoteCmd: ProtonRemoteCmd.TEST;
}

interface ProtonDeviceArmCmd extends ProtonDeviceCmd {
  remoteCmd: ProtonRemoteCmd.ARM | ProtonRemoteCmd.DISARM;
  zones: Array<1 | 0>;
}

interface ProtonPingCmd extends ProtonCmdInterface {
  cmd: ProtonCMD.PING;
}

export type ProtonCmdPayload =
  | ProtonAuthCmd
  | ProtonDeviceArmCmd
  | ProtonDeviceTestCmd
  | ProtonAckCmd
  | ProtonPingCmd;

export class ProtonPacketRequest {
  buffer: Buffer;
  id: string;
  data: ProtonCmdPayload;
  objNumber?: number;
  constructor(data: ProtonCmdPayload) {
    this.data = data;
    const prefix = [0x47, 0x50, 0x02, 0x00, 0x40, 0x01, 0x00, 0x00];
    const idBuffer = Buffer.alloc(39); //39
    idBuffer[0] = 0xc0;
    idBuffer[1] = 0x01;
    this.id = data.cmd === ProtonCMD.ACK ? data.id : uuidv4();
    idBuffer[2] = this.id.length;
    idBuffer.write(this.id, 3, "ascii");
    let cmdBuffer: number[] = [];
    switch (data.cmd) {
      case ProtonCMD.PING:
        cmdBuffer = [0x00, 0x02];
        break;
      case ProtonCMD.ACK:
        cmdBuffer = [0x20, 0x01, data.crcPassed ? 0 : 1];
        break;
      case ProtonCMD.AUTH:
        //const authSize = data.username.length + data.password.length + 2;
        const authSize = 18;
        const tempAuthBuffer = Buffer.alloc(authSize + 3);
        tempAuthBuffer.writeUInt16BE(ProtonCMD.AUTH);
        tempAuthBuffer[2] = authSize;
        tempAuthBuffer[3] = 0x80;
        tempAuthBuffer.write(data.username, 4, "binary");
        tempAuthBuffer[12] = 0x81;
        tempAuthBuffer.write(data.password, 13, "binary");
        // console.log('auth: ', tempAuthBuffer.toString());
        cmdBuffer = [...tempAuthBuffer];
        // cmdBuffer = [0xc0, 0x02,
        //     0x12,
        //     0x80, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
        //     0x81, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]
        break;
      case ProtonCMD.CONTROL:
        this.objNumber = data.objNumber;
        let tempCmdBuffer = Buffer.from([
          0xe0,
          0x03, // ControlCMD
          0x00,
          0x00, //SIZE
          0x41,
          0x00,
          0x00, //OBJNUM
          0x22,
          data.systemNumber, // SYSNUM
          0x21,
          data.channel, // CHANNEL
          0xe2,
        ]);
        tempCmdBuffer.writeInt16BE(data.objNumber, 5);
        if (data.remoteCmd !== ProtonRemoteCmd.TEST) {
          const zoneBit = getBitFromZones(data.zones);
          if (!zoneBit) {
            throw new Error(
              "Получен некорректный пакет без zones " + JSON.stringify(data)
            );
          }
          tempCmdBuffer = Buffer.from([
            ...tempCmdBuffer,
            0x00,
            0x03,
            0x30,
            data.remoteCmd === ProtonRemoteCmd.ARM ? 0x02 : 0x01,
            zoneBit,
          ]);
        } else {
          tempCmdBuffer = Buffer.from([
            ...tempCmdBuffer,
            0x00,
            0x02,
            0x30,
            0x03,
          ]);
        }
        tempCmdBuffer.writeInt16BE(tempCmdBuffer.length - 4, 2);
        cmdBuffer = [...tempCmdBuffer];
        break;
      default:
        break;
    }
    const crc = [0x40, 0x02, 0x00, 0x00];
    const tempBuffer = Buffer.from([
      ...prefix,
      ...idBuffer,
      ...cmdBuffer,
      ...crc,
    ]);
    tempBuffer.writeInt16BE(
      prefix.length + idBuffer.length + cmdBuffer.length + crc.length,
      6
    );
    this.buffer = Buffer.from(setCRC(tempBuffer));
  }
}

export class ProtonPacketResponse {
  buffer: Buffer;
  packetSize: number;
  id: string;
  idBuffer: Buffer;
  cmd: ProtonCMD;
  event?: ProtonEvent;
  crcValid: boolean;
  constructor(buffer: Buffer, logger: Logger) {
    this.buffer = buffer;
    if (
      buffer[0] !== 0x47 ||
      buffer[1] !== 0x50 ||
      buffer[2] !== 0x02 ||
      buffer[3] !== 0x00 ||
      buffer[4] !== 0x40 ||
      buffer[5] !== 0x01
    ) {
      throw new IncorrectPacketError(
        "Префикс пакета некорректный. " + bufferPrint(buffer)
      );
    }
    this.packetSize = buffer.readUInt16BE(6);
    if (this.packetSize !== buffer.length) {
      throw new IncorrectPacketError(
        "Размер пакета не сходится. В пакете указан: " +
          this.packetSize +
          " фактический: " +
          buffer.length +
          " пакет: " +
          bufferPrint(buffer)
      );
    }
    if (buffer[8] !== 0xc0 || buffer[9] !== 0x01) {
      throw new IncorrectPacketError(
        "Префикс ID не корректный. Пакет: " + bufferPrint(buffer)
      );
    }
    this.crcValid = validateCRC(buffer);
    // if (!validateCRC(buffer)) {
    //     throw new CRCError('Ошибка CRC');
    // }
    this.idBuffer = buffer.slice(11, 11 + buffer[10]);
    this.id = this.idBuffer.toString();
    this.cmd = buffer.readUInt16BE(11 + buffer[10]);
    if (this.cmd === ProtonCMD.EVENT) {
      const eventPayloadBuffer = buffer.slice(
        15 + buffer[10],
        buffer.length - 4
      );
      // console.log('eventPayload', eventPayloadBuffer);
      let x = 0;
      let objectNumber: number | undefined;
      let systemNumber: number | undefined;
      let eventCode: number | undefined; // ENUM
      let channel: ProtonChannelType | undefined;
      let time: Date | undefined;
      let simCard: 1 | 2 | undefined;
      let signalLevel: number | undefined;
      let relay: number | undefined;
      let relayLevel: number | undefined;
      let eventData: Buffer | undefined;
      let zones: Array<1 | 0> | undefined;
      let active: Array<1 | 0> | undefined;
      let userId: number | undefined;

      while (x < eventPayloadBuffer.length) {
        switch (eventPayloadBuffer[x]) {
          case 0x41: // OBJNUM
            objectNumber = eventPayloadBuffer.readUInt16BE(x + 1);
            x += 3;
            break;
          case 0x22: // SYSNUM
            systemNumber = eventPayloadBuffer[x + 1];
            x += 2;
            break;
          case 0xe1: // EVENTDATA
            const size = eventPayloadBuffer.readUInt16BE(x + 1);
            eventData = eventPayloadBuffer.slice(x + 5, x + 3 + size);
            if (size > 1) {
              eventCode = eventPayloadBuffer.readUInt16BE(x + 3);
            }
            x += 3 + size;
            break;
          case 0x21: // CHANNEL
            if (eventPayloadBuffer[x + 1] === 0x01) {
              channel = ProtonChannelType.GPRS;
            } else if (eventPayloadBuffer[x + 1] === 0x02) {
              channel = ProtonChannelType.GSM;
            } else if (eventPayloadBuffer[x + 1] === 0x03) {
              channel = ProtonChannelType.RADIO;
            }
            x += 2;
            break;
          case 0x81: // TIME
            const low = eventPayloadBuffer.readInt32BE(x + 5);
            let timestamp =
              eventPayloadBuffer.readInt32BE(x + 1) * 4294967296.0 + low;
            if (low < 0) timestamp += 4294967296;
            const now = Date.now();
            time = new Date(timestamp > now ? now : timestamp);
            x += 9;
            break;
          case 0x23: // SIM
            if (eventPayloadBuffer[x + 1] === 0x00) {
              simCard = 1;
            } else if (eventPayloadBuffer[x + 1] === 0x01) {
              simCard = 2;
            }
            x += 2;
            break;
          case 0x24: // SYSNUM
            signalLevel = eventPayloadBuffer[x + 1];
            x += 2;
            break;
          default:
            console.error(
              "Не корректный индекс " +
                x +
                "значение 0x" +
                eventPayloadBuffer[x].toString(16)
            );
            x++;
            break;
        }
      }
      if (!eventCode || !objectNumber || !systemNumber || !eventCode) {
        throw new Error(
          "В событии отсутствуют обязательные поля! eventCode: " +
            eventCode +
            " objectNumber: " +
            objectNumber +
            " systemNumber: " +
            systemNumber +
            " eventCode: " +
            eventCode
        );
      }
      if (ALL_EVENT_CODES_WITH_STATE.includes(eventCode)) {
        if (eventData && eventData.length > 1) {
          zones = getZonesFromBit(eventData[0]);
          active = getZonesFromBit(eventData[1], true);
        } else {
          logger.error(
            "Для события " +
              eventCode +
              ": " +
              (eventMap as any)[eventCode] +
              " нет состояния зон. EventData: " +
              bufferPrint(eventData)
          );
        }
      }
      if (
        ACTION_EVENT_CODES.includes(eventCode) &&
        eventData &&
        eventData.length > 1
      ) {
        zones = getZonesFromBit(eventData[1]);
        userId = eventData[0];
      }
      if (
        ALARM_EVENT_CODES.includes(eventCode) &&
        eventData &&
        eventData.length > 0
      ) {
        active = new Array(8).fill(0);
        active[eventData[0] - 1] = 1;
      }

      this.event = {
        objectNumber,
        systemNumber,
        eventCode,
        eventName: (eventMap as any)[eventCode],
        channel,
        time,
        simCard,
        signalLevel,
        relay,
        relayLevel,
        eventData,
        zones,
        active,
        userId,
      };
    } else if (this.cmd === ProtonCMD.ACK) {
      const result = buffer[13 + buffer[10]];
      if (result === 0x01) {
        logger.error("ОШИБКА CRC!");
      } else if (result === 0x02) {
        logger.error("ОШИБКА АВТОРИЗАЦИИ!!!!");
      }
    }
  }

  hasState(): boolean {
    return (
      this.event !== undefined &&
      this.event.active !== undefined &&
      this.event.active.length > 0 &&
      this.event.zones !== undefined &&
      this.event.zones.length > 0
    );
  }

  isAction(): boolean {
    return (
      this.event !== undefined &&
      ACTION_EVENT_CODES.includes(this.event.eventCode) &&
      this.event.userId !== undefined &&
      this.event.zones !== undefined &&
      this.event.zones.length > 0
    );
  }

  getResponse(): Buffer {
    if (this.cmd === ProtonCMD.ACK) {
      throw new Error("Отвечать на подтверждение не требуется");
    }
    const response = new ProtonPacketRequest({
      cmd: ProtonCMD.ACK,
      crcPassed: this.crcValid,
      id: this.id,
    });
    return response.buffer;
  }

  toObject() {
    return {
      id: this.id,
      cmd: this.cmd,
      crcValid: this.crcValid,
      packetSize: this.packetSize,
      event: this.event
        ? {
            ...this.event,
            eventData: this.event.eventData
              ? bufferPrint(this.event.eventData)
              : undefined,
            zones: this.event.zones ? this.event.zones.join(",") : undefined,
            active: this.event.active ? this.event.active.join(",") : undefined,
          }
        : undefined,
    };
  }
}

const ToInteger = (x: number): number => {
  x = Number(x);
  return x < 0 ? Math.ceil(x) : Math.floor(x);
};

const modulo = (a: number, b: number): number => {
  return a - Math.floor(a / b) * b;
};
const ToUint32 = (x: number): number => {
  return modulo(ToInteger(x), Math.pow(2, 32));
};

export const setCRC = (buffer: Buffer): Buffer => {
  const result = Buffer.from(buffer);
  let crc16 = 0;
  for (let x = 0; x < result.length - 4; x++) {
    crc16 = ToUint32(crc16 + result[x]);
    for (let y = 0; y < 8; y++) {
      if (ToUint32(crc16 & 0x800000) !== 0) {
        crc16 = ToUint32(ToUint32(crc16 << 1) ^ 0x800500);
      } else {
        crc16 = ToUint32(crc16 << 1);
      }
    }
  }
  result.writeUInt16BE(
    ToUint32(ToUint32(crc16 >> 8) & 0x0000ffff),
    result.length - 2
  );
  return result;
};

export const validateCRC = (buffer: Buffer): boolean => {
  const recalculated = setCRC(buffer);
  recalculated.readInt16BE(recalculated.length - 2);
  // console.log('получен: ' + buffer.toString('hex'));
  // console.log('с СRC  : ' + recalculated.toString('hex'));
  // console.log('разница: ' + (recalculated.readInt16BE(recalculated.length - 2) - buffer.readInt16BE(buffer.length - 2)))
  return buffer.toString("hex") === recalculated.toString("hex");
};

// const packet = new ProtonPacketResponse(Buffer.from([
//     0x47, 0x50, 0x02, 0x00,
//     0x40, 0x01, 0x00, 0x51,
//     0xc0, 0x01, 0x24,

//     0x32, 0x66, 0x30, 0x35,
//     0x63, 0x64, 0x31, 0x34,
//     0x2d, 0x39, 0x38, 0x64,
//     0x36, 0x2d, 0x34, 0x65,
//     0x32, 0x34, 0x2d, 0x39,
//     0x35, 0x36, 0x31, 0x2d,
//     0x32, 0x36, 0x65, 0x30,
//     0x37, 0x34, 0x63, 0x61,
//     0x62, 0x38, 0x30, 0x63,

//     0xe0, 0x02, //EVENT CMD
//     0x00, 0x41, //SIZE
//     0x41, 0x03, 0x09, //OBJNUM
//     0x22, 0x01, //SYSNUM
//     0xe1, //EVENTPREFIX
//     0x00, 0x03, //EVENTSIZE
//     0x02, 0x69, 0x00, //EVENT DATA
//     0x21, // CHANNEL PREFIX
//     0x01, //CHANNEL (GPRS)
//     0x81, // TIME PREFIX
//     0x00, 0x00, 0x01, 0x75, 0x6e, 0x27, 0xf9, 0x17, //TIMESTAMP
//     0x23, //SIM PREFIX
//     0x00, //SIM1
//     0x24, //SIGNAL PREFIX
//     0x41, //SIGNAL

//     0x40, 0x02, 0x3d, 0x75 //CRC
// ]));

// const testResp = [
//     0xfa, 0x77,  //1,1,1,1
//     0x0f, 0x0f, // 1111
//     0x0e, 0x0f,

//     0x47, 0x50, 0x02, 0x00,
//     0x40, 0x01, 0x00, 0x52,
//     0xc0, 0x01, 0x24,

//     0x35, 0x31, 0x35, 0x36,
//     0x65, 0x38, 0x34, 0x32,
//     0x2d, 0x38, 0x62, 0x63,
//     0x62, 0x2d, 0x34, 0x39,
//     0x61, 0x66, 0x2d, 0x62,
//     0x35, 0x36, 0x66, 0x2d,
//     0x61, 0x38, 0x39, 0x61,
//     0x61, 0x33, 0x36, 0x64,
//     0x37, 0x39, 0x62, 0x36,

//     0xe0, 0x02,
//     0x00, 0x42,
//     0x41, 0x00, 0x0b,
//     0x22, 0x01,
//     0xe1,
//     0x00, 0x04,
//     0x02, 0xbf, 0x00, 0xb9,
//     0x21, 0x01,
//     0x81, 0x00, 0x00, 0x01, 0x75, 0x78, 0x41, 0xac, 0x3a,
//     0x23, 0x00,
//     0x24, 0x3d,

//     0x40, 0x02, 0x7f, 0x66
// ];
