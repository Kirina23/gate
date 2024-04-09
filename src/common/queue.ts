import * as Bull from "bull";
import {
  QueueAutoArmCommand,
  QueueAutoDisarmCommand,
  QueueCommandEnum,
  QueueTestCommand,
} from "./server.interface";
import { config } from "./config";
import { RadioDeviceArmControl, RadioDeviceScheduleType } from "./dto";
import { Logger, notAllowTime } from "./logger";
import { getCronFromSeconds } from "./helper";

const QUEUE_NAME =
  config.NAMESPACE +
  "-" +
  config.SYSTEM +
  "-" +
  config.REGION +
  "-" +
  config.GATEWAY_ID;
const REDIS_FULL_HOST =
  "redis://" + config.REDIS_HOST + ":" + config.REDIS_PORT;

export enum QueuePriorityEnum {
  HIGH = 1,
  MID = 3,
  LOW = 5,
}

interface ScheduleMapItem {
  cron: string;
  day: number;
  zones: number[];
  action: "arm" | "disarm";
  alarm?: boolean;
}

export class ITYQueueService extends Bull {
  logger: Logger;
  constructor(queuePrefix: string, logger: Logger, opts?: Bull.QueueOptions) {
    super(queuePrefix + QUEUE_NAME, REDIS_FULL_HOST, opts);
    this.logger = logger;
  }

  async test(
    deviceId: string | number,
    opts?: Bull.JobOptions,
    alarm?: boolean
  ) {
    return this.add(
      {
        cmd: QueueCommandEnum.TEST,
        deviceId,
        alarm,
      } as QueueTestCommand,
      opts
    );
  }

  async autoArm(
    deviceId: string | number,
    zones: Array<1 | 0>,
    opts?: Bull.JobOptions
  ) {
    return this.add(
      {
        cmd: QueueCommandEnum.AUTO_ARM,
        deviceId,
        zones,
      } as QueueAutoArmCommand,
      opts
    );
  }

  async autoDisarm(
    deviceId: string | number,
    zones: Array<1 | 0>,
    opts?: Bull.JobOptions
  ) {
    return this.add(
      {
        cmd: QueueCommandEnum.AUTO_DISARM,
        deviceId,
        zones,
      } as QueueAutoDisarmCommand,
      opts
    );
  }

  async startRepeatedTest(
    deviceId: number,
    interval: number
  ): Promise<boolean> {
    if ((await this.hasRepeatedJob(deviceId)) === false) {
      const every =
        interval >= 2400000
          ? interval - Math.round(Math.random() * 240000)
          : interval;
      await this.test(deviceId, {
        jobId: "test-" + deviceId,
        priority: QueuePriorityEnum.LOW,
        repeat: {
          every,
        },
      });
      return true;
    } else {
      return false;
    }
  }

  async deleteRepeatedJob(deviceId: string | number): Promise<boolean> {
    const repeatableJobs = await this.getRepeatableJobs();
    for (const repeatedJob of repeatableJobs) {
      if (repeatedJob.id === "test-" + deviceId) {
        await this.removeRepeatableByKey(repeatedJob.key);
        return true;
      }
    }
    return false;
  }

  async hasRepeatedJob(deviceId: string | number): Promise<boolean> {
    const repeatableJobs = await this.getRepeatableJobs();
    for (const repeatedJob of repeatableJobs) {
      if (repeatedJob.id === "test-" + deviceId) {
        return true;
      }
    }
    return false;
  }

  async checkArmControl(
    deviceId: string | number,
    zones: Array<1 | 0>,
    mismatched: Array<1 | 0>,
    armControlSetting?: RadioDeviceArmControl[]
  ) {
    const zonesResult = [...zones];
    const mismatchedResult = [...mismatched];
    if (armControlSetting && armControlSetting.length > 0) {
      const zoneLength = armControlSetting.length;
      const armZones: Array<0 | 1> = new Array(zoneLength).fill(0);
      // const disarmZones = new Array(zoneLength).fill(0);
      const date = new Date();
      const weekDay = date.getDay() === 0 ? 6 : date.getDay() - 1;

      for (let zone = 0; zone < zoneLength; zone++) {
        const isArm = zones[zone] === 0;
        if (isArm) {
          const notAllow = notAllowTime(
            armControlSetting[zone].schedule[weekDay],
            "disarm"
          );
          if (armControlSetting[zone].auto && !notAllow) {
            if (mismatched[zone] === 0) {
              armZones[zone] = 1;
            } else if (config.SYSTEM === "Mirazh") {
              zonesResult[zone] = 1;
              mismatchedResult[zone] = 0;
              this.logger.errorDevice(
                "Исправляем несоответствие по АВТО для зоны " + (zone + 1),
                deviceId
              );
            }
          }
        }
      }
      if (armZones.findIndex((item) => item === 1) > -1) {
        const jobId = "fixAutoArm-" + deviceId;
        const job = await this.getJob(jobId);
        if (
          !job ||
          !["waiting", "active", "delayed"].includes(await job.getState()) ||
          Date.now() - job.timestamp > 30000 ||
          (await job.isStuck())
        ) {
          this.logger.warnDevice(
            "Установлено задание на автоматическое взятие зон " +
              armZones.join(",") +
              " по АВТО",
            deviceId
          );
          if (job) {
            await job.remove();
          }
          await this.add(
            {
              cmd: QueueCommandEnum.AUTO_ARM,
              deviceId,
              zones: armZones,
              alarm: true,
            },
            {
              jobId,
              priority: QueuePriorityEnum.MID,
              attempts: 3,
              timeout: 80000,
              delay: 15000,
            }
          );
        } else {
          this.logger.logDevice(
            "Задание на автоматическое взятие зон " +
              armZones.join(",") +
              " по АВТО пропущено так как задача исполняется.",
            deviceId
          );
        }
      }
    }
    return {
      zones: zonesResult,
      mismatched: mismatchedResult,
    };
  }

  async setArmControl(
    deviceId?: string,
    armControlSetting?: RadioDeviceArmControl[]
  ) {
    if (deviceId) {
      await this.deleteArmControlJobs(deviceId);
      if (armControlSetting && armControlSetting.length > 0) {
        const zoneLength = armControlSetting.length;
        const scheduleMaps = new Map<string, ScheduleMapItem>();
        for (let zone = 0; zone < zoneLength; zone++) {
          const armControl = armControlSetting[zone];
          if (
            armControl.schedule &&
            armControl.auto &&
            armControl.schedule.length > 0
          ) {
            for (let day = 0; day < armControl.schedule.length; day++) {
              const schedule = armControl.schedule[day];
              if (
                schedule.type === RadioDeviceScheduleType.TIMER &&
                schedule.endTimeSec !== undefined &&
                schedule.startTimeSec !== undefined
              ) {
                const endTimeCron = getCronFromSeconds(
                  schedule.endTimeSec,
                  day
                );
                const startTimeCron = getCronFromSeconds(
                  schedule.startTimeSec,
                  day
                );
                if (
                  scheduleMaps.has(
                    startTimeCron + "-arm-" + armControl.armAlarm
                  )
                ) {
                  const map = scheduleMaps.get(
                    startTimeCron + "-arm-" + armControl.armAlarm
                  ) as ScheduleMapItem;
                  scheduleMaps.set(
                    startTimeCron + "-arm-" + armControl.armAlarm,
                    { ...map, zones: [...map.zones, zone] }
                  );
                } else {
                  scheduleMaps.set(
                    startTimeCron + "-arm-" + armControl.armAlarm,
                    {
                      cron: startTimeCron,
                      day,
                      alarm: armControl.armAlarm,
                      zones: [zone],
                      action: "arm",
                    }
                  );
                }
                if (scheduleMaps.has(endTimeCron + "-disarm")) {
                  const map = scheduleMaps.get(
                    endTimeCron + "-disarm"
                  ) as ScheduleMapItem;
                  scheduleMaps.set(endTimeCron + "-disarm", {
                    ...map,
                    zones: [...map.zones, zone],
                  });
                } else {
                  scheduleMaps.set(endTimeCron + "-disarm", {
                    cron: endTimeCron,
                    day,
                    zones: [zone],
                    action: "disarm",
                  });
                }
              }
            }
          }
        }
        for (const value of scheduleMaps.values()) {
          if (!value.cron.includes("NaN")) {
            const zones = new Array(zoneLength).fill(0);
            for (const zon of value.zones) {
              zones[zon] = 1;
            }
            this.logger.warnDevice(
              "Установлено задание на автоматическое " +
                (value.action === "arm" ? "взятие" : "cнятие") +
                " зон " +
                value.zones.map((item) => item + 1).join(",") +
                " по расписанию " +
                value.cron,
              deviceId
            );
            this.add(
              {
                cmd:
                  value.action === "arm"
                    ? QueueCommandEnum.AUTO_ARM
                    : QueueCommandEnum.AUTO_DISARM,
                deviceId,
                zones,
                alarm: value.alarm,
              },
              {
                jobId:
                  "armControl-" +
                  deviceId +
                  "-" +
                  value.day +
                  "-" +
                  value.action,
                priority: QueuePriorityEnum.LOW,
                attempts: 3,
                repeat: {
                  cron: value.cron,
                },
              }
            );
          } else {
            this.logger.errorDevice(
              "Не корректно установлено значение авто взятия/снятия зон " +
                value.zones.map((item) => item + 1).join(",") +
                " по расписанию " +
                value.cron,
              deviceId
            );
          }
        }
      }
    }
  }

  async deleteArmControlJobs(deviceId: string): Promise<void> {
    const repeatableJobs = await this.getRepeatableJobs();
    const promises = [];
    for (const repeatedJob of repeatableJobs) {
      if (
        repeatedJob.id &&
        repeatedJob.id.startsWith("armControl-" + deviceId)
      ) {
        promises.push(this.removeRepeatableByKey(repeatedJob.key));
      }
    }
    await Promise.all(promises);
    if (promises.length > 0) {
      this.logger.warnDevice(
        "Удалено " +
          promises.length +
          " заданий на автоматическое взятие/снятие устройства",
        deviceId
      );
    }
  }

  async getAllArmControlJobs(deviceId: string): Promise<void> {
    const repeatableJobs = await this.getRepeatableJobs();
    for (const repeatedJob of repeatableJobs) {
      if (
        repeatedJob.id &&
        repeatedJob.id.startsWith("armControl-" + deviceId)
      ) {
        // promises.push(this.removeRepeatableByKey(repeatedJob.key));
        console.log(
          "cron",
          repeatedJob.cron,
          " tz: ",
          repeatedJob.tz,
          " next: ",
          repeatedJob.next,
          "rest",
          JSON.stringify(repeatedJob)
        );
      }
    }
  }
}
