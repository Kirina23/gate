import { RedisCache } from "./common/cache";
import { config, writeConfig } from "./common/config";
import { ProtonServer } from "./proton/proton";
import {
  AlarmTypeEnum,
  DeviceAction,
  DeviceStateMqtt,
  QueueCommand,
  QueueCommandEnum,
  ServerInterface,
} from "./common/server.interface";
import { JSONRPCPacket } from "./common/jsonRpc";
import { GATEWAY_COMMAND_ENUM, ITYMqttService } from "./common/mqtt";
import { DeviceConfigMqtt, RadioDeviceScheduleType, Topic } from "./common/dto";
import {
  getArmFromZones,
  getBitFromZones,
  getCurrentTime,
  getErrorMsg,
  printZones,
} from "./common/helper";
import { ITYQueueService } from "./common/queue";
import { notAllowTime } from "./common/logger";
import { MirajServer } from "./miraj/miraj";
import { AIUSOServer } from "./aiuso/aiuso";

const REPEATED_ACTION_TIMEOUT = 45000;
const redisClient = new RedisCache();

const retestMap = new Map<number, NodeJS.Timeout>();

export let DEBUG = false;

let server: ServerInterface;

const waitedCommands: Map<string, JSONRPCPacket> = new Map();

const mqttClient = new ITYMqttService();

const queue = new ITYQueueService("", mqttClient.logger, {
  defaultJobOptions: {
    timeout: 40000,
    removeOnComplete: 10,
    removeOnFail: 200,
  },
});

const {
  log,
  warn,
  error,
  errorDevice,
  logDevice,
  warnDevice,
} = mqttClient.logger;
(async () => {
  const cached = await redisClient.getGatewayConfig();
  if (!cached || cached.time < config.time) {
    warn(
      "Обновили настройки в кэше. Новые настройки: " + JSON.stringify(config)
    );
    redisClient.setGatewayConfig(config);
  }
})();

// redisClient.setIgnoreNoAnswer(false);
// warn('После перезагрузки отключили настройку по игнорированию тревог нет ответа NO_ANSWER_IGNORE');

const SYSTEM_NO_PERIODIC_TEST = ["Proton", "Mirazh", "Surgard", "Tandem"];

switch (config.SYSTEM) {
  case "Proton":
    server = new ProtonServer(mqttClient);
    break;
  case "Mirazh":
    server = new MirajServer(mqttClient);
    break;
  case "Tandem":
    server = new AIUSOServer(mqttClient);
    break;

  default:
    const msg =
      "Проверьте настройку SYSTEM. Значение: " + (config as any).SYSTEM;
    error(msg);
    throw new Error(msg);
}

mqttClient.sendStatus(server.gatewayStatus);

setInterval(async () => {
  const debug = await redisClient.get("debug");
  if (debug !== undefined) {
    DEBUG = debug;
  }
}, 1000);

setTimeout(async () => {
  if (mqttClient.isOnline()) {
    const cacheConfig = await redisClient.getGatewayConfig();
    if (!cacheConfig || !config.time || cacheConfig.time < config.time) {
      warn("Настройки шлюза отправлены в брокер сообщений");
      mqttClient.sendGatewayConfig(config);
    }
  }
}, 30000);

mqttClient.on(
  config.SYSTEM + "/STATUS",
  async (parsedTopic: Topic, payload) => {
    if (parsedTopic.deviceId) {
      const cached = await redisClient.getDeviceStatus(parsedTopic.deviceId);
      if (!cached || cached.time < payload.time) {
        warnDevice(
          "Статус устройства получен из брокера. Статус брокера: " +
            payload.status +
            " Статус кэша: " +
            (cached ? cached.status : "Отсутствует. Первичное заполнение"),
          parsedTopic.deviceId
        );
        redisClient.setDeviceStatus(parsedTopic.deviceId, payload);
      } else if (
        cached.time > payload.time &&
        cached.status !== payload.status
      ) {
        warnDevice(
          "Статус устройства более новый в кэше. Статус брокера: " +
            payload.status +
            " Статус кэша: " +
            (cached ? cached.status : "Отсутствует. Первичное заполнение"),
          parsedTopic.deviceId
        );
        mqttClient.sendDeviceStatus({
          deviceId: parsedTopic.deviceId,
          ...cached,
        });
      }
    } else {
      if (
        payload.status === 0 ||
        (payload.connectionStatus === 1) !== server.gatewayStatus
      ) {
        mqttClient.sendStatus(server.gatewayStatus);
      }
    }
  }
);

mqttClient.on(
  config.SYSTEM + "/STATE",
  async (parsedTopic: Topic, payload: DeviceStateMqtt) => {
    if (!payload.mismatched) {
      payload.mismatched = new Array(payload.zones.length).fill(0);
    }
    if (parsedTopic.deviceId) {
      const cached = await redisClient.getDeviceState(parsedTopic.deviceId);
      if (!cached || cached.time < payload.time || !cached.mismatched) {
        warnDevice(
          "Состояние устройства получен из брокера. Состояние в брокере: " +
            JSON.stringify(payload) +
            " Статус кэша: " +
            (cached
              ? JSON.stringify(cached)
              : "Отсутствует. Первичное заполнение"),
          parsedTopic.deviceId
        );
        setDeviceState(parsedTopic.deviceId, payload);
        checkArmControl(parsedTopic.deviceId, payload);
      } else if (cached.time > payload.time) {
        warnDevice(
          "Состояние устройства более новый в кэше. Состояние в брокере: " +
            JSON.stringify(payload) +
            " Статус кэша: " +
            JSON.stringify(cached),
          parsedTopic.deviceId
        );
        mqttClient.sendDeviceState({
          deviceId: parsedTopic.deviceId,
          ...cached,
        });
      } else {
        checkArmControl(parsedTopic.deviceId, payload);
      }
    } else {
      error(
        "Получено состояние шлюза в тему: " +
          parsedTopic +
          " с данными: " +
          JSON.stringify(payload)
      );
    }
  }
);

mqttClient.on(
  config.SYSTEM + "/CONFIG",
  async (parsedTopic: Topic, payload) => {
    if (parsedTopic.deviceId) {
      const cached = await redisClient.getDeviceConfig(parsedTopic.deviceId);
      if (
        !cached ||
        cached.time < payload.time ||
        cached.region !== parsedTopic.region
      ) {
        warnDevice(
          "Настройки устройства получен из брокера. Настройки в брокере: " +
            JSON.stringify(payload) +
            " Настройки кэша: " +
            (cached
              ? JSON.stringify(cached)
              : "Отсутствует. Первичное заполнение"),
          parsedTopic.deviceId
        );
        redisClient.setDeviceConfig(parsedTopic.deviceId, {
          ...payload,
          region: parsedTopic.region,
        });
        queue.setArmControl(parsedTopic.deviceId, payload.armControlSetting);
      } else if (cached.time > payload.time) {
        warnDevice(
          "Настройки устройства более новый в кэше. Настройки в брокере: " +
            JSON.stringify(payload) +
            " Настройки кэша: " +
            JSON.stringify(cached),
          parsedTopic.deviceId
        );
        mqttClient.sendDeviceConfig(parsedTopic.deviceId, cached);
      }
    } else {
      const cached = await redisClient.getGatewayConfig();
      if (!cached || cached.time < payload.time) {
        warn(
          "Настройки шлюза получен из брокера. Настройки в брокере: " +
            JSON.stringify(payload) +
            " Настройки кэша: " +
            (cached
              ? JSON.stringify(cached)
              : "Отсутствует. Первичное заполнение")
        );
        const newConfig = { ...config, ...payload };
        redisClient.setGatewayConfig(newConfig);
        writeConfig(newConfig);
      } else if (cached.time > payload.time) {
        warn(
          "Настройки шлюза более новый в кэше. Настройки в брокере: " +
            JSON.stringify(payload) +
            " Настройки кэша: " +
            JSON.stringify(cached)
        );
        mqttClient.sendGatewayConfig(cached);
      }
    }
  }
);

mqttClient.on(config.SYSTEM + "/CONFIG-delete", async (parsedTopic: Topic) => {
  if (parsedTopic.deviceId) {
    error(
      "Получено пустое сообщение в настройках устройства " +
        parsedTopic.deviceId +
        " удаляем в системе"
    );
    await deleteDevice(parsedTopic.deviceId);
  }
});

mqttClient.on(
  config.SYSTEM + "/DCMD",
  async (parsedTopic: Topic, payload: JSONRPCPacket) => {
    if (parsedTopic.deviceId) {
      processDeviceCommand(parsedTopic, payload);
    } else {
      error(
        "Получено задание в DCMD без указания deviceId. Тема: " +
          parsedTopic.initial +
          " payload: " +
          JSON.stringify(payload)
      );
    }
  }
);

mqttClient.on(
  config.SYSTEM + "/NCMD",
  async (parsedTopic: Topic, payload: JSONRPCPacket) => {
    try {
      switch (payload.method) {
        case GATEWAY_COMMAND_ENUM.ADD_DEVICE:
          await processAddDeviceCommand(parsedTopic, payload);
          break;
        case GATEWAY_COMMAND_ENUM.DELETE_DEVICE:
          await processDelDeviceCommand(parsedTopic, payload);
          break;
        case GATEWAY_COMMAND_ENUM.SET_DEBUG:
          await setDebug(parsedTopic, payload);
          break;
        case GATEWAY_COMMAND_ENUM.RESTART:
          await mqttClient.sendSuccessRpc(parsedTopic, payload.id, true);
          //TODO: Add graceful shutdown
          process.exit(0);
        case GATEWAY_COMMAND_ENUM.SET_CONFIG:
          if (!payload.params) {
            mqttClient.sendErrorRpc(parsedTopic, payload.id, "Нет настроек");
            return;
          }
          const newConfig = {
            ...config,
            ...payload.params,
            timeout: undefined,
          };
          redisClient.setGatewayConfig(newConfig);
          await writeConfig(newConfig);
          mqttClient.sendSuccessRpc(parsedTopic, payload.id, true);
          break;
        case GATEWAY_COMMAND_ENUM.SET_IGNORE_NO_ANSWER:
          await redisClient.setIgnoreNoAnswer(payload.params?.ignore === true);
          mqttClient.sendSuccessRpc(parsedTopic, payload.id, true);
          break;
        case GATEWAY_COMMAND_ENUM.PING:
          await mqttClient.sendStatus(server.gatewayStatus);
          mqttClient.sendSuccessRpc(parsedTopic, payload.id, true);
          break;
        default:
          mqttClient.sendErrorRpc(
            parsedTopic,
            payload.id,
            "Неизвестная команда: " + payload.method
          );
          error(
            "Получена неизвестная команда: " +
              payload.method +
              " Payload: " +
              JSON.stringify(payload)
          );
          break;
      }
    } catch (err) {
      mqttClient.sendErrorRpc(parsedTopic, payload.id, getErrorMsg(err));
    }
  }
);

const processAddDeviceCommand = async (parsedTopic: Topic, payload: any) => {
  if (payload.params && payload.params.deviceId) {
    warn("Получен запрос на добавление устройства " + payload.params.deviceId);
    const setting = await redisClient.getDeviceConfig(payload.params.deviceId);
    if (setting) {
      error(
        "Устройство с номером " +
          payload.params.deviceId +
          " уже добавлено в систему."
      );
      errorDevice(
        "Попытка повторного добавления устройства!",
        payload.params.deviceId
      );
      throw new Error(
        "Устройство с номером " +
          payload.params.deviceId +
          " уже добавлено в систему."
      );
    } else {
      const newDeviceSettings: DeviceConfigMqtt = {
        time: getCurrentTime(),
        region: parsedTopic.region,
        interval: payload.params.interval
          ? payload.params.interval
          : config.DEFAULT_INTERVAL_MS,
        forbiddenDays: payload.params.forbiddenDays
          ? payload.params.forbiddenDays
          : undefined,
        armControlSetting: payload.params.armControlSetting
          ? payload.params.armControlSetting
          : undefined,
        allowedUsers: payload.params.allowedUsers
          ? payload.params.allowedUsers
          : [1],
      };
      warn(
        "Добавлено устройство номер " +
          payload.params.deviceId +
          " c настройками " +
          JSON.stringify({ ...newDeviceSettings, time: undefined })
      );
      warnDevice(
        "Добавлено устройство c настройками " +
          JSON.stringify({ ...newDeviceSettings, time: undefined }),
        payload.params.deviceId
      );
      await redisClient.setDeviceConfig(
        payload.params.deviceId,
        newDeviceSettings
      );
      queue.setArmControl(
        payload.params.deviceId,
        newDeviceSettings.armControlSetting
      );
      mqttClient.sendDeviceConfig(payload.params.deviceId, newDeviceSettings);
      mqttClient.sendSuccessRpc(parsedTopic, payload.id, true);
    }
  } else {
    throw new Error("Не заданы параметры для добавления устройства");
  }
};

const deleteDevice = async (deviceId: string): Promise<boolean> => {
  const setting = await redisClient.getDeviceConfig(deviceId);
  if (setting) {
    errorDevice("Устройство удалено с сервера!", deviceId);
    const promises = [
      redisClient.deleteDeviceData(deviceId),
      queue.deleteArmControlJobs(deviceId),
      queue.deleteRepeatedJob(deviceId),
      mqttClient.cleanMqttBroker(deviceId),
    ];
    await Promise.all(promises as any[]);
    return true;
  } else {
    error("Устройство с номером " + deviceId + " отсутствует в системе.");
    errorDevice("Попытка удаления устройства!", deviceId);
    return false;
  }
};

const processDelDeviceCommand = async (parsedTopic: Topic, payload: any) => {
  if (payload.params && payload.params.deviceId) {
    const deviceId = payload.params.deviceId;
    warn("Получен запрос на удаление устройства " + deviceId);
    const result = await deleteDevice(deviceId);
    if (result) {
      mqttClient.sendSuccessRpc(parsedTopic, payload.id, true);
    } else {
      throw new Error(
        "Устройство с номером " +
          payload.params.deviceId +
          " отсутствует в системе."
      );
    }
  }
};

const setDebug = async (parsedTopic: Topic, payload: any) => {
  if (payload.params === undefined || payload.params.debug === undefined) {
    throw new Error("Не задан параметр debug: true/false");
  } else {
    if (payload.params.debug === true || payload.params.debug === false) {
      warn(
        "Получен запрос на установку флага DEBUG на " + payload.params.debug
      );
      redisClient.set("debug", payload.params.debug);
      DEBUG = payload.params.debug;
      mqttClient.sendSuccessRpc(parsedTopic, payload.id, true);
    } else {
      throw new Error("Не задан параметр debug: true/false");
    }
  }
};

const checkArmControl = async (
  deviceId: number | string,
  state: DeviceStateMqtt
) => {
  const config = await redisClient.getDeviceConfig(deviceId);
  const newState = await queue.checkArmControl(
    deviceId,
    state.zones,
    state.mismatched,
    config?.armControlSetting
  );
  if (state.zones.join(",") !== newState.zones.join(",")) {
    const time = getCurrentTime(state.time);
    mqttClient.sendDeviceState({
      deviceId,
      active: state.active,
      arm: newState.zones.findIndex((item) => item === 1) > -1 ? 1 : 0,
      mismatched: newState.mismatched,
      zones: newState.zones,
      time,
    });
    const armZones = new Array(state.zones.length).fill(0);
    const disarmZones = new Array(state.zones.length).fill(0);
    for (let x = 0; x < state.zones.length; x++) {
      if (state.zones[x] !== newState.zones[x]) {
        if (newState.zones[x] === 1) {
          armZones[x] = 1;
        } else {
          disarmZones[x] = 1;
        }
      }
    }
    if (armZones.find((item) => item === 1) > -1) {
      mqttClient.sendAction({
        action: "arm",
        deviceId,
        time,
        zones: armZones,
        auto: true,
        server: true,
      });
    }
    if (disarmZones.find((item) => item === 1) > -1) {
      mqttClient.sendAction({
        action: "disarm",
        deviceId,
        time,
        zones: disarmZones,
        auto: true,
        server: true,
      });
    }
  }
};

const setDeviceState = async (
  deviceId: number | string,
  state: DeviceStateMqtt
) => {
  if (!state.mismatched) {
    state.mismatched = new Array(state.zones.length).fill(0);
  }
  redisClient.setDeviceState(deviceId, state);
  // checkArmControl(deviceId, state);
};

const processDeviceCommand = async (
  parsedTopic: Topic,
  payload: JSONRPCPacket
) => {
  try {
    const deviceId = Number.parseInt(parsedTopic.deviceId as string);
    // console.log('deviceId', deviceId, 'parsedTopic.deviceId', '"' + parsedTopic.deviceId + '"');
    // console.log('payload.method + - + deviceId',payload.method + '-' + deviceId)
    if (
      payload.method &&
      ["test", "arm", "disarm"].includes(payload.method) &&
      waitedCommands.has(payload.method + "-" + deviceId)
    ) {
      throw new Error("Устройство занято. Предыдущая команда еще выполняется.");
    }
    switch (payload.method) {
      case "test":
        waitedCommands.set(payload.method + "-" + deviceId, payload);
        const responseState = await server.testDevice(deviceId);
        waitedCommands.delete(payload.method + "-" + deviceId);
        if (responseState) {
          const state = await redisClient.getDeviceState(deviceId);
          const mismatched = state
            ? []
            : new Array(responseState.zones.length).fill(0);
          if (state) {
            for (let x = 0; x < state.zones.length; x++) {
              if (state.zones[x] !== responseState.zones[x]) {
                mismatched.push(1);
              } else {
                mismatched.push(0);
              }
            }
          }
          mqttClient.sendSuccessRpc(parsedTopic, payload.id, {
            ...responseState,
            mismatched,
            zonesBit: getBitFromZones(responseState.zones),
            activeBit: getBitFromZones(responseState.active),
          });
        } else {
          mqttClient.sendErrorRpc(
            parsedTopic,
            payload.id,
            "Устройство занято. Дождитесь выполнения предыдущего теста."
          );
        }

        break;
      case "arm":
      case "disarm":
        if (
          payload.params &&
          payload.params.zones &&
          payload.params.zones.length
        ) {
          waitedCommands.set(payload.method + "-" + deviceId, payload);
          const responseArm = await server.armDevice(
            deviceId,
            payload.method,
            payload.params.zones,
            payload.params.userId,
            payload.params.dbMode,
            payload.params.userName
          );
          waitedCommands.delete(payload.method + "-" + deviceId);
          await mqttClient.sendSuccessRpc(parsedTopic, payload.id, {
            ...responseArm,
            zonesBit: getBitFromZones(responseArm.zones),
          });
        }
        break;
      case "setConfig":
        if (payload.params) {
          const cachedDeviceConfig = await redisClient.getDeviceConfig(
            deviceId
          );
          if (!cachedDeviceConfig) {
            throw new Error(
              "Устройство номер " + deviceId + " не имеет настроек на сервере."
            );
          }
          const newConfig = {
            ...cachedDeviceConfig,
            ...payload.params,
            time: getCurrentTime(),
            timeout: undefined,
          };
          await redisClient.setDeviceConfig(deviceId, newConfig);
          mqttClient.sendSuccessRpc(parsedTopic, payload.id, true);
          mqttClient.sendDeviceConfig(deviceId, newConfig);
          if (payload.params.armControlSetting) {
            queue.setArmControl(
              deviceId + "",
              payload.params.armControlSetting
            );
          }
        }
        break;
      default:
        throw new Error("Нет метода с именем: " + payload.method);
    }
  } catch (err) {
    waitedCommands.delete(payload.method + "-" + parsedTopic.deviceId);
    console.error("error during RPC request", parsedTopic, payload);
    console.error(err);
    errorDevice(
      "Ошибка при запросе команды " + JSON.stringify(err),
      parsedTopic.deviceId || 0
    );
    mqttClient.sendErrorRpc(parsedTopic, payload.id, getErrorMsg(err));
  } finally {
    waitedCommands.delete(payload.method + "-" + parsedTopic.deviceId);
  }
};

server.on("alarm", async (alarm) => {
  warnDevice(
    "Получен сигнал тревоги. Тип тревоги: " +
      alarm.type +
      " Зоны: " +
      printZones(alarm.active) +
      " Сообщение: " +
      alarm.message,
    alarm.deviceId
  );
  const state = await redisClient.getDeviceState(alarm.deviceId);
  if (alarm.type === AlarmTypeEnum.NO_ANSWER) {
    const ignore = redisClient.ignoreNoAnswer();
    if (ignore) {
      errorDevice(
        "Тревога по нет ответу проигнорирована так как установлена настройка NO_ANSWER_IGNORE",
        alarm.deviceId
      );
      return;
    }
  }
  if (state) {
    const active: Array<0 | 1> = [];
    for (let x = 0; x < state.zones.length; x++) {
      if (
        alarm.active &&
        alarm.active.length > 0 &&
        x < alarm.active.length &&
        alarm.active[x] === 1 &&
        state.zones[x] === 0
      ) {
        errorDevice(
          "Тревога по зоне " +
            (x + 1) +
            " будет проигнорирована. В кэше зона не под охраной.",
          alarm.deviceId
        );
        active.push(0);
      } else {
        if (alarm.active && alarm.active.length > 0) {
          active.push(alarm.active[x]);
        } else {
          active.push(state.zones[x]);
        }
      }
    }
    if (active.filter((item) => item === 1).length > 0) {
      mqttClient.sendAlarm({
        ...alarm,
        active,
      });
    }
  } else {
    errorDevice(
      "Отсутствует сохраненное состояние устройства в кэш",
      alarm.deviceId
    );
    // mqttClient.sendAlarm(alarm);
  }
});

const repeatedActions = new Map<
  number,
  { action: string; zones: string; time: number }
>();

setInterval(() => {
  const date = Date.now();
  for (const deviceId of repeatedActions.keys()) {
    const data = repeatedActions.get(deviceId);
    if (data && date - data.time > REPEATED_ACTION_TIMEOUT) {
      repeatedActions.delete(deviceId);
    }
  }
}, REPEATED_ACTION_TIMEOUT);

server.on("action", async (action) => {
  // Отправка в ACTION
  log("Получен action: " + JSON.stringify(action));
  const deviceId =
    typeof action.deviceId === "string"
      ? Number.parseInt(action.deviceId)
      : action.deviceId;
  const command = waitedCommands.get(action.action + "-" + deviceId);
  // logDevice('command: ' + JSON.stringify(command), deviceId);
  // logDevice('waitedCommands: ' + JSON.stringify(waitedCommands), deviceId);
  const state = await redisClient.getDeviceState(deviceId);
  if (!state) {
    error(
      "Для устройства " + deviceId + " нет состояния. Делаем повторный тест!"
    );
    server.testDevice(deviceId);
    return;
  }
  const deviceConfig = await redisClient.getDeviceConfig(deviceId);
  if (!deviceConfig) {
    error(
      "Для устройства " + deviceId + " нет настроек. Команда проигнорирована!"
    );
    return;
  }
  const repeatedAction = repeatedActions.get(deviceId);
  const zonesStringify = action.zones.join(",");
  if (
    repeatedAction &&
    action.time - repeatedAction.time < REPEATED_ACTION_TIMEOUT &&
    repeatedAction.action === action.action &&
    repeatedAction.zones === zonesStringify
  ) {
    warnDevice(
      "Получено повторное действие: " + JSON.stringify(repeatedAction),
      deviceId
    );
    return;
  }
  repeatedActions.set(deviceId, {
    action: action.action,
    zones: zonesStringify,
    time: action.time,
  });
  let actionToSend;
  let newZones: Array<0 | 1> = [];
  if (["Mirazh", "Tandem"].includes(config.SYSTEM)) {
    newZones = action.zones;
  } else {
    if (command && action.action === "disarm" && command.method === "disarm") {
      newZones = command.params.zones;
    } else {
      for (let x = 0; x < action.zones.length; x++) {
        if (action.zones[x] === 1) {
          newZones.push(1);
        } else if (
          command &&
          command.params.zones[x] === 1 &&
          state.mismatched[x] === 1
        ) {
          newZones.push(1);
        } else {
          newZones.push(0);
        }
      }
    }
  }

  if (action.auto) {
    actionToSend = {
      ...action,
      zones: newZones,
      server: true,
      mobile: false,
    };
  } else if (command) {
    actionToSend = {
      ...action,
      zones: newZones,
      server: true,
      mobile: command.params.mobile,
      id: command.id,
      userId: command.params.userId, //check
    };
  } else {
    actionToSend = {
      ...action,
      zones: newZones,
      server: action.server || false,
      mobile: false,
    };
  }

  // Проверка на тревоги
  let allow = true;
  const allowedUsers = [
    114,
    128,
    115,
    250,
    ...deviceConfig.allowedUsers.map((item) => {
      if (typeof item === "number") {
        return item;
      } else {
        return Number.parseInt(item);
      }
    }),
  ];
  // logDevice('actionToSend: ' + JSON.stringify(actionToSend), deviceId);
  // logDevice('allowedUsers: ' + JSON.stringify(allowedUsers), deviceId);
  const actionStr = `Запрос на ${
    action.action === "arm" ? "взятие на охрану" : "снятие с охраны"
  } зон: ${printZones(actionToSend.zones)}`;
  if (
    actionToSend.auto === false &&
    typeof actionToSend.userId === "number" &&
    !allowedUsers.includes(actionToSend.userId)
  ) {
    allow = false;
    errorDevice(
      actionStr +
        " отклонен! Пользователь " +
        actionToSend.userId +
        " отсутствует списке разрешенных пользователей!",
      deviceId
    );
    mqttClient.sendAlarm({
      time: actionToSend.time,
      type: AlarmTypeEnum.UNAUTHRORIZED_USER,
      deviceId,
      active: actionToSend.zones,
      user: actionToSend.userId,
      message:
        "Пользователь " +
        actionToSend.userId +
        " отсутствует в списке разрешенных",
    });
  }
  const alarmZones = [];
  if (deviceConfig.armControlSetting) {
    const date = new Date();
    const weekDay = date.getDay() === 0 ? 6 : date.getDay() - 1;
    const zones = newZones
      .map((value, index) => {
        if (value === 1) {
          return index;
        } else {
          return -1;
        }
      })
      .filter((item) => item > -1);
    for (const zone of zones) {
      if (zone >= deviceConfig.armControlSetting.length) {
        errorDevice(
          'В настройках "Контроля постановки" отсутствуют настройки для зоны ' +
            zone,
          deviceId
        );
      } else {
        if (
          (action.action === "arm" &&
            deviceConfig.armControlSetting[zone].armControl) ||
          (action.action === "disarm" &&
            deviceConfig.armControlSetting[zone].disarmControl)
        ) {
          const schedule =
            deviceConfig.armControlSetting[zone].schedule[weekDay];
          const printZone = zone + 1;
          if (schedule.type === RadioDeviceScheduleType.TIMER) {
            if (action.action === "arm" && !notAllowTime(schedule, "arm")) {
              allow = false;
              warnDevice(
                actionStr +
                  "отклонен. Сработало ограничение на взятие по контролю постановки. Таймер. Зона: " +
                  printZone,
                deviceId
              );
              if (deviceConfig.armControlSetting[zone].armAlarm) {
                alarmZones.push(zone);
              }
            }
            if (
              action.action === "disarm" &&
              !notAllowTime(schedule, "disarm")
            ) {
              warnDevice(
                actionStr +
                  "отклонен. Сработало ограничение на снятие по контролю постановки. Таймер. Зона: " +
                  printZone,
                deviceId
              );
              allow = false;
            }
          } else if (schedule.type === RadioDeviceScheduleType.NONSTOP) {
            if (action.action === "disarm") {
              warnDevice(
                actionStr +
                  "отклонен. Сработало ограничение на снятие по контролю постановки. Круглосуточно. Зона: " +
                  printZone,
                deviceId
              );
              allow = false;
            }
          }
        }
      }
    }
  }
  if (alarmZones.length > 0) {
    const active: Array<1 | 0> = [];
    for (let x = 0; x < newZones.length; x++) {
      if (alarmZones.includes(x)) {
        active.push(1);
      } else {
        active.push(0);
      }
    }

    mqttClient.sendAlarm({
      time: action.time,
      type: AlarmTypeEnum.ARM_PERIOD,
      deviceId,
      active,
    });
  }

  // FIX issue with Alarm during ARMING
  if (["Mirazh", "Proton"].includes(config.SYSTEM)) {
    const prevTimer = retestMap.get(deviceId);
    if (prevTimer) {
      clearTimeout(prevTimer);
    }
    const timer = setTimeout(() => {
      retestMap.delete(deviceId);
      server.testDevice(deviceId);
    }, 30_000);
    retestMap.set(deviceId, timer);
  }

  if (!allow) {
    warnDevice(
      "Отклонен запрос на " +
        (action.action === "arm" ? "постановку на охраны" : "снятие с охраны") +
        ". Контроль постановки. зоны: " +
        printZones(action.zones) +
        " пользователь: " +
        action.userId,
      deviceId
    );
    return;
  }

  mqttClient.sendAction(actionToSend);

  // Обновление STATE
  if (["arm", "disarm"].includes(action.action)) {
    let newActive: Array<0 | 1> = state.active;
    let newState: DeviceStateMqtt | undefined = undefined;

    const mismatched = [...state.mismatched];
    const zones = [...state.zones];
    for (let x = 0; x < newZones.length; x++) {
      if (newZones[x] === 1) {
        mismatched[x] = 0;
        zones[x] = action.action === "arm" ? 1 : 0;
        if (action.action === "arm") {
          newActive[x] = 0;
        }
      }
    }
    newState = {
      time: getCurrentTime(),
      arm: getArmFromZones(zones),
      active: newActive,
      mismatched,
      zones,
    };
    setDeviceState(deviceId, newState);
    mqttClient.sendDeviceState({
      ...newState,
      deviceId: deviceId,
    });
    if (!SYSTEM_NO_PERIODIC_TEST.includes(config.SYSTEM)) {
      queue.test(deviceId, {
        delay: 20000,
      });
      checkTestJob(newState, deviceId, deviceConfig.interval);
    }

    const stateText = newState ? newState.zones.join(",") : "неизвестно";
    const actionText =
      action.action === "arm" ? "установленно под охрану" : "снято с охраны";
    const userText =
      typeof actionToSend.userId === "undefined"
        ? "не указан"
        : actionToSend.userId;
    if (actionToSend.mobile) {
      warnDevice(
        `Устройство ${actionText} с мобильного приложения. Пользователь: ${userText} Состояние зон: ${stateText}`,
        actionToSend.deviceId
      );
    } else if (actionToSend.auto) {
      warnDevice(
        `Устройство Автоматический ${actionText} с управляющего сервера. Состояние зон: ${stateText}`,
        actionToSend.deviceId
      );
    } else if (actionToSend.server) {
      warnDevice(
        `Устройство ${actionText} с управляющего сервера. Пользователь: ${userText} Состояние зон: ${stateText}`,
        actionToSend.deviceId
      );
    } else {
      warnDevice(
        `Устройство ${actionText} с прибора. Пользователь: ${userText} Состояние зон: ${stateText}`,
        actionToSend.deviceId
      );
    }
  }
});

server.on("deviceState", async (state) => {
  const cachedState = await redisClient.getDeviceState(state.deviceId);
  const mismatched = new Array(state.zones.length).fill(0);
  const zones = cachedState ? cachedState.zones : state.zones;
  if (!cachedState) {
    warnDevice(
      "Первичное заполнение состояния в кэш. Зоны под охраной: " +
        printZones(state.zones) +
        " Нарушенные зоны: " +
        printZones(state.active),
      state.deviceId
    );
  } else {
    if (
      cachedState.zones &&
      cachedState.zones.join(",") !== state.zones.join(",")
    ) {
      errorDevice(
        "Статус зон не сходится с кэшем. Зоны под охраной в кэше: " +
          printZones(cachedState.zones) +
          " Получено: " +
          printZones(state.zones) +
          " Нарушены зоны: " +
          printZones(state.active),
        state.deviceId
      );
      for (let x = 0; x < state.zones.length; x++) {
        if (
          x < cachedState.zones.length &&
          cachedState.zones[x] !== state.zones[x]
        ) {
          if (state.mismatched[x] === 1) {
            zones[x] = 0;
            errorDevice(
              "Автоматически снимаем несоответствие зоны под охраной №" +
                (x + 1),
              state.deviceId
            );
          } else {
            mismatched[x] = 1;
          }
        }
      }
    }
  }
  const newState: DeviceStateMqtt = {
    time: state.time,
    active: state.active,
    mismatched,
    zones,
    arm: zones.filter((item) => item === 1).length > 0 ? 1 : 0,
  };
  setDeviceState(state.deviceId, newState);
  mqttClient.sendDeviceState({ ...newState, deviceId: state.deviceId });
  if (!SYSTEM_NO_PERIODIC_TEST.includes(config.SYSTEM)) {
    checkTestJob(newState, parseDeviceId(state.deviceId));
  }
});

server.on("deviceStatus", async (status) => {
  const config = await redisClient.getDeviceConfig(status.deviceId);
  if (!config) {
    error(
      "Обновился статус устройства " +
        status.deviceId +
        " но отсутствуют настройки в кэше. Статус: " +
        status.status
    );
    return;
  }
  const cachedStatus = await redisClient.getDeviceStatus(status.deviceId);
  if (!cachedStatus) {
    warnDevice(
      "Первичное заполнение статуса в кэше: " + status.status,
      status.deviceId
    );
    // redisClient.setDeviceStatus(status.deviceId, status);
    mqttClient.sendDeviceStatus(status);
  } else if (
    cachedStatus.status !== status.status ||
    status.time - cachedStatus.time > 3600000
  ) {
    mqttClient.sendDeviceStatus(status);
  }
  logDevice("Получен статус от устройства " + status.status, status.deviceId);
  redisClient.setDeviceStatus(status.deviceId, status);
  if (status.status === 0) {
    const state = await redisClient.getDeviceState(status.deviceId);
    if (state && state.arm === 1) {
      const ignore = redisClient.ignoreNoAnswer();
      if (ignore) {
        errorDevice(
          "Тревога по нет ответу проигнорирована так как установлена настройка NO_ANSWER_IGNORE",
          status.deviceId
        );
        return;
      }
      await mqttClient.sendAlarm({
        deviceId: status.deviceId,
        time: getCurrentTime(),
        type: AlarmTypeEnum.NO_ANSWER,
        active: state.zones,
        message: "Получен сигнал потери сигнала с устройством",
      });
    }
    // warnDevice('Устройство оффлайн. Установили задание на тест через 30 сек для тревоги "Нет ответа"', status.deviceId);
    // queue.test(status.deviceId, {
    //     delay: 30000,
    // }, true);
  }
});

server.on("gatewayStatus", (status) => {
  // const statusNumber = status ? 1 : 0;
  // if (statusNumber !== connectionStatus) {
  //     connectionStatus = statusNumber;
  mqttClient.sendStatus(server.gatewayStatus);
  // }
});

queue.process(async (job, done) => {
  const data: QueueCommand = job.data;
  log("Получил задание из очереди: " + JSON.stringify(data));
  const deviceId =
    typeof data.deviceId === "string"
      ? Number.parseInt(data.deviceId)
      : data.deviceId;
  switch (data.cmd) {
    case QueueCommandEnum.TEST:
      try {
        await server.testDevice(deviceId);
      } catch (err) {
        // const state = await redisClient.getDeviceState(deviceId);
        const msg = "Не получен ответ от устройства на тест";
        errorDevice(msg, deviceId);
        done(new Error(msg));
        // if (state && state.arm === 1) {
        //     await mqttClient.sendAlarm({
        //         deviceId,
        //         time: getCurrentTime(),
        //         type: AlarmTypeEnum.NO_ANSWER,
        //         active: state.zones,
        //         message: 'Не получен ответ от устройства на тест.',
        //     });
        // }
        // } else {
        //     warnDevice('Установили повторный тест через минуту чтобы подтвердить тревогу "Нет ответа"', job.data.deviceId);
        //     await queue.test(deviceId, {
        //         delay: 60000,
        //         priority: QueuePriorityEnum.MID
        //     }, true);
        // }
      }
      break;
    case QueueCommandEnum.AUTO_ARM:
      try {
        logDevice("Получил задание на автовзятие. Тестируем зоны.", deviceId);
        const testResult = await server.testDevice(deviceId);
        if (!testResult) {
          done(new Error("Устройство занято"));
          return;
        }
        setTimeout(async () => {
          try {
            const zoneLength = testResult.zones.length;
            const alarmZones: Array<1 | 0> = new Array(zoneLength).fill(0);
            const activeNumber = [];
            const zones: Array<1 | 0> = new Array(zoneLength).fill(0);
            const mismatched: Array<1 | 0> = new Array(zoneLength).fill(0);
            const state = await redisClient.getDeviceState(deviceId);
            if (!state) {
              const stateError = "Нет статуса зон в кэше";
              errorDevice(stateError, deviceId);
              done(new Error(stateError));
              return;
            }
            for (let x = 0; x < data.zones.length; x++) {
              if (data.zones[x] === 1 && testResult.zones[x] === 0) {
                zones[x] = 1;
              }
              if (data.zones[x] === 1 && testResult.active[x] === 1) {
                alarmZones[x] = 1;
                activeNumber.push(x + 1);
              }
              if (
                data.zones[x] === 1 &&
                state &&
                state.mismatched[x] === 1 &&
                state.zones[x] === 0 &&
                testResult.active[x] === 0
              ) {
                mismatched[x] = 1;
              }
            }
            if (alarmZones.filter((item) => item === 1).length > 0) {
              const msg =
                "Ошибка автовзятия! Зона " +
                activeNumber.join(",") +
                " нарушена!";
              errorDevice(msg, deviceId);
              mqttClient.sendAlarm({
                deviceId,
                time: getCurrentTime(),
                type: AlarmTypeEnum.AUTO_ALARM,
                active: alarmZones,
                message: msg,
              });
              done(new Error(msg));
            } else if (zones.filter((item) => item === 1).length === 0) {
              warnDevice(
                "Автовзятие отменено так как зоны уже под охраной!",
                deviceId
              );
              if (mismatched.filter((item) => item === 1).length > 0) {
                warnDevice(
                  "Приводим в соответствие зоны которые должны быть взяты по результатам автовзятия " +
                    mismatched.join(", "),
                  deviceId
                );
                server.emit("action", {
                  action: "arm",
                  deviceId,
                  time: Date.now(),
                  zones: mismatched,
                  auto: true,
                  server: true,
                } as DeviceAction);
              }
              done();
            } else {
              logDevice(
                "Отправили команду на взятие зон " +
                  zones.join(",") +
                  " по АВТО",
                deviceId
              );
              const armResult = await server.armDevice(
                deviceId,
                "arm",
                zones,
                "auto"
              );
              warnDevice(
                "Устройство Автоматический установленно под охрану с управляющего сервера. Состояние зон: " +
                  armResult.zones.join(","),
                deviceId
              );
              done(undefined, armResult);
            }
          } catch (err: any) {
            const msg =
              "Ошибка автовзятия! Зон: " +
              data.zones.join(",") +
              " Ошибка: " +
              getErrorMsg(err);
            errorDevice(msg, deviceId);
            mqttClient.sendAlarm({
              deviceId,
              time: getCurrentTime(),
              type: AlarmTypeEnum.AUTO_ALARM,
              active: data.zones,
              message: msg,
            });
            done(new Error(msg));
          }
        }, 1000);
      } catch (err) {
        const msg = "Ошибка автовзятии: " + getErrorMsg(err);
        errorDevice(msg, deviceId);
        mqttClient.sendAlarm({
          deviceId,
          time: getCurrentTime(),
          type: AlarmTypeEnum.AUTO_ALARM,
          active: data.zones,
          message: msg,
        });
        done(new Error(msg));
        return;
      }
      break;
    case QueueCommandEnum.AUTO_DISARM:
      warnDevice(
        "Получено задание на автоснятие зон " + data.zones.join(","),
        deviceId
      );
      if (config.SYSTEM === "Mirazh") {
        const state = await redisClient.getDeviceState(deviceId);
        if (!state) {
          errorDevice(
            "Отсутствует состояние устройства в кэше. Задача на автоснятие отменена.",
            deviceId
          );
          break;
        }
        const newZones = new Array(data.zones.length).fill(0);
        for (let x = 0; x < data.zones.length; x++) {
          if (data.zones[x] === 1) {
            newZones[x] = 0;
          } else {
            newZones[x] = state.zones[x];
          }
        }
        if (newZones.join(",") === state.zones.join(",")) {
          warnDevice("Автоснятие отменено, так как зоны уже сняты", deviceId);
          break;
        }
        const time = getCurrentTime(state.time);
        const newState = {
          time,
          arm: getArmFromZones(newZones),
          active: state.active,
          mismatched: state.mismatched,
          zones: newZones,
        };
        setDeviceState(deviceId, newState);
        mqttClient.sendDeviceState({
          ...newState,
          deviceId: deviceId,
        });
        mqttClient.sendAction({
          action: "disarm",
          deviceId,
          time,
          auto: true,
          server: true,
          zones: data.zones,
        });
        warnDevice(
          "Автоснятие зон " +
            data.zones.join(",") +
            " было сделано в БД. Команда на устройство не было отправлено",
          deviceId
        );
      } else {
        try {
          const disarmResult = await server.armDevice(
            deviceId,
            "disarm",
            data.zones,
            "auto"
          );
          warnDevice(
            "Устройство Автоматический снято с охраны с управляющего сервера. Состояние зон: " +
              disarmResult.zones.join(","),
            deviceId
          );
          done(undefined, disarmResult);
          return;
        } catch (err) {
          const msg = "Ошибка при автоснятии: " + getErrorMsg(err);
          errorDevice(msg, deviceId);
          done(new Error(msg));
          return;
        }
      }
      break;
    default:
      break;
  }
  done();
});

const checkTestJob = async (
  newState: DeviceStateMqtt,
  deviceId: number,
  interval?: number
) => {
  let intervalVal = interval;
  if (!interval) {
    const deviceConfig = await redisClient.getDeviceConfig(deviceId);
    if (!deviceConfig) {
      error("Для устройства " + deviceId + " нет настроек.");
      return;
    } else {
      intervalVal = deviceConfig.interval;
    }
  }
  if (newState.arm === 1) {
    const result = await queue.startRepeatedTest(
      deviceId,
      intervalVal as number
    );
    if (result) {
      logDevice("Установили задание на переодическое тестирование", deviceId);
    }
  } else {
    const result = await queue.deleteRepeatedJob(deviceId);
    if (result) {
      logDevice("Сняли задание на переодическое тестирование", deviceId);
    }
  }
};

const parseDeviceId = (deviceId: string | number): number => {
  return typeof deviceId === "string" ? Number.parseInt(deviceId) : deviceId;
};

process.on("uncaughtException", (err) => {
  error("Неожиданная ошибка: " + err);
});

process.on("unhandledRejection", (err) => {
  error("Неожиданный отказ: " + err);
});
