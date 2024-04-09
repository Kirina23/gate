export enum RadioDeviceScheduleType {
  TIMER,
  NONSTOP,
  IGNORE,
}
export class RadioDeviceSchedule {
  type!: RadioDeviceScheduleType;
  startTimeSec?: number;
  endTimeSec?: number;
}

export class RadioDeviceArmControl {
  auto!: boolean;
  armControl!: boolean;
  disarmControl!: boolean;
  armAlarm!: boolean;
  schedule!: RadioDeviceSchedule[];
}

export class ForbiddenDay {
  weekdays!: number[];
  zones!: number[];
  users?: number[];
  from!: string;
  to!: string;
}

export class DeviceConfigMqtt {
  time!: number;
  interval!: number;
  region!: string;
  // relay!: number;
  // secondRelay!: number;
  // otherRelays!: number[];
  allowedUsers!: number[];
  forbiddenDays!: ForbiddenDay[];
  armControlSetting!: RadioDeviceArmControl[];
}

export class Topic {
  id!: string;
  initial!: string;
  namespace!: string;
  system!: string;
  region!: string;
  command!: string;
  gatewayId!: string;
  deviceId?: string;
}
