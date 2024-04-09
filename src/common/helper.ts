import { Topic } from "./dto";
import * as win1251 from "windows-1251";

export const parseTopic = (topic: string, error: any): Topic => {
  const parts = topic.split("/");
  if (parts.length < 5 || parts.length > 6) {
    error("Не удалось разбить тему. Некорректный формат темы. Тема: " + topic);
    throw new Error(
      "topic should have at least 5 parts. Received topic: " + topic
    );
  }
  const result: Topic = {
    initial: topic,
    id: `${parts[0]}-${parts[1]}-${parts[2]}-${parts[4]}${
      parts.length === 6 ? "-" + parts[5] : ""
    }`,
    namespace: parts[0],
    system: parts[1],
    region: parts[2],
    command: parts[3],
    gatewayId: parts[4],
    deviceId: parts.length === 6 ? parts[5] : undefined,
  };
  return result;
};

export const getCurrentTime = (prevDate?: number): number => {
  const now = Date.now();
  if (prevDate && prevDate > now) {
    return prevDate + 1;
  }
  return now;
};

export const jsonToObject = (message: string, error: (msg: string) => void) => {
  if (message === "") {
    return;
  }
  try {
    return JSON.parse(message);
  } catch (err) {
    error(
      "Не удалось преобразовать сообщение из формата JSON. Сообщение: " +
        message +
        " Ошибка: " +
        err
    );
    return;
  }
};

export const getBitFromZones = (zones?: number[]): number | undefined => {
  if (!zones) {
    return;
  }
  let result = 0;
  for (let x = 0; x < zones.length; x++) {
    if (zones[x] === 1) {
      result = result | (1 << x);
    }
  }
  return result;
};

export const getZonesFromBitReversed = (
  bit: number,
  maxZones = 8
): Array<1 | 0> => {
  let results: Array<1 | 0> = new Array(maxZones).fill(0);
  for (let x = 0; x < maxZones; x++) {
    if ((bit & (1 << x)) > 0) {
      results[maxZones - x - 1] = 1;
    }
  }
  return results;
};

export const getZonesFromBit = (
  bit: number,
  reverse = false,
  maxZones = 8
): Array<1 | 0> => {
  let results: Array<1 | 0> = [];
  for (let x = 0; x < maxZones; x++) {
    if ((bit & (1 << x)) > 0) {
      results.push(reverse ? 0 : 1);
    } else {
      results.push(reverse ? 1 : 0);
    }
  }
  return results;
};

export const bufferPrint = (buffer: Buffer | undefined): string => {
  if (buffer === undefined) {
    return "[undefined Buffer]";
  }
  return (
    "[" +
    [...buffer]
      .map((item) =>
        item < 16 ? "0x0" + item.toString(16) : "0x" + item.toString(16)
      )
      .join(", ") +
    "]"
  );
};

export const printZones = (zones: Array<1 | 0> | undefined): string => {
  if (zones === undefined) {
    return "[зоны не указаны]";
  }
  const zoneNumbers = zones
    .map((value, index) => {
      if (value === 1) {
        return index + 1;
      } else {
        return -1;
      }
    })
    .filter((item) => item > 0);
  return zoneNumbers.length > 0 ? zoneNumbers.join(",") : "[нет зон]";
};

export const getErrorMsg = (err: any): string => {
  // console.log("getErrorMsg",err)
  let errors = [];
  if (err) {
    if (typeof err === "string") {
      errors.push(err);
    }
    if (err.name) {
      errors.push(err.name);
    }
    if (err.message) {
      errors.push(err.message);
    }
  }
  return errors && errors.length > 0 ? errors.join(": ") : "Неизвестная ошибка";
};

export const getArmFromZones = (zones: Array<1 | 0>): 1 | 0 => {
  return zones.includes(1) ? 1 : 0;
};

export const getCronFromSeconds = (
  seconds: number,
  weekday: number
): string => {
  const hours = Math.floor(seconds / 3600);
  const min = Math.floor((seconds / 60) % 60);
  return `${min} ${hours} * * ${weekday + 1}`;
};

export const getStringWin1251 = (
  buffer: Buffer,
  setNull = false
): string | undefined | null => {
  if (typeof buffer === "string") {
    return buffer;
  }
  if (buffer && buffer.length > 0) {
    return (win1251.decode(buffer.toString("binary")) as string).trim();
  } else {
    if (setNull) {
      return null;
    }
    return;
  }
};

export const prepareString = <T extends Record<string, any>>(
  query: T[]
): T[] => {
  if (!query) {
    return query;
  }
  return query.map((item) => {
    const result: any = {};
    for (const key of Object.keys(item)) {
      const value = (item as any)[key];
      result[key] = Buffer.isBuffer(value) ? getStringWin1251(value) : value;
    }
    return result;
  });
};

export const textToWin1251 = (text: string) => {
  if (text) {
    return Buffer.from([...Buffer.from(win1251.encode(text))]);
  }
  return Buffer.from([]);
};

export const extractSMSCategory = (
  R: number
): { alarm?: number; arm?: number; disarm?: number } | undefined => {
  if (R === 0) {
    return undefined;
  }
  const str = R.toString(16);
  let numberArr: number[] = [];
  for (let x = 0; x < str.length; x += 2) {
    numberArr.push(
      Number.parseInt(str.substring(str.length - 2 - x, str.length - x))
    );
  }
  const arrLength = numberArr.length;
  const result = {
    alarm:
      arrLength > 0 && numberArr[0] !== 0 && numberArr[0] !== 1
        ? numberArr[0]
        : undefined,
    arm:
      arrLength > 1 && numberArr[1] !== 0 && numberArr[1] !== 2
        ? numberArr[1]
        : undefined,
    disarm:
      arrLength > 2 && numberArr[2] !== 0 && numberArr[2] !== 3
        ? numberArr[2]
        : undefined,
  };

  if (
    (!result.alarm || result.alarm === 1) &&
    (!result.arm || result.arm === 2) &&
    (!result.disarm || result.disarm === 3)
  ) {
    return undefined;
  }
  return result;
};

export const extractAddress = (info: {
  address: string;
  port: number;
}): string => {
  return `${info.address}:${info.port}`;
};
