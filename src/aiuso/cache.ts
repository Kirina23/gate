import { RedisCache } from "../common/cache";
import { Topic } from "../common/dto";
import { Logger } from "../common/logger";
import { ITYMqttService } from "../common/mqtt";
import { DeviceDBMqtt } from "../common/server.interface";

const DEVICE_ID_DB_MAP = "DEVICE_ID_DB_MAP";
const LITER_DB_MAP = "LITER_DB_MAP";
const N_DEVICE_ID_MAP = "N_DEVICE_ID_MAP";
const LAST_ALARM_PROCESS_TIME = "LAST_ALARM_PROCESS_TIME";
const LAST_ACTION_PROCESS_TIME = "LAST_ACTION_PROCESS_TIME";
const LAST_LOG_PROCESS_TIME = "LAST_LOG_PROCESS_TIME";

export class AIUSOCache {
  private logger: Logger;
  private cache: RedisCache;
  private deviceIdDBMap = new Map<string, DeviceDBMqtt>();
  private literDBMap = new Map<string, DeviceDBMqtt & { deviceId: string }>();
  private nDeviceIdMap = new Map<string, { deviceId: string; liter: string }>();
  private lockMap = new Map<
    number,
    { active: boolean; timeout: Date; timer: NodeJS.Timeout }
  >();
  processedAlarms = new Set<string>();
  lastAlarmProcessTime?: number;
  lastActionProcessTime?: number;
  lastLogProcessTime?: number;
  actionOnWork: undefined | NodeJS.Timeout;

  constructor(ityService: ITYMqttService) {
    this.cache = ityService.redisClient;
    this.logger = ityService.logger;
    this.syncCacheDb();
  }

  needToSendLock(deviceId: number, active: boolean): boolean {
    const lock = this.lockMap.get(deviceId);
    return !lock || lock.active !== active;
  }

  saveLock(deviceId: number, active: boolean) {
    const lock = this.lockMap.get(deviceId);
    if (!lock || active !== lock.active) {
      if (lock) {
        clearTimeout(lock.timer);
      }
    }
  }

  private async syncCacheDb() {
    const deviceIdDBCache: any[] = await this.cache.get(DEVICE_ID_DB_MAP);
    if (deviceIdDBCache && deviceIdDBCache.length > 0)
      this.deviceIdDBMap = new Map(deviceIdDBCache);

    const literDBCache: any[] = await this.cache.get(LITER_DB_MAP);
    if (literDBCache && literDBCache.length > 0)
      this.literDBMap = new Map(literDBCache);

    const nDeviceIdMapCache: any[] = await this.cache.get(N_DEVICE_ID_MAP);
    if (nDeviceIdMapCache && nDeviceIdMapCache.length > 0)
      this.nDeviceIdMap = new Map(nDeviceIdMapCache);

    const lastAlarmProcessTimeCache = await this.cache.get(
      LAST_ALARM_PROCESS_TIME
    );
    if (lastAlarmProcessTimeCache)
      this.lastAlarmProcessTime = lastAlarmProcessTimeCache;

    const lastActionProcessTimeCache = await this.cache.get(
      LAST_ACTION_PROCESS_TIME
    );
    if (lastActionProcessTimeCache)
      this.lastActionProcessTime = lastActionProcessTimeCache;

    const lastLogProcessTimeCache = await this.cache.get(LAST_LOG_PROCESS_TIME);
    if (lastLogProcessTimeCache)
      this.lastLogProcessTime = lastLogProcessTimeCache;

    setInterval(() => {
      this.cache.set(LAST_LOG_PROCESS_TIME, this.lastLogProcessTime);
      this.cache.set(DEVICE_ID_DB_MAP, [...this.deviceIdDBMap.entries()]);
      this.cache.set(LITER_DB_MAP, [...this.literDBMap.entries()]);
      this.cache.set(N_DEVICE_ID_MAP, [...this.nDeviceIdMap.entries()]);
      this.cache.set(LAST_ALARM_PROCESS_TIME, this.lastAlarmProcessTime);
      this.cache.set(LAST_ACTION_PROCESS_TIME, this.lastActionProcessTime);
    }, 60_000);
  }

  getLastLogProcessTime(): number {
    if (!this.lastLogProcessTime) {
      this.lastLogProcessTime = Date.now() - 60000;
    }
    return this.lastLogProcessTime;
  }

  setLastLogProcessTime(time: number) {
    this.lastLogProcessTime = time;
  }
  getLastActionProcessTime(): number {
    if (this.actionOnWork) {
      return 0;
    }
    if (!this.lastActionProcessTime) {
      this.lastActionProcessTime = Date.now() - 60000;
    }
    this.actionOnWork = setTimeout(() => {
      if (this.actionOnWork) {
        this.actionOnWork = undefined;
      }
    }, 60_000);
    return this.lastActionProcessTime;
  }

  resetActionOnWork() {
    if (this.actionOnWork) {
      clearTimeout(this.actionOnWork);
      this.actionOnWork = undefined;
    }
  }

  setLastActionProcessTime(time: number) {
    this.lastActionProcessTime = time;
  }

  getLastAlarmProcessTime(): number | undefined {
    const last = this.lastAlarmProcessTime || Date.now();
    for (const key of this.processedAlarms.keys()) {
      const split = key.split("/");
      if (last > Number.parseInt(split[2])) {
        this.processedAlarms.delete(key);
      }
    }
    return last;
  }

  setLastAlarmProcessTime(time: number) {
    this.lastAlarmProcessTime = time;
  }

  addProcessedAlarmKey(key: string) {
    this.processedAlarms.add(key);
  }

  hasProcessedAlarmKey(key: string): boolean {
    return this.processedAlarms.has(key);
  }

  getDBFromDeviceIdOrNot(deviceId: string): DeviceDBMqtt | undefined {
    return this.deviceIdDBMap.get(deviceId);
  }

  getDBFromDeviceId(deviceId: string): DeviceDBMqtt {
    const db = this.deviceIdDBMap.get(deviceId);
    if (!db) {
      const errMsg = "Не найден DB объект в кэше для deviceId: " + deviceId;
      this.logger.error(errMsg);
      throw new Error(errMsg);
    }
    return db;
  }

  getDBFromLiter(liter: string | number): DeviceDBMqtt & { deviceId: string } {
    const db = this.literDBMap.get(liter + "");
    if (!db) {
      const errMsg = "Не найден DB объект в кэше для литера: " + liter;
      this.logger.error(errMsg);
      throw new Error(errMsg);
    }
    return db;
  }

  getDeviceIdFromN(n: number): { deviceId: string; liter: string } {
    const device = this.nDeviceIdMap.get(n + "");
    if (!device) {
      const errMsg = "Не найден DeviceId в кэше для N: " + n;
      this.logger.error(errMsg);
      throw new Error(errMsg);
    }
    return device;
  }

  getDBFromN(n: number): DeviceDBMqtt & { deviceId: string } {
    const obj = this.getDeviceIdFromN(n);
    const db = this.getDBFromDeviceId(obj.deviceId);
    return { ...db, deviceId: obj.deviceId };
  }

  async processDBMessage(parsedTopic: Topic, payload: DeviceDBMqtt) {
    if (parsedTopic.deviceId) {
      // this.logger.warnDevice('Получены данные по ДВ' + JSON.stringify(payload), parsedTopic.deviceId)
      this.deviceIdDBMap.set(parsedTopic.deviceId, payload);
      this.literDBMap.set(payload.liter, {
        ...payload,
        deviceId: parsedTopic.deviceId,
      });
      for (const n of payload.n) {
        if (n && n > 0) {
          this.nDeviceIdMap.set(n + "", {
            deviceId: parsedTopic.deviceId,
            liter: payload.liter,
          });
        }
      }
    }
  }

  async processDBMessageDelete({ parsedTopic }: { parsedTopic: Topic }) {
    if (parsedTopic.deviceId) {
      const db = this.deviceIdDBMap.get(parsedTopic.deviceId);
      if (db) {
        this.deviceIdDBMap.delete(parsedTopic.deviceId);
        this.literDBMap.delete(db.liter);
        this.logger.errorDevice("Удалили данные в кэше", parsedTopic.deviceId);
        for (const n of db.n) {
          this.nDeviceIdMap.delete(n + "");
        }
      }
    }
  }
}
