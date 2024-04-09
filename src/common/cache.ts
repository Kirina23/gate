import * as Redis from "ioredis";
import { config, ConfigParams } from "./config";
import { DeviceConfigMqtt } from "./dto";
import {
  DeviceState,
  DeviceStateMqtt,
  DeviceStatus,
  DeviceStatusMqtt,
} from "./server.interface";

export const CACHED_STATE_PREFIX = "state_";
export const CACHED_STATUS_PREFIX = "status_";
export const CACHED_CONFIG_PREFIX = "config_";
export const POWER_STATUS_PREFIX = "power:";
export const BATTERY_STATUS_PREFIX = "battery:";
export const CACHED_GATEWAY_CONFIG_PREFIX = "gatewayConfig";
const NO_ANSWER_IGNORE = "NO_ANSWER_IGNORE";
const LAST_EVENT_ID = "lastEventId";

export class RedisCache {
  private client: Redis.Redis;
  private prefix: string;
  private ignore = false;

  constructor(options?: Redis.RedisOptions) {
    this.prefix =
      config.NAMESPACE +
      "_" +
      config.SYSTEM +
      "_" +
      config.REGION +
      "_" +
      config.GATEWAY_ID +
      "_";
    this.client = new Redis({
      ...options,
      host: config.REDIS_HOST,
      port: config.REDIS_PORT,
    });
    setInterval(() => {
      this.syncIgnoreNoAnswer();
    }, 30000);
    this.syncIgnoreNoAnswer();
  }

  async syncIgnoreNoAnswer() {
    const value = await this.client.get(NO_ANSWER_IGNORE);
    this.ignore = value === "1";
  }

  async getDevicePowerStatus(
    deviceId: number | string
  ): Promise<boolean | undefined> {
    return this.get(POWER_STATUS_PREFIX + deviceId);
  }

  async setDevicePowerStatus(
    deviceId: number | string,
    status: boolean
  ): Promise<void> {
    await this.set(POWER_STATUS_PREFIX + deviceId, status);
  }

  async getDeviceBatteryStatus(
    deviceId: number | string
  ): Promise<boolean | undefined> {
    return this.get(BATTERY_STATUS_PREFIX + deviceId);
  }

  async setDeviceBatteryStatus(
    deviceId: number | string,
    status: boolean
  ): Promise<void> {
    await this.set(BATTERY_STATUS_PREFIX + deviceId, status);
  }

  async hasDevice(deviceId: number | string): Promise<boolean> {
    const keys = await this.keys(CACHED_CONFIG_PREFIX + deviceId);
    return keys.length > 0;
  }

  async getDeviceState(
    deviceId: number | string
  ): Promise<DeviceStateMqtt | undefined> {
    return this.get(CACHED_STATE_PREFIX + deviceId);
  }

  async getDeviceStatus(
    deviceId: number | string
  ): Promise<DeviceStatusMqtt | undefined> {
    return this.get(CACHED_STATUS_PREFIX + deviceId);
  }

  async getDeviceConfig(
    deviceId: number | string
  ): Promise<DeviceConfigMqtt | undefined> {
    return this.get(CACHED_CONFIG_PREFIX + deviceId);
  }

  async getGatewayConfig(): Promise<ConfigParams | undefined> {
    return this.get(CACHED_GATEWAY_CONFIG_PREFIX);
  }

  async setDeviceState(
    deviceId: number | string,
    state: DeviceStateMqtt
  ): Promise<void> {
    return this.set(CACHED_STATE_PREFIX + deviceId, {
      ...state,
      deviceId: undefined,
    });
  }

  async setDeviceStatus(
    deviceId: number | string,
    status: DeviceStatusMqtt
  ): Promise<void> {
    return this.set(CACHED_STATUS_PREFIX + deviceId, {
      ...status,
      deviceId: undefined,
    });
  }

  async setDeviceConfig(
    deviceId: number | string,
    config: DeviceConfigMqtt
  ): Promise<void> {
    return this.set(CACHED_CONFIG_PREFIX + deviceId, config);
  }

  async setGatewayConfig(config: ConfigParams): Promise<void> {
    return this.set(CACHED_GATEWAY_CONFIG_PREFIX, config);
  }

  async deleteDeviceData(deviceId: number | string): Promise<void> {
    const promises = [
      this.del(CACHED_CONFIG_PREFIX + deviceId),
      this.del(CACHED_STATE_PREFIX + deviceId),
      this.del(CACHED_STATUS_PREFIX + deviceId),
    ];
    await Promise.all(promises);
  }

  async getMemoryStat(): Promise<any> {
    const reply = await this.client.info();
    let upSince,
      memory,
      connectedClients,
      lastSaveToDisk,
      changesSinceLastSave,
      commandsPerSecond;
    for (const line of reply.split("\n")) {
      if (line.startsWith("uptime_in_seconds")) {
        upSince =
          Math.round(new Date().getTime() / 1000) -
          Number.parseInt(line.split(":")[1]);
      }
      if (line.startsWith("used_memory:")) {
        memory = Number.parseInt(line.split(":")[1]);
      }
      if (line.startsWith("connected_clients")) {
        connectedClients = Number.parseInt(line.split(":")[1]);
      }
      if (line.startsWith("rdb_changes_since_last_save")) {
        changesSinceLastSave = Number.parseInt(line.split(":")[1]);
      }
      if (line.startsWith("rdb_last_save_time")) {
        lastSaveToDisk = Number.parseInt(line.split(":")[1]);
      }
      if (line.startsWith("instantaneous_ops_per_sec")) {
        commandsPerSecond = Number.parseInt(line.split(":")[1]);
      }
    }
    return {
      upSince,
      memory,
      connectedClients,
      lastSaveToDisk,
      changesSinceLastSave,
      commandsPerSecond,
    };
  }

  ignoreNoAnswer(): boolean {
    return this.ignore;
  }

  async setIgnoreNoAnswer(value: boolean) {
    await this.client.set(NO_ANSWER_IGNORE, value ? "1" : "0");
    this.ignore = value;
  }

  async del(key: string) {
    await this.client.del(key);
  }

  async delKeys(pattern: string) {
    const keys = await this.client.keys(pattern);
    await this.client.del(...keys);
  }

  async getLastEventId(): Promise<number | undefined> {
    return this.get(LAST_EVENT_ID);
  }

  async setLastEventId(eventId: number) {
    await this.set(LAST_EVENT_ID, eventId);
  }

  async get(key: string): Promise<any> {
    const value = await this.client.get(this.prefix + key);
    if (value) {
      try {
        return JSON.parse(value);
      } catch (err) {
        return value;
      }
    } else {
      return undefined;
    }
  }

  async set(key: string, value: any): Promise<any> {
    return this.client.set(this.prefix + key, JSON.stringify(value));
  }
  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(this.prefix + pattern);
  }
}
