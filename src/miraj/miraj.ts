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
import { Logger, notAllowTime } from "../common/logger";
import { ITYMqttService } from "../common/mqtt";
import { Client } from "pg";
import * as eventMap from "./events_system.json";
import * as win1251 from "windows-1251";
import { MirajDBStateEvent, MirajEventDb, MirajZoneState } from "./interface";
import {
  getLogin,
  getPing,
  MirajPacket,
  MirajRequestCMD,
  MirazhPacketRequest,
} from "./mirajPacket";
import { DeviceCommandResult } from "../proton/proton";
import { ProtonRemoteCmd } from "../proton/protonPacket";
import { bufferTime, fromEvent } from "rxjs";
import { RedisCache } from "../common/cache";

const EVENT_CHANNEL = "event_channel";
const LISTEN_QUERY = `listen ${EVENT_CHANNEL};`;
const UNLISTEN_QUERY = `unlisten ${EVENT_CHANNEL};`;
const ZONE_LENGTH = 8;
const PING_PERIOD = 50000;
const PING_DB_PERIOD = 10000;

export const EVENT_EMIT_PREFIX = "event-";
export const ACTION_EMIT_PREFIX = "action-";
export const STATE_EMIT_PREFIX = "state-";
export const STATE_EMIT = "db_state";
export const COMMAND_SENT_EMIT_PREFIX = "command-";
export const COMMAND_RECEIVED_EMIT_PREFIX = "cmd-";

const NO_CONNECTION_AFTER_INACTIVE_MIN = process.env
  .NO_CONNECTION_AFTER_INACTIVE_MIN
  ? parseInt(process.env.NO_CONNECTION_AFTER_INACTIVE_MIN)
  : 15;

const POSTGRES_CONFIG = {
  host: (config as any).POSTGRES_HOST,
  database: (config as any).POSTGRES_DB,
  user: (config as any).POSTGRES_USER,
  password: (config as any).POSTGRES_PASSWORD,
  port: (config as any).POSTGRES_PORT,
  // connectionTimeoutMillis: 60000,
};

// const packetOnFly: Map<string, { packet: MirazhPacketRequest, timer: NodeJS.Timeout, attempt: number }> = new Map();
const commandSent: Map<
  number,
  {
    packet: MirazhPacketRequest;
    timer: NodeJS.Timeout;
    request: {
      deviceId: number;
      zones?: Array<1 | 0>;
      userId?: number | "auto";
    };
  }
> = new Map();

export class MirajServer extends EventEmitter implements ServerInterface {
  private socket: Socket;
  private logger: Logger;
  private cache: RedisCache;
  private db: Client;
  public gatewayStatus = false;
  private socketStatus = false;
  private dbStatus = false;
  private objectZonesMap = new Map<number, number[]>();
  private objectIdMap = new Map<number, number>();
  private lastEventId = 0;
  private lastPingDate = Date.now() + PING_DB_PERIOD;
  private statusHistoryMap = new Map<
    number,
    DeviceState & { count: number; timer: NodeJS.Timeout }
  >();
  private msqCount = 0;
  private noEventsMinutes = 0;
  constructor(mqttService: ITYMqttService) {
    super();
    this.logger = mqttService.logger;
    this.socket = new Socket();
    this.cache = mqttService.redisClient;
    if (config.SYSTEM !== "Mirazh") {
      throw new Error("config SYSTEM should be Mirazh");
    }
    this.db = new Client(POSTGRES_CONFIG);

    this.initConnect();
    this.setLogger();
    setInterval(() => {
      this.logger.log("Отправил пинг запрос!");
      this.socket.write(getPing());
    }, PING_PERIOD);
    setInterval(() => {
      if (this.msqCount === 0 && NO_CONNECTION_AFTER_INACTIVE_MIN > 0) {
        this.noEventsMinutes++;
        if (this.noEventsMinutes >= NO_CONNECTION_AFTER_INACTIVE_MIN) {
          this.setOffline("db");
        }
      }
      if (this.msqCount > 0 && this.noEventsMinutes > 0) {
        this.noEventsMinutes = 0;
        this.setOnline("db");
      }
      const count = this.msqCount;
      this.msqCount = 0;
      this.logger.warn(
        "Кол-во полученных сообщений от STEMAX в минуту: " + count
      );
    }, 60000);
  }

  private async initConnect() {
    this.connectSocket();
    const lastEventId = await this.cache.getLastEventId();
    if (lastEventId) {
      this.lastEventId = lastEventId;
      console.log(
        "this.lastEventId",
        this.lastEventId,
        typeof this.lastEventId
      );
    }
    this.socket.on("data", (data) => {
      this.msqCount += 1;
      // console.log('Сообщение от сервера STEMAX');
      // const packet = new MirajPacket(data);
      // console.log(packet.toJSON());
    });
    setInterval(() => {
      if (Date.now() - this.lastPingDate > PING_DB_PERIOD + 1000) {
        this.logger.error(
          "Не получен последний пинг! Переподключаемся к БД Postgres!"
        );
        this.reconnectDb();
      }
      this.sendPingToDb();
    }, PING_DB_PERIOD);
    setInterval(() => {
      this.syncLastId();
    }, 5000);
    await this.listen();
    await this.connectDb();
    await this.syncMissedEvents(this.lastEventId);
    setInterval(() => {
      this.updateZoneMap();
    }, 60000);
  }

  private async initDb() {
    this.logger.log("Запуск запросов на создание триггера");
    await this.db.query(`drop trigger if exists event_trigger on "event";`);
    await this.db
      .query(`create or replace function event_trigger() returns trigger 
            as $event_trigger$
                begin 
                    PERFORM pg_notify('${EVENT_CHANNEL}' ,row_to_json(new)::text);
                    RETURN NULL;
                end;
            $event_trigger$ language plpgsql;`);
    await this.db.query(`create trigger event_trigger
            after insert on "event"
            for each row execute procedure event_trigger();`);
    this.logger.log("Завершены запросы на создание триггера");
  }

  private connectSocket() {
    this.socket = this.socket.connect(
      {
        port: config.CONNECTION_PORT,
        host: config.CONNECTION_HOST,
      },
      () => {
        this.socket.write(getLogin());
        this.logger.log("Отправлен запрос на авторизацию в STEMAX");
      }
    );
  }

  private reconnectSocket() {
    // pingData = undefined;
    let timer: any = setTimeout(() => {
      this.logger.warn(
        "Переподключаемся к серверу " +
          config.CONNECTION_HOST +
          ":" +
          config.CONNECTION_PORT
      );
      clearTimeout(timer);
      timer = undefined;
      this.connectSocket();
    }, config.RECONNECT_PERIOD);
  }

  private async reconnectDb() {
    let timer: any = setTimeout(async () => {
      if (config.SYSTEM !== "Mirazh") {
        throw new Error("config SYSTEM should be Mirazh");
      }
      // if(Date.now() - this.lastPingDate < PING_DB_PERIOD) {
      //     this.logger.log('Подключение к БД восстановлено! Отключаем таймер!');
      //     clearTimeout(interval);
      //     interval = undefined;
      //     return;
      // }
      clearTimeout(timer);
      timer = undefined;
      this.logger.warn(
        "Переподключаемся к серверу " +
          config.POSTGRES_HOST +
          ":" +
          config.POSTGRES_PORT
      );
      try {
        await this.db.end();
      } catch (err) {
        console.log("Ошибка переподключения", err);
      }
      this.connectDb();
    }, config.RECONNECT_PERIOD);
  }

  private async syncDeviceStatus(deviceId?: number) {
    const query = await this.db.query<{
      object_number: string;
      event_time: string;
      status: string;
    }>(`
        select distinct on (object_number) object_number, event_time, CASE when event_subtype = 21 then 1 else 0 end as status from "event" e 
where event_type = 2 and event_subtype in (20,21) ${
      deviceId ? "and object_number = " + deviceId : ""
    }
order by object_number, event_time desc`);
    // console.log('syncDeviceStatus', query);
    for (const state of query.rows) {
      const deviceId = state.object_number;
      const existed = await this.cache.hasDevice(deviceId);
      if (existed) {
        const time = new Date(state.event_time).getTime();
        const status = Number.parseInt(state.status);
        const cached = await this.cache.getDeviceStatus(deviceId);
        if (!cached || cached.time !== time || cached.status !== status) {
          const deviceStatus: DeviceStatus = {
            deviceId,
            status,
            time,
          };
          this.emit("deviceStatus", deviceStatus);
          this.logger.warnDevice(
            "Статус устройства в базе более новый. Статус: " + status,
            deviceId
          );
        }
      }
    }
  }

  private async connectDb() {
    try {
      // await this.db.end();
      this.db.removeAllListeners();
      this.logger.warn("Удалили всех слушателей");
      this.db = new Client(POSTGRES_CONFIG);
      await new Promise((resolve, reject) => {
        this.db.connect(async (err) => {
          if (err) {
            this.logger.error(
              "Ошибка подключения к Postgres. Текст ошибки:" + err
            );
            reject("Ошибка подключения к Postgres");
          } else {
            this.logger.warn("Подключено к Postgres!!!");
            this.listenDb();
            this.setOnline("db");
            await this.initDb();
            try {
              await this.db.query(UNLISTEN_QUERY);
            } catch (err) {
              this.logger.error(
                "Ошибка при отписки от lisnera" + JSON.stringify(err)
              );
            }
            await this.db.query(LISTEN_QUERY);
            this.sendPingToDb();
            //         const countQuery = await this.db.query(`select count(*) as cnt  FROM pg_stat_activity
            // where query = $1;`, [LISTEN_QUERY]);
            //         if (!countQuery || !countQuery.rows || countQuery.rowCount === 0 || countQuery.rows[0].cnt === "0") {
            //             this.logger.warn('Повторная подписка на события таблицы event');
            //             await this.db.query(LISTEN_QUERY);
            //         } else {
            //             this.logger.warn('Повторная пере-подписка на события таблицы event');

            //         }
            await this.updateZoneMap();
            this.syncDeviceStatus();
            resolve(true);
          }
        });
      });
    } catch (err) {
      console.error(err);
      this.logger.error(
        "Ошибка при подключении к PostgreSQL. Ошибка: " + JSON.stringify(err)
      );
    }
  }

  private async updateZoneMap(deviceId?: number) {
    try {
      const result = await this.db.query<{
        object_id: number;
        object_number: number;
        zoneNumber: number[];
      }>(
        `select o.object_id, o.object_number, array_agg(sensor_number - 1) as "zoneNumber" from "object" o
left join sensor s on s.object_id = o.object_id 
where sensor_number <= 8 ${deviceId ? "and o.object_number = $1" : ""}
group by o.object_id, o.object_number
order by object_number;`,
        deviceId ? [deviceId] : undefined
      );
      for (const item of result.rows) {
        if (item.zoneNumber.length > 0) {
          this.objectZonesMap.set(item.object_number, item.zoneNumber);
          this.objectIdMap.set(item.object_number, item.object_id);
        }
      }
      // console.log('zoneMapQuery', this.objectZonesMap);
    } catch (err) {
      this.logger.error("Не удалось обновить данные об шлейфах");
    }
  }

  private setLogger() {
    this.socket.on("connect", () => {
      this.logger.warn(
        "Успешно подключился к серверу STEMAX. Хост: " +
          config.CONNECTION_HOST +
          ":" +
          config.CONNECTION_PORT
      );
      this.setOnline("socket");
    });
    this.socket.on("error", (err) => {
      this.logger.error(
        "Ошибка при подключении к серверу STEMAX. Хост: " +
          config.CONNECTION_HOST +
          ":" +
          config.CONNECTION_PORT +
          " Ошибка: " +
          err
      );
      this.setOffline("socket");
    });
    this.socket.on("timeout", () => {
      this.logger.error(
        "Таймаут подключения к серверу STEMAX. Хост: " +
          config.CONNECTION_HOST +
          ":" +
          config.CONNECTION_PORT
      );
      this.setOffline("socket");
    });
    this.socket.on("close", (hadError) => {
      this.logger.error(
        "Было закрыто подключение к серверу STEMAX. Хост: " +
          config.CONNECTION_HOST +
          ":" +
          config.CONNECTION_PORT +
          " Причина ошибка: " +
          hadError
      );
      this.setOffline("socket");
      this.reconnectSocket();
    });
  }

  private listenDb() {
    this.logger.log("Запустили listenDb");
    this.db.removeAllListeners("notification");
    this.db.on("notification", async (notification) => {
      if (!notification.payload) {
        console.log("receive empty payload");
        return;
      }
      if (notification.payload === "PING") {
        this.lastPingDate = Date.now();
        return;
      }
      try {
        const payload: MirajEventDb = JSON.parse(notification.payload);
        await this.processEvent(payload);
      } catch (err) {
        this.logger.error(
          "Ошибка парсинга события из Postgres. Текст ошибки: " +
            getErrorMsg(err)
        );
      }
    });
    this.db.on("error", (err) => {
      this.logger.error(
        "Ошибка Postgres клиента. Ошибка: " + JSON.stringify(err)
      );
      this.setOffline("db");
    });
    this.db.on("end", () => {
      if (config.SYSTEM !== "Mirazh") {
        throw new Error("config SYSTEM should be Mirazh");
      }
      this.logger.error(
        "Было закрыто подключение к БД STEMAX. Хост: " +
          config.POSTGRES_HOST +
          ":" +
          config.POSTGRES_PORT
      );
      this.setOffline("db");
      // this.reconnectDb();
    });
  }

  private setOffline(type: "db" | "socket") {
    if (type === "db") {
      this.dbStatus = false;
    }
    if (type === "socket") {
      this.socketStatus = false;
    }
    if (this.gatewayStatus) {
      this.gatewayStatus = false;
      this.emit("gatewayStatus", this.gatewayStatus);
    }
  }

  private setOnline(type: "db" | "socket") {
    if (type === "db") {
      this.dbStatus = true;
    }
    if (type === "socket") {
      this.socketStatus = true;
    }
    if (!this.gatewayStatus && this.dbStatus && this.socketStatus) {
      this.gatewayStatus = true;
      this.emit("gatewayStatus", this.gatewayStatus);
    }
  }

  private async sendToSocket(
    packet: MirazhPacketRequest,
    attempt = 1
  ): Promise<boolean> {
    const timer = setTimeout(() => {
      if (attempt < config.REQUEST_ATTEMPTS) {
        this.logger.warn(
          "Попытка " + attempt + " отправить пакет: " + JSON.stringify(packet)
        );
        this.sendToSocket(packet, attempt + 1);
      } else {
        const msg =
          "Превышено количество повторов отправки пакета: " +
          JSON.stringify(packet);
        this.logger.errorDevice(msg, packet.deviceId);
      }
    }, config.REQUEST_RETRY);
    // packetOnFly.set(packet.id, {
    //     attempt,
    //     packet: request,
    //     timer,
    // });
    return new Promise((resolve, reject) => {
      this.socket.write(packet.buffer, (err) => {
        if (err) {
          this.logger.error(
            "Ошибка при отправке пакета: " + bufferPrint(packet.buffer)
          );
          reject();
        } else {
          if (DEBUG) {
            this.logger.log(
              "Успешно отправили пакет: " + bufferPrint(packet.buffer)
            );
          }
          clearTimeout(timer);
          resolve(true);
        }
      });
    });
  }

  private async syncMissedEvents(from: number, to?: number) {
    this.logger.warn(
      `Синхронизация пропущенных сообщений по id ${from ? "c " + from : ""} ${
        to ? "по " + to : ""
      }`
    );
    if (!from || from === 0) {
      this.logger.error(
        "Запрос на синхронизацию пропущенных сообщений проигнорирован так как id равен 0"
      );
      const lastIdQuery = await this.db.query(`SELECT event_id from event
            order by event_id desc 
            limit 1`);
      if (lastIdQuery.rows && lastIdQuery.rowCount > 0) {
        this.lastEventId = Number.parseInt(lastIdQuery.rows[0].event_id);
        // console.log('this.lastEventId',this.lastEventId, typeof this.lastEventId)
        await this.syncLastId();
      }
      return;
    }
    const LIMIT = 100;
    let count = LIMIT;
    let fromValue = from;
    while (count === LIMIT) {
      const missedEventsQuery = await this.db.query<MirajEventDb>(
        `SELECT * FROM event
            where event_id > $1 ${
              to ? "and event_id < $2" : ""
            } limit ${LIMIT}`,
        to ? [fromValue, to] : [fromValue]
      );
      for (const event of missedEventsQuery.rows) {
        await this.processEvent(event, true);
        fromValue = event.event_id;
      }
      // console.log('missedEventsQuery',missedEventsQuery);
      count = missedEventsQuery.rowCount;
      if (!missedEventsQuery.rowCount || missedEventsQuery.rowCount < LIMIT) {
        break;
      }
    }
  }

  private async syncLastId() {
    await this.cache.setLastEventId(this.lastEventId);
  }

  private hasTemp(deviceId: number) {
    return this.statusHistoryMap.get(deviceId);
  }

  private setTemp(deviceId: number, state: DeviceState & { count: number }) {
    const temp = this.statusHistoryMap.get(deviceId);
    this.statusHistoryMap.set(deviceId, {
      ...state,
      timer: temp
        ? temp.timer
        : setTimeout(() => {
            this.statusHistoryMap.delete(deviceId);
          }, 13000),
    });
  }

  private deleteTemp(deviceId: number) {
    const temp = this.statusHistoryMap.get(deviceId);
    if (temp) {
      clearTimeout(temp.timer);
      this.statusHistoryMap.delete(deviceId);
    }
  }

  private listen() {
    this.logger.log("Запустили listen");
    return new Promise((resolve) => {
      const logObservable = fromEvent<MirajDBStateEvent>(this, STATE_EMIT);
      logObservable.pipe(bufferTime(1000)).subscribe(async (states) => {
        const dataMap = new Map<number, DeviceState & { count: number }>();
        const alarmMap = new Map<number, { time: number; active: number[] }>();
        for (const state of states) {
          const map =
            dataMap.get(state.deviceId) || this.hasTemp(state.deviceId);
          if (state.alarm && state.arm) {
            const alarmZones: number[] = alarmMap.has(state.deviceId)
              ? alarmMap.get(state.deviceId)!.active
              : new Array(ZONE_LENGTH).fill(0);
            alarmZones[state.zoneNumber - 1] = 1;
            alarmMap.set(state.deviceId, {
              time: state.time,
              active: alarmZones,
            });
          }
          if (map) {
            map.zones[state.zoneNumber - 1] = state.arm ? 1 : 0;
            map.active[state.zoneNumber - 1] = state.active ? 1 : 0;
            map.mismatched[state.zoneNumber - 1] = 0;
            dataMap.set(state.deviceId, {
              ...map,
              count: map.count + 1,
            });
          } else {
            const zones = new Array(ZONE_LENGTH).fill(0);
            zones[state.zoneNumber - 1] = state.arm ? 1 : 0;
            const active = new Array(ZONE_LENGTH).fill(1);
            active[state.zoneNumber - 1] = state.active ? 1 : 0;
            const mismatched = new Array(ZONE_LENGTH).fill(1);
            mismatched[state.zoneNumber - 1] = 0;
            dataMap.set(state.deviceId, {
              active,
              arm: 0,
              deviceId: state.deviceId,
              mismatched,
              time: state.time,
              zones,
              count: 1,
            });
          }
        }
        for (const [deviceId, event] of dataMap.entries()) {
          let zoneNumber = this.objectZonesMap.get(deviceId);
          if (!zoneNumber) {
            this.logger.warn(
              "Нет данных о шлейфе для устройства №" +
                event.deviceId +
                " запускаем повторную синхронизацию."
            );
            await this.updateZoneMap(deviceId);
            zoneNumber = this.objectZonesMap.get(deviceId);
          }
          if (!zoneNumber) {
            this.logger.warnDevice(
              "Событие не отправлено так как в кэше нет сохраненных зон" +
                JSON.stringify(event),
              event.deviceId
            );
          } else {
            if (event.count < zoneNumber.length) {
              this.logger.errorDevice(
                "Событие не отправлено так как кол-во зон в STEMAX: " +
                  zoneNumber.length +
                  " в событии получено: " +
                  event.count +
                  ". Проверьте настройки зон в STEMAX.",
                event.deviceId
              );
              this.setTemp(deviceId, event);
            } else {
              const newEvent = {
                ...event,
                arm: event.zones.includes(1) ? 1 : 0,
                timer: undefined,
              };
              // const cmd = commandSent.get(deviceId);
              // if (cmd && [MirajRequestCMD.ARM, MirajRequestCMD.DISARM].includes(cmd.packet.cmd)) {
              //     const newZones = new Array(ZONE_LENGTH).fill(0);

              //     for (let index = 0; index < ZONE_LENGTH; index++) {
              //         if (event.zones[index] === (cmd.packet.cmd === 'arm' ? 1 : 0) && zoneNumber.includes(index)) {
              //             newZones[index] = 1;
              //         }
              //     }
              //     const action: DeviceAction = {
              //         action: cmd.packet.cmd === MirajRequestCMD.ARM ? 'arm' : 'disarm',
              //         deviceId,
              //         time: event.time,
              //         zones: newZones,
              //         userId: Number.isInteger(cmd?.request?.userId) ? cmd.request.userId as number : undefined,
              //         auto: cmd?.request?.userId === 'auto' ? true : false,
              //     };
              //     this.emit('action', action);
              // }

              setTimeout(() => {
                this.emit(COMMAND_SENT_EMIT_PREFIX + event.deviceId + "-test", {
                  success: true,
                  state: newEvent,
                });
                this.emit("deviceState", newEvent);
                // console.log('deviceState', newEvent);
              }, 100);
              this.deleteTemp(deviceId);
            }
          }
        }
        for (const [deviceId, alarm] of alarmMap.entries()) {
          setTimeout(() => {
            this.emit("alarm", {
              type: AlarmTypeEnum.ACTIVE,
              deviceId,
              message: "Нарушен шлейф",
              ...alarm,
              time: alarm.time,
            } as DeviceAlarm);
          }, 500);
        }
      });

      resolve(true);
    });
  }

  private async sendPingToDb() {
    try {
      await this.db.query(`NOTIFY ${EVENT_CHANNEL}, 'PING';`);
    } catch (err) {
      this.logger.error("Ошибка при отправке пинга в Postgres");
    }
  }

  private async processEvent(payload: MirajEventDb, noSync = false) {
    const idDiff = payload.event_id - this.lastEventId;
    if (!noSync && idDiff > 30) {
      this.syncMissedEvents(this.lastEventId, payload.event_id);
    }
    if (idDiff > 0) {
      this.lastEventId = payload.event_id;
    }
    if (
      payload.object_number > 0 &&
      !(await this.cache.hasDevice(payload.object_number))
    ) {
      this.logger.warn(
        "Нет настроек для устройства №" +
          payload.object_number +
          " события проигнорировано"
      );
      return;
    }
    const eventKey = payload.event_type + "/" + payload.event_subtype;
    const eventName = (eventMap as any)[eventKey];
    // console.log('notification', payload);
    const bytes = Buffer.isBuffer(payload.event_data)
      ? [...payload.event_data]
      : payload.event_data
          ?.substr(2)
          .match(/.{1,2}/g)
          ?.map((item: string) => Number.parseInt("0x" + item, 16));
    const eventData = bytes
      ? win1251.decode(Buffer.from(bytes).toString("binary"))
      : undefined;
    // console.log('win1251', eventData);
    console.log(
      "event_id:",
      payload.event_id,
      "Событие БД:",
      eventName,
      "Обьект №",
      payload.object_number,
      "Данные события:",
      eventData
    );
    const eventTime =
      new Date(payload.event_time).getTime() + (payload.event_id % 1000);
    const now = Date.now();
    const time =
      Math.floor(eventTime / 1000) > Math.floor(now / 1000) + 1
        ? now
        : eventTime;
    if (payload.object_number && payload.object_number > 0) {
      if (eventKey === "2/3") {
        this.emit(COMMAND_RECEIVED_EMIT_PREFIX + payload.object_number, true);
      }
      if (eventKey === "3/99") {
        this.emit(
          COMMAND_SENT_EMIT_PREFIX + payload.object_number + "-arm",
          false
        );
      }
      if (["3/14", "3/13", "3/25", "3/31"].includes(eventKey)) {
        const cmd = commandSent.get(payload.object_number);
        const isArm = ["3/13", "3/31"].includes(eventKey);
        const alarm = ["3/25", "3/31"].includes(eventKey);
        if (
          cmd &&
          ((cmd.packet.cmd === MirajRequestCMD.ARM && isArm) ||
            (cmd.packet.cmd === MirajRequestCMD.DISARM && !isArm))
        ) {
          this.emit(
            COMMAND_SENT_EMIT_PREFIX + payload.object_number + "-arm",
            true
          );
        }
        const hasCmd =
          cmd &&
          [MirajRequestCMD.ARM, MirajRequestCMD.DISARM].includes(
            cmd.packet.cmd
          );
        if (
          (!cmd &&
            payload.key_number >= 0 &&
            !eventData?.includes("Администратор")) ||
          hasCmd
        ) {
          const newZones = new Array(ZONE_LENGTH).fill(0);
          const zoneNumbers = this.objectZonesMap.get(payload.object_number);
          if (zoneNumbers) {
            for (const index of zoneNumbers) {
              newZones[index] = 1;
            }
            if (alarm) {
              setTimeout(() => {
                this.emit("alarm", {
                  type: AlarmTypeEnum.DISARM,
                  deviceId: payload.object_number,
                  message: isArm
                    ? "Взятие под принуждением"
                    : "Снятие под принуждением",
                  time: time,
                  active: newZones,
                } as DeviceAlarm);
              }, 3000);
            }
            if (!alarm || isArm) {
              const action: DeviceAction = {
                action: isArm ? "arm" : "disarm",
                deviceId: payload.object_number,
                time,
                zones: newZones,
                userId: hasCmd
                  ? Number.isInteger(cmd?.request?.userId)
                    ? (cmd?.request?.userId as number)
                    : undefined
                  : payload.key_number >= 0
                  ? payload.key_number
                  : undefined,
                auto:
                  cmd?.request?.userId === "auto" ||
                  cmd?.request?.userId === 250
                    ? true
                    : false,
              };
              // if(isArm) {
              //     setTimeout(() => {
              //         this.testDevice(payload.object_number, true);
              //     }, 30_000)
              // }
              if (cmd && cmd.timer) {
                this.cleanUpCommand(payload.object_number, cmd.timer);
              }
              this.emit("action", action);
            }
          }
        }
      }
      if (["3/10", "3/40"].includes(eventKey)) {
        const [state, batteryStatus] = await Promise.all([
          this.cache.getDeviceState(payload.object_number),
          this.cache.getDeviceBatteryStatus(payload.object_number),
        ]);
        if (
          state?.arm === 1 &&
          (typeof batteryStatus === "undefined" || batteryStatus === true)
        ) {
          this.emit("alarm", {
            type: AlarmTypeEnum.BATTERY,
            deviceId: payload.object_number,
            message: eventName,
            time,
            active: state.zones,
          } as DeviceAlarm);
        }
        this.cache.setDeviceBatteryStatus(payload.object_number, false);
        this.logger.errorDevice(
          "Ошибка батареи: " + eventName,
          payload.object_number
        );
      }
      if (["3/9", "3/39"].includes(eventKey)) {
        const batteryStatus = await this.cache.getDeviceBatteryStatus(
          payload.object_number
        );
        if (!batteryStatus) {
          this.logger.warnDevice(
            "Восстановление батареи: " + eventName,
            payload.object_number
          );
          this.cache.setDeviceBatteryStatus(payload.object_number, true);
        }
      }
      if (["3/11", "3/37"].includes(eventKey)) {
        const batteryStatus = await this.cache.getDevicePowerStatus(
          payload.object_number
        );
        if (!batteryStatus) {
          this.logger.warnDevice(
            "Восстановление основного питания: " + eventName,
            payload.object_number
          );
          this.cache.setDevicePowerStatus(payload.object_number, true);
        }
      }
      if (["3/12", "3/38"].includes(eventKey)) {
        const batteryStatus = await this.cache.getDevicePowerStatus(
          payload.object_number
        );
        if (batteryStatus || typeof batteryStatus === "undefined") {
          this.logger.errorDevice(
            "Отключение основного питания: " + eventName,
            payload.object_number
          );
          this.cache.setDevicePowerStatus(payload.object_number, false);
        }
      }
      if (
        payload.event_type === 3 &&
        payload.sensor_number > 0 &&
        bytes &&
        bytes.length > 0
      ) {
        const zoneInfo = MirajZoneState.find((item) => item.id === bytes[0]);
        if (zoneInfo) {
          this.emit(STATE_EMIT, {
            deviceId: payload.object_number,
            zoneNumber: payload.sensor_number,
            arm: zoneInfo.arm,
            active: zoneInfo.active,
            alarm: zoneInfo.alarm,
            time,
          } as MirajDBStateEvent);
        } else {
          this.logger.errorDevice(
            `Состояние зоны №${payload.sensor_number} с номером ${bytes[0]} не найдено в справочнике`,
            payload.object_number
          );
        }
      }
      if (
        [
          "2/9",
          "2/10",
          "2/13",
          "2/14",
          "2/7",
          "2/8",
          "3/17",
          "3/60",
          "3/61",
          "3/70",
          "3/71",
          "3/19",
          "2/34",
          "3/26",
          "3/34",
          "3/32",
          "3/70",
          "3/71",
          "3/72",
          "3/107",
          "3/95",
          "4/0",
          "4/1",
          "4/4",
          "4/5",
          "3/23",
        ].includes(eventKey)
      ) {
        this.logger.warnDevice(
          `Получено сообщение "${eventName}" для Зоны ${
            payload.sensor_number || "(не указано)"
          }`,
          payload.object_number
        );

        // Полное сообщение: ${JSON.stringify({
        //     ...payload,
        //     eventData,

        // })}`, payload.object_number);
      }
      if (
        [
          "3/6",
          // '3/10', исключены ошибка батареи
          "2/20",
          "2/21",
          "3/66",
          "3/99",
          "3/50",
          "3/73",
          "3/69",
          "3/59",
          "3/26",
          "5/1",
          "3/49",
          "3/65",
          "2/36",
          "2/25",
          "2/26",
          "2/31",
          "3/59",
          "3/60",
          "3/62",
          "3/99",
          "4/2",
          "4/6",
          "5/1",
          // '3/40', исключены ошибка батареи
          "1/1",
          "3/41",
          "3/43",
        ].includes(eventKey)
      ) {
        this.logger.errorDevice(
          `Получена ошибка "${eventName}" для Зоны ${
            payload.sensor_number || "(не указано)"
          }`,
          payload.object_number
        );

        // Полное сообщение: ${JSON.stringify({
        //     ...payload,
        //     eventData,

        // })}`, payload.object_number);
      }
      if (eventKey === "2/19" && eventData && eventData.includes("ОШИБКА")) {
        this.emit(
          COMMAND_SENT_EMIT_PREFIX + payload.object_number + "-arm",
          false
        );
        this.emit(COMMAND_SENT_EMIT_PREFIX + payload.object_number + "-test", {
          success: false,
        });
      }
      if (
        eventKey === "2/19" &&
        eventData &&
        eventData.includes("УСПЕШНО") &&
        (eventData.includes("Перевзять") ||
          eventData.includes("Снятие с охраны"))
      ) {
        const cmd = commandSent.get(payload.object_number);
        const isArm = eventData.includes("Перевзять");
        if (!cmd || cmd.packet.cmd === MirajRequestCMD.TEST) {
          const timer = setTimeout(() => {
            this.cleanUpCommand(payload.object_number, timer);
            this.logger.errorDevice(
              "Таймаут запроса " + config.REQUEST_TIMEOUT / 1000 + " сек",
              payload.object_number
            );
          }, config.REQUEST_TIMEOUT);
          this.logger.errorDevice(
            `Получено сообщение об успешном выполнении команды ${
              isArm ? "взятия" : "снятия"
            } устройства отправленное не из Сатурн.`,
            payload.object_number
          );
          commandSent.set(payload.object_number, {
            packet: new MirazhPacketRequest(
              await this.getObjectId(payload.object_number),
              isArm ? MirajRequestCMD.ARM : MirajRequestCMD.DISARM
            ),
            request: {
              deviceId: payload.object_number,
              userId: 250,
            },
            timer,
          });
        }
      }
      if (eventKey === "2/21") {
        const deviceStatus: DeviceStatus = {
          deviceId: payload.object_number,
          status: 1,
          time,
        };
        this.emit("deviceStatus", deviceStatus);
      }
      if (eventKey === "2/20") {
        const deviceStatus: DeviceStatus = {
          deviceId: payload.object_number,
          status: 0,
          time,
        };
        this.emit("deviceStatus", deviceStatus);
      }
      if (eventKey === "2/10") {
        const cmd = commandSent.get(payload.object_number);
        if (cmd) {
          this.socket.write(cmd.packet.buffer);
        }
      }
    }
  }

  private cleanUpCommand(deviceId: number, timer: NodeJS.Timeout) {
    clearTimeout(timer);
    commandSent.delete(deviceId);
  }

  private setCommandTimeout(
    deviceId: number,
    listener: any,
    reject: Function,
    packet: MirazhPacketRequest
  ) {
    const interval = setInterval(() => {
      this.logger.warnDevice(
        "Повторно отправил команду на сервер STEMAX",
        deviceId
      );
      this.sendToSocket(packet);
    }, 3000);
    const clearFunc = () => {
      clearInterval(interval);
    };
    this.once(COMMAND_RECEIVED_EMIT_PREFIX + deviceId, clearFunc);
    const timer: NodeJS.Timeout = setTimeout(() => {
      clearFunc();
      this.removeListener(COMMAND_RECEIVED_EMIT_PREFIX + deviceId, clearFunc);
      this.removeListener(
        COMMAND_SENT_EMIT_PREFIX + deviceId + "-test",
        listener
      );
      this.cleanUpCommand(deviceId, timer);
      reject("Таймаут запроса " + config.REQUEST_TIMEOUT / 1000 + " сек");
    }, config.REQUEST_TIMEOUT);

    return timer;
  }

  private async getObjectId(deviceId: number): Promise<number> {
    let objectId = this.objectIdMap.get(deviceId);
    if (!objectId) {
      await this.updateZoneMap(deviceId);
      objectId = this.objectIdMap.get(deviceId);
    }
    if (!objectId) {
      const msg = "Нет ObjectId для устройства №" + deviceId;
      this.logger.error(msg);
      throw new Error(msg);
    }
    return objectId;
  }

  async testDevice(
    deviceId: number,
    ignoreCmd = false
  ): Promise<DeviceState | undefined> {
    this.logger.log("Получил команду на тест устройства " + deviceId);
    if (!ignoreCmd) {
      const cmd = commandSent.get(deviceId);
      if (cmd) {
        this.logger.warnDevice(
          "Дождитесь выполнения предыдущей команды",
          deviceId
        );
        return;
      }
    }
    const objectId = await this.getObjectId(deviceId);
    // console.log('objectId', objectId);
    const testRequest = new MirazhPacketRequest(objectId, MirajRequestCMD.TEST);
    return new Promise((resolve, reject) => {
      const listener = (result: { success: boolean; state?: DeviceState }) => {
        // console.log('listener result', result);
        if (!ignoreCmd) {
          this.cleanUpCommand(deviceId, timer);
        } else {
          clearTimeout(timer);
        }
        if (result.success && result.state) {
          resolve(result.state);
        } else {
          reject("Нет связи с устройством");
        }
        // if (result.success && result.remoteCmd === ProtonRemoteCmd.TEST && result.state) {
        // } else {
        //     reject('Неуспешный ответ: ' + JSON.stringify(result));
        // }
      };
      let timer = this.setCommandTimeout(
        deviceId,
        listener,
        reject,
        testRequest
      );
      if (!ignoreCmd) {
        commandSent.set(deviceId, {
          packet: testRequest,
          request: {
            deviceId,
          },
          timer,
        });
      }
      this.once(COMMAND_SENT_EMIT_PREFIX + deviceId + "-test", listener);
      this.sendToSocket(testRequest);
      const msg = "Отправлен запрос теста для устройства";
      this.logger.logDevice(msg, deviceId);
    });
  }

  async armDevice(
    deviceId: number,
    cmd: "arm" | "disarm",
    zones: Array<1 | 0>,
    userId: number | "auto"
  ): Promise<{ arm: 1 | 0; zones: Array<1 | 0> }> {
    const hasCmd = commandSent.get(deviceId);
    if (hasCmd) {
      this.logger.warnDevice(
        "Дождитесь выполнения предыдущей команды",
        deviceId
      );
      throw new Error("Дождитесь выполнения предыдущей команды");
    }
    const armRequest = new MirazhPacketRequest(
      await this.getObjectId(deviceId),
      cmd === "arm" ? MirajRequestCMD.ARM : MirajRequestCMD.DISARM
    );
    const zoneIndex = this.objectZonesMap.get(deviceId);
    if (!zoneIndex) {
      throw new Error("Нет зон данных по зонам для устройства " + deviceId);
    }
    const zonesOverride = new Array(ZONE_LENGTH).fill(0);
    for (const index of zoneIndex) {
      zonesOverride[index] = 1;
    }
    if (cmd === "disarm" && (zones?.length || 0) > 0 && zones.includes(1)) {
      const config = await this.cache.getDeviceConfig(deviceId);
      if (config) {
        const date = new Date();
        const weekDay = date.getDay() === 0 ? 6 : date.getDay() - 1;
        const armZones: Array<0 | 1> = new Array(zones.length).fill(0);
        for (let x = 0; x < zones.length; x++) {
          if (config.armControlSetting[x].auto && zones[x] === 1) {
            const notAllow = notAllowTime(
              config.armControlSetting[x].schedule[weekDay],
              "disarm"
            );
            if (!notAllow) {
              armZones[x] = 1;
            }
          }
        }
        if (
          armZones.includes(1) &&
          armZones.filter((item) => item === 1).length ===
            zones.filter((item) => item === 1).length
        ) {
          this.emit("action", {
            action: "disarm",
            deviceId,
            time: date.getTime(),
            zones: armZones,
            userId,
            server: true,
          } as DeviceAction);
          return {
            arm: 0,
            zones: armZones,
          };
        }
      }
    }
    return new Promise((resolve, reject) => {
      const listener = (result: boolean) => {
        this.cleanUpCommand(deviceId, timer);
        if (!result) {
          reject("Нет связи с устройством");
        } else {
          // this.testDevice(deviceId, true).then((state) => {
          this.cleanUpCommand(deviceId, timer);
          // if (!state) {
          //     reject('Ошибка при обновлении статуса');
          // } else {
          // if (zoneIndex) {
          // const newZones = new Array(ZONE_LENGTH).fill(0);
          // for (const index of zoneIndex) {
          //     if (state.zones[index] === (cmd === 'arm' ? 1 : 0)) {
          //         newZones[index] = 1;
          //     }
          // }
          resolve({
            arm: cmd === "arm" ? 1 : 0,
            zones: zonesOverride,
          });
          // }
          // }
          // }).catch((err) => {
          //     this.cleanUpCommand(deviceId, timer);
          //     reject(err);
          // });
        }
      };
      let timer = this.setCommandTimeout(
        deviceId,
        listener,
        reject,
        armRequest
      );
      commandSent.set(deviceId, {
        packet: armRequest,
        request: {
          deviceId,
          zones: zonesOverride,
          userId,
        },
        timer,
      });
      this.once(COMMAND_SENT_EMIT_PREFIX + deviceId + "-arm", listener);
      this.sendToSocket(armRequest);
      const msg = "Отправлен запрос на взятие/снятие для устройства";
      this.logger.warnDevice(msg, deviceId);
    });
  }
}
