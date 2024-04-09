import { config } from "../common/config";
import { getBitFromZones } from "../common/helper";

export type UDPRequestCommandType =
  | "test"
  | "dcmd"
  | "manualAlarm"
  | "lock"
  | "ping"
  | "dcmdbd";

const MAX_INT = 16777215;

const UDPCommand: Record<UDPRequestCommandType, number> = {
  manualAlarm: 0x4d,
  dcmd: 0x06,
  lock: 0x4a,
  test: 0x00,
  ping: 0x20,
  dcmdbd: 0x54,
};

export interface UDPRequestPing {
  cmd: "ping";
}

export interface UDPRequestTest {
  cmd: "test";
  deviceId: number;
}

const UDPRequestArmCMD = ["dcmd", "manualAlarm", "lock"];

export interface UDPRequestArm {
  cmd: "dcmd" | "dcmdbd" | "manualAlarm";
  deviceId: number;
  zones: Array<0 | 1>;
  userId?: number;
  arm?: boolean;
}

export interface UDPRequestLock {
  cmd: "lock";
  deviceId: number;
  active: boolean;
  userId?: number;
}

export type UDPRequestInput =
  | UDPRequestTest
  | UDPRequestArm
  | UDPRequestPing
  | UDPRequestLock;

export class UDPAiusoRequest {
  input: UDPRequestInput;
  buffer: Buffer;
  id: number;
  constructor(input: UDPRequestInput) {
    if (config.SYSTEM !== "Tandem") {
      throw new Error("Should be Tandem!");
    }
    this.id = 1111; // Math.floor(MAX_INT * Math.random());
    this.input = input;
    this.buffer = Buffer.alloc(20);
    this.buffer[0] = 1;
    this.buffer[2] = config.RMO_ID;
    this.buffer[3] = config.KRT;
    this.buffer[4] = UDPCommand[input.cmd];
    if ((input as UDPRequestTest).deviceId) {
      this.buffer.writeInt16LE((input as UDPRequestTest).deviceId - 1, 5);
    }
    const userId: number | undefined = (input as UDPRequestArm).userId;
    if (userId) {
      this.buffer[9] = userId;
    }
    if (
      input.cmd !== "dcmdbd" &&
      ((input as UDPRequestArm).arm || (input as UDPRequestLock).active)
    ) {
      this.buffer[11] = 1;
    }
    if (input.cmd === "test") {
      this.buffer[12] = 1;
    }
    this.buffer.writeInt32LE(this.id, 13);
    const zones: Array<1 | 0> | undefined = (input as UDPRequestArm).zones;
    if (zones && zones.length > 0) {
      let byte = getBitFromZones(zones) || 0;
      if (input.cmd === "dcmdbd") {
        if (input.arm) {
          byte |= 0x40;
        } else {
          byte &= 0x3f;
        }
      }
      this.buffer[12] = byte;
    }
  }
}
