import { RemoteInfo } from "dgram";
import { config } from "../common/config";
import { getZonesFromBit, getZonesFromBitReversed } from "../common/helper";
import { ZONE_LENGTH } from "./aiuso";

export type UDPRequestCommandType =
  | "action"
  | "alarm"
  | "lock"
  | "test"
  | "dcmd"
  | "dcmdbd"
  | "manualAlarm"
  | "failTest";

const UDPCommand: Record<number, UDPRequestCommandType> = {
  0x1b: "alarm",
  0x4d: "manualAlarm",
  0x1f: "action",
  0x4a: "lock",
  0x46: "test",
  0x47: "failTest",
  0x48: "dcmd",
  0x54: "dcmdbd",
};

export interface UDPResponseBase {
  cmd: UDPRequestCommandType;
}

export interface UDPResponseAlarm extends UDPResponseBase {
  cmd: "alarm";
  n: number;
}

export interface UDPResponseArm extends UDPResponseBase {
  cmd: "action";
  disarm: boolean;
  n: number;
}

export interface UDPResponseLock extends UDPResponseBase {
  cmd: "lock";
  deviceId: number;
}

export interface UDPResponseTest extends UDPResponseBase {
  cmd: "test";
  deviceId: number;
  success: boolean;
  zones?: (1 | 0)[];
  active?: (1 | 0)[];
}

export interface UDPResponseDCMD extends UDPResponseBase {
  cmd: "dcmd" | "dcmdbd";
  deviceId: number;
  arm: boolean;
  zoneNumber?: number;
}

export interface UDPResponseManualAlarm extends UDPResponseBase {
  cmd: "manualAlarm";
  deviceId: number;
  zones?: (1 | 0)[];
}

export type UDPResponseData =
  | UDPResponseAlarm
  | UDPResponseArm
  | UDPResponseLock
  | UDPResponseTest
  | UDPResponseDCMD
  | UDPResponseManualAlarm;

export class UDPAiusoResponse {
  data: UDPResponseData;
  rmoId: number;
  krt: number;
  buffer: Buffer;
  address: string;
  port: number;
  id: number;
  time: number;
  constructor(buffer: Buffer, info: RemoteInfo) {
    if (config.SYSTEM !== "Tandem") {
      throw new Error("Should be Tandem!");
    }
    if (buffer.length !== 20) {
      throw new Error("Длинна сообщения должна быть 20 байт");
    }
    this.time = Date.now();
    this.address = info.address;
    this.port = info.port;
    this.buffer = buffer;
    this.krt = buffer[2]; //NEED TO GET from 12 in some cases
    this.id = this.buffer.readInt32LE(13);
    const cmd = UDPCommand[this.buffer[4]];
    if (!cmd) {
      throw new Error("Неизвестный тип команды: " + this.buffer[4]);
    }
    this.rmoId = buffer[3];
    const n = buffer.readUInt16LE(5);
    switch (cmd) {
      case "action":
        this.data = {
          cmd,
          disarm: this.buffer[10] === 0x02,
          n,
        };
        break;
      case "alarm":
        this.data = {
          cmd,
          n,
        };
        break;
      case "lock":
        this.data = {
          cmd,
          deviceId: n + 1,
        };
        break;
      case "test":
        this.data = {
          cmd,
          deviceId: n + 1,
          success: true,
          active: getZonesFromBitReversed(this.buffer[11], ZONE_LENGTH),
          zones: getZonesFromBit(this.buffer[12], false, ZONE_LENGTH),
        };
        break;
      case "failTest":
        this.data = {
          cmd: "test",
          deviceId: n + 1,
          success: false,
        };
        break;
      case "dcmdbd":
      case "dcmd":
        this.data = {
          cmd,
          deviceId: n + 1,
          arm: this.buffer[11] === 0x03,
          zoneNumber: this.buffer[12],
        };
        break;
      case "manualAlarm":
        this.data = {
          cmd,
          deviceId: n + 1,
          zones: getZonesFromBit(this.buffer[12], false, ZONE_LENGTH),
        };
        break;
    }
  }
}
