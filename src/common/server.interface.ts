export enum QueueCommandEnum {
  TEST = "test",
  AUTO_ARM = "autoArm",
  AUTO_DISARM = "autoDisarm",
}

export interface DevicePowerStatus {
  battery: boolean;
  ac: boolean;
}

export interface QueueCommandInterface {
  cmd: QueueCommandEnum;
}

export interface QueueTestCommand extends QueueCommandInterface {
  cmd: QueueCommandEnum.TEST;
  deviceId: number;
  alarm?: boolean;
}

export interface QueueAutoArmCommand extends QueueCommandInterface {
  cmd: QueueCommandEnum.AUTO_ARM;
  deviceId: number;
  zones: Array<0 | 1>;
  alarm?: boolean;
}

export interface QueueAutoDisarmCommand extends QueueCommandInterface {
  cmd: QueueCommandEnum.AUTO_DISARM;
  deviceId: number;
  zones: Array<0 | 1>;
}

export type QueueCommand =
  | QueueAutoArmCommand
  | QueueAutoDisarmCommand
  | QueueTestCommand;

export enum AlarmTypeEnum {
  NO_ANSWER = 0, // Нет ответа
  BATTERY = 1, // Низкий заряд акк
  ACTIVE = 2, // Шлейфовая
  ARM_TIME = 3, // Не взятие вовремя
  UNAUTHRORIZED_USER = 4, // Неавторизованный пользователь
  ARM_PERIOD = 5, // Снятие в периода контроля постановки
  AUTO_ALARM = 7, // Нарушена зона при автовзятии
  MANUAL = 8, // Операторская тревога
  MISSMATCH = 10, // Несоответствие зон
  DISARM = 11, // Снятие под принуждением
}

export class DeviceStatusMqtt {
  status!: number;
  time!: number;
}

export class DeviceStateMqtt {
  arm!: 1 | 0;
  time!: number;
  zones!: Array<1 | 0>;
  active!: Array<1 | 0>;
  mismatched!: Array<1 | 0>;
}

export class DeviceAlarmMqtt {
  time!: number;
  active?: Array<1 | 0>;
  type!: AlarmTypeEnum;
  message?: string;
  user?: number;
  server?: 1 | 0;
}

export class DeviceActionMqtt {
  time!: number;
  action!: "arm" | "disarm" | "alarm" | "disalarm";
  userId?: number;
  id?: string | number;
  zones!: Array<1 | 0>;
  server?: boolean;
  mobile?: boolean;
  auto?: boolean;
}

export class DeviceDBMqtt {
  time!: number;
  liter!: string;
  krt!: number;
  n!: number[];
  rmds!: Array<Array<number>>;
}

export interface GatewaySettings {
  krt: number;
  literPrefix: number;
  literPrefixStart: number;
  literPrefixEnd: number;
  dbAddress: string;
  dbPort: number;
  dbPath: string;
  dbUsername: string;
  dbPassword: string;
}

export class DeviceLockMqtt {
  id?: string;
  liter!: number;
  time!: number;
  timeout?: number;
  active!: boolean;
  userId?: number;
  userIdNew?: string;
  reason?: string;
  rmoId?: number;
  server?: 1 | 0;
}

export class DeviceStatus extends DeviceStatusMqtt {
  deviceId!: number | string;
}

export class DeviceState extends DeviceStateMqtt {
  deviceId!: number | string;
  // mismatched!: undefined;
}

export class DeviceAlarm extends DeviceAlarmMqtt {
  deviceId!: number | string;
}

export class DeviceAction extends DeviceActionMqtt {
  deviceId!: number | string;
}

export declare interface ServerInterface {
  gatewayStatus: boolean;

  on(event: string, listener: Function): this;
  once(event: string, listener: Function): this;
  emit(event: string, ...args: any): boolean;
  prependListener(event: string, listener: Function): this;
  prependOnceListener(event: string, listener: Function): this;
  addListener(event: string, listener: Function): this;

  on(event: "gatewayStatus", listener: (connectStatus: boolean) => void): this;
  once(
    event: "gatewayStatus",
    listener: (connectStatus: boolean) => void
  ): this;
  emit(event: "gatewayStatus", connectStatus: boolean): boolean;
  prependListener(
    event: "gatewayStatus",
    listener: (connectStatus: boolean) => void
  ): this;
  prependOnceListener(
    event: "gatewayStatus",
    listener: (connectStatus: boolean) => void
  ): this;
  addListener(
    event: "gatewayStatus",
    listener: (connectStatus: boolean) => void
  ): this;

  on(event: "deviceStatus", listener: (update: DeviceStatus) => void): this;
  once(event: "deviceStatus", listener: (update: DeviceStatus) => void): this;
  emit(event: "deviceStatus", update: DeviceStatus): boolean;
  prependListener(
    event: "deviceStatus",
    listener: (update: DeviceStatus) => void
  ): this;
  prependOnceListener(
    event: "deviceStatus",
    listener: (update: DeviceStatus) => void
  ): this;
  addListener(
    event: "deviceStatus",
    listener: (update: DeviceStatus) => void
  ): this;

  on(event: "deviceState", listener: (state: DeviceState) => void): this;
  once(event: "deviceState", listener: (state: DeviceState) => void): this;
  emit(event: "deviceState", state: DeviceState): boolean;
  prependListener(
    event: "deviceState",
    listener: (state: DeviceState) => void
  ): this;
  prependOnceListener(
    event: "deviceState",
    listener: (state: DeviceState) => void
  ): this;
  addListener(
    event: "deviceState",
    listener: (state: DeviceState) => void
  ): this;

  on(event: "alarm", listener: (alarm: DeviceAlarm) => void): this;
  once(event: "alarm", listener: (alarm: DeviceAlarm) => void): this;
  emit(event: "alarm", alarm: DeviceAlarm): boolean;
  prependListener(event: "alarm", listener: (alarm: DeviceAlarm) => void): this;
  prependOnceListener(
    event: "alarm",
    listener: (alarm: DeviceAlarm) => void
  ): this;
  addListener(event: "alarm", listener: (alarm: DeviceAlarm) => void): this;

  on(event: "action", listener: (action: DeviceAction) => void): this;
  once(event: "action", listener: (action: DeviceAction) => void): this;
  emit(event: "action", action: DeviceAction): boolean;
  prependListener(
    event: "action",
    listener: (action: DeviceAction) => void
  ): this;
  prependOnceListener(
    event: "action",
    listener: (action: DeviceAction) => void
  ): this;
  addListener(event: "action", listener: (action: DeviceAction) => void): this;

  testDevice(deviceId: number): Promise<DeviceState | undefined>;
  armDevice(
    deviceId: number,
    cmd: "arm" | "disarm",
    zones: Array<1 | 0>,
    userId: number | "auto",
    dbMode?: boolean,
    userName?: string
  ): Promise<{ arm: 1 | 0; zones: Array<1 | 0> }>;
}
