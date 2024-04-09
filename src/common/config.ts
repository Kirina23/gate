import * as fs from "fs";
import * as path from "path";

export interface ConfigParamsCommon {
  time: number;
  NAMESPACE: string;
  SYSTEM: "Proton" | "Mirazh" | "Surgard" | "Tandem";
  GATEWAY_ID: string;
  REGION: string;
  MQTT_USERNAME: string;
  MQTT_PASSWORD: string;
  MQTT_SERVERS: Array<{
    host: string;
    port: number;
    protocol?: "wss" | "ws" | "mqtt" | "mqtts" | "tcp" | "ssl" | "wx" | "wxs";
  }>;
  REDIS_HOST: string;
  REDIS_PORT: number;
  CONNECTION_PORT: number;
  CONNECTION_HOST: string;
  RECONNECT_PERIOD: number;
  REQUEST_TIMEOUT: number;
  REQUEST_RETRY: number;
  REQUEST_ATTEMPTS: number;
  DEFAULT_INTERVAL_MS: number;
  GATEWAY_STATUS_PERIOD: number;
  DEBUG: boolean;
}

export interface ConfigParamsMiraj extends ConfigParamsCommon {
  SYSTEM: "Mirazh";
  POSTGRES_HOST: string;
  POSTGRES_PORT: number;
  POSTGRES_DB: string;
  POSTGRES_USER: string;
  POSTGRES_PASSWORD: string;
}

export interface ConfigParamsProton extends ConfigParamsCommon {
  SYSTEM: "Proton";
  SYSTEM_NUMBER: number;
}

export interface ConfigParamsAIUSO extends ConfigParamsCommon {
  SYSTEM: "Tandem";
  KRT: number;
  RMO_ID: number;
  UDP_PORT: number;
  DB_LOG_PATH: string;
}

export interface ConfigParamsOther extends ConfigParamsCommon {
  SYSTEM: "Surgard";
}

export type ConfigParams =
  | ConfigParamsOther
  | ConfigParamsMiraj
  | ConfigParamsProton
  | ConfigParamsAIUSO;

export const CONFIG_PATH = path.resolve(__dirname, "../../config.json");
const configPayload = fs.readFileSync(CONFIG_PATH).toString();
console.log("configPayload", configPayload);
export let config: ConfigParams = {
  NAMESPACE: "Test",
  SYSTEM: "Mirazh",
  GATEWAY_ID: "1",
  REGION: "ALA",
  MQTT_USERNAME: "",
  MQTT_PASSWORD: "",
  MQTT_SERVERS: [
    {
      host: "10.10.17.5",
      port: "1883",
      protocol: "mqtt",
    },
  ],
  REDIS_HOST: "127.0.0.1",
  REDIS_PORT: 6379,
  CONNECTION_PORT: 3333,
  CONNECTION_HOST: "10.10.17.5",
  RECONNECT_PERIOD: 1000,
  REQUEST_TIMEOUT: 45000,
  REQUEST_RETRY: 1000,
  REQUEST_ATTEMPTS: 3,
  SYSTEM_NUMBER: 1,
  DEFAULT_INTERVAL_MS: 2 * 3600 * 1000,
  POSTGRES_DB: "mgs",
  POSTGRES_HOST: "10.10.17.234",
  POSTGRES_PORT: 5432,
  POSTGRES_USER: "root",
  POSTGRES_PASSWORD: "root",
  UDP_PORT: 1200,
  DB_LOG_PATH: "F:\\test\\A1.GDB",
  ...JSON.parse(configPayload),
};

export const isAUISO = config.SYSTEM === "Tandem";

export const SUBSCRIBE_TO_ALL_REGIONS =
  process.env.SUBSCRIBE_TO_ALL_REGIONS === "true" || !isAUISO;

export const writeConfig = async (newConfig: ConfigParams) => {
  config = {
    ...config,
    ...newConfig,
  };
  return new Promise((resolve, reject) => {
    fs.writeFile(CONFIG_PATH, JSON.stringify(newConfig, null, 4), (err) => {
      if (err) {
        reject("Ошибка при записи новых настроек: " + err.message);
      } else {
        resolve(true);
      }
    });
  });
};
