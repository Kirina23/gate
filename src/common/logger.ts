// import log4js from 'log4js';
import * as Mqtt from "mqtt";
import { RedisCache } from "./cache";
import { RadioDeviceSchedule, RadioDeviceScheduleType } from "./dto";
import { config } from "./config";
import { DEBUG } from "../index";
import {
  DEVICE_LOG_TOPIC_PREFIX,
  GATEWAY_LOG_TOPIC,
  getTopicPrefix,
} from "./mqtt";

export const notAllowTime = (
  schedule: RadioDeviceSchedule,
  command: "arm" | "disarm"
): boolean => {
  const date = new Date();
  const now =
    date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
  // console.log('Текущие секунды: ' + now + ' часы: ' + Math.ceil(now / 3600));
  if (schedule.type === RadioDeviceScheduleType.IGNORE) {
    return false;
  }
  if (command === "arm" && schedule.type === RadioDeviceScheduleType.NONSTOP) {
    return true;
  } else if (
    command === "disarm" &&
    schedule.type === RadioDeviceScheduleType.NONSTOP
  ) {
    return false;
  }
  // const now = 30000;
  if (
    schedule.endTimeSec !== undefined &&
    schedule.startTimeSec !== undefined &&
    schedule.endTimeSec !== null &&
    schedule.startTimeSec !== null
  ) {
    if (command === "arm") {
      if (schedule.endTimeSec > schedule.startTimeSec) {
        const result =
          now <= schedule.endTimeSec && now >= schedule.startTimeSec;
        console.log("Контроль 1 результат: " + result);
        return result;
      } else {
        const result =
          now <= schedule.endTimeSec || now >= schedule.startTimeSec;
        console.log("Контроль 2 результат: " + result);
        return result;
      }
    } else {
      if (schedule.endTimeSec > schedule.startTimeSec) {
        const result =
          now >= schedule.endTimeSec || now <= schedule.startTimeSec;
        console.log("Контроль 3 результат: " + result);
        return result;
      } else {
        const result =
          now >= schedule.endTimeSec && now <= schedule.startTimeSec;
        console.log("Контроль 4 результат: " + result);
        return result;
      }
    }
  } else {
    return true;
  }
};

export class Logger {
  mqttClient: Mqtt.MqttClient;
  redisClient: RedisCache;
  constructor(mqttClient: Mqtt.MqttClient) {
    this.redisClient = new RedisCache();
    this.mqttClient = mqttClient;
  }

  log = (msg: string, time?: number): void => {
    console.log(
      "\x1b[37m",
      this.getFormatedMessage(msg, "log", time),
      "\x1b[0m"
    );
  };

  error = (msg: string, time?: number): void => {
    console.error(
      "\x1b[31m",
      this.getFormatedMessage(msg, "error", time),
      "\x1b[0m"
    );
  };

  warn = (msg: string, time?: number): void => {
    console.warn(
      "\x1b[33m",
      this.getFormatedMessage(msg, "warn", time),
      "\x1b[0m"
    );
  };

  logDevice = async (msg: string, deviceId: string | number, time?: number) => {
    console.log(
      "\x1b[37m",
      await this.getFormatedMessageDevice(msg, deviceId, "log", time),
      "\x1b[0m"
    );
  };

  errorDevice = async (
    msg: string,
    deviceId: string | number,
    time?: number
  ) => {
    console.error(
      "\x1b[31m",
      await this.getFormatedMessageDevice(msg, deviceId, "error", time),
      "\x1b[0m"
    );
  };

  warnDevice = async (
    msg: string,
    deviceId: string | number,
    time?: number
  ) => {
    console.warn(
      "\x1b[33m",
      await this.getFormatedMessageDevice(msg, deviceId, "warn", time),
      "\x1b[0m"
    );
  };

  async getRegionFromDeviceId(
    deviceId: string | number
  ): Promise<string | undefined> {
    const config = await this.redisClient.getDeviceConfig(deviceId);
    if (!config) {
      const msg = "Нет настроек для устройства " + deviceId;
      this.error(msg);
      return;
    }
    if (!config.region) {
      const msg =
        "Не указан регион для устройства " +
        deviceId +
        " config: " +
        JSON.stringify(config);
      this.error(msg);
      return;
    }
    return config.region;
  }

  protected getFormatedMessage = (
    msg: string,
    level: string,
    time?: number
  ): string => {
    const date = time ? new Date(time) : new Date();
    if (DEBUG || level === "error" || level === "warn") {
      this.mqttClient.publish(
        GATEWAY_LOG_TOPIC,
        JSON.stringify({
          time: date.getTime(),
          msg,
          level,
          system: config.SYSTEM,
        }),
        { qos: 0 }
      );
    }
    return date.toLocaleString("ru-RU") + " message: " + msg;
  };

  protected getFormatedMessageDevice = async (
    msg: string,
    deviceId: string | number,
    level: "error" | "log" | "warn" | "critical",
    time?: number
  ): Promise<string> => {
    const date = time ? new Date(time) : new Date();
    if (DEBUG || level === "error" || level === "warn") {
      const region = await this.getRegionFromDeviceId(deviceId);
      const topic = region
        ? DEVICE_LOG_TOPIC_PREFIX(region) + deviceId
        : GATEWAY_LOG_TOPIC;
      // console.log('topic: ', topic);
      this.mqttClient.publish(
        topic,
        JSON.stringify({
          time: date.getTime(),
          msg: region ? msg : msg + " Устройство №" + deviceId,
          level,
        }),
        { qos: 0 }
      );
    }
    return (
      date.toLocaleString("ru-RU") +
      " device ID: " +
      deviceId +
      " message: " +
      msg
    );
  };
}
