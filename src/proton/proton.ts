import { EventEmitter } from "events";
import { Socket } from "net";
import { DEBUG } from "../index";
import {
  DeviceAction,
  DeviceAlarm,
  DeviceStatus,
  DeviceState,
  ServerInterface,
  AlarmTypeEnum,
} from "../common/server.interface";
import { config } from "../common/config";
import {
  bufferPrint,
  getArmFromZones,
  getCurrentTime,
  getErrorMsg,
} from "../common/helper";
import { Logger } from "../common/logger";
import {
  ALARM_EVENT_CODES,
  ARM_EVENT_CODES,
  BATTERY_ERROR_EVENT_CODES,
  DEVICE_ERROR_EVENT_CODES,
  DEVICE_WARN_EVENT_CODES,
  DISARM_EVENT_CODES,
  IGNORE_LOG_EVENT_CODES,
  OFFLINE_EVENT_CODES,
  ONLINE_EVENT_CODES,
  UNSUCCESS_ACTION_EVENT_CODES,
} from "./commandLists";
import {
  ProtonChannelType,
  ProtonCMD,
  ProtonEvent,
  ProtonPacketRequest,
  ProtonPacketResponse,
  ProtonRemoteCmd,
  validateCRC,
} from "./protonPacket";
import { ITYMqttService } from "../common/mqtt";

const RECEIVED_PACKET_ID_BUFFER = 1000;

export interface DeviceCommandResult {
  remoteCmd: ProtonRemoteCmd;
  success: boolean;
  event?: ProtonEvent;
  zones?: Array<1 | 0>;
  userId?: number;
  state?: DeviceState;
}

let receivedIds: string[] = [];

export const EVENT_EMIT_PREFIX = "event-";
export const ACTION_EMIT_PREFIX = "action-";
export const STATE_EMIT_PREFIX = "state-";
export const COMMAND_SENT_EMIT_PREFIX = "command-";

const packetOnFly: Map<
  string,
  { packet: ProtonPacketRequest; timer: NodeJS.Timeout; attempt: number }
> = new Map();
const commandSent: Map<
  number,
  {
    packet: ProtonPacketRequest;
    timer: NodeJS.Timeout;
    request: {
      deviceId: number;
      remoteCmd: ProtonRemoteCmd;
      zones?: Array<1 | 0>;
      userId?: number | "auto";
    };
  }
> = new Map();

let pingData:
  | {
      time: number;
      timer: NodeJS.Timeout;
      id: string;
    }
  | undefined;

let lastResponse = Date.now();

const PROTON_SERVER_OFFLINE_TIMEOUT_SEC = process.env
  .PROTON_SERVER_OFFLINE_TIMEOUT_SEC
  ? Number.parseInt(process.env.PROTON_SERVER_OFFLINE_TIMEOUT_SEC) * 1000
  : 300000;

const PING_PERIOD = 60000;
export class ProtonServer extends EventEmitter implements ServerInterface {
  private socket: Socket;
  private logger: Logger;
  public gatewayStatus = false;
  constructor(mqttService: ITYMqttService) {
    super();
    this.logger = mqttService.logger;
    this.socket = new Socket();
    this.connect();
    this.listen();
    this.setLogger();
    setInterval(() => {
      const pingPacket = new ProtonPacketRequest({
        cmd: ProtonCMD.PING,
      });
      this.logger.log("Отправил пинг запрос с ID: " + pingPacket.id);
      this.sendToSocket(pingPacket);
      const timer = setTimeout(() => {
        this.reconnect();
      }, 3000);
      pingData = {
        id: pingPacket.id,
        time: Date.now(),
        timer: timer,
      };
      if (Date.now() - lastResponse > PROTON_SERVER_OFFLINE_TIMEOUT_SEC) {
        this.setOffline();
      }
    }, PING_PERIOD);
  }

  private connect() {
    this.socket = this.socket.connect({
      port: config.CONNECTION_PORT,
      host: config.CONNECTION_HOST,
    });
  }

  private reconnect() {
    pingData = undefined;
    let timer: any = setTimeout(() => {
      this.logger.warn(
        "Переподключаемся к серверу " +
          config.CONNECTION_HOST +
          ":" +
          config.CONNECTION_PORT
      );
      clearTimeout(timer);
      timer = undefined;
      this.connect();
    }, config.RECONNECT_PERIOD);
  }

  private listen() {
    this.socket.on("data", async (buffer) => {
      let offset = 0;
      while (offset + 6 < buffer.length) {
        const packetSize = buffer.readUInt16BE(offset + 6);
        const singleBuffer = buffer.slice(offset, offset + packetSize);
        offset = offset + packetSize;
        try {
          const request = new ProtonPacketResponse(singleBuffer, this.logger);

          if (request.cmd === ProtonCMD.PING) {
            this.logger.log("Сервер отправил пинг id: " + request.id);
            const response = request.getResponse();
            this.socket.write(response);
          } else if (request.cmd === ProtonCMD.ACK) {
            // if (DEBUG) {
            this.logger.log(
              "Сервер подтвердил получение пакета с id: " + request.id
            );
            // }
            this.confirmReceivePacket(request.id);
          } else {
            const response = request.getResponse();
            //  console.log('отправили ответ: ', response);
            this.socket.write(response);
            if (receivedIds.includes(request.id)) {
              // this.logger.log(
              //   "Повтор получен пакета с id: " +
              //     request.id +
              //     " payload: " +
              //     JSON.stringify(request.toObject())
              // );
              return;
            }
            receivedIds = [
              request.id,
              ...receivedIds.slice(0, RECEIVED_PACKET_ID_BUFFER - 1),
            ];
            if (DEBUG && buffer[59] !== 0x02 && buffer[60] !== 0x69) {
              this.logger.log(
                "Получен пакет от сервера: " + bufferPrint(buffer)
              );
            }
            if (
              DEBUG &&
              (!request.event ||
                !IGNORE_LOG_EVENT_CODES.includes(request.event.eventCode))
            ) {
              this.logger.log(
                "Получен пакет: " + JSON.stringify(request.toObject(), null, 2)
              );
            }
            if (!request.crcValid) {
              this.logger.error(
                "Получен пакет с ошибкой CRC: " + bufferPrint(singleBuffer)
              );
            } else {
              setImmediate(() => {
                lastResponse = Date.now();
                this.setOnline();
              });
              if (request.event) {
                const event = request.event;
                const command = commandSent.get(event.objectNumber);
                //const isAction = request.hasState() && [...ARM_EVENT_CODES, ...DISARM_EVENT_CODES].includes(event.eventCode);
                this.emit(EVENT_EMIT_PREFIX + event.objectNumber, event);
                const time = event.time
                  ? event.time.getTime()
                  : getCurrentTime();
                if (event.eventName) {
                  if (!IGNORE_LOG_EVENT_CODES.includes(event.eventCode)) {
                    const msg =
                      "Событие " +
                      event.eventCode +
                      ': "' +
                      event.eventName +
                      (event.time
                        ? '" Время: ' + event.time.toISOString()
                        : "") +
                      (event.eventData && event.eventData.length > 0
                        ? " Данные события: " + bufferPrint(event.eventData)
                        : "");
                    if (DEVICE_ERROR_EVENT_CODES.includes(event.eventCode)) {
                      this.logger.errorDevice(msg, event.objectNumber);
                    } else if (
                      DEVICE_WARN_EVENT_CODES.includes(event.eventCode)
                    ) {
                      this.logger.warnDevice(msg, event.objectNumber);
                    } else {
                      this.logger.logDevice(msg, event.objectNumber);
                    }
                  }
                } else {
                  this.logger.errorDevice(
                    "Код события: " +
                      event.eventCode +
                      " отсутствует в справочнике. EventData: " +
                      bufferPrint(event.eventData),
                    event.objectNumber
                  );
                }
                if (request.hasState()) {
                  const zones = event.zones as Array<1 | 0>;
                  const state: DeviceState = {
                    time,
                    arm: getArmFromZones(zones),
                    deviceId: event.objectNumber,
                    active: event.active as Array<1 | 0>,
                    zones,
                    mismatched: new Array(event.active?.length || 8).fill(0), //TODO:
                  };
                  // this.emit(STATE_EMIT_PREFIX + event.objectNumber, state);
                  if (
                    command &&
                    command.request.remoteCmd === ProtonRemoteCmd.TEST
                  ) {
                    const response: DeviceCommandResult = {
                      remoteCmd: ProtonRemoteCmd.TEST,
                      success: true,
                      event,
                      state,
                    };
                    this.emit(
                      COMMAND_SENT_EMIT_PREFIX + event.objectNumber,
                      response
                    );
                  }
                  this.emit("deviceState", state);
                }
                if (request.isAction()) {
                  const hasCommand =
                    command &&
                    [ProtonRemoteCmd.ARM, ProtonRemoteCmd.DISARM].includes(
                      command.request.remoteCmd
                    );
                  const action: DeviceAction = {
                    action: ARM_EVENT_CODES.includes(event.eventCode)
                      ? "arm"
                      : "disarm",
                    deviceId: event.objectNumber,
                    time,
                    zones: event.zones ? event.zones : new Array(8).fill(0), // TODO: Compare with state
                    userId:
                      command &&
                      hasCommand &&
                      event.userId !== undefined &&
                      event.userId === 250
                        ? command.request.userId !== "auto"
                          ? command.request.userId
                          : undefined
                        : event.userId,
                    auto:
                      command && command.request.userId === "auto"
                        ? true
                        : false,
                  };
                  this.emit("action", action);
                  setTimeout(() => {
                    if (
                      command &&
                      [ProtonRemoteCmd.ARM, ProtonRemoteCmd.DISARM].includes(
                        command.request.remoteCmd
                      )
                    ) {
                      const response: DeviceCommandResult = {
                        remoteCmd: command.request.remoteCmd,
                        success: true,
                        event,
                        zones: event.zones ? event.zones : new Array(8).fill(0),
                      };
                      this.emit(
                        COMMAND_SENT_EMIT_PREFIX + event.objectNumber,
                        response
                      );
                    }
                  }, 50);
                }
                if (UNSUCCESS_ACTION_EVENT_CODES.includes(event.eventCode)) {
                  if (
                    command &&
                    [ProtonRemoteCmd.ARM, ProtonRemoteCmd.DISARM].includes(
                      command.request.remoteCmd
                    )
                  ) {
                    const response: DeviceCommandResult = {
                      remoteCmd: command.request.remoteCmd,
                      success: false,
                      event,
                      // zones: event.zones ? event.zones : [0, 0, 0, 0, 0, 0],
                    };
                    this.emit(
                      COMMAND_SENT_EMIT_PREFIX + event.objectNumber,
                      response
                    );
                  }
                }
                if (ALARM_EVENT_CODES.includes(event.eventCode)) {
                  this.emit("alarm", {
                    type: AlarmTypeEnum.ACTIVE, //TODO: Classification of alarms
                    active: event.active,
                    deviceId: event.objectNumber,
                    time,
                    message: event.eventName,
                    // user: undefined //TODO: Add user data when needed1
                  } as DeviceAlarm);
                }
                if (BATTERY_ERROR_EVENT_CODES.includes(event.eventCode)) {
                  this.emit("alarm", {
                    type: AlarmTypeEnum.BATTERY, //TODO: Classification of alarms
                    deviceId: event.objectNumber,
                    time,
                    message: event.eventName,
                  } as DeviceAlarm);
                }
                if (OFFLINE_EVENT_CODES.includes(event.eventCode)) {
                  const deviceStatus: DeviceStatus = {
                    deviceId: event.objectNumber,
                    status: 0,
                    time,
                  };
                  this.emit("deviceStatus", deviceStatus);
                }
                if (ONLINE_EVENT_CODES.includes(event.eventCode)) {
                  const deviceStatus: DeviceStatus = {
                    deviceId: event.objectNumber,
                    status: 1,
                    time,
                  };
                  this.emit("deviceStatus", deviceStatus);
                }
              }
            }
          }
        } catch (err) {
          this.logger.error(
            "Ошибка парсинга пакета от сервера. Ошибка: " + getErrorMsg(err)
          );
        }
      }
    });
  }

  private async sendToSocket(
    request: ProtonPacketRequest,
    attempt = 1
  ): Promise<boolean> {
    const timer = setTimeout(() => {
      if (attempt < config.REQUEST_ATTEMPTS) {
        this.logger.warn(
          "Попытка " +
            attempt +
            " отправить пакет: " +
            JSON.stringify(request.data)
        );
        this.sendToSocket(request, attempt + 1);
      } else {
        const msg =
          "Превышено количество повторов отправки пакета: " +
          JSON.stringify(request.data);
        if (request.objNumber !== undefined) {
          this.logger.errorDevice(msg, request.objNumber);
        } else {
          this.logger.error(msg);
        }
      }
    }, config.REQUEST_RETRY);
    packetOnFly.set(request.id, {
      attempt,
      packet: request,
      timer,
    });
    return new Promise((resolve, reject) => {
      this.socket.write(request.buffer, (err) => {
        if (err) {
          this.logger.error(
            "Ошибка при отправке пакета: " + bufferPrint(request.buffer)
          );
          reject();
        } else {
          if (DEBUG) {
            this.logger.log(
              "Успешно отправили пакет: " + bufferPrint(request.buffer)
            );
          }
          resolve(true);
        }
      });
    });
  }

  private setOffline() {
    if (this.gatewayStatus) {
      this.gatewayStatus = false;
      this.emit("gatewayStatus", this.gatewayStatus);
    }
  }

  private setOnline() {
    if (!this.gatewayStatus) {
      this.gatewayStatus = true;
      this.emit("gatewayStatus", this.gatewayStatus);
    }
  }

  private confirmReceivePacket(id: string) {
    if (pingData && pingData.id === id) {
      clearTimeout(pingData.timer);
      pingData = undefined;
    }
    const onFly = packetOnFly.get(id);
    if (onFly) {
      clearTimeout(onFly.timer);
      packetOnFly.delete(id);
    } else {
      this.logger.error("Получил подтверждение на неизвестный id: " + id);
    }
  }

  private setLogger() {
    this.socket.on("connect", () => {
      this.logger.warn(
        "Успешно подключился к серверу WebProton. Хост: " +
          config.CONNECTION_HOST +
          ":" +
          config.CONNECTION_PORT
      );
      this.setOnline();
    });
    this.socket.on("error", (err) => {
      this.logger.error(
        "Ошибка при подключении к серверу WebProton. Хост: " +
          config.CONNECTION_HOST +
          ":" +
          config.CONNECTION_PORT +
          " Ошибка: " +
          err
      );
    });
    this.socket.on("timeout", () => {
      this.logger.error(
        "Таймаут подключения к серверу WebProton. Хост: " +
          config.CONNECTION_HOST +
          ":" +
          config.CONNECTION_PORT
      );
    });
    this.socket.on("close", (hadError) => {
      this.logger.error(
        "Было закрыто подключение к серверу WebProton. Хост: " +
          config.CONNECTION_HOST +
          ":" +
          config.CONNECTION_PORT +
          " Причина ошибка: " +
          hadError
      );
      this.setOffline();
      this.reconnect();
    });
  }

  private cleanUpCommand(deviceId: number, timer: NodeJS.Timeout) {
    clearTimeout(timer);
    commandSent.delete(deviceId);
  }

  private setCommandTimeout(deviceId: number, listener: any, reject: Function) {
    const timer: NodeJS.Timeout = setTimeout(() => {
      this.removeListener(COMMAND_SENT_EMIT_PREFIX + deviceId, listener);
      this.cleanUpCommand(deviceId, timer);
      reject("Таймаут запроса " + config.REQUEST_TIMEOUT / 1000 + " сек");
    }, config.REQUEST_TIMEOUT);
    return timer;
  }

  async testDevice(deviceId: number): Promise<DeviceState | undefined> {
    if (config.SYSTEM !== "Proton") {
      throw new Error("config SYSTEM should be Proton");
    }
    const testRequest = new ProtonPacketRequest({
      cmd: ProtonCMD.CONTROL,
      channel: ProtonChannelType.GPRS,
      objNumber: deviceId,
      remoteCmd: ProtonRemoteCmd.TEST,
      systemNumber: config.SYSTEM_NUMBER,
    });
    const cmd = commandSent.get(deviceId);
    if (cmd) {
      this.logger.warnDevice(
        "Дождитесь выполнения предыдущей команды",
        deviceId
      );
      return;
    }
    return new Promise((resolve, reject) => {
      const listener = (result: DeviceCommandResult) => {
        // console.log('listener result', result);
        this.cleanUpCommand(deviceId, timer);
        if (
          result.success &&
          result.remoteCmd === ProtonRemoteCmd.TEST &&
          result.state
        ) {
          resolve(result.state);
        } else {
          reject("Неуспешный ответ: " + JSON.stringify(result));
        }
      };
      let timer = this.setCommandTimeout(deviceId, listener, reject);
      commandSent.set(deviceId, {
        packet: testRequest,
        request: {
          remoteCmd: ProtonRemoteCmd.TEST,
          deviceId,
        },
        timer,
      });
      this.once(COMMAND_SENT_EMIT_PREFIX + deviceId, listener);
      this.sendToSocket(testRequest);
      const msg =
        "Отправлен запрос теста для устройства " +
        testRequest.objNumber +
        " с id: " +
        testRequest.id;
      if (testRequest.objNumber) {
        this.logger.logDevice(msg, testRequest.objNumber);
      } else {
        this.logger.log(msg);
      }
    });
  }

  async armDevice(
    deviceId: number,
    cmd: "arm" | "disarm",
    zones: Array<1 | 0>,
    userId: number | "auto"
  ): Promise<{ arm: 1 | 0; zones: Array<1 | 0> }> {
    const remoteCmd =
      cmd === "arm" ? ProtonRemoteCmd.ARM : ProtonRemoteCmd.DISARM;
    if (config.SYSTEM !== "Proton") {
      throw new Error("config SYSTEM should be Proton");
    }
    const armRequest = new ProtonPacketRequest({
      cmd: ProtonCMD.CONTROL,
      channel: ProtonChannelType.GPRS,
      objNumber: deviceId,
      remoteCmd,
      systemNumber: config.SYSTEM_NUMBER,
      zones,
    });
    return new Promise((resolve, reject) => {
      const cmd = commandSent.get(deviceId);
      if (cmd) {
        reject("Дождитесь выполнения предыдущей команды");
      } else {
        const listener = (result: DeviceCommandResult) => {
          this.cleanUpCommand(deviceId, timer);
          if (result.remoteCmd === remoteCmd && result.success) {
            resolve({
              arm: result.remoteCmd === ProtonRemoteCmd.ARM ? 1 : 0,
              zones,
            });
          } else {
            reject("Неуспешный ответ: " + JSON.stringify(result));
          }
        };
        let timer = this.setCommandTimeout(deviceId, listener, reject);
        this.once(COMMAND_SENT_EMIT_PREFIX + deviceId, listener);
        commandSent.set(deviceId, {
          packet: armRequest,
          request: {
            remoteCmd,
            deviceId,
            zones,
            userId,
          },
          timer,
        });
        this.sendToSocket(armRequest);
        const msg =
          "Отправлен запрос на взятие/снятие для устройства " +
          armRequest.objNumber +
          " с id: " +
          armRequest.id;
        if (armRequest.objNumber) {
          this.logger.logDevice(msg, armRequest.objNumber);
        } else {
          this.logger.log(msg);
        }
      }
    });
  }
}
