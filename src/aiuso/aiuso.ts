import { EventEmitter } from "events";
import { RemoteInfo, Socket } from "dgram";
import { DEBUG } from "../index";
import {
  DeviceAction,
  DeviceAlarm,
  DeviceStatus,
  DeviceState,
  ServerInterface,
  AlarmTypeEnum,
  GatewaySettings,
  DeviceAlarmMqtt,
  DeviceLockMqtt,
  DeviceDBMqtt,
} from "../common/server.interface";
import { config, SUBSCRIBE_TO_ALL_REGIONS } from "../common/config";
import {
  bufferPrint,
  extractAddress,
  extractSMSCategory,
  getArmFromZones,
  getCurrentTime,
  getErrorMsg,
  getStringWin1251,
  prepareString,
  printZones,
  textToWin1251,
} from "../common/helper";
import { Logger } from "../common/logger";
import {
  ITYMqttService,
  TOPIC_PREFIX,
  TOPIC_PREFIX_ALL_REGIONS,
} from "../common/mqtt";
import { attach, ConnectionPool, Database, Options, pool } from "node-firebird";
import { RedisCache } from "../common/cache";
import { createSocket } from "dgram";
import {
  UDPAiusoResponse,
  UDPRequestCommandType,
  UDPResponseAlarm,
  UDPResponseArm,
  UDPResponseDCMD,
  UDPResponseLock,
  UDPResponseTest,
} from "./udpResponse";
import { bufferTime, fromEvent, last } from "rxjs";
import { UDPAiusoRequest } from "./udpRequest";
import { Topic } from "../common/dto";
import { JSONRPCPacket } from "../common/jsonRpc";
import { AIUSOCache } from "./cache";
import { DBAlarmItem } from "./interface";
import * as moment from "moment";

export const UDP_EMIT = "udp_packets";
export const TEST_PREFIX = "test-";
export const DCMD_PREFIX = "dcmd-";

const DYNAMIC_FIREBIRD = process.env.DYNAMIC_FIREBIRD === "yes";

const getTimestampForDB = (time: number | string | Date): string => {
  // return new Date(time).toISOString().slice(0, 19).replace('T', ' ');
  return moment(time).format("YYYY-MM-DD HH:mm:ss");
};

const SUBSCRIBE_TOPICS = [
  TOPIC_PREFIX_ALL_REGIONS + "ALARM/" + config.GATEWAY_ID + "/+",
  TOPIC_PREFIX_ALL_REGIONS + "LOCK/" + config.GATEWAY_ID + "/+",
  config.NAMESPACE +
    "/Legacy/" +
    (SUBSCRIBE_TO_ALL_REGIONS ? "+" : config.REGION) +
    "/NCMD/" +
    config.GATEWAY_ID,
  // TOPIC_PREFIX_ALL_REGIONS + 'INT_CONFIG/' + config.GATEWAY_ID,
  TOPIC_PREFIX_ALL_REGIONS + "DB/" + config.GATEWAY_ID + "/+",
];

export const ZONE_LENGTH = 4;

const FIREBIRD_CONFIG: Options = {
  host: (config as any).POSTGRES_HOST,
  database: (config as any).POSTGRES_DB,
  user: (config as any).POSTGRES_USER,
  password: (config as any).POSTGRES_PASSWORD,
  port: (config as any).POSTGRES_PORT,
  retryConnectionInterval: 500,
  // connectionTimeoutMillis: 60000,
};

export class AIUSOServer extends EventEmitter implements ServerInterface {
  server: Socket;
  logger: Logger;
  // redis: RedisCache;
  mqttClient: ITYMqttService;
  db: ConnectionPool | undefined;
  public gatewayStatus = false;
  socketStatus = true;
  dbStatus = true;
  ignoreEventMap = new Map<
    string,
    { timeout: number; timer: NodeJS.Timeout; data?: any }
  >();
  cache: AIUSOCache;
  krt: number;
  dbLogPath: string;
  constructor(mqttService: ITYMqttService) {
    super();
    this.mqttClient = mqttService;
    this.logger = mqttService.logger;
    this.server = createSocket("udp4");
    // this.redis = mqttService.redisClient;
    if (config.SYSTEM !== "Tandem") {
      throw new Error("config SYSTEM should be Tandem");
    }
    this.dbLogPath = config.DB_LOG_PATH;
    this.krt = config.KRT;
    this.cache = new AIUSOCache(mqttService);
    if (!DYNAMIC_FIREBIRD) {
      this.db = pool(3, FIREBIRD_CONFIG);
    }
    this.listen();
    this.initConnect();
    this.mqttClient.publishToMqtt(
      `${config.NAMESPACE}/Legacy/${config.REGION}/STATUS/${config.GATEWAY_ID}`,
      {
        time: getCurrentTime(),
        status: 1,
      },
      true
    );
    // this.setLogger();
    setTimeout(() => {
      setInterval(() => {
        this.sendPing();
        // this.intervalAlarmProcess()
        this.processLogs();
      }, 60000);
      setInterval(() => {
        this.processAction();
      }, 25000);
      setTimeout(() => {
        this.intervalAlarmProcess();
      }, 1000);
    }, Math.round(Math.random() * 30000));

    this.sendPing();
    this.subscribeMqtt();
  }

  async processLogs() {
    const time = this.cache.getLastLogProcessTime();
    const logs: Array<{
      DATAL: string;
      ABN: number;
      TEXT: string;
      COM: number;
    }> = await this.makeQuery(
      `select * from LOG where DATAL > ? order by DATAL asc;`,
      [[moment(time).format("YYYY-MM-DD HH:mm:ss")]],
      {
        ...FIREBIRD_CONFIG,
        database: this.dbLogPath,
      }
    );
    // console.log('Получены события', JSON.stringify(logs, null, 2));
    if (logs.length > 0) {
      this.cache.setLastLogProcessTime(
        new Date(logs[logs.length - 1].DATAL).getTime()
      );
    }
    for (const log of logs) {
      if (log.ABN > 0) {
        this.logger.warnDevice(
          log.TEXT,
          log.ABN,
          new Date(log.DATAL).getTime()
        );
      } else {
        this.logger.warn(log.TEXT, new Date(log.DATAL).getTime());
      }
    }
  }

  sendPing() {
    const packet = new UDPAiusoRequest({
      cmd: "ping",
    });
    this.logger.log("Отправил пинг запрос управляющему серверу!");
    this.sendBuffer(packet.buffer);
  }

  async testDevice(deviceId: number): Promise<DeviceState | undefined> {
    return new Promise((resolve, reject) => {
      const packet = new UDPAiusoRequest({
        cmd: "test",
        deviceId,
      });
      const timer = setTimeout(() => {
        subscriber.removeAllListeners(TEST_PREFIX + packet.id);
        reject("Устройство не ответило за 60 секунд");
      }, 60000);
      const subscriber = this.once(
        TEST_PREFIX + packet.id,
        (testResponse: UDPResponseTest) => {
          clearTimeout(timer);
          if (
            testResponse.success &&
            testResponse.active &&
            testResponse.zones
          ) {
            this.setDeviceOnline(testResponse.deviceId);
            resolve({
              time: getCurrentTime(),
              active: testResponse.active,
              arm: testResponse.zones.includes(1) ? 1 : 0,
              deviceId: testResponse.deviceId,
              mismatched: new Array(ZONE_LENGTH).fill(0),
              zones: testResponse.zones,
            });
            return;
          }
          reject("Нет связи с устройством");
        }
      );
      this.sendBuffer(packet.buffer);
      const msg = "Отправлен запрос теста для устройства";
      this.logger.logDevice(msg, deviceId);
    });
  }

  async armDevice(
    deviceId: number,
    cmd: "arm" | "disarm",
    zones: (0 | 1)[],
    userId: number | "auto",
    dbMode?: boolean,
    userName?: string
  ): Promise<{ arm: 0 | 1; zones: (0 | 1)[] }> {
    if (config.SYSTEM !== "Tandem") {
      throw new Error();
    }
    let fios = "";
    let code = 0;
    if (userId === "auto") {
      fios = "Авто";
    } else if ([114, 115, 128, 250].includes(userId)) {
      code = userId;
      switch (userId) {
        case 114:
          // case 14:
          fios = "оператор ДЧ";
          break;
        case 115:
          // case 15:
          fios = "техник";
          break;
        case 128:
          // case 28:
          fios = "оператор ПЦМ";
          break;
        case 250:
          fios = "Администратор";
          break;
        default:
          break;
      }
    } else if (userId !== undefined && userId !== null) {
      const cacheDb = this.cache.getDBFromDeviceId(deviceId + "");
      if (cacheDb) {
        const nameResult = await this.makeQuery(
          `SELECT FIO, CODE from HOZ WHERE N = ? AND OBJN = ?`,
          [userId, cacheDb.liter]
        );
        if (nameResult.length > 0) {
          fios = nameResult[0].FIO;
          code = nameResult[0].CODE;
        }
      }
      if (fios.length === 0) {
        fios = userId + "";
        code = userId;
      }
    }

    await this.makeQuery(
      `UPDATE KRT${this.krt} 
            SET FIOS = ?, OPFIO = ?, OPN = ${config.RMO_ID}, CODE = ?
            WHERE KROS = ?`,
      [fios, userName || "Сатурн", code, deviceId - 1]
    );
    return new Promise(async (resolve, reject) => {
      const packet = new UDPAiusoRequest({
        cmd: dbMode ? "dcmdbd" : "dcmd",
        deviceId,
        zones,
        arm: cmd === "arm",
        userId: typeof userId === "number" ? userId : undefined,
      });
      const listener = (action: DeviceAction) => {
        clearTimeout(timer);
        if (action.zones && action.zones.length > 0) {
          resolve({
            arm: action.action === "arm" ? 1 : 0,
            zones: action.zones,
          });
          return;
        }
        reject("Нет связи с устройством");
      };
      this.once(DCMD_PREFIX + deviceId, listener);
      const timer = setTimeout(() => {
        this.removeListener(DCMD_PREFIX + deviceId, listener);
        reject("Устройство не ответило за 60 секунд");
      }, 60000);
      this.sendBuffer(packet.buffer);
      const msg = `Отправлен запрос на ${
        cmd === "arm" ? "взятие" : "снятие"
      } для зон ${printZones(zones)} пользователь ${userId}`;
      this.logger.logDevice(msg, deviceId);
    });
  }

  ignoreEvent(key: string, data?: any, timeout = 60000) {
    const existed = this.ignoreEventMap.get(key);
    if (existed) {
      clearTimeout(existed.timer);
      this.ignoreEventMap.delete(key);
    }
    const time = getCurrentTime() + timeout;
    const timer = setTimeout(() => {
      this.ignoreEventMap.delete(key);
    }, timeout);
    this.ignoreEventMap.set(key, {
      timeout: time,
      timer,
      data,
    });
  }

  async testDb(
    input: GatewaySettings
  ): Promise<{ success: boolean; error?: string }> {
    const result = await new Promise<{ success: boolean; error?: string }>(
      (resolve) => {
        try {
          setTimeout(() => {
            resolve({ success: false, error: "Timeout" });
          }, 2000);
          attach(
            {
              host: input.dbAddress,
              port: input.dbPort,
              database: input.dbPath,
              user: input.dbUsername,
              password: input.dbPassword,
            },
            (err, db) => {
              if (err) {
                resolve({ success: false, error: err.toString() });
              } else {
                db.detach(() => {
                  resolve({ success: true });
                });
              }
            }
          );
        } catch (err: any) {
          resolve({ success: false, error: err?.toString() });
        }
      }
    );
    if (
      result.error &&
      (result.error.includes("ECONNREFUSED") ||
        result.error.includes("Timeout"))
    ) {
      result.error = "Подключение к серверу БД не доступно";
    }
    if (result.error && result.error.includes("unavailable database")) {
      result.error = "Ошибка открытия файла базы данных";
    }
    if (result.error && result.error.includes("password")) {
      result.error = "Проверьте корректность ввода логина и пароля от СУБД";
    }
    if (result.error && result.error.includes("open file")) {
      result.error = "Ошибка при открытии файла БД: " + input.dbPath;
    }
    return result;
  }

  async syncDb(
    gateway: GatewaySettings,
    gatewayId: string,
    selectLiter?: number
  ): Promise<any[]> {
    if (
      !gateway.dbAddress ||
      !gateway.krt ||
      !gateway.dbPassword ||
      !gateway.dbUsername
    ) {
      throw new Error("Проверьте правильность настроек Шлюза СНОД!");
    }
    const krt = gateway.krt;
    const literPrefixEnd = gateway.literPrefixEnd
      ? gateway.literPrefixEnd
      : gateway.literPrefix * 1000 + 1999;
    const literPrefixStart = gateway.literPrefixStart
      ? gateway.literPrefixStart
      : gateway.literPrefix * 1000;
    // const literPrefix = gateway.literPrefix;
    const options: Options = {
      host: gateway.dbAddress,
      port: gateway.dbPort,
      database: gateway.dbPath,
      user: gateway.dbUsername,
      password: gateway.dbPassword,
    };
    const krtData: any = {};
    const userData: any = {};
    try {
      const zonesQueryResult = await this.makeQuery(
        `SELECT FIRST 10000 * FROM KRT${krt} krt 
            JOIN OBJ ON OBJ.OBJN = krt.OBJN 
            WHERE ${
              selectLiter
                ? `krt.OBJN = ${selectLiter}`
                : `krt.OBJN > ${literPrefixStart} and krt.OBJN < ${literPrefixEnd}`
            } 
            ORDER BY krt.OBJN ASC, ZON ASC`,
        [],
        { long: true, ...options }
      );
      const usersQueryResult = await this.makeQuery(
        `SELECT FIRST 10000 * FROM HOZ 
            WHERE ${
              selectLiter
                ? `OBJN = ${selectLiter}`
                : `OBJN > ${literPrefixStart} and OBJN < ${literPrefixEnd}`
            }
            ORDER BY OBJN ASC, N ASC`,
        [],
        { long: true, ...options }
      );
      const objectQueryResults = await this.makeQuery(
        `SELECT DISTINCT * FROM OBJ 
            WHERE ${
              selectLiter
                ? `OBJN = ${selectLiter}`
                : `OBJN > ${literPrefixStart} and OBJN < ${literPrefixEnd}`
            }`,
        [],
        { long: true, ...options }
      );
      const armConfigQueryResults = await this.makeQuery(
        `SELECT FIRST 10000
            avs.OBJN  AS OBJN,
            avs.ZON  AS ZON,
            avs.FLAG1 AS FLAG1,
            avs.OHBEG1 AS OHBEG1,
            avs.OHEND1 AS OHEND1,
            avs.FLAG2 AS FLAG2,
            avs.OHBEG2 AS OHBEG2,
            avs.OHEND2 AS OHEND2,
            avs.FLAG3 AS FLAG3,
            avs.OHBEG3 AS OHBEG3,
            avs.OHEND3 AS OHEND3,
            avs.FLAG4 AS FLAG4,
            avs.OHBEG4 AS OHBEG4,
            avs.OHEND4 AS OHEND4,
            avs.FLAG5 AS FLAG5,
            avs.OHBEG5 AS OHBEG5,
            avs.OHEND5 AS OHEND5,
            avs.FLAG6 AS FLAG6,
            avs.OHBEG6 AS OHBEG6,
            avs.OHEND6 AS OHEND6,
            avs.FLAG7 AS FLAG7,
            avs.OHBEG7 AS OHBEG7,
            avs.OHEND7 AS OHEND7,
            avs.R2  AS R2,
            krt.R AS R 
            FROM AVS avs LEFT JOIN KRT${krt} krt ON avs.OBJN = krt.OBJN AND AVS.ZON = KRT.ZON 
            WHERE ${
              selectLiter
                ? `avs.OBJN = ${selectLiter}`
                : `avs.OBJN > ${literPrefixStart} and avs.OBJN < ${literPrefixEnd}`
            }
            ORDER BY avs.OBJN ASC, avs.ZON ASC`,
        [],
        { long: true, ...options }
      );
      if (objectQueryResults.length === 0) {
        throw new Error(
          "Данные по объектам охраны для КРТ " +
            krt +
            " и литера начинающегося на " +
            literPrefixStart +
            " не найдено. Проверьте настройки."
        );
      }
      if (usersQueryResult.length === 0) {
        throw new Error(
          "Данные о пользователях для КРТ " +
            krt +
            " и литера начинающегося на " +
            literPrefixStart +
            " не найдено. Проверьте настройки."
        );
      }
      console.log("usersQuery len:", usersQueryResult.length);
      if (zonesQueryResult.length === 0) {
        throw new Error(
          "Данные о зонах охраны для КРТ " +
            krt +
            " и литера начинающегося на " +
            literPrefixStart +
            " не найдено. Проверьте настройки."
        );
      }
      let liter = zonesQueryResult[0].OBJN;
      let temp = [];
      // deviceIdToRegionMap.set((zonesQueryResult[0].KROS + 1) + '', process.env.REGION_OVERRIDE || zonesQueryResult[0].PREFIX + '')
      // console.log("objectQueryResults", JSON.stringify(objectQueryResults));
      for (const zon of zonesQueryResult) {
        if (liter !== zon.OBJN) {
          krtData[liter] = temp;
          temp = [];
          liter = zon.OBJN;
          // deviceIdToRegionMap.set((zon.KROS + 1) + '', process.env.REGION_OVERRIDE || zon.PREFIX + '')
        }
        temp.push(zon);
      }
      krtData[liter] = temp;

      liter =
        usersQueryResult && usersQueryResult.length > 0
          ? usersQueryResult[0].OBJN
          : 0;
      let usersEntity = [];
      for (const user of usersQueryResult) {
        if (user.OBJN !== liter) {
          userData[liter] = usersEntity;
          usersEntity = [];
          liter = user.OBJN;
        }
        const smsMask = user.FLAGP && (0x3ffffff8 << 27) | user.SMSMASK;
        const notifyEvents = [];
        // console.log('user', user)
        for (let action = 0; action < 3; action++) {
          const check = (user.FLAGP & (1 << action)) > 0;
          if (check) {
            switch (action) {
              case 0:
                notifyEvents.push("alarm");
                break;
              case 1:
                notifyEvents.push("arm");
                break;
              case 2:
                notifyEvents.push("disarm");
                break;
              default:
                break;
            }
          }
        }
        // console.log('notifyEvents',notifyEvents);
        const pager = getStringWin1251(user.PAGER);
        const phone = getStringWin1251(user.PHONE);
        usersEntity.push({
          id: user.OBJN * 100 + user.N,
          userId: user.N,
          notifyEvents,
          name: getStringWin1251(user.FIO) || "",
          position: getStringWin1251(user.DOL),
          address: getStringWin1251(user.ADR),
          phone: phone ? phone : pager ? pager : "",
          smsCategory: extractSMSCategory(user.R),
          sms:
            user.PAGER &&
            user.PAGER.length === 10 &&
            ((user.R >> 24) & 0x02) !== 0x02
              ? true
              : false,
          smsNumber: pager,
          mobileControl:
            user.PAGER &&
            user.PAGER.length === 10 &&
            ((user.R >> 22) & 0x04) === 0x04
              ? true
              : false,
          push:
            user.PAGER &&
            user.PAGER.length === 10 &&
            ((user.R >> 24) & 0x04) === 0x04
              ? true
              : false,
          pushToken: getStringWin1251(user.TOKEN),
          telegram: ((user.R >> 24) & 0x08) === 0x08 ? true : false,
          telegramId: getStringWin1251(user.IDTELEGRAM),
          enable: true,
        });
      }
      userData[liter] = usersEntity;
      liter =
        armConfigQueryResults && armConfigQueryResults.length > 0
          ? armConfigQueryResults[0].OBJN
          : 0;
      const armConfigMap = new Map<string, any>();
      let armTemp = new Array(ZONE_LENGTH).fill({
        auto: false,
        armControl: false,
        disarmControl: false,
        armAlarm: false,
        schedule: new Array(7).fill({
          type: 2,
          startTimeSec: undefined,
          endTimeSec: undefined,
        }),
      });
      let schedule = [];
      for (const config of armConfigQueryResults) {
        if (config.OBJN !== liter) {
          armConfigMap.set(liter, armTemp);
          // console.log(liter, armTemp);
          armTemp = new Array(ZONE_LENGTH).fill({
            auto: false,
            armControl: false,
            disarmControl: false,
            armAlarm: false,
            schedule: new Array(7).fill({
              type: 2,
              startTimeSec: undefined,
              endTimeSec: undefined,
            }),
          });
          liter = config.OBJN;
        }
        for (let x = 2; x < 9; x++) {
          const n = x === 8 ? 1 : x;
          const flag =
            config["FLAG" + n] > 15
              ? config["FLAG" + n] - 16
              : config["FLAG" + n];
          schedule.push({
            type: flag,
            startTimeSec:
              config["OHBEG" + n] === 0 ? undefined : config["OHBEG" + n],
            endTimeSec:
              config["OHEND" + n] === 0 ? undefined : config["OHEND" + n],
          });
        }
        if (config.ZON > 0 && config.ZON <= ZONE_LENGTH) {
          armTemp[config.ZON - 1] = {
            auto: config.FLAG1 < 16,
            armControl: config.FLAG2 < 16,
            disarmControl: config.R2 === 1,
            armAlarm: config.R ? config.R % 2 > 0 : false,
            schedule,
          };
        }
        schedule = [];
      }
      armConfigMap.set(liter, armTemp);
      const results = [];

      for (const dbObj of objectQueryResults) {
        const zonesName: string[] = [];
        const rmds: number[][] = [];
        const n: number[] = [];
        let interval = 120000;
        const zones = [];
        let time = new Date(0);
        let alarm: any = {
          time: new Date(0),
          type: -1,
          active: [],
          message: "Первоначальное заполнение данных. Тревога из FireBird.",
        };
        if (krtData[dbObj.OBJN]) {
          const deviceId = krtData[dbObj.OBJN][0].KROS + 1;
          const zonesMap = new Array(ZONE_LENGTH);
          for (const zon of krtData[dbObj.OBJN]) {
            const tempRmds = [];
            if (zon.DEG1 > 0) {
              for (let x = 1; x < ZONE_LENGTH; x++) {
                if (zon["DEG" + x] > 0) {
                  tempRmds.push(zon["DEG" + x]);
                }
              }
            } else if (zon.DJN > 0) {
              // for (let y = 0; y <= zon.DJN.toString(2).length; y++) {
              // 	if (zon.DJN % Math.pow(2, y) > 0) {
              // 		tempRmds.push(y - 1);
              // 	}
              // }
              const DJNstr = zon.DJN.toString(2);
              for (let y = 0; y <= DJNstr.length; y++) {
                if (DJNstr[DJNstr.length - y] === "1") {
                  tempRmds.push(y - 1);
                }
              }
            }
            zonesMap[zon.ZON - 1] = {
              n: zon.N,
              zonName: getStringWin1251(zon.OP),
              interval: zon.OPROS * 60 * 1000,
              st: zon.ST > 0 ? 1 : 0,
              trevDate: zon.TREVDATE,
              trevTip: zon.TREVTIP,
              date: new Date(new Date(zon.DATAS).getTime() + zon.TIMES * 1000),
              tempRmds,
              alarmActive: zon.ST > 1 ? 1 : 0,
            };
          }
          for (const zone of zonesMap) {
            if (zone) {
              zonesName.push(zone.zonName ? zone.zonName : "");
              n.push(zone.n);
              interval = zone.interval;
              zones.push(zone.st);
              alarm.active.push(zone.alarmActive);
              if (zone.alarmActive > 1) {
                if (alarm.time < zone.trevDate) {
                  alarm.time = zone.trevDate;
                  alarm.type = zone.trevTip;
                }
              }
              if (time < zone.date) {
                time = zone.date;
              }
              rmds.push(zone.tempRmds);
            } else {
              zonesName.push("Не используется");
              n.push(0);
              zones.push(0);
              alarm.active.push(0);
              rmds.push([]);
            }
          }
          const shortName = getStringWin1251(dbObj.SHORTNAME);

          const inputObject = {
            id: deviceId,
            gateway: {
              id: gatewayId,
            },
            relay: 0,
            secondRelay: 1,
            otherRelays: [2],
            liter: dbObj.OBJN,
            deviceId: deviceId + "",
            krt: dbObj.KRTNUM,
            zonesName,
            n,
            rmds,
            interval,
            allowedUsers: userData[dbObj.OBJN]
              ? userData[dbObj.OBJN].map((item: any) => item.userId)
              : [],
            objectType: dbObj.TIP && dbObj.TIP > 0 ? dbObj.TIP : 6,
            fullName: getStringWin1251(dbObj.NAME),
            address: getStringWin1251(dbObj.ADR),
            telephone: getStringWin1251(dbObj.PHONE),
            secret: getStringWin1251(dbObj.KS, true),
            comments: getStringWin1251(dbObj.PRIM, true),
            gbrSecret: getStringWin1251(dbObj.MAR, true),
            contractNumber: getStringWin1251(dbObj.DOGO, true),
            tip: getStringWin1251(dbObj.OS),
            bin: getStringWin1251(dbObj.BINCLIENT),
            lat: getStringWin1251(dbObj.LAT),
            lon: getStringWin1251(dbObj.LON),
            name:
              shortName && shortName.length > 0
                ? shortName
                : getStringWin1251(dbObj.NAME),
            locked: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            users: userData[dbObj.OBJN],
            armControlSetting: armConfigMap.has(dbObj.OBJN)
              ? armConfigMap.get(dbObj.OBJN)
              : new Array(ZONE_LENGTH).fill({
                  auto: false,
                  armControl: false,
                  disarmControl: false,
                  armAlarm: false,
                  schedule: new Array(7).fill({
                    type: 2,
                    startTimeSec: undefined,
                    endTimeSec: undefined,
                  }),
                }),
            latestState: [
              {
                id: 9999,
                since: time,
                count: 1,
                time,
                arm: zones.filter((item) => item === 1).length > 0 ? 1 : 0,
                zones,
                active: new Array(ZONE_LENGTH).fill(0),
              } as any,
            ],
            latestAlarm: alarm.type >= 0 ? [alarm] : [],
          };
          results.push(inputObject);
        } else {
          this.logger.error("Нет Зон с Литером " + dbObj.OBJN);
        }
      }
      // console.log(JSON.stringify(results, null, 2));
      return results;
    } catch (err) {
      this.logger.error("Запросы в базу не были обработаны. Ошибка: " + err);
      throw new Error("Запросы в базу не были обработаны. Ошибка: " + err);
    }
  }

  subscribeMqtt() {
    this.mqttClient.on(config.SYSTEM + "/ALARM", (topic, payload) =>
      this.processAlarmMessage(topic, payload)
    );
    this.mqttClient.on(config.SYSTEM + "/LOCK", (topic, payload) =>
      this.processLockMessage(topic, payload)
    );
    this.mqttClient.on("Legacy/NCMD", (topic, payload) =>
      this.processGatewayCommand(topic, payload)
    );
    this.mqttClient.on(config.SYSTEM + "/DB", (topic, payload) =>
      this.cache.processDBMessage(topic, payload)
    );
    // this.mqttClient.on(config.SYSTEM + '/INT_CONFIG', (topic, payload) => this.processLegacyConfig(topic, payload))
    this.mqttClient.on(config.SYSTEM + "/DB-delete", (topic) =>
      this.cache.processDBMessageDelete(topic)
    );
    this.mqttClient.mqttClient.on("connect", () => {
      this.logger.warn("Подписался на темы: " + SUBSCRIBE_TOPICS.join(","));
      this.mqttClient.mqttClient.subscribe(SUBSCRIBE_TOPICS);
    });
  }

  // async processLegacyConfig(
  //     parsedTopic: Topic,
  //     payload: DeviceAlarmMqtt
  // ) {
  //     console.log('INT_CONFIG', payload)
  //     setTimeout(() => {
  //         console.log(JSON.stringify(payload, null, 2));
  //     }, 10000)
  // }

  async processAlarmMessage(parsedTopic: Topic, payload: DeviceAlarmMqtt) {
    if (
      payload.type === AlarmTypeEnum.MANUAL &&
      payload.server !== 1 &&
      parsedTopic.deviceId
    ) {
      const deviceId = Number.parseInt(parsedTopic.deviceId);
      const packet = new UDPAiusoRequest({
        cmd: "manualAlarm",
        deviceId,
        zones: payload.active || [1],
        userId: payload.user,
      });
      this.sendBuffer(packet.buffer);
      this.logger.warnDevice(
        "Отправили операторскую тревогу управляющему серверу по зонам " +
          printZones(payload.active || [1]),
        deviceId
      );
      this.ignoreEvent("manualAlarm-" + deviceId);
    }
  }

  async processLockMessage(parsedTopic: Topic, payload: DeviceLockMqtt) {
    if (
      payload.server !== 1 &&
      parsedTopic.deviceId &&
      ((payload.active &&
        payload.timeout &&
        payload.timeout > getCurrentTime()) ||
        !payload.active)
    ) {
      const deviceId = Number.parseInt(parsedTopic.deviceId);
      const packet = new UDPAiusoRequest({
        cmd: "lock",
        deviceId,
        userId: payload.userId,
        active: payload.active,
      });
      this.sendBuffer(packet.buffer);
      this.logger.warnDevice(
        `Отправили ${
          payload.active ? "блокировку" : "разблокировку"
        } управляющему серверу`,
        deviceId
      );
      this.ignoreEvent("lock-" + deviceId);
      if (!payload.active) {
        this.mqttClient.publishToMqtt(parsedTopic.initial, "", true, 1);
      }
    }
  }

  async processGatewayCommand(parsedTopic: Topic, payload: JSONRPCPacket) {
    switch (payload.method) {
      case "checkOperator":
        if (payload.params && payload.params.operator) {
          const query = await this.makeQuery(
            "select * from OPERLIST where fio=?",
            [textToWin1251(payload.params.operator)]
          );
          this.mqttClient.sendSuccessRpc(
            parsedTopic,
            payload.id,
            query && query.length > 0 ? true : false
          );
        } else {
          this.mqttClient.sendSuccessRpc(parsedTopic, payload.id, false);
        }
        break;
      case "testDb":
        this.logger.warn(
          "Получен запрос на тест подключения к БД с параметрами: " +
            JSON.stringify(payload.params)
        );
        const result = await this.testDb(payload.params);
        this.mqttClient.sendSuccessRpc(parsedTopic, payload.id, result);
        break;
      case "syncDb":
        this.logger.warn(
          "Получен запрос на синхронизацию данных с БД с параметрами: " +
            JSON.stringify(payload.params)
        );
        const literStr = payload.params.liter
          ? "Литер: " + payload.params.liter
          : "";
        try {
          const result2 = await this.syncDb(
            payload.params,
            `${parsedTopic.namespace}-${config.SYSTEM}-${parsedTopic.region}-${parsedTopic.gatewayId}`,
            payload.params.liter
          );
          this.logger.warn("Синхронизация прошла успешна " + literStr);
          this.mqttClient.sendSuccessRpc(parsedTopic, payload.id, result2);
        } catch (err: any) {
          const errorMsg = getErrorMsg(err);
          this.logger.error(
            "Ошибка при синхронизации с БД. " +
              literStr +
              " Ошибка: " +
              errorMsg
          );
          this.mqttClient.sendErrorRpc(parsedTopic, payload.id, errorMsg);
        }
        break;
      default:
        this.logger.error(
          "Неизвестная команда: " +
            payload.method +
            " Тема: " +
            parsedTopic.initial +
            " Запрос: " +
            JSON.stringify(payload)
        );
        this.mqttClient.sendErrorRpc(
          parsedTopic,
          payload.id,
          "Неизвестная команда"
        );
        break;
    }
  }

  setOffline(type: "db" | "socket") {
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

  setOnline(type: "db" | "socket") {
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

  initConnect() {
    if (config.SYSTEM !== "Tandem") {
      throw new Error("config SYSTEM should be Tandem");
    }
    this.server.on("listening", () => {
      this.setOnline("socket");
      const { port } = this.server.address();
      this.logger.warn("UDP сервер запущен на порту " + port);
    });
    this.server.on("close", () => {
      this.logger.error("UDP сервер закрыт");
    });
    this.server.on("error", (err) => {
      this.setOffline("socket");
      this.logger.error("Ошибка UDP сервера: " + err);
    });
    this.server.on("message", (buffer, info) => this.udpListener(buffer, info));
    this.server.bind(config.UDP_PORT);
  }

  listen() {
    const logObservable = fromEvent<UDPAiusoResponse>(this, UDP_EMIT);
    logObservable
      .pipe(bufferTime(500, null, 100))
      .subscribe(async (packets) => {
        if (packets.length === 0) {
          return;
        }
        const map = new Map<UDPRequestCommandType, UDPAiusoResponse[]>();
        for (const packet of packets) {
          const type = packet.data.cmd;
          const arr = map.get(type) || [];
          map.set(type, [...arr, packet]);
        }
        for (const [type, data] of map.entries()) {
          switch (type) {
            case "dcmdbd":
            case "dcmd":
            case "action":
              await this.processActionEvents(
                data.map((item) => item.data as UDPResponseArm)
              );
              break;
            case "alarm":
              await this.processAlarmEvents(
                data.map((item) => (item.data as UDPResponseAlarm).n)
              );
              break;
            case "lock":
              await this.processActionEvents([]);
              // data.map(item => item.data.cmd)
              // this.emit('lock', )
              break;
            default:
              this.logger.error("Неизвестный тип пакета: " + type);
              break;
          }
        }
      });
  }

  // async processLockEvents(data: UDPResponseLock[]) {
  //     const liters = new Set();
  //     for(const item of data) {
  //         const dbData = this.cache.getDBFromDeviceIdOrNot(item.deviceId + '');
  //         if(dbData) {
  //             liters.add(dbData.liter);
  //         }
  //     }

  //     if(liters.size > 0) {
  //         const query: Array<{OBJN: number, R: number}> = await this.makeQuery(`SELECT DISTINCT OBJN, R FROM OBJ
  //         where KRTNUM = ${this.krt} and OBJN in (${new Array(liters.size).fill('?').join(',')})`, [...liters.values()]);
  //         for(const lockLine of query) {
  //             const db = this.cache.getDBFromLiter(lockLine.OBJN);
  //             const now = Date.now();
  //             this.mqttClient.sendDeviceLock(db.deviceId, {
  //                 active: lockLine.R > 0,
  //                 id: v4(),
  //                 liter: lockLine.OBJN,
  //                 time: now,
  //                 reason: 'Блокировка получена от сервера АИУСО',
  //                 server: 1,
  //                 timeout: now + 15000,
  //             })
  //         }
  //     }

  // }

  async processActionEvents(data: UDPResponseArm[]) {
    // const liters = new Set<string>()
    // for (const item of data) {
    //     const db = this.cache.getDBFromN(item.n);
    //     liters.add(db.liter)
    // }
    await this.processAction();
  }

  async setDeviceOnline(deviceId: number | string) {
    const status = await this.mqttClient.redisClient.getDeviceStatus(deviceId);
    if (!status || status.status === 0) {
      this.emit("deviceStatus", {
        deviceId,
        status: 1,
        time: getCurrentTime(),
      } as DeviceStatus);
    }
  }

  async setDeviceOffline(deviceId: number | string) {
    const status = await this.mqttClient.redisClient.getDeviceStatus(deviceId);
    if (!status || status.status === 1) {
      this.emit("deviceStatus", {
        deviceId,
        status: 0,
        time: getCurrentTime(),
      } as DeviceStatus);
    }
  }

  async processAction() {
    setTimeout(async () => {
      try {
        if (config.SYSTEM !== "Tandem") {
          throw new Error("Should be SYSTEM - Tandem");
        }
        const time = this.cache.getLastActionProcessTime();
        if (time === 0) {
          return;
        }
        const literAlarm = new Set<string>();
        const fromDate = moment(time).format("YYYY-MM-DD HH:mm:ss");
        const query: Array<{
          OBJN: number;
          N?: number;
          ZON: number;
          KRTNUM: number;
          KROS: number;
          DATS: string;
          TIMS: number;
          FIOS: string;
          OPFIO?: string;
          OPN?: number;
          REG: string;
          REZ?: string;
          FL?: number;
          userId?: number;
        }> = await this.makeQuery(
          `SELECT s.*, h.N as "userId" FROM STAT s 
        LEFT JOIN HOZ h ON h.OBJN = s.OBJN AND s.FIOS = h.FIO  
                    WHERE s.KRTNUM = ? AND s.DATS > ?
                    ORDER BY s.DATS ASC, s.OBJN ASC`,
          [config.KRT, fromDate]
        );
        // console.error('Проверка списка действий ответ: ' + JSON.stringify(query, null, 2))
        const msg =
          "Получен список действий кол-во: " +
          query.length +
          " от: " +
          fromDate;
        if (query.length > 0) {
          this.logger.warn(msg);
        } else {
          this.logger.log(msg);
        }
        if (query.length > 0) {
          const time = new Date(query[query.length - 1].DATS).getTime();
          this.cache.setLastActionProcessTime(time);
        }
        this.cache.resetActionOnWork();
        const map = new Map<string, DeviceAction>();
        const delayMap = new Map<string, number>();
        for (const item of query) {
          const key = `${item.KROS}-${item.REG}-${item.userId}-${item.OPFIO}-${item.FIOS}`;
          let action: "arm" | "disarm" | "alarm" | "disalarm" = "alarm";
          if (item.REG === "Взят") {
            action = "arm";
          } else if (item.REG === "Снят") {
            action = "disarm";
          } else if (item.REG.includes("Тревога")) {
            action = "alarm";
            literAlarm.add(item.KROS + 1 + "");
          } else if (
            item.REG === "Блокировка тревог" ||
            item.REG === "Разблок. тревог"
          ) {
            const active = item.REG === "Блокировка тревог";
            if (!active || item.OPN !== config.RMO_ID) {
              const time = new Date(item.DATS).getTime();
              this.mqttClient.sendDeviceLock(item.KROS + 1, {
                time,
                liter: item.OBJN,
                active,
                reason:
                  "Блокировка получена от сервера АИУСО пользователь: " +
                  item.OPFIO +
                  " РМД №" +
                  item.OPN,
                timeout: active ? time + 15 * 60000 : undefined,
                rmoId: item.OPN ? item.OPN : undefined,
                server: 1,
              });
              continue;
            } else {
              this.logger.warn(
                "Пропущено событие из STAT: " + JSON.stringify(item)
              );
            }
          } else {
            this.logger.warn(
              "Пропущено событие из STAT: " + JSON.stringify(item)
            );
            // this.mqttClient.sendDeviceLock();
            continue;
          }
          if (["arm", "disarm"].includes(action)) {
            this.setDeviceOnline(item.KROS + 1);
          }
          const payload: DeviceAction = map.get(key) || {
            action,
            deviceId: item.KROS + 1,
            time: new Date(item.DATS).getTime(),
            zones: new Array(ZONE_LENGTH).fill(0),
            userId: typeof item.userId === "number" ? item.userId : undefined,
            server:
              typeof item.OPFIO === "string" &&
              item.OPFIO.length > 0 &&
              ["Сервер", "РМО"].includes(item.OPFIO),
            auto: item.FIOS === "Авто",
            mobile: item.OPFIO === "Мобильное приложение",
          };
          if (item.ZON) {
            payload.zones[item.ZON - 1] = 1;
          }
          map.set(key, payload);
        }
        const deviceIds = [];
        let maxDelay = 0;
        for (const action of map.values()) {
          this.emit(DCMD_PREFIX + action.deviceId, action);
          if (literAlarm.has(action.deviceId + "")) {
            deviceIds.push(action.deviceId + "");
            literAlarm.delete(action.deviceId + "");
          }
          const delay = delayMap.get(action.deviceId + "") || 0;
          if (delay === 0) {
            this.emit("action", action);
          } else {
            setTimeout(() => this.emit("action", action), delay * 300);
          }
          const newDelay = delay + 1;
          delayMap.set(action.deviceId + "", newDelay);
          if (newDelay > maxDelay) {
            maxDelay = newDelay;
          }
          // console.log('action', JSON.stringify(action));
        }
        if (deviceIds.length > 0) {
          const query: Array<DBAlarmItem> = await this.makeQuery(
            `SELECT OBJN, KROS, N, ZON, DATAS, TREVDATE, TREVTIP, ST from KRT${
              this.krt
            }
                    WHERE TREVDATE >= ? and OBJN is not null and OBJN <> 0 and OBJN in (${deviceIds
                      .map(() => "?")
                      .join(", ")})
                    and TREVDATE is not null and TREVTIP is not null
                    ORDER BY OBJN, ZON;`,
            [moment(time).format("YYYY-MM-DD HH:mm:ss"), ...deviceIds]
          );
          if (query.length > 0) {
            setTimeout(async () => {
              this.processAlarmDb(query);
            }, maxDelay * 300 + 200);
          }
        }
      } catch (err) {
        this.logger.error(
          "Ошибка при синхронизации действий: " + getErrorMsg(err)
        );
      }
    }, 8000);
  }

  async processAlarmEvents(n: number[]) {
    const literSet = new Set<string>();
    for (const item of n) {
      try {
        const db = this.cache.getDeviceIdFromN(item);
        literSet.add(db.liter);
      } catch (err) {}
    }
    const liters = [...literSet];
    if (liters.length > 0) {
      const lastTime = this.cache.getLastAlarmProcessTime();
      const query: Array<DBAlarmItem> = await this.makeQuery(
        `SELECT OBJN, KROS, N, ZON, DATAS, TREVDATE, TREVTIP, ST from KRT${
          this.krt
        }
            WHERE OBJN in (${liters.map(() => "?").join(", ")})
            and TREVDATE is not null and TREVTIP is not null ${
              lastTime ? ` and TREVDATE > '${getTimestampForDB(lastTime)}'` : ""
            }
            ORDER BY OBJN, ZON;`,
        liters
      );
      this.processAlarmDb(query);
    }
  }

  async intervalAlarmProcess() {
    const lastTime = this.cache.getLastAlarmProcessTime();
    if (lastTime) {
      const query: Array<DBAlarmItem> = await this.makeQuery(
        `SELECT OBJN, KROS, N, ZON, DATAS, TREVDATE, TREVTIP, ST from KRT${this.krt}
            WHERE TREVDATE > ? and OBJN is not null and OBJN <> 0 
            and TREVDATE is not null and TREVTIP is not null
            ORDER BY OBJN, ZON;`,
        [getTimestampForDB(lastTime)]
      );
      this.processAlarmDb(query);
    }
  }

  async processAlarmDb(query: Array<DBAlarmItem>) {
    if (query.length === 0) {
      return;
    }
    const map = new Map<string, DeviceAlarm>();
    let lastTime = 0;
    for (const line of query) {
      const time = new Date(line.TREVDATE).getTime();
      if (time < lastTime) {
        lastTime = time;
      }
      const key = line.OBJN + "/" + line.TREVTIP + "/" + time;
      const cached: DeviceAlarm = map.get(key) || {
        time,
        deviceId: line.KROS + 1,
        type: line.TREVTIP,
        active: new Array(ZONE_LENGTH).fill(0),
      };
      if (cached.active) {
        cached.active[line.ZON - 1] = 1;
      }
      map.set(key, cached);
    }
    if (lastTime) {
      this.cache.setLastAlarmProcessTime(lastTime);
    }
    for (const [key, alarm] of map.entries()) {
      if (!this.cache.hasProcessedAlarmKey(key)) {
        this.cache.addProcessedAlarmKey(key);
        if (alarm.type === AlarmTypeEnum.NO_ANSWER) {
          this.setDeviceOffline(alarm.deviceId);
        }
        this.emit("alarm", alarm);
      }
    }
  }

  async udpListener(msg: Buffer, info: RemoteInfo) {
    if (config.SYSTEM !== "Tandem") {
      throw new Error("config SYSTEM should be Tandem");
    }
    if (msg.length !== 20) {
      this.logger.error(
        "Длина UDP пакета не ровно 20 байт, фактический размер: " +
          msg.length +
          " от адреса: " +
          extractAddress(info)
      );
      return;
    }
    try {
      this.logger.log(
        "Получено сообщение от " +
          extractAddress(info) +
          " Данные: " +
          bufferPrint(msg)
      );
      const packet = new UDPAiusoResponse(msg, info);
      this.logger.warn("Получен пакет: " + JSON.stringify(packet));
      if (packet.krt === config.KRT && packet.rmoId === config.RMO_ID) {
        if (
          packet.address !== config.CONNECTION_HOST ||
          packet.port !== config.CONNECTION_PORT
        ) {
          this.logger.error(
            `Получено сообщение от другого хоста. Адрес полученный: ${extractAddress(
              packet
            )} В настройках: ${extractAddress({
              address: config.CONNECTION_HOST,
              port: config.CONNECTION_PORT,
            })}`
          );
        }
        switch (packet.data.cmd) {
          case "test":
            this.emit(TEST_PREFIX + packet.id, packet.data);
            if (
              packet.data.success &&
              packet.data.active &&
              packet.data.zones &&
              packet.data.active.length > 0 &&
              packet.data.zones.length > 0
            ) {
              this.emit("deviceState", {
                time: packet.time,
                arm: getArmFromZones(packet.data.zones),
                deviceId: packet.data.deviceId,
                active: packet.data.active,
                zones: packet.data.zones,
                mismatched: new Array(ZONE_LENGTH).fill(0),
              } as DeviceState);
            }
            break;
          case "dcmdbd":
          case "dcmd":
            this.emit(UDP_EMIT, packet);
            break;
          case "manualAlarm":
            this.logger.warnDevice(
              `Управляющий сервер подтвердил получение операторской тревоги`,
              packet.data.deviceId
            );
            break;
          default:
            this.emit(UDP_EMIT, packet);
            break;
        }
      }
    } catch (err) {
      this.logger.error(
        "Ошибка обработки пакета UDP: " +
          err +
          " пакет: " +
          bufferPrint(msg) +
          " от адреса: " +
          extractAddress(info)
      );
    }
  }

  async sendBuffer(buffer: Buffer) {
    return new Promise((resolve, reject) => {
      this.server.send(
        buffer,
        config.CONNECTION_PORT,
        config.CONNECTION_HOST,
        (err, bytes) => {
          if (err) {
            this.logger.error("Ошибка при отправке UDP пакета. Ошибка: " + err);
            reject(err);
          } else {
            this.logger.log(
              "Отправили серверу " +
                extractAddress({
                  address: config.CONNECTION_HOST,
                  port: config.CONNECTION_PORT,
                }) +
                " данные: " +
                bufferPrint(buffer)
            );
            resolve(bytes);
          }
        }
      );
    });
  }

  async makeQuery<T extends Record<string, any>>(
    query: string,
    params: any[] = [],
    options?: Options & {
      stat?: boolean;
      long?: boolean;
    }
  ): Promise<T[]> {
    const result = await new Promise<T[]>((resolve, reject) => {
      const processQuery = (err: any, db: Database) => {
        const startTime = Date.now();
        const success = (result: any[], first: boolean) => {
          const executionTime = Date.now() - startTime;
          if (first && executionTime > 2000) {
            this.logger.warn(
              `Запрос в Firebird долго выполнялся. Время выполнения: ${executionTime}ms. База: ${
                FIREBIRD_CONFIG.host
              } Запрос: ${query} Параметры: ${params.join(" , ")}`
            );
          }
          clearTimeout(timer);
          db?.detach();
          this.setOnline("db");
          resolve(result);
        };
        const notSuccess = (err: string) => {
          clearTimeout(timer);
          this.logger.error(
            err +
              " База: " +
              FIREBIRD_CONFIG.host +
              " Запрос: " +
              query +
              " Параметры: " +
              params.join(" , ")
          );
          db?.detach();
          this.setOffline("db");
          resolve([]);
        };
        const timer = setTimeout(
          () => {
            notSuccess(
              "Таймаут подключения к БД. Проверьте настройки БД и запущен ли сервер СУБД Firebird на хосте"
            );
          },
          options?.long ? 30000 : 10000
        );
        if (err) {
          notSuccess("Ошибка подключения к БД: " + err);
        } else {
          db.query(query, params, (err2, result) => {
            if (err2) {
              this.logger.error(
                "Попытка 1. Ошибка выполнения запроса в БД. Ошибка:" + err2
              );
              setTimeout(() => {
                db.query(query, params, (err3, result2) => {
                  if (err3) {
                    notSuccess("Попытка 2. Ошибка выполнения запроса в БД.");
                  } else {
                    success(result2, false);
                  }
                });
              }, 500);
            } else {
              success(result, true);
            }
          });
        }
      };
      if (options?.host) {
        attach({ ...FIREBIRD_CONFIG, ...options }, processQuery);
      } else if (this.db) {
        this.db.get(processQuery);
      } else {
        attach(FIREBIRD_CONFIG, processQuery);
      }
    });
    return prepareString(result);
  }
}
