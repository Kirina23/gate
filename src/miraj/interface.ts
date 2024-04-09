export interface MirajDBStateEvent {
  deviceId: number;
  zoneNumber: number;
  arm: boolean;
  alarm: boolean;
  active: boolean;
  time: number;
}

export interface MirajEventDb {
  event_id: number;
  device_id: number;
  object_id: number;
  object_group_id: number;
  event_time: Date;
  event_type: number;
  event_subtype: number;
  source_type: number;
  source_id: number;
  channel_id: number;
  object_state: number;
  object_state_change: number;
  message_id: number;
  device_number: number;
  partition_number: number;
  object_number: number;
  sensor_number: number;
  pin_number: number;
  key_number: number;
  info: string;
  event_data_size: number;
  event_data?: string | Buffer;
  server_id: number;
  device_addr: number;
  event_create_time: Date;
  channel_net: number;
  shift_id: number;
}

export const MirajZoneState = [
  { id: 0, text: "-----------", active: false, arm: false, alarm: false },
  {
    id: 1,
    text: "Снят, короткое замыкание",
    active: true,
    arm: false,
    alarm: false,
  },
  { id: 2, text: "Снят, обрыв", active: true, arm: false, alarm: false },
  { id: 3, text: "Норма", active: false, arm: false, alarm: false },
  { id: 4, text: "Тревога", active: true, arm: true, alarm: true },
  {
    id: 5,
    text: "Тревога, короткое замыкание",
    active: true,
    arm: true,
    alarm: true,
  },
  { id: 6, text: "Тревога, обрыв", active: true, arm: true, alarm: true },
  {
    id: 7,
    text: "Тревога, готов к постановке",
    active: false,
    arm: true,
    alarm: true,
  },
  {
    id: 8,
    text: "Снят, готов к постановке",
    active: false,
    arm: false,
    alarm: false,
  },
  { id: 9, text: "На охране, норма", active: false, arm: true, alarm: false },
  {
    id: 10,
    text: "Неисправность пожарного ШС",
    active: true,
    arm: true,
    alarm: true,
  },
  {
    id: 11,
    text: "Внимание пожарного ШС",
    active: true,
    arm: true,
    alarm: true,
  },
  { id: 12, text: "Пожар", active: true, arm: true, alarm: true },
  { id: 13, text: "Неисправность ШС", active: true, arm: true, alarm: true },
  {
    id: 14,
    text: "Задержка постановки",
    active: false,
    arm: false,
    alarm: false,
  },
  { id: 15, text: "Снят с охраны", active: false, arm: false, alarm: false },
  {
    id: 16,
    text: "Норма, технол. ШС",
    active: false,
    arm: false,
    alarm: false,
  },
  { id: 17, text: "Тревога, технол. ШС", active: true, arm: true, alarm: true },
  {
    id: 18,
    text: "Норма, после Внимание",
    active: false,
    arm: false,
    alarm: false,
  },
  {
    id: 19,
    text: "Норма, после Пожар",
    active: false,
    arm: false,
    alarm: false,
  },
  {
    id: 20,
    text: "Тревога проходной зоны",
    active: true,
    arm: true,
    alarm: true,
  },
  {
    id: 21,
    text: "Тревога, тревожная кнопка",
    active: true,
    arm: true,
    alarm: true,
  },
  {
    id: 22,
    text: "Норма, тревожная кнопка",
    active: false,
    arm: true,
    alarm: false,
  },
  {
    id: 23,
    text: "Тревога, утечка воды",
    active: true,
    arm: true,
    alarm: true,
  },
  {
    id: 24,
    text: "Норма, утечка воды",
    active: false,
    arm: true,
    alarm: false,
  },
  {
    id: 25,
    text: "Тревога, утечка газа",
    active: true,
    arm: true,
    alarm: true,
  },
  {
    id: 26,
    text: "Норма, утечка газа",
    active: false,
    arm: true,
    alarm: false,
  },
  {
    id: 27,
    text: "Тихая тревога, короткое замыкание",
    active: true,
    arm: true,
    alarm: true,
  },
  {
    id: 28,
    text: "Тихая тревога, обрыв",
    active: true,
    arm: true,
    alarm: true,
  },
  { id: 29, text: "Тихая тревога", active: true, arm: true, alarm: true },
  { id: 30, text: "Пожар 1", active: true, arm: true, alarm: true },
  { id: 31, text: "Пожар 2", active: true, arm: true, alarm: true },
  {
    id: 32,
    text: "Норма, после Пожар 1",
    active: false,
    arm: true,
    alarm: false,
  },
  {
    id: 33,
    text: "Норма, после Пожар 2",
    active: false,
    arm: true,
    alarm: false,
  },
  {
    id: 34,
    text: "Тихая тревога, тревожная кнопка",
    active: false,
    arm: true,
    alarm: true,
  },
  {
    id: 35,
    text: "КТС не восстановлена после теста",
    active: false,
    arm: true,
    alarm: false,
  },
  {
    id: 36,
    text: "Тревога, аварийный датчик",
    active: true,
    arm: true,
    alarm: true,
  },
  {
    id: 37,
    text: "Норма, аварийный датчик",
    active: false,
    arm: true,
    alarm: false,
  },
];

export const MirajCMD = [
  { id: 0, text: "Не определена" },
  { id: 1, text: "Обработать" },
  { id: 2, text: "Включение" },
  { id: 3, text: "Выключение" },
  { id: 4, text: "Обновить" },
  { id: 5, text: "Перевзять" },
  { id: 6, text: "Сброс пожарных тревог и неисправностей" },
  { id: 7, text: "Сброс тревог" },
  { id: 8, text: "Заблокировать постановку" },
  { id: 9, text: "Разблокировать постановку" },
  { id: 10, text: "Запрос реагирования" },
  { id: 11, text: "Закончен поиск удалённого ключа" },
  { id: 12, text: "Снятие с охраны" },
  { id: 13, text: "Постановка на охрану" },
  { id: 14, text: "Тест КТС" },
  { id: 15, text: "Отмена реагирования" },
];

export const MirajZoneType = [
  { id: 0, text: "Не задан" },
  { id: 1, text: "Периметр" },
  { id: 2, text: "Объемный" },
  { id: 3, text: "Пожарный дымовой" },
  { id: 4, text: "Тревожная кнопка" },
  { id: 5, text: "Технологический" },
  { id: 6, text: "Пожарный тепловой" },
  { id: 7, text: "Пожарный ручной" },
  { id: 8, text: "Входная зона" },
  { id: 9, text: "Штора" },
  { id: 10, text: "Разбитие стекла" },
  { id: 11, text: "Видеокамера" },
  { id: 12, text: "Видеокамера" },
  { id: 13, text: "Видеокамера" },
  { id: 14, text: "Видеокамера" },
  { id: 15, text: "Видеокамера" },
  { id: 16, text: "Видеокамера" },
  { id: 17, text: "Видеокамера" },
  { id: 18, text: "Видеокамера" },
];

export const MirajCMDResult = [
  { id: 0, text: "Нет ошибок" },
  { id: 1, text: "Неизвестная комманда" },
  { id: 2, text: "Не отвечает устройство на интерфейсе" },
  { id: 3, text: "Устройство не записано в конфигурации" },
  { id: 4, text: "Реле не записано в конфигурации" },
  { id: 5, text: "Номер реле вне допустимого диапазона" },
  { id: 6, text: "Реле сконфигурировано не как удаленное управление" },
  { id: 7, text: "Команда выполняется" },
  { id: 8, text: "Раздел не существует" },
  { id: 9, text: "Прибор не в режиме диагностики" },
  { id: 10, text: "Данных в команде больше, чем требуется" },
  { id: 11, text: "Данных в команде меньше, чем требуется" },
  { id: 12, text: "Неверный формат данных" },
  { id: 13, text: "Насос уже включен" },
  { id: 14, text: "Насос уже выключен" },
  { id: 15, text: "Отстутствует фаза" },
  { id: 16, text: "Отстутствует давление" },
  { id: 17, text: "Команда не поддерживается" },
  { id: 18, text: "Адрес назначения не совпадает с локальным адресом" },
  { id: 19, text: "Невозможно открыть канал" },
  { id: 20, text: "Невозможно закрыть канал" },
  { id: 21, text: "Невозможно передать данные в канал" },
  { id: 22, text: "Ошибка инициализации сети" },
  { id: 23, text: "Отсутствует интерфейс" },
  { id: 24, text: "Неверный идентификатор интерфейса" },
  { id: 25, text: "Операция не поддерживается" },
  { id: 26, text: "Нехватка динамической памяти" },
  { id: 27, text: "Неверный идентификатор" },
  { id: 28, text: "Неизвестный параметр" },
  { id: 29, text: "Неизвестный режим энергопотребления" },
  { id: 30, text: "Ошибка выполнения" },
  { id: 31, text: "Неизвестная конфигурация" },
  { id: 32, text: "Неизвестная операция" },
  { id: 33, text: "Неподдерживаемый тип памяти" },
  { id: 34, text: "Не верный идентификатор" },
  { id: 35, text: "Устройство занято" },
  { id: 36, text: "Устройство не отвечает" },
  { id: 255, text: "Результат неопределен" },
];
