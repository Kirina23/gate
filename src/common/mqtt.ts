import * as Mqtt from "mqtt";
import { Logger } from "./logger";
import {
  getBitFromZones,
  getCurrentTime,
  getErrorMsg,
  jsonToObject,
  parseTopic,
} from "./helper";
import { RedisCache } from "./cache";
import { config, ConfigParams, SUBSCRIBE_TO_ALL_REGIONS } from "./config";
import { EventEmitter } from "events";
import {
  DeviceAction,
  DeviceAlarm,
  DeviceStatus,
  DeviceState,
  DeviceLockMqtt,
} from "./server.interface";
import { DeviceConfigMqtt, Topic } from "./dto";
import {
  getJsonRpcErrorResponse,
  getJsonRpcSuccessResponse,
  validateRpcRequest,
  validateRpcRequestTimeout,
} from "./jsonRpc";

export const TOPIC_PREFIX =
  config.NAMESPACE + "/" + config.SYSTEM + "/" + config.REGION + "/";
export const TOPIC_PREFIX_ALL_REGIONS =
  config.NAMESPACE +
  "/" +
  config.SYSTEM +
  "/" +
  (SUBSCRIBE_TO_ALL_REGIONS ? "+" : config.REGION) +
  "/";
export const getTopicPrefix = (region: string) =>
  config.NAMESPACE + "/" + config.SYSTEM + "/" + region + "/";

export const CLIENT_ID =
  config.NAMESPACE +
  "_" +
  config.SYSTEM +
  "_" +
  config.REGION +
  "_" +
  config.GATEWAY_ID +
  "_v1.5";

export const SUBSCRIBE_TOPICS = [
  TOPIC_PREFIX_ALL_REGIONS + "NCMD/" + config.GATEWAY_ID,
  TOPIC_PREFIX_ALL_REGIONS + "DCMD/" + config.GATEWAY_ID + "/+",
  TOPIC_PREFIX_ALL_REGIONS + "STATE/" + config.GATEWAY_ID + "/+",
  TOPIC_PREFIX_ALL_REGIONS + "STATUS/" + config.GATEWAY_ID,
  TOPIC_PREFIX + "CONFIG/" + config.GATEWAY_ID,
  TOPIC_PREFIX_ALL_REGIONS + "CONFIG/" + config.GATEWAY_ID + "/+",
];

export const GATEWAY_STATUS_TOPIC =
  TOPIC_PREFIX + "STATUS/" + config.GATEWAY_ID;
export const GATEWAY_DEVICE_LIST_TOPIC =
  TOPIC_PREFIX + "DEVICES/" + config.GATEWAY_ID;
export const DEVICE_STATUS_TOPIC_PREFIX = (region: string) =>
  getTopicPrefix(region) + "STATUS/" + config.GATEWAY_ID + "/";
export const GATEWAY_STATE_TOPIC = TOPIC_PREFIX + "STATE/" + config.GATEWAY_ID;
export const DEVICE_STATE_TOPIC_PREFIX = (region: string) =>
  getTopicPrefix(region) + "STATE/" + config.GATEWAY_ID + "/";
export const GATEWAY_CONFIG_TOPIC =
  TOPIC_PREFIX + "CONFIG/" + config.GATEWAY_ID;
export const DEVICE_CONFIG_TOPIC_PREFIX = (region: string) =>
  getTopicPrefix(region) + "CONFIG/" + config.GATEWAY_ID + "/";
export const DEVICE_LOCK_TOPIC_PREFIX = (region: string) =>
  getTopicPrefix(region) + "LOCK/" + config.GATEWAY_ID + "/";
export const DEVICE_ALARM_TOPIC_PREFIX = (region: string) =>
  getTopicPrefix(region) + "ALARM/" + config.GATEWAY_ID + "/";
// export const GATEWAY_RESPONSE_TOPIC = TOPIC_PREFIX + 'NDATA/' + config.GATEWAY_ID;
// export const DEVICE_RESPONSE_TOPIC_PREFIX = TOPIC_PREFIX + 'DDATA/' + config.GATEWAY_ID + '/';
export const DEVICE_ACTION_TOPIC_PREFIX = (region: string) =>
  getTopicPrefix(region) + "ACTION/" + config.GATEWAY_ID + "/";
export const DEVICE_LOG_TOPIC_PREFIX = (region: string) =>
  getTopicPrefix(region) + "LOG/" + config.GATEWAY_ID + "/";
export const GATEWAY_LOG_TOPIC = TOPIC_PREFIX + "LOG/" + config.GATEWAY_ID;

export enum GATEWAY_COMMAND_ENUM {
  SET_CONFIG = "setConfig",
  SET_DEBUG = "setDebug",
  GET_LOGS = "getLogs",
  RESTART = "restart",
  ADD_DEVICE = "addDevice",
  DELETE_DEVICE = "delDevice",
  CLEAN_QUEUE = "cleanQueue",
  RESET_TEST = "resetTest",
  GET_NEXT_TESTS = "getNextTests",
  SET_IGNORE_NO_ANSWER = "setIgnoreNoAnswer",
  PING = "ping",
}

export class ITYMqttService extends EventEmitter {
  logger: Logger;
  mqttClient: Mqtt.Client;
  redisClient: RedisCache;
  connectionStatus: 1 | 0;
  constructor(mqttConfig?: Mqtt.IClientOptions, connectionStatus?: 1 | 0) {
    super();
    // console.log('!!!!!!!MQTT SERVICE CREATED!!!!!!');
    this.redisClient = new RedisCache();
    this.mqttClient = Mqtt.connect({
      ...mqttConfig,
      username: config.MQTT_USERNAME,
      password: config.MQTT_PASSWORD,
      clientId: CLIENT_ID,
      reconnectPeriod: 2000,
      resubscribe: false,
      queueQoSZero: true,
      keepalive: 20,
      clean: false,
      servers: config.MQTT_SERVERS,
      will: {
        topic: GATEWAY_STATUS_TOPIC,
        payload: JSON.stringify({
          time: 0,
          status: 0,
          connectStatus: 0,
        }),
        qos: 1,
        retain: true,
      },
    });
    this.connectionStatus = connectionStatus || 0;
    this.logger = new Logger(this.mqttClient);
    this.mqttClient.on("connect", () => {
      this.logger.warn("Подписался на темы: " + SUBSCRIBE_TOPICS.join(","));
      this.mqttClient.subscribe(SUBSCRIBE_TOPICS, (err) => {
        if (!err) {
          this.sendStatus(this.connectionStatus);
          this.logger.log(
            "Успешно подключился к MQTT брокеру (" +
              this.mqttClient.options.host +
              ")"
          );
        } else {
          this.logger.error(
            "Ошибка при подключении к MQTT брокеру (" +
              this.mqttClient.options.host +
              "). Ошибка: " +
              err
          );
        }
      });
    });
    this.addLogger();
    this.startListener();
  }

  isOnline() {
    return this.mqttClient.connected;
  }

  startListener() {
    this.mqttClient.on(
      "message",
      async (topic: string, bufferPayload: Buffer) => {
        const textMessage = bufferPayload.toString();
        const parsedTopic = parseTopic(topic, this.logger.error);
        if (textMessage.length === 0) {
          this.logger.warn("Получено пустое сообщение в тему: " + topic);
          this.emit(
            parsedTopic.system + "/" + parsedTopic.command + "-delete",
            { parsedTopic }
          );
          return;
        }
        // if (parsedTopic.command === 'DB') {
        this.logger.log(
          "Получено MQTT сообщение. Тема: " +
            topic +
            " Сообщение: " +
            textMessage
        );
        // }
        const payload = jsonToObject(textMessage, this.logger.error);
        switch (parsedTopic.command) {
          case "DCMD":
          case "NCMD":
            try {
              if (!validateRpcRequest(payload)) {
                throw new Error("Запрос не корректный");
              }
              if (!validateRpcRequestTimeout(payload)) {
                throw new Error("Запрос получен после таймаута");
              }
              this.emit(
                parsedTopic.system + "/" + parsedTopic.command,
                parsedTopic,
                payload
              );
            } catch (err) {
              const errMsg = getErrorMsg(err);
              if (parsedTopic.command === "DCMD" && parsedTopic.deviceId) {
                this.logger.errorDevice(
                  "Ошибка получения команд: " + errMsg,
                  parsedTopic.deviceId
                );
              } else {
                this.logger.error("Ошибка получения команд: " + errMsg);
              }
              this.sendErrorRpc(parsedTopic, payload.id, errMsg);
            }
            break;
          default:
            this.emit(
              parsedTopic.system + "/" + parsedTopic.command,
              parsedTopic,
              payload
            );
            break;
        }
      }
    );
  }

  addLogger() {
    this.mqttClient.on("close", () => {
      this.logger.warn(
        "Закрылось подключение к MQTT брокеру (" +
          this.mqttClient.options.host +
          ")"
      );
    });
    this.mqttClient.on("error", (err) => {
      this.logger.error(
        "Ошибка подключения к MQTT брокеру (" +
          this.mqttClient.options.host +
          "). Ошибка: " +
          err
      );
    });

    this.mqttClient.on("disconnect", (err: Error | undefined) => {
      this.logger.error(
        "Отключение от MQTT брокера (" +
          this.mqttClient.options.host +
          "). Ошибка: " +
          err
      );
    });

    this.mqttClient.on("offline", (err: Error | undefined) => {
      this.logger.warn(
        "Отключился от MQTT брокера (" +
          this.mqttClient.options.host +
          "). Ошибка: " +
          err
      );
    });

    this.mqttClient.on("reconnect", (err: Error | undefined) => {
      this.logger.log(
        "Повторное подключение к MQTT брокеру (" +
          this.mqttClient.options.host +
          "). Ошибка: " +
          err
      );
    });
  }

  async getRegionFromDeviceId(
    deviceId: string | number
  ): Promise<string | undefined> {
    const deviceConfig = await this.redisClient.getDeviceConfig(deviceId);
    if (!deviceConfig) {
      const msg = "Нет настроек для устройства " + deviceId;
      this.logger.error(msg);
      return;
    }
    if (!deviceConfig.region) {
      const msg =
        "Не указан регион для устройства " +
        deviceId +
        " config: " +
        JSON.stringify(deviceConfig);
      this.logger.error(msg);
      return;
    }
    return deviceConfig.region;
  }

  async sendDeviceLog(
    msg: string,
    deviceId: string | number,
    level: "error" | "log" | "warn" | "critical",
    date: Date
  ) {
    const region = await this.getRegionFromDeviceId(deviceId);
    if (region) {
      await this.mqttClient.publish(
        DEVICE_LOG_TOPIC_PREFIX(region) + deviceId,
        JSON.stringify({
          time: date.getTime(),
          msg,
          level,
        }),
        { qos: 0 }
      );
    } else {
      await this.mqttClient.publish(
        GATEWAY_LOG_TOPIC,
        JSON.stringify({
          time: date.getTime(),
          msg: msg + " Устройство №" + deviceId,
          level,
        }),
        { qos: 0 }
      );
    }
  }

  async publishToMqtt(
    topic: string,
    payload: any,
    retain = false,
    qos?: Mqtt.QoS
  ) {
    this.logger.log(
      "Отправлено сообщение в тему: " +
        topic +
        " payload: " +
        JSON.stringify(payload)
    );
    const selectedQoS = qos !== undefined ? qos : 1;
    const payloadToSend =
      typeof payload === "string" ? payload : JSON.stringify(payload);
    return new Promise((resolve) => {
      this.mqttClient.publish(
        topic,
        payloadToSend,
        {
          qos: selectedQoS as any,
          retain,
        },
        (err, packet) => {
          resolve(true);
        }
      );
    });
  }

  async sendStatus(connectionStatus: 1 | 0 | boolean) {
    this.connectionStatus = connectionStatus ? 1 : 0;
    this.logger.warn(
      "Статус подключения был изменен на: " + this.connectionStatus
    );
    await this.publishToMqtt(
      GATEWAY_STATUS_TOPIC,
      {
        time: getCurrentTime(),
        status: 1,
        connectionStatus: this.connectionStatus,
      },
      true
    );
  }

  async sendGatewayConfig(gatewayConfig: ConfigParams) {
    await this.publishToMqtt(
      GATEWAY_CONFIG_TOPIC,
      { ...gatewayConfig, time: Date.now(), MQTT_PASSWORD: undefined } as any,
      true
    );
  }

  async sendDeviceConfig(
    deviceId: string | number,
    deviceConfig: DeviceConfigMqtt
  ) {
    const region = await this.getRegionFromDeviceId(deviceId);
    if (region) {
      await this.publishToMqtt(
        DEVICE_CONFIG_TOPIC_PREFIX(region) + deviceId,
        deviceConfig,
        true
      );
    }
  }

  async sendDeviceLock(deviceId: string | number, lock: DeviceLockMqtt) {
    const region = await this.getRegionFromDeviceId(deviceId);
    if (region) {
      await this.publishToMqtt(
        DEVICE_LOCK_TOPIC_PREFIX(region) + deviceId,
        lock,
        true
      );
    }
  }

  async sendDeviceStatus(status: DeviceStatus) {
    const region = await this.getRegionFromDeviceId(status.deviceId);
    if (region) {
      await this.publishToMqtt(
        DEVICE_STATUS_TOPIC_PREFIX(region) + status.deviceId,
        {
          ...status,
          deviceId: undefined,
        },
        true
      );
    }
  }

  async sendDeviceState(state: DeviceState) {
    const region = await this.getRegionFromDeviceId(state.deviceId);
    if (region) {
      await this.publishToMqtt(
        DEVICE_STATE_TOPIC_PREFIX(region) + state.deviceId,
        {
          ...state,
          arm: state.zones.filter((item) => item === 1).length > 0 ? 1 : 0,
          activeBit: getBitFromZones(state.active),
          zonesBit: getBitFromZones(state.zones),
          mismatchedBit: getBitFromZones(state.mismatched),
          deviceId: undefined,
        },
        true
      );
    }
  }

  async sendAlarm(alarm: DeviceAlarm) {
    const region = await this.getRegionFromDeviceId(alarm.deviceId);
    if (region) {
      await this.publishToMqtt(
        DEVICE_ALARM_TOPIC_PREFIX(region) + alarm.deviceId,
        {
          ...alarm,
          activeBit: getBitFromZones(alarm.active),
          deviceId: undefined,
          server: 1,
        }
      );
    }
  }

  async sendAction(acton: DeviceAction) {
    const payload = {
      ...acton,
      zonesBit: getBitFromZones(acton.zones),
      deviceId: undefined,
    };
    this.logger.log("Отправили ACTION: " + JSON.stringify(payload));
    const region = await this.getRegionFromDeviceId(acton.deviceId);
    if (region) {
      await this.publishToMqtt(
        DEVICE_ACTION_TOPIC_PREFIX(region) + acton.deviceId,
        payload,
        false,
        1
      );
    }
  }

  async sendErrorRpc(parsedTopic: Topic, id: string | number, err: any) {
    const msg =
      "Ошибка при RPC запросе id: " +
      id +
      " Текст ошибки: " +
      JSON.stringify(err);
    if (parsedTopic.deviceId) {
      this.logger.errorDevice(msg, parsedTopic.deviceId);
    } else {
      this.logger.error(msg);
    }
    await this.publishToMqtt(
      this.getResponseTopic(parsedTopic),
      getJsonRpcErrorResponse(id, err),
      false,
      1
    );
  }

  async sendSuccessRpc(parsedTopic: Topic, id: string | number, result: any) {
    await this.publishToMqtt(
      this.getResponseTopic(parsedTopic),
      getJsonRpcSuccessResponse(id, result),
      false,
      1
    );
  }

  async cleanMqttBroker(deviceId: string | number) {
    const region = await this.getRegionFromDeviceId(deviceId);
    if (!region) {
      this.logger.error("Нет настроек региона для устройства №" + deviceId);
      return;
    }
    const promises = [
      this.publishToMqtt(
        DEVICE_STATE_TOPIC_PREFIX(region) + deviceId,
        "",
        true
      ),
      this.publishToMqtt(
        DEVICE_STATUS_TOPIC_PREFIX(region) + deviceId,
        "",
        true
      ),
      this.publishToMqtt(
        DEVICE_CONFIG_TOPIC_PREFIX(region) + deviceId,
        "",
        true
      ),
    ];
    await Promise.all(promises);
  }

  private getResponseTopic = (parsedTopic: Topic): string => {
    return parsedTopic.initial
      .replace("DCMD", "DDATA")
      .replace("NCMD", "NDATA");
  };
}
