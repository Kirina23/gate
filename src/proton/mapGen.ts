import * as fs from "fs";

const map = [
  {
    codeevent_proton: 13,
    codeevent_uarm: 13,
    description: " Доставка команды   Тест канала связи ",
  },
  {
    codeevent_proton: 14,
    codeevent_uarm: 14,
    description: " Доставка команды   Включить выход прибора ",
  },
  {
    codeevent_proton: 1038,
    codeevent_uarm: 1038,
    description: " Доставка команды   Отключить выход прибора ",
  },
  {
    codeevent_proton: 18,
    codeevent_uarm: 18,
    description: " Доставка команды   Снять прибор с охраны (по GSM-каналу) ",
  },
  {
    codeevent_proton: 1042,
    codeevent_uarm: 1042,
    description: " Доставка команды   Взять прибор под охрану (по GSM-каналу) ",
  },
  {
    codeevent_proton: 19,
    codeevent_uarm: 19,
    description: " Доставка команды   Снять шлейф с охраны ",
  },
  {
    codeevent_proton: 1043,
    codeevent_uarm: 1043,
    description: " Доставка команды   Взять шлейф под охрану ",
  },
  {
    codeevent_proton: 20,
    codeevent_uarm: 20,
    description: " Доставка команды   Снять прибор с охраны (по р/каналу) ",
  },
  {
    codeevent_proton: 1044,
    codeevent_uarm: 1044,
    description: " Доставка команды   Взять прибор под охрану (по р/каналу) ",
  },
  {
    codeevent_proton: 21,
    codeevent_uarm: 21,
    description: " Доставка команды   Снять шлейфы с охраны",
  },
  {
    codeevent_proton: 1045,
    codeevent_uarm: 1045,
    description: " Доставка команды   Взять шлейфы под охрану ",
  },
  {
    codeevent_proton: 22,
    codeevent_uarm: 22,
    description: " Доставка команды   Запрос параметров ШС  (по GSM-каналу) ",
  },
  {
    codeevent_proton: 23,
    codeevent_uarm: 23,
    description:
      " Доставка команды   Запрос параметров прибора (по GSM-каналу) ",
  },
  {
    codeevent_proton: 24,
    codeevent_uarm: 24,
    description: " Доставка команды   Запрос записи журнала событий ",
  },
  {
    codeevent_proton: 25,
    codeevent_uarm: 25,
    description: " Доставка команды   Запрос типа установленного прибора ",
  },
  {
    codeevent_proton: 26,
    codeevent_uarm: 26,
    description: " Доставка команды   Включить речевое оповещение ",
  },
  {
    codeevent_proton: 1050,
    codeevent_uarm: 1050,
    description: " Доставка команды   Отключить речевое оповещение ",
  },
  {
    codeevent_proton: 27,
    codeevent_uarm: 27,
    description: " Доставка команды   Включить сирену ",
  },
  {
    codeevent_proton: 1051,
    codeevent_uarm: 1051,
    description: " Доставка команды   Отключить сирену ",
  },
  {
    codeevent_proton: 28,
    codeevent_uarm: 28,
    description: " Доставка команды   Запрос уровня сигнала по радиоканалу ",
  },
  {
    codeevent_proton: 1052,
    codeevent_uarm: 1052,
    description: " Ответ на команду   Запрос уровня сигнала по радиоканалу ",
  },
  {
    codeevent_proton: 29,
    codeevent_uarm: 29,
    description: " Доставка команды   Запрос версии прибора ",
  },
  {
    codeevent_proton: 1053,
    codeevent_uarm: 1053,
    description: " Ответ на команду   Запрос версии прибора ",
  },
  {
    codeevent_proton: 30,
    codeevent_uarm: 30,
    description: " Доставка команды   Блокировка объекта ",
  },
  {
    codeevent_proton: 1054,
    codeevent_uarm: 1054,
    description: " Ответ на команду   Блокировка объекта ",
  },
  {
    codeevent_proton: 31,
    codeevent_uarm: 31,
    description: " Доставка команды   Разблокировка объекта ",
  },
  {
    codeevent_proton: 1055,
    codeevent_uarm: 1055,
    description: " Ответ на команду   Разблокировка объекта ",
  },
  {
    codeevent_proton: 32,
    codeevent_uarm: 32,
    description: " Доставка команды   Удаление пользователя ",
  },
  {
    codeevent_proton: 1056,
    codeevent_uarm: 1056,
    description: " Ответ на команду   Удаление пользователя ",
  },
  {
    codeevent_proton: 33,
    codeevent_uarm: 33,
    description: " Доставка команды   Трансляция с микрофона ",
  },
  {
    codeevent_proton: 34,
    codeevent_uarm: 34,
    description: " Доставка команды   Включить FM-радио   ",
  },
  {
    codeevent_proton: 35,
    codeevent_uarm: 35,
    description: " Доставка команды   Обновить файлы ",
  },
  {
    codeevent_proton: 50,
    codeevent_uarm: 50,
    description: " Доставка команды   Запрос состояния объекта ",
  },
  {
    codeevent_proton: 1074,
    codeevent_uarm: 1074,
    description: " Ответ на команду   Запрос состояния объекта ",
  },
  {
    codeevent_proton: 51,
    codeevent_uarm: 51,
    description: " Доставка команды   Запрос состояния питания ",
  },
  {
    codeevent_proton: 1075,
    codeevent_uarm: 1075,
    description: " Ответ на команду   Запрос состояния питания ",
  },
  {
    codeevent_proton: 52,
    codeevent_uarm: 52,
    description: " Доставка команды   Запрос состояния раздела ",
  },
  {
    codeevent_proton: 1076,
    codeevent_uarm: 1076,
    description: " Ответ на команду   Запрос состояния раздела ",
  },
  {
    codeevent_proton: 53,
    codeevent_uarm: 53,
    description: " Доставка команды   Запрос состояния типа взятия/снятия ",
  },
  {
    codeevent_proton: 1077,
    codeevent_uarm: 1077,
    description: " Ответ на команду   Запрос состояния  типа взятия/снятия ",
  },
  {
    codeevent_proton: 54,
    codeevent_uarm: 54,
    description: " Доставка команды   Запрос состояния ШС ",
  },
  {
    codeevent_proton: 1078,
    codeevent_uarm: 1078,
    description: " Ответ на команду   Запрос состояния ШС ",
  },
  {
    codeevent_proton: 55,
    codeevent_uarm: 55,
    description: " Доставка команды   Запрос состояния ШС ",
  },
  {
    codeevent_proton: 1079,
    codeevent_uarm: 1079,
    description: " Ответ на команду   Запрос состояния ШС ",
  },
  {
    codeevent_proton: 56,
    codeevent_uarm: 56,
    description: " Доставка команды   Запрос состояния ШС ",
  },
  {
    codeevent_proton: 1080,
    codeevent_uarm: 1080,
    description: " Ответ на команду   Запрос состояния ШС ",
  },
  {
    codeevent_proton: 57,
    codeevent_uarm: 57,
    description: " Доставка команды   Запрос состояния ШС ",
  },
  {
    codeevent_proton: 1081,
    codeevent_uarm: 1081,
    description: " Ответ на команду   Запрос состояния ШС ",
  },
  {
    codeevent_proton: 58,
    codeevent_uarm: 58,
    description: " Доставка команды   Запрос состояния ШС ",
  },
  {
    codeevent_proton: 1082,
    codeevent_uarm: 1082,
    description: " Ответ на команду   Запрос состояния ШС ",
  },
  {
    codeevent_proton: 58,
    codeevent_uarm: 58,
    description: " Доставка команды   Запрос состояния ШС ",
  },
  {
    codeevent_proton: 1083,
    codeevent_uarm: 1083,
    description: " Ответ на команду   Запрос состояния ШС ",
  },
  {
    codeevent_proton: 60,
    codeevent_uarm: 60,
    description: " Доставка команды   Запрос состояния ШС ",
  },
  {
    codeevent_proton: 1084,
    codeevent_uarm: 1084,
    description: " Ответ на команду   Запрос состояния ШС ",
  },
  {
    codeevent_proton: 61,
    codeevent_uarm: 61,
    description: " Доставка команды   Запрос состояния ШС ",
  },
  {
    codeevent_proton: 1085,
    codeevent_uarm: 1085,
    description: " Ответ на команду   Запрос состояния ШС ",
  },
  {
    codeevent_proton: 62,
    codeevent_uarm: 62,
    description: " Доставка команды   Запрос состояния ШС ",
  },
  {
    codeevent_proton: 1086,
    codeevent_uarm: 1086,
    description: " Ответ на команду   Запрос состояния ШС ",
  },
  {
    codeevent_proton: 63,
    codeevent_uarm: 63,
    description: " Доставка команды   Запрос состояния ШС ",
  },
  {
    codeevent_proton: 1087,
    codeevent_uarm: 1087,
    description: " Ответ на команду   Запрос состояния ШС ",
  },
  {
    codeevent_proton: 64,
    codeevent_uarm: 64,
    description: " Доставка команды   Запрос состояния ШС ",
  },
  {
    codeevent_proton: 1088,
    codeevent_uarm: 1088,
    description: " Ответ на команду   Запрос состояния ШС ",
  },
  {
    codeevent_proton: 65,
    codeevent_uarm: 65,
    description: " Доставка команды   Запрос состояния ШС ",
  },
  {
    codeevent_proton: 1089,
    codeevent_uarm: 1089,
    description: " Ответ на команду   Запрос состояния ШС ",
  },
  {
    codeevent_proton: 66,
    codeevent_uarm: 66,
    description: " Доставка команды   Запрос состояния ШС ",
  },
  {
    codeevent_proton: 1090,
    codeevent_uarm: 1090,
    description: " Ответ на команду   Запрос состояния ШС ",
  },
  {
    codeevent_proton: 67,
    codeevent_uarm: 67,
    description: " Доставка команды   Запрос состояния ШС ",
  },
  {
    codeevent_proton: 1091,
    codeevent_uarm: 1091,
    description: " Ответ на команду   Запрос состояния ШС ",
  },
  {
    codeevent_proton: 68,
    codeevent_uarm: 68,
    description: " Доставка команды   Запрос состояния ШС ",
  },
  {
    codeevent_proton: 1092,
    codeevent_uarm: 1092,
    description: " Ответ на команду   Запрос состояния ШС ",
  },
  {
    codeevent_proton: 69,
    codeevent_uarm: 69,
    description: " Доставка команды   Запрос состояния ШС ",
  },
  {
    codeevent_proton: 1093,
    codeevent_uarm: 1093,
    description: " Ответ на команду   Запрос состояния ШС ",
  },
  {
    codeevent_proton: 70,
    codeevent_uarm: 70,
    description: " Доставка команды   Запрос состояния выходов ",
  },
  {
    codeevent_proton: 1094,
    codeevent_uarm: 1094,
    description: " Ответ на команду   Запрос состояния Выходов ",
  },
  {
    codeevent_proton: 71,
    codeevent_uarm: 71,
    description: " Доставка команды   Запрос состояния выходов ",
  },
  {
    codeevent_proton: 1095,
    codeevent_uarm: 1095,
    description: " Ответ на команду   Запрос состояния Выходов ",
  },
  {
    codeevent_proton: 72,
    codeevent_uarm: 72,
    description: " Доставка команды   Запрос состояния выходов ",
  },
  {
    codeevent_proton: 1096,
    codeevent_uarm: 1096,
    description: " Ответ на команду   Запрос состояния Выходов ",
  },
  {
    codeevent_proton: 73,
    codeevent_uarm: 73,
    description: " Доставка команды   Запрос уровня шума в канале ",
  },
  {
    codeevent_proton: 1097,
    codeevent_uarm: 1097,
    description: " Ответ на команду   Запрос уровня шума в канале ",
  },
  {
    codeevent_proton: 74,
    codeevent_uarm: 74,
    description: " Доставка команды   Запрос качества сигнала ",
  },
  {
    codeevent_proton: 1098,
    codeevent_uarm: 1098,
    description: " Ответ на команду   Запрос качества сигнала ",
  },
  {
    codeevent_proton: 75,
    codeevent_uarm: 75,
    description: " Доставка команды   Запрос мощности передатчика ",
  },
  {
    codeevent_proton: 1099,
    codeevent_uarm: 1099,
    description: " Ответ на команду   Запрос мощности передатчика ",
  },
  {
    codeevent_proton: 76,
    codeevent_uarm: 76,
    description: " Доставка команды   Запрос уровня сигнала GSM ",
  },
  {
    codeevent_proton: 1100,
    codeevent_uarm: 1100,
    description: " Ответ на команду   Запрос уровня сигнала GSM ",
  },
  {
    codeevent_proton: 77,
    codeevent_uarm: 77,
    description: " Доставка команды   Запрос емкости аккумулятора ",
  },
  {
    codeevent_proton: 1101,
    codeevent_uarm: 1101,
    description: " Ответ на команду   Запрос емкости аккумулятора ",
  },
  {
    codeevent_proton: 76,
    codeevent_uarm: 76,
    description: " Доставка команды   Запрос состояния баланса ",
  },
  {
    codeevent_proton: 1102,
    codeevent_uarm: 1102,
    description: " Ответ на команду   Запрос состояния баланса ",
  },
  {
    codeevent_proton: 77,
    codeevent_uarm: 77,
    description: " Доставка команды   Запрос качества связи ",
  },
  {
    codeevent_proton: 1103,
    codeevent_uarm: 1103,
    description: " Ответ на команду   Запрос качества связи ",
  },
  {
    codeevent_proton: 100,
    codeevent_uarm: 100,
    description: "Медицинская тревога ШС",
  },
  {
    codeevent_proton: 1124,
    codeevent_uarm: 1124,
    description: "Сброс медицинской тревоги ШС",
  },
  {
    codeevent_proton: 101,
    codeevent_uarm: 101,
    description: "Нажата кнопка медицинского вызова ШС",
  },
  {
    codeevent_proton: 1125,
    codeevent_uarm: 1125,
    description: "Сброс кнопки медицинского вызова ШС",
  },
  {
    codeevent_proton: 102,
    codeevent_uarm: 102,
    description: "Не поступило медицинское сообщение ШС",
  },
  {
    codeevent_proton: 110,
    codeevent_uarm: 81,
    description: "Пожарная тревога ШС",
  },
  {
    codeevent_proton: 1134,
    codeevent_uarm: 1134,
    description: "Восстановление пожарного ШС",
  },
  {
    codeevent_proton: 111,
    codeevent_uarm: 111,
    description: "Дымовой извещатель ШС",
  },
  {
    codeevent_proton: 1135,
    codeevent_uarm: 1135,
    description: "Восстановление дымового извещателя ШС",
  },
  {
    codeevent_proton: 112,
    codeevent_uarm: 112,
    description: "Возгорание ШС",
  },
  {
    codeevent_proton: 1136,
    codeevent_uarm: 1136,
    description: "Отмена возгорания ШС",
  },
  {
    codeevent_proton: 113,
    codeevent_uarm: 113,
    description: "Прорыв воды ШС",
  },
  {
    codeevent_proton: 1137,
    codeevent_uarm: 1137,
    description: "Отмена прорыва воды ШС",
  },
  {
    codeevent_proton: 114,
    codeevent_uarm: 114,
    description: "Тепловой извещатель ШС",
  },
  {
    codeevent_proton: 1138,
    codeevent_uarm: 1138,
    description: "Восстановление теплового извещателя ШС",
  },
  {
    codeevent_proton: 115,
    codeevent_uarm: 115,
    description: "Ручной извещатель ШС",
  },
  {
    codeevent_proton: 1139,
    codeevent_uarm: 1139,
    description: "Восстановление ручного извещателя ШС",
  },
  {
    codeevent_proton: 116,
    codeevent_uarm: 116,
    description: "Тревога в трубопроводе ШС",
  },
  {
    codeevent_proton: 1140,
    codeevent_uarm: 1140,
    description: "Отмена тревоги в трубопроводе ШС",
  },
  {
    codeevent_proton: 117,
    codeevent_uarm: 117,
    description: "Извещатель пламени ШС",
  },
  {
    codeevent_proton: 1141,
    codeevent_uarm: 1141,
    description: "Восстановление извещателя пламени ШС",
  },
  {
    codeevent_proton: 118,
    codeevent_uarm: 118,
    description: "Внимание пожарная тревога ШС",
  },
  {
    codeevent_proton: 1142,
    codeevent_uarm: 1142,
    description: "Отмена внимание ШС",
  },
  {
    codeevent_proton: 120,
    codeevent_uarm: 120,
    description: "Тревожная кнопка ШС",
  },
  {
    codeevent_proton: 1144,
    codeevent_uarm: 1144,
    description: "Сброс тревожной кнопки ШС",
  },
  {
    codeevent_proton: 121,
    codeevent_uarm: 121,
    description: "Снятие по принуждению, пользователь",
  },
  {
    codeevent_proton: 1145,
    codeevent_uarm: 1145,
    description: "Взятие по принуждению, пользователь",
  },
  {
    codeevent_proton: 122,
    codeevent_uarm: 122,
    description: "Тихая тревога ШС",
  },
  {
    codeevent_proton: 1146,
    codeevent_uarm: 1146,
    description: "Сброс тихой тревоги ШС",
  },
  {
    codeevent_proton: 123,
    codeevent_uarm: 123,
    description: "Громкая тревога ШС",
  },
  {
    codeevent_proton: 1147,
    codeevent_uarm: 1147,
    description: "Сброс громкой тревоги ШС",
  },
  {
    codeevent_proton: 124,
    codeevent_uarm: 124,
    description: "Принуждение - вход разрешен, пользователь",
  },
  {
    codeevent_proton: 125,
    codeevent_uarm: 125,
    description: "Принуждение - выход разрешен, пользователь",
  },
  {
    codeevent_proton: 126,
    codeevent_uarm: 126,
    description: "Тревожный вызов, пользователь",
  },
  {
    codeevent_proton: 1150,
    codeevent_uarm: 1150,
    description: "Отмена тревожного вызова, пользователь",
  },
  {
    codeevent_proton: 130,
    codeevent_uarm: 2,
    description: "Тревога ШС",
  },
  {
    codeevent_proton: 1154,
    codeevent_uarm: 0,
    description: "Восстановление ШС",
  },
  {
    codeevent_proton: 131,
    codeevent_uarm: 131,
    description: "Тревога периметр ШС",
  },
  {
    codeevent_proton: 1155,
    codeevent_uarm: 1155,
    description: "Восстановление ШС",
  },
  {
    codeevent_proton: 132,
    codeevent_uarm: 132,
    description: "Тревога внутренняя ШС",
  },
  {
    codeevent_proton: 1156,
    codeevent_uarm: 1156,
    description: "Восстановление ШС",
  },
  {
    codeevent_proton: 133,
    codeevent_uarm: 133,
    description: "Тревога круглосуточная ШС",
  },
  {
    codeevent_proton: 1157,
    codeevent_uarm: 1157,
    description: "Восстановление ШС",
  },
  {
    codeevent_proton: 134,
    codeevent_uarm: 2,
    description: "Нарушение входного ШС",
  },
  {
    codeevent_proton: 1158,
    codeevent_uarm: 0,
    description: "Восстановление входного ШС",
  },
  {
    codeevent_proton: 135,
    codeevent_uarm: 135,
    description: "Тревога - День ШС",
  },
  {
    codeevent_proton: 1159,
    codeevent_uarm: 1159,
    description: "Восстановление - Ночь ШС",
  },
  {
    codeevent_proton: 136,
    codeevent_uarm: 136,
    description: "Тревога наружная ШС",
  },
  {
    codeevent_proton: 1160,
    codeevent_uarm: 1160,
    description: "Восстановление ШС",
  },
  {
    codeevent_proton: 137,
    codeevent_uarm: 137,
    description: "Вскрытие корпуса датчика ШС",
  },
  {
    codeevent_proton: 1161,
    codeevent_uarm: 1161,
    description: "Восстановление корпуса датчика ШС",
  },
  {
    codeevent_proton: 138,
    codeevent_uarm: 138,
    description: "Вероятная тревога ШС",
  },
  {
    codeevent_proton: 1162,
    codeevent_uarm: 1162,
    description: "Отмена вероятной тревоги ШС",
  },
  {
    codeevent_proton: 139,
    codeevent_uarm: 139,
    description: "Верификатор проникновения ШС",
  },
  {
    codeevent_proton: 1163,
    codeevent_uarm: 1163,
    description: "Отмена верификатора проникновения ШС",
  },
  {
    codeevent_proton: 140,
    codeevent_uarm: 140,
    description: "Общая тревога ШС",
  },
  {
    codeevent_proton: 1164,
    codeevent_uarm: 1164,
    description: "Отмена общей тревоги ШС",
  },
  {
    codeevent_proton: 141,
    codeevent_uarm: 141,
    description: "Обрыв адресной линии ",
  },
  {
    codeevent_proton: 1165,
    codeevent_uarm: 1165,
    description: "Восстановление адресной линии ",
  },
  {
    codeevent_proton: 142,
    codeevent_uarm: 142,
    description: "Замыкание адресной линия   ",
  },
  {
    codeevent_proton: 1166,
    codeevent_uarm: 1166,
    description: "Восстановление адресной линии",
  },
  {
    codeevent_proton: 143,
    codeevent_uarm: 677,
    description: "Потеря модуля расширения ",
  },
  {
    codeevent_proton: 1167,
    codeevent_uarm: 672,
    description: "Подключение модуля расширения ",
  },
  {
    codeevent_proton: 144,
    codeevent_uarm: 144,
    description: "Тампер датчика ",
  },
  {
    codeevent_proton: 1168,
    codeevent_uarm: 1168,
    description: "Восстановление тампера датчика ",
  },
  {
    codeevent_proton: 145,
    codeevent_uarm: 289,
    description: "Вскрытие корпуса прибора",
  },
  {
    codeevent_proton: 1169,
    codeevent_uarm: 2049,
    description: "Восстановление корпуса прибора",
  },
  {
    codeevent_proton: 146,
    codeevent_uarm: 146,
    description: "Тихая тревога датчик",
  },
  {
    codeevent_proton: 1170,
    codeevent_uarm: 1170,
    description: "Отмена тихой тревоги датчик",
  },
  {
    codeevent_proton: 147,
    codeevent_uarm: 147,
    description: "Неудача контроля датчика",
  },
  {
    codeevent_proton: 1171,
    codeevent_uarm: 1171,
    description: "Восстановление контроля датчика",
  },
  {
    codeevent_proton: 150,
    codeevent_uarm: 150,
    description: "Технологический ШС",
  },
  {
    codeevent_proton: 1174,
    codeevent_uarm: 1174,
    description: "Восстановление технологического ШС",
  },
  {
    codeevent_proton: 151,
    codeevent_uarm: 113,
    description: "Детектор газа ШС",
  },
  {
    codeevent_proton: 1175,
    codeevent_uarm: 1175,
    description: "Восстановление детектора газа ШС",
  },
  {
    codeevent_proton: 152,
    codeevent_uarm: 152,
    description: "Нарушение охлаждения ШС",
  },
  {
    codeevent_proton: 1176,
    codeevent_uarm: 1176,
    description: "Восстановление охлаждения ШС",
  },
  {
    codeevent_proton: 153,
    codeevent_uarm: 153,
    description: "Нарушение отопления ШС",
  },
  {
    codeevent_proton: 1177,
    codeevent_uarm: 1177,
    description: "Восстановление отопления ШС",
  },
  {
    codeevent_proton: 154,
    codeevent_uarm: 154,
    description: "Утечка воды ШС",
  },
  {
    codeevent_proton: 1178,
    codeevent_uarm: 1178,
    description: "Отмена утечки воды ШС",
  },
  {
    codeevent_proton: 155,
    codeevent_uarm: 155,
    description: "Обрыв фольги ШС",
  },
  {
    codeevent_proton: 1179,
    codeevent_uarm: 1179,
    description: "Восстановление фольги ШС",
  },
  {
    codeevent_proton: 156,
    codeevent_uarm: 156,
    description: "Проблема в состоянии Снят ШС",
  },
  {
    codeevent_proton: 1180,
    codeevent_uarm: 1180,
    description: "Отмена проблемы в состоянии Снят ШС",
  },
  {
    codeevent_proton: 157,
    codeevent_uarm: 157,
    description: "Низкий уровень газа в баллоне",
  },
  {
    codeevent_proton: 1181,
    codeevent_uarm: 1181,
    description: "Восстановление уровня газа в баллоне",
  },
  {
    codeevent_proton: 158,
    codeevent_uarm: 158,
    description: "Высокая температура ШС",
  },
  {
    codeevent_proton: 1182,
    codeevent_uarm: 1182,
    description: "Отмена высокой температуры ШС",
  },
  {
    codeevent_proton: 159,
    codeevent_uarm: 159,
    description: "Низкая температура ШС",
  },
  {
    codeevent_proton: 1183,
    codeevent_uarm: 1183,
    description: "Отмена низкой температуры ШС",
  },
  {
    codeevent_proton: 161,
    codeevent_uarm: 161,
    description: "Нарушение вентиляции ШС",
  },
  {
    codeevent_proton: 1185,
    codeevent_uarm: 1185,
    description: "Восстановление вентиляции ШС",
  },
  {
    codeevent_proton: 162,
    codeevent_uarm: 162,
    description: "Угарный газ ШС",
  },
  {
    codeevent_proton: 1186,
    codeevent_uarm: 1186,
    description: "Отмена угарный газ ШС",
  },
  {
    codeevent_proton: 163,
    codeevent_uarm: 163,
    description: "Недостаточный уровень в резервуаре",
  },
  {
    codeevent_proton: 1187,
    codeevent_uarm: 1187,
    description: "Восстановление уровня в резервуаре",
  },
  {
    codeevent_proton: 200,
    codeevent_uarm: 200,
    description: "Неисправность пожаротушения, устройство",
  },
  {
    codeevent_proton: 1224,
    codeevent_uarm: 1224,
    description: "Восстановление пожаротушения, устройство",
  },
  {
    codeevent_proton: 201,
    codeevent_uarm: 201,
    description: "Низкое давление воды, устройство",
  },
  {
    codeevent_proton: 1225,
    codeevent_uarm: 1225,
    description: "Восстановление давления воды, устройство",
  },
  {
    codeevent_proton: 202,
    codeevent_uarm: 202,
    description: "Низкая концентрация СО2, устройство",
  },
  {
    codeevent_proton: 1226,
    codeevent_uarm: 1226,
    description: "Восстановление концентрации СО2, устройство",
  },
  {
    codeevent_proton: 203,
    codeevent_uarm: 203,
    description: "Нарушение датчика вентиля",
  },
  {
    codeevent_proton: 1227,
    codeevent_uarm: 1227,
    description: "Восстановление датчика вентиля",
  },
  {
    codeevent_proton: 204,
    codeevent_uarm: 204,
    description: "Низкий уровень воды, устройство",
  },
  {
    codeevent_proton: 1228,
    codeevent_uarm: 1228,
    description: "Восстановление уровня воды, устройство",
  },
  {
    codeevent_proton: 205,
    codeevent_uarm: 205,
    description: "Включен насос, устройство",
  },
  {
    codeevent_proton: 1229,
    codeevent_uarm: 1229,
    description: "Выключен насос, устройство",
  },
  {
    codeevent_proton: 206,
    codeevent_uarm: 206,
    description: "Неисправность насоса, устройство",
  },
  {
    codeevent_proton: 1230,
    codeevent_uarm: 1230,
    description: "Отмена неисправности насоса, устройство",
  },
  {
    codeevent_proton: 300,
    codeevent_uarm: 300,
    description: "Системная неисправность, устройство",
  },
  {
    codeevent_proton: 1324,
    codeevent_uarm: 1324,
    description: "Отмена неисправности, устройство",
  },
  {
    codeevent_proton: 301,
    codeevent_uarm: 577,
    description: "Отсутствие сетевого питания, устройство",
  },
  {
    codeevent_proton: 1325,
    codeevent_uarm: 2049,
    description: "Восстановление сетевого питания, устройство",
  },
  {
    codeevent_proton: 302,
    codeevent_uarm: 589,
    description: "Разряд аккумулятора, устройство",
  },
  {
    codeevent_proton: 1326,
    codeevent_uarm: 576,
    description: "Восстановление аккумулятора, устройство",
  },
  {
    codeevent_proton: 303,
    codeevent_uarm: 303,
    description: "Ошибка ОЗУ, устройство",
  },
  {
    codeevent_proton: 304,
    codeevent_uarm: 304,
    description: "Ошибка ПЗУ, устройство",
  },
  {
    codeevent_proton: 305,
    codeevent_uarm: 305,
    description: "Перезагрузка, устройство",
  },
  {
    codeevent_proton: 1329,
    codeevent_uarm: 1329,
    description: "Включение  устройства",
  },
  {
    codeevent_proton: 306,
    codeevent_uarm: 306,
    description: "Программирование, устройство",
  },
  {
    codeevent_proton: 307,
    codeevent_uarm: 307,
    description: "Неудача самотестирования, устройство",
  },
  {
    codeevent_proton: 308,
    codeevent_uarm: 308,
    description: "Отключение, устройство",
  },
  {
    codeevent_proton: 309,
    codeevent_uarm: 309,
    description: "Неудача теста аккумулятора, устройство",
  },
  {
    codeevent_proton: 310,
    codeevent_uarm: 310,
    description: "Неисправность заземления, устройство ",
  },
  {
    codeevent_proton: 1334,
    codeevent_uarm: 1334,
    description: "Восстановление заземления, устройство",
  },
  {
    codeevent_proton: 311,
    codeevent_uarm: 589,
    description: "Авария аккумулятора, устройство",
  },
  {
    codeevent_proton: 1335,
    codeevent_uarm: 576,
    description: "Восстановление аккумулятора, устройство",
  },
  {
    codeevent_proton: 312,
    codeevent_uarm: 312,
    description: "Перегрузка РИП, устройство",
  },
  {
    codeevent_proton: 1336,
    codeevent_uarm: 1336,
    description: "Отмена перегрузки РИП, устройство",
  },
  {
    codeevent_proton: 313,
    codeevent_uarm: 313,
    description: "Программный сброс инженером, устройство          ",
  },
  {
    codeevent_proton: 320,
    codeevent_uarm: 320,
    description: "Неисправность сирены\\реле",
  },
  {
    codeevent_proton: 1344,
    codeevent_uarm: 1344,
    description: "Восстановление сирены\\реле",
  },
  {
    codeevent_proton: 321,
    codeevent_uarm: 321,
    description: "Неисправность сирены 1, устройство",
  },
  {
    codeevent_proton: 1345,
    codeevent_uarm: 1345,
    description: "Восстановление сирены 1, устройство",
  },
  {
    codeevent_proton: 322,
    codeevent_uarm: 322,
    description: "Неисправность сирены 2, устройство",
  },
  {
    codeevent_proton: 1346,
    codeevent_uarm: 1346,
    description: "Восстановление сирены 2, устройство",
  },
  {
    codeevent_proton: 323,
    codeevent_uarm: 323,
    description: "Неисправность реле Тревога, устройство",
  },
  {
    codeevent_proton: 1347,
    codeevent_uarm: 1347,
    description: "Восстановление реле Тревога, устройство",
  },
  {
    codeevent_proton: 324,
    codeevent_uarm: 324,
    description: "Неисправность реле Неисправность, устройство",
  },
  {
    codeevent_proton: 1348,
    codeevent_uarm: 1348,
    description: "Восстановление реле Неисправность, устройство",
  },
  {
    codeevent_proton: 325,
    codeevent_uarm: 325,
    description: "Неисправность реле Реверсирование, устройство",
  },
  {
    codeevent_proton: 1349,
    codeevent_uarm: 1349,
    description: "Восстановление реле Реверсирование, устройство",
  },
  {
    codeevent_proton: 326,
    codeevent_uarm: 326,
    description: "Неисправность оповещателя 1, устройство",
  },
  {
    codeevent_proton: 1350,
    codeevent_uarm: 1350,
    description: "Восстановление оповещателя 1, устройство",
  },
  {
    codeevent_proton: 327,
    codeevent_uarm: 327,
    description: "Неисправность оповещателя 2, устройство",
  },
  {
    codeevent_proton: 1351,
    codeevent_uarm: 1351,
    description: "Восстановление оповещателя 2, устройство",
  },
  {
    codeevent_proton: 330,
    codeevent_uarm: 330,
    description: "Неисправность периферии, устройство",
  },
  {
    codeevent_proton: 1354,
    codeevent_uarm: 1354,
    description: "Восстановление периферии, устройство",
  },
  {
    codeevent_proton: 331,
    codeevent_uarm: 331,
    description: "Обрыв адресной линии, устройство",
  },
  {
    codeevent_proton: 1355,
    codeevent_uarm: 1355,
    description: "Восстановление адресной линии, устройство",
  },
  {
    codeevent_proton: 332,
    codeevent_uarm: 332,
    description: "Замыкание адресной линии, устройство",
  },
  {
    codeevent_proton: 1356,
    codeevent_uarm: 1356,
    description: "Восстановление адресной линии, устройство",
  },
  {
    codeevent_proton: 333,
    codeevent_uarm: 333,
    description: "Неисправность модуля расширения",
  },
  {
    codeevent_proton: 1357,
    codeevent_uarm: 1357,
    description: "Восстановление модуля расширения",
  },
  {
    codeevent_proton: 334,
    codeevent_uarm: 334,
    description: "Неисправность повторителя",
  },
  {
    codeevent_proton: 1358,
    codeevent_uarm: 1358,
    description: "Восстановление повторителя",
  },
  {
    codeevent_proton: 335,
    codeevent_uarm: 335,
    description: "Нет бумаги в принтере, устройство",
  },
  {
    codeevent_proton: 1359,
    codeevent_uarm: 1359,
    description: "Есть бумага в принтере, устройство",
  },
  {
    codeevent_proton: 336,
    codeevent_uarm: 336,
    description: "Потеря связи с принтером, устройство",
  },
  {
    codeevent_proton: 1360,
    codeevent_uarm: 1360,
    description: "Восстановление связи с принтером, устройство",
  },
  {
    codeevent_proton: 337,
    codeevent_uarm: 337,
    description: "Авария питания модуля расширения",
  },
  {
    codeevent_proton: 1361,
    codeevent_uarm: 1361,
    description: "Восстановление питания модуля расширения",
  },
  {
    codeevent_proton: 338,
    codeevent_uarm: 338,
    description: "Разряд аккумулятора модуля расширения",
  },
  {
    codeevent_proton: 1362,
    codeevent_uarm: 1362,
    description: "Восстановление аккумулятора модуля расширения",
  },
  {
    codeevent_proton: 339,
    codeevent_uarm: 339,
    description: "Перезагрузка модуля расширения",
  },
  {
    codeevent_proton: 1363,
    codeevent_uarm: 1363,
    description: "Включение модуля расширения",
  },
  {
    codeevent_proton: 341,
    codeevent_uarm: 341,
    description: "Вскрытие корпуса модуля расширения",
  },
  {
    codeevent_proton: 1365,
    codeevent_uarm: 1365,
    description: "Восстановление корпуса модуля расширения",
  },
  {
    codeevent_proton: 342,
    codeevent_uarm: 342,
    description: "Отсутствие сетевого питания модуля расширения",
  },
  {
    codeevent_proton: 1366,
    codeevent_uarm: 1366,
    description: "Восстановление сетевого питания модуля расширения",
  },
  {
    codeevent_proton: 343,
    codeevent_uarm: 343,
    description: "Неудача теста модуля расширения",
  },
  {
    codeevent_proton: 1367,
    codeevent_uarm: 1367,
    description: "Восстановление тестирования модуля расширения",
  },
  {
    codeevent_proton: 344,
    codeevent_uarm: 344,
    description: "Обнаружена радиопомеха, устройство",
  },
  {
    codeevent_proton: 1368,
    codeevent_uarm: 1368,
    description: "Отмена радиопомехи, устройство",
  },
  {
    codeevent_proton: 350,
    codeevent_uarm: 350,
    description: "Нет связи со станцией мониторинга, устройство",
  },
  {
    codeevent_proton: 1374,
    codeevent_uarm: 1374,
    description: "Восстановление связи со станцией мониторинга, устройство",
  },
  {
    codeevent_proton: 351,
    codeevent_uarm: 351,
    description: "Неисправность телефонной линии 1, устройство",
  },
  {
    codeevent_proton: 1375,
    codeevent_uarm: 1375,
    description: "Восстановление телефонной линии 1, устройство",
  },
  {
    codeevent_proton: 352,
    codeevent_uarm: 352,
    description: "Неисправность телефонной линии 2, устройство",
  },
  {
    codeevent_proton: 1376,
    codeevent_uarm: 1376,
    description: "Восстановление телефонной линии 2, устройство",
  },
  {
    codeevent_proton: 353,
    codeevent_uarm: 353,
    description: "Неисправность передатчика, устройство",
  },
  {
    codeevent_proton: 1377,
    codeevent_uarm: 1377,
    description: "Восстановление передатчика устройства",
  },
  {
    codeevent_proton: 354,
    codeevent_uarm: 354,
    description: "Сообщение не доставлено, устройство",
  },
  {
    codeevent_proton: 1378,
    codeevent_uarm: 1378,
    description: "Сообщение доставлено, устройство",
  },
  {
    codeevent_proton: 355,
    codeevent_uarm: 355,
    description: "Потеря контроля радиосвязи, устройство",
  },
  {
    codeevent_proton: 1379,
    codeevent_uarm: 1379,
    description: "Восстановление контроля радиосвязи, устройство",
  },
  {
    codeevent_proton: 356,
    codeevent_uarm: 356,
    description: "Отсутствие опроса с центральной станции, устройство",
  },
  {
    codeevent_proton: 1380,
    codeevent_uarm: 1380,
    description: "Восстановление опроса с центральной станции, устройство",
  },
  {
    codeevent_proton: 357,
    codeevent_uarm: 357,
    description: "Высокий КСВ антенны, устройство",
  },
  {
    codeevent_proton: 1381,
    codeevent_uarm: 1381,
    description: "Восстановление КСВ антенны, устройство",
  },
  {
    codeevent_proton: 358,
    codeevent_uarm: 358,
    description: "Перегрузка радиоканала",
  },
  {
    codeevent_proton: 1382,
    codeevent_uarm: 1382,
    description: "Отмена перегрузки радиоканала",
  },
  {
    codeevent_proton: 359,
    codeevent_uarm: 359,
    description: "Помеха радиоканала",
  },
  {
    codeevent_proton: 1383,
    codeevent_uarm: 1383,
    description: "Отмена помехи радиоканала ",
  },
  {
    codeevent_proton: 370,
    codeevent_uarm: 673,
    description: "Неисправность ШС",
  },
  {
    codeevent_proton: 1394,
    codeevent_uarm: 1394,
    description: "Восстановление ШС",
  },
  {
    codeevent_proton: 371,
    codeevent_uarm: 676,
    description: "Обрыв ШС",
  },
  {
    codeevent_proton: 1395,
    codeevent_uarm: 1395,
    description: "Восстановление ШС",
  },
  {
    codeevent_proton: 372,
    codeevent_uarm: 372,
    description: "Замыкание ШС",
  },
  {
    codeevent_proton: 1396,
    codeevent_uarm: 1396,
    description: "Восстановление ШС",
  },
  {
    codeevent_proton: 373,
    codeevent_uarm: 373,
    description: "Неисправность пожарного ШС",
  },
  {
    codeevent_proton: 1397,
    codeevent_uarm: 1397,
    description: "Восстановление пожарного ШС",
  },
  {
    codeevent_proton: 374,
    codeevent_uarm: 147,
    description: "Невзятие ШС",
  },
  {
    codeevent_proton: 1398,
    codeevent_uarm: 1398,
    description: "Отмена Тревоги при невзятии ШС",
  },
  {
    codeevent_proton: 375,
    codeevent_uarm: 375,
    description: "Неисправность тревожной кнопки ШС",
  },
  {
    codeevent_proton: 1399,
    codeevent_uarm: 1399,
    description: "Восстановление тревожной кнопки ШС",
  },
  {
    codeevent_proton: 376,
    codeevent_uarm: 376,
    description: "Неисправность тихой тревоги ШС",
  },
  {
    codeevent_proton: 1400,
    codeevent_uarm: 1400,
    description: "Восстановление тихой тревоги ШС",
  },
  {
    codeevent_proton: 377,
    codeevent_uarm: 377,
    description: "Перемежающаяся неисправность ШС",
  },
  {
    codeevent_proton: 1401,
    codeevent_uarm: 1401,
    description: "Восстановление ШС",
  },
  {
    codeevent_proton: 378,
    codeevent_uarm: 378,
    description: "Неисправность связанных шлейфов ШС",
  },
  {
    codeevent_proton: 1402,
    codeevent_uarm: 1402,
    description: "Восстановление связанных шлейфов ШС",
  },
  {
    codeevent_proton: 380,
    codeevent_uarm: 380,
    description: "Неисправность датчика",
  },
  {
    codeevent_proton: 1404,
    codeevent_uarm: 1404,
    description: "Восстановление датчика",
  },
  {
    codeevent_proton: 381,
    codeevent_uarm: 381,
    description: "Потеря контроля датчика",
  },
  {
    codeevent_proton: 1405,
    codeevent_uarm: 1405,
    description: "Восстановление контроля датчика",
  },
  {
    codeevent_proton: 382,
    codeevent_uarm: 382,
    description: "Потеря контроля адресного модуля ",
  },
  {
    codeevent_proton: 383,
    codeevent_uarm: 383,
    description: "Вскрытие корпуса датчика",
  },
  {
    codeevent_proton: 1407,
    codeevent_uarm: 1407,
    description: "Восстановление корпуса датчика",
  },
  {
    codeevent_proton: 384,
    codeevent_uarm: 384,
    description: "Разряд аккумулятора датчика",
  },
  {
    codeevent_proton: 1408,
    codeevent_uarm: 1408,
    description: "Восстановление аккумулятора датчика",
  },
  {
    codeevent_proton: 385,
    codeevent_uarm: 385,
    description: "Высокая чувствительность пожарного датчика",
  },
  {
    codeevent_proton: 1409,
    codeevent_uarm: 1409,
    description: "Восстановление чувствительности датчика",
  },
  {
    codeevent_proton: 386,
    codeevent_uarm: 386,
    description: "Низкая чувствительность пожарного датчика",
  },
  {
    codeevent_proton: 1410,
    codeevent_uarm: 1410,
    description: "Восстановление чувствительности датчика",
  },
  {
    codeevent_proton: 387,
    codeevent_uarm: 387,
    description: "Высокая чувствительность датчика",
  },
  {
    codeevent_proton: 1411,
    codeevent_uarm: 1411,
    description: "Восстановление чувствительности датчика",
  },
  {
    codeevent_proton: 388,
    codeevent_uarm: 388,
    description: "Низкая чувствительность датчика",
  },
  {
    codeevent_proton: 1412,
    codeevent_uarm: 1412,
    description: "Восстановление чувствительности датчика",
  },
  {
    codeevent_proton: 389,
    codeevent_uarm: 389,
    description: "Ошибка самодиагностики датчика",
  },
  {
    codeevent_proton: 1413,
    codeevent_uarm: 1413,
    description: "Восстановление датчика",
  },
  {
    codeevent_proton: 391,
    codeevent_uarm: 391,
    description: "Ошибка таймера датчика",
  },
  {
    codeevent_proton: 1415,
    codeevent_uarm: 1415,
    description: "Восстановление датчика",
  },
  {
    codeevent_proton: 392,
    codeevent_uarm: 392,
    description: "Ошибка компенсации ухода частоты датчика",
  },
  {
    codeevent_proton: 1416,
    codeevent_uarm: 1416,
    description: "Восстановление датчика",
  },
  {
    codeevent_proton: 393,
    codeevent_uarm: 393,
    description: "Требуется техническое обслуживание датчика",
  },
  {
    codeevent_proton: 1417,
    codeevent_uarm: 1417,
    description: "Восстановление датчика",
  },
  {
    codeevent_proton: 400,
    codeevent_uarm: 400,
    description: "Снятие с охраны",
  },
  {
    codeevent_proton: 1424,
    codeevent_uarm: 1424,
    description: "Взятие под охрану",
  },
  {
    codeevent_proton: 401,
    codeevent_uarm: 401,
    description: "Снятие, пользователь ",
  },
  {
    codeevent_proton: 1425,
    codeevent_uarm: 1425,
    description: "Взятие, пользователь",
  },
  {
    codeevent_proton: 402,
    codeevent_uarm: 1024,
    description: "Снятие ШС",
  },
  {
    codeevent_proton: 1426,
    codeevent_uarm: 1025,
    description: "Взятие ШС",
  },
  {
    codeevent_proton: 403,
    codeevent_uarm: 403,
    description: "Автоматическое снятие",
  },
  {
    codeevent_proton: 1427,
    codeevent_uarm: 1427,
    description: "Автоматическое взятие",
  },
  {
    codeevent_proton: 404,
    codeevent_uarm: 404,
    description: "Снятие после установленного времени, пользователь",
  },
  {
    codeevent_proton: 1428,
    codeevent_uarm: 1428,
    description: "Взятие после установленного времени, пользователь",
  },
  {
    codeevent_proton: 405,
    codeevent_uarm: 405,
    description: "Снятие отложенное, пользователь",
  },
  {
    codeevent_proton: 1429,
    codeevent_uarm: 1429,
    description: "Взятие отложенное, пользователь",
  },
  {
    codeevent_proton: 406,
    codeevent_uarm: 406,
    description: "Сброс тревоги-снятие, пользователь",
  },
  {
    codeevent_proton: 1430,
    codeevent_uarm: 1430,
    description: "Отмена сброса тревоги-снятие, пользователь",
  },
  {
    codeevent_proton: 407,
    codeevent_uarm: 407,
    description: "Удаленное снятие, пользователь",
  },
  {
    codeevent_proton: 1431,
    codeevent_uarm: 1431,
    description: "Удаленное взятие, пользователь",
  },
  {
    codeevent_proton: 408,
    codeevent_uarm: 408,
    description: "Снятие быстрое",
  },
  {
    codeevent_proton: 1432,
    codeevent_uarm: 1432,
    description: "Взятие быстрое",
  },
  {
    codeevent_proton: 409,
    codeevent_uarm: 409,
    description: "Снятие ключом, пользователь ",
  },
  {
    codeevent_proton: 1433,
    codeevent_uarm: 1433,
    description: "Взятие ключом, пользователь",
  },
  {
    codeevent_proton: 411,
    codeevent_uarm: 411,
    description: "Запрос на ответный вызов",
  },
  {
    codeevent_proton: 412,
    codeevent_uarm: 412,
    description: "Удачный сеанс загрузки с ПЦН",
  },
  {
    codeevent_proton: 413,
    codeevent_uarm: 413,
    description: "Неудачный сеанс загрузки с ПЦН",
  },
  {
    codeevent_proton: 414,
    codeevent_uarm: 414,
    description: "Получена команда системного останова",
  },
  {
    codeevent_proton: 415,
    codeevent_uarm: 415,
    description: "Получена команда останова наборщика",
  },
  {
    codeevent_proton: 416,
    codeevent_uarm: 416,
    description: "Удачный сеанс выгрузки на ПЦН",
  },
  {
    codeevent_proton: 421,
    codeevent_uarm: 421,
    description: "Ложный пароль",
  },
  {
    codeevent_proton: 422,
    codeevent_uarm: 422,
    description: "Доступ разрешен, пользователь",
  },
  {
    codeevent_proton: 423,
    codeevent_uarm: 423,
    description: "Доступ под принуждением, пользователь",
  },
  {
    codeevent_proton: 424,
    codeevent_uarm: 424,
    description: "Выход запрещен, пользователь",
  },
  {
    codeevent_proton: 425,
    codeevent_uarm: 425,
    description: "Выход разрешен, пользователь",
  },
  {
    codeevent_proton: 426,
    codeevent_uarm: 426,
    description: "Дверь заблокирована, устройство ",
  },
  {
    codeevent_proton: 427,
    codeevent_uarm: 427,
    description: "Неисправность датчика двери, устройство",
  },
  {
    codeevent_proton: 428,
    codeevent_uarm: 428,
    description: "Неисправность устройства запроса на выход",
  },
  {
    codeevent_proton: 429,
    codeevent_uarm: 429,
    description: "Программирование доступа начато, пользователь",
  },
  {
    codeevent_proton: 430,
    codeevent_uarm: 430,
    description: "Программирование доступа закончено, пользователь",
  },
  {
    codeevent_proton: 431,
    codeevent_uarm: 431,
    description: "Изменен уровень доступа, пользователь",
  },
  {
    codeevent_proton: 432,
    codeevent_uarm: 432,
    description: "Не сработало реле доступа, устройство",
  },
  {
    codeevent_proton: 433,
    codeevent_uarm: 433,
    description: "Запрос на выход шунтирован, устройство",
  },
  {
    codeevent_proton: 434,
    codeevent_uarm: 434,
    description: "Датчик двери шунтирован, устройство",
  },
  {
    codeevent_proton: 441,
    codeevent_uarm: 441,
    description: "Снятие пользователем",
  },
  {
    codeevent_proton: 1465,
    codeevent_uarm: 1465,
    description: "Взятие с присутствием людей, пользователь",
  },
  {
    codeevent_proton: 442,
    codeevent_uarm: 442,
    description: "Снятие ключом, пользователь ",
  },
  {
    codeevent_proton: 1466,
    codeevent_uarm: 1466,
    description: "Взятие ключом с присутствием людей, пользователь",
  },
  {
    codeevent_proton: 450,
    codeevent_uarm: 148,
    description: "Отсутствие снятия",
  },
  {
    codeevent_proton: 1474,
    codeevent_uarm: 1474,
    description: "Невзятие, пользователь",
  },
  {
    codeevent_proton: 451,
    codeevent_uarm: 451,
    description: "Снятие до установленного времени, пользователь",
  },
  {
    codeevent_proton: 1475,
    codeevent_uarm: 1475,
    description: "Взятие до установленного времени, пользователь",
  },
  {
    codeevent_proton: 452,
    codeevent_uarm: 452,
    description: "Снятие после установленного времени, пользователь",
  },
  {
    codeevent_proton: 1476,
    codeevent_uarm: 1476,
    description: "Взятие после установленного времени, пользователь",
  },
  {
    codeevent_proton: 453,
    codeevent_uarm: 453,
    description: "Отсутствие снятия в установленное время",
  },
  {
    codeevent_proton: 454,
    codeevent_uarm: 454,
    description: "Отсутствие Взятия в установленное время",
  },
  {
    codeevent_proton: 455,
    codeevent_uarm: 455,
    description: "Неудача автоматического взятия",
  },
  {
    codeevent_proton: 1479,
    codeevent_uarm: 1479,
    description: "Взятие частичное автоматическое",
  },
  {
    codeevent_proton: 456,
    codeevent_uarm: 456,
    description: "Снятие, пользователь ",
  },
  {
    codeevent_proton: 1480,
    codeevent_uarm: 1480,
    description: "Взятие частичное, пользователь",
  },
  {
    codeevent_proton: 457,
    codeevent_uarm: 457,
    description: "Ошибка: выход после задержки на взятие, пользователь",
  },
  {
    codeevent_proton: 1481,
    codeevent_uarm: 1481,
    description: "Взятие частичное удаленное, пользователь",
  },
  {
    codeevent_proton: 458,
    codeevent_uarm: 458,
    description: "Пользователь в помещении",
  },
  {
    codeevent_proton: 459,
    codeevent_uarm: 459,
    description: "Тревога после недавнего взятия",
  },
  {
    codeevent_proton: 461,
    codeevent_uarm: 461,
    description: "Ввод некорректного кода, устройство",
  },
  {
    codeevent_proton: 462,
    codeevent_uarm: 462,
    description: "Ввод корректного кода, пользователь",
  },
  {
    codeevent_proton: 463,
    codeevent_uarm: 463,
    description: "Взятие после тревоги, пользователь",
  },
  {
    codeevent_proton: 1487,
    codeevent_uarm: 1487,
    description: "Невзятие типа",
  },
  {
    codeevent_proton: 464,
    codeevent_uarm: 464,
    description: "Время автоматического взятия увеличено",
  },
  {
    codeevent_proton: 465,
    codeevent_uarm: 465,
    description: "Сброс тревожной кнопки ШС",
  },
  {
    codeevent_proton: 466,
    codeevent_uarm: 466,
    description: "Снятие сервисной службой",
  },
  {
    codeevent_proton: 1490,
    codeevent_uarm: 1490,
    description: "Взятие сервисной службой",
  },
  {
    codeevent_proton: 467,
    codeevent_uarm: 467,
    description: "Снятие раздела 1, пользователь",
  },
  {
    codeevent_proton: 1491,
    codeevent_uarm: 1491,
    description: "Взятие раздела 1, пользователь",
  },
  {
    codeevent_proton: 468,
    codeevent_uarm: 468,
    description: "Снятие раздела 2, пользователь",
  },
  {
    codeevent_proton: 1492,
    codeevent_uarm: 1492,
    description: "Взятие раздела 2, пользователь",
  },
  {
    codeevent_proton: 469,
    codeevent_uarm: 469,
    description: "Снятие раздела 3, пользователь",
  },
  {
    codeevent_proton: 1493,
    codeevent_uarm: 1493,
    description: "Взятие раздела 3, пользователь",
  },
  {
    codeevent_proton: 470,
    codeevent_uarm: 470,
    description: "Снятие раздела 4, пользователь",
  },
  {
    codeevent_proton: 1494,
    codeevent_uarm: 1494,
    description: "Взятие раздела 4, пользователь",
  },
  {
    codeevent_proton: 471,
    codeevent_uarm: 471,
    description: "Снятие раздела 5, пользователь",
  },
  {
    codeevent_proton: 1495,
    codeevent_uarm: 1495,
    description: "Взятие раздела 5, пользователь",
  },
  {
    codeevent_proton: 472,
    codeevent_uarm: 472,
    description: "Снятие раздела 6, пользователь",
  },
  {
    codeevent_proton: 1496,
    codeevent_uarm: 1496,
    description: "Взятие раздела 6, пользователь",
  },
  {
    codeevent_proton: 473,
    codeevent_uarm: 473,
    description: "Снятие раздела 7, пользователь",
  },
  {
    codeevent_proton: 1497,
    codeevent_uarm: 1497,
    description: "Взятие раздела 7, пользователь",
  },
  {
    codeevent_proton: 474,
    codeevent_uarm: 474,
    description: "Снятие раздела 8, пользователь",
  },
  {
    codeevent_proton: 1498,
    codeevent_uarm: 1498,
    description: "Взятие раздела 8, пользователь",
  },
  {
    codeevent_proton: 475,
    codeevent_uarm: 475,
    description: "Снятие раздела 9, пользователь",
  },
  {
    codeevent_proton: 1499,
    codeevent_uarm: 1499,
    description: "Взятие раздела 9, пользователь",
  },
  {
    codeevent_proton: 476,
    codeevent_uarm: 476,
    description: "Снятие раздела 10, пользователь",
  },
  {
    codeevent_proton: 1500,
    codeevent_uarm: 1500,
    description: "Взятие раздела 10, пользователь",
  },
  {
    codeevent_proton: 477,
    codeevent_uarm: 477,
    description: "Снятие раздела 11, пользователь",
  },
  {
    codeevent_proton: 1501,
    codeevent_uarm: 1501,
    description: "Взятие раздела 11, пользователь",
  },
  {
    codeevent_proton: 478,
    codeevent_uarm: 478,
    description: "Снятие раздела 12, пользователь",
  },
  {
    codeevent_proton: 1502,
    codeevent_uarm: 1502,
    description: "Взятие раздела 12, пользователь",
  },
  {
    codeevent_proton: 479,
    codeevent_uarm: 479,
    description: "Снятие раздела 13, пользователь",
  },
  {
    codeevent_proton: 1503,
    codeevent_uarm: 1503,
    description: "Взятие раздела 13, пользователь",
  },
  {
    codeevent_proton: 480,
    codeevent_uarm: 480,
    description: "Снятие раздела 14, пользователь",
  },
  {
    codeevent_proton: 1504,
    codeevent_uarm: 1504,
    description: "Взятие раздела 14, пользователь",
  },
  {
    codeevent_proton: 481,
    codeevent_uarm: 481,
    description: "Снятие раздела 15, пользователь",
  },
  {
    codeevent_proton: 1505,
    codeevent_uarm: 1505,
    description: "Взятие раздела 15, пользователь",
  },
  {
    codeevent_proton: 482,
    codeevent_uarm: 1024,
    description: "Снятие по типу 1, пользователь",
  },
  {
    codeevent_proton: 1506,
    codeevent_uarm: 1025,
    description: "Взятие по типу 1, пользователь",
  },
  {
    codeevent_proton: 483,
    codeevent_uarm: 483,
    description: "Снятие по типу 2, пользователь",
  },
  {
    codeevent_proton: 1507,
    codeevent_uarm: 1507,
    description: "Взятие по типу 2, пользователь",
  },
  {
    codeevent_proton: 484,
    codeevent_uarm: 484,
    description: "Снятие по типу 3, пользователь",
  },
  {
    codeevent_proton: 1508,
    codeevent_uarm: 1508,
    description: "Взятие по типу 3, пользователь",
  },
  {
    codeevent_proton: 485,
    codeevent_uarm: 485,
    description: "Снятие по типу 4, пользователь",
  },
  {
    codeevent_proton: 1509,
    codeevent_uarm: 1509,
    description: "Взятие по типу 4, пользователь",
  },
  {
    codeevent_proton: 486,
    codeevent_uarm: 486,
    description: "Снятие по типу 5, пользователь",
  },
  {
    codeevent_proton: 1510,
    codeevent_uarm: 1510,
    description: "Взятие по типу 5, пользователь",
  },
  {
    codeevent_proton: 487,
    codeevent_uarm: 487,
    description: "Снятие по типу 6, пользователь",
  },
  {
    codeevent_proton: 1511,
    codeevent_uarm: 1511,
    description: "Взятие по типу 6, пользователь",
  },
  {
    codeevent_proton: 488,
    codeevent_uarm: 488,
    description: "Снятие по типу 7, пользователь",
  },
  {
    codeevent_proton: 1512,
    codeevent_uarm: 1512,
    description: "Взятие по типу 7, пользователь",
  },
  {
    codeevent_proton: 489,
    codeevent_uarm: 489,
    description: "Снятие по типу 8, пользователь",
  },
  {
    codeevent_proton: 1513,
    codeevent_uarm: 1513,
    description: "Взятие по типу 8, пользователь",
  },
  {
    codeevent_proton: 490,
    codeevent_uarm: 490,
    description: "Снятие по типу 9, пользователь",
  },
  {
    codeevent_proton: 1514,
    codeevent_uarm: 1514,
    description: "Взятие по типу 9, пользователь",
  },
  {
    codeevent_proton: 491,
    codeevent_uarm: 491,
    description: "Снятие по типу 10, пользователь",
  },
  {
    codeevent_proton: 1515,
    codeevent_uarm: 1515,
    description: "Взятие по типу 10, пользователь",
  },
  {
    codeevent_proton: 492,
    codeevent_uarm: 492,
    description: "Снятие по типу 11, пользователь",
  },
  {
    codeevent_proton: 1516,
    codeevent_uarm: 1516,
    description: "Взятие по типу 11, пользователь",
  },
  {
    codeevent_proton: 493,
    codeevent_uarm: 493,
    description: "Снятие по типу 12, пользователь",
  },
  {
    codeevent_proton: 1517,
    codeevent_uarm: 1517,
    description: "Взятие по типу 12, пользователь",
  },
  {
    codeevent_proton: 494,
    codeevent_uarm: 494,
    description: "Снятие по типу 13, пользователь",
  },
  {
    codeevent_proton: 1518,
    codeevent_uarm: 1518,
    description: "Взятие по типу 13, пользователь",
  },
  {
    codeevent_proton: 495,
    codeevent_uarm: 495,
    description: "Снятие по типу 14, пользователь",
  },
  {
    codeevent_proton: 1519,
    codeevent_uarm: 1519,
    description: "Взятие по типу 14, пользователь",
  },
  {
    codeevent_proton: 496,
    codeevent_uarm: 496,
    description: "Снятие по типу 15, пользователь",
  },
  {
    codeevent_proton: 1520,
    codeevent_uarm: 1520,
    description: "Взятие по типу 15, пользователь",
  },
  {
    codeevent_proton: 497,
    codeevent_uarm: 497,
    description: "Снятие автоматическое раздела",
  },
  {
    codeevent_proton: 1521,
    codeevent_uarm: 1521,
    description: "Взятие автоматическое раздела",
  },
  {
    codeevent_proton: 498,
    codeevent_uarm: 498,
    description: "Снятие частичное автоматическое раздела",
  },
  {
    codeevent_proton: 1522,
    codeevent_uarm: 1522,
    description: "Взятие частичное автоматическое раздела",
  },
  {
    codeevent_proton: 501,
    codeevent_uarm: 501,
    description: "Считыватель отключен, устройство",
  },
  {
    codeevent_proton: 1525,
    codeevent_uarm: 1525,
    description: "Считыватель включен, устройство",
  },
  {
    codeevent_proton: 520,
    codeevent_uarm: 520,
    description: "Сирена/Реле отключена устройство",
  },
  {
    codeevent_proton: 1544,
    codeevent_uarm: 1544,
    description: "Сирена/Реле включена, устройство",
  },
  {
    codeevent_proton: 521,
    codeevent_uarm: 521,
    description: "Сирена 1 отключена, устройство",
  },
  {
    codeevent_proton: 1545,
    codeevent_uarm: 1545,
    description: "Сирена 1 включена, устройство",
  },
  {
    codeevent_proton: 522,
    codeevent_uarm: 522,
    description: "Сирена 2 отключена, устройство",
  },
  {
    codeevent_proton: 1546,
    codeevent_uarm: 1546,
    description: "Сирена 2 включена, устройство",
  },
  {
    codeevent_proton: 523,
    codeevent_uarm: 523,
    description: "Реле тревога отключено устройство",
  },
  {
    codeevent_proton: 1547,
    codeevent_uarm: 1547,
    description: "Реле Тревога включено, устройство",
  },
  {
    codeevent_proton: 524,
    codeevent_uarm: 524,
    description: "Реле Неисправность отключено, устройство",
  },
  {
    codeevent_proton: 1548,
    codeevent_uarm: 1548,
    description: "Реле Неисправность включено, устройство",
  },
  {
    codeevent_proton: 525,
    codeevent_uarm: 525,
    description: "Реле Реверсирование отключено, устройство",
  },
  {
    codeevent_proton: 1549,
    codeevent_uarm: 1549,
    description: "Реле Реверсирование включено, устройство",
  },
  {
    codeevent_proton: 526,
    codeevent_uarm: 526,
    description: "Оповещатель №3 отключен, устройство",
  },
  {
    codeevent_proton: 1550,
    codeevent_uarm: 1550,
    description: "Оповещатель №3 включен, устройство",
  },
  {
    codeevent_proton: 527,
    codeevent_uarm: 527,
    description: "Оповещатель №4 отключен, устройство",
  },
  {
    codeevent_proton: 1551,
    codeevent_uarm: 1551,
    description: "Оповещатель №4 включен, устройство",
  },
  {
    codeevent_proton: 531,
    codeevent_uarm: 531,
    description: "Добавлен модуль расширения",
  },
  {
    codeevent_proton: 532,
    codeevent_uarm: 532,
    description: "Удален модуль расширения",
  },
  {
    codeevent_proton: 551,
    codeevent_uarm: 551,
    description: "Отключен телефонный коммуникатор, устройство",
  },
  {
    codeevent_proton: 552,
    codeevent_uarm: 552,
    description: "Отключен радиопередатчик устройства",
  },
  {
    codeevent_proton: 553,
    codeevent_uarm: 553,
    description: "Отключено удаленное прогр. устройства",
  },
  {
    codeevent_proton: 570,
    codeevent_uarm: 570,
    description: "Обход ШС",
  },
  {
    codeevent_proton: 571,
    codeevent_uarm: 571,
    description: "Обход пожарного ШС",
  },
  {
    codeevent_proton: 572,
    codeevent_uarm: 572,
    description: "Обход круглосуточного ШС",
  },
  {
    codeevent_proton: 573,
    codeevent_uarm: 573,
    description: "Обход охранного ШС",
  },
  {
    codeevent_proton: 574,
    codeevent_uarm: 574,
    description: "Обход раздела, пользователь",
  },
  {
    codeevent_proton: 575,
    codeevent_uarm: 575,
    description: "Обход неисправного ШС",
  },
  {
    codeevent_proton: 576,
    codeevent_uarm: 576,
    description: "Шунтирована зона доступа",
  },
  {
    codeevent_proton: 577,
    codeevent_uarm: 577,
    description: "Обход зоны доступа",
  },
  {
    codeevent_proton: 601,
    codeevent_uarm: 2049,
    description: "Тест ручной",
  },
  {
    codeevent_proton: 602,
    codeevent_uarm: 2049,
    description: "Тест охранный",
  },
  {
    codeevent_proton: 603,
    codeevent_uarm: 2049,
    description: "Тест периодический",
  },
  {
    codeevent_proton: 604,
    codeevent_uarm: 2049,
    description: "Тест пожарный, пользователь",
  },
  {
    codeevent_proton: 605,
    codeevent_uarm: 605,
    description: "Отправка статуса ШС",
  },
  {
    codeevent_proton: 606,
    codeevent_uarm: 606,
    description: "Голосовая связь",
  },
  {
    codeevent_proton: 607,
    codeevent_uarm: 607,
    description: "Режим тестирования, пользователь",
  },
  {
    codeevent_proton: 608,
    codeevent_uarm: 608,
    description: "Проблема ШС",
  },
  {
    codeevent_proton: 609,
    codeevent_uarm: 609,
    description: "Видео-передача активирована",
  },
  {
    codeevent_proton: 611,
    codeevent_uarm: 611,
    description: "Контрольная точка проверена",
  },
  {
    codeevent_proton: 612,
    codeevent_uarm: 612,
    description: "Контрольная точка не проверена",
  },
  {
    codeevent_proton: 613,
    codeevent_uarm: 613,
    description: "Тест охранного ШС",
  },
  {
    codeevent_proton: 614,
    codeevent_uarm: 614,
    description: "Тест пожарного ШС",
  },
  {
    codeevent_proton: 615,
    codeevent_uarm: 615,
    description: "Тест тревожной кнопки ШС",
  },
  {
    codeevent_proton: 616,
    codeevent_uarm: 616,
    description: "Вызов сервисной службы",
  },
  {
    codeevent_proton: 617,
    codeevent_uarm: 2049,
    description: "Тест канала GPRS",
  },
  {
    codeevent_proton: 618,
    codeevent_uarm: 2049,
    description: "Тест канала SMS",
  },
  {
    codeevent_proton: 619,
    codeevent_uarm: 2049,
    description: "Тест канала Ethernet",
  },
  {
    codeevent_proton: 620,
    codeevent_uarm: 2049,
    description: "Тест канала DialUP",
  },
  {
    codeevent_proton: 621,
    codeevent_uarm: 621,
    description: "Журнал событий очищен, устройство",
  },
  {
    codeevent_proton: 622,
    codeevent_uarm: 622,
    description: "Журнал событий заполнен на 50%, устройство",
  },
  {
    codeevent_proton: 623,
    codeevent_uarm: 623,
    description: "Журнал событий заполнен на 90%, устройство",
  },
  {
    codeevent_proton: 624,
    codeevent_uarm: 624,
    description: "Журнал событий переполнен, устройство",
  },
  {
    codeevent_proton: 625,
    codeevent_uarm: 625,
    description: "Системные дата\\время изменены, устройство",
  },
  {
    codeevent_proton: 626,
    codeevent_uarm: 626,
    description: "Системные дата\\время некорректны, устройство",
  },
  {
    codeevent_proton: 627,
    codeevent_uarm: 627,
    description: "Вход в режим программирования, устройство",
  },
  {
    codeevent_proton: 628,
    codeevent_uarm: 628,
    description: "Выход из режима программирования, устройство",
  },
  {
    codeevent_proton: 629,
    codeevent_uarm: 629,
    description: "32-часовой маркер в журнале событий, устройство",
  },
  {
    codeevent_proton: 630,
    codeevent_uarm: 630,
    description: "Расписание изменено, устройство",
  },
  {
    codeevent_proton: 631,
    codeevent_uarm: 631,
    description: "Невозможно изменить расписание, устройство",
  },
  {
    codeevent_proton: 632,
    codeevent_uarm: 632,
    description: "Расписание доступа изменено, устройство",
  },
  {
    codeevent_proton: 641,
    codeevent_uarm: 641,
    description: "Проблема контроля наряда",
  },
  {
    codeevent_proton: 642,
    codeevent_uarm: 642,
    description: "Контроль универсального ключа, пользователь",
  },
  {
    codeevent_proton: 643,
    codeevent_uarm: 643,
    description: "Отметка наряда",
  },
  {
    codeevent_proton: 651,
    codeevent_uarm: 651,
    description: "Зарезервированно",
  },
  {
    codeevent_proton: 652,
    codeevent_uarm: 652,
    description: "Зарезервированно",
  },
  {
    codeevent_proton: 653,
    codeevent_uarm: 653,
    description: "Зарезервированно",
  },
  {
    codeevent_proton: 654,
    codeevent_uarm: 654,
    description: "Система не активна",
  },
  {
    codeevent_proton: 655,
    codeevent_uarm: 655,
    description: "Баланс ниже критического",
  },
  {
    codeevent_proton: 1679,
    codeevent_uarm: 1679,
    description: "Баланс в  норме",
  },
  {
    codeevent_proton: 656,
    codeevent_uarm: 656,
    description: "Смена SIM-карты",
  },
  {
    codeevent_proton: 657,
    codeevent_uarm: 657,
    description: "Слабый уровень сигнала",
  },
  {
    codeevent_proton: 700,
    codeevent_uarm: 700,
    description: "Сообщение в формате RSE, RSE1",
  },
  {
    codeevent_proton: 701,
    codeevent_uarm: 701,
    description: "Снятие шлейфов XXXXXXXX, пользователь Nп",
  },
  {
    codeevent_proton: 1725,
    codeevent_uarm: 1725,
    description: "Взятие  шлейфов XXXXXXXX, пользователь Nп",
  },
  {
    codeevent_proton: 702,
    codeevent_uarm: 702,
    description: "Удаленное снятие шлейфов XXXXXXXX, пользователь 250",
  },
  {
    codeevent_proton: 1726,
    codeevent_uarm: 1726,
    description: "Удаленное взятие шлейфов XXXXXXXX, пользователь 250",
  },
  {
    codeevent_proton: 703,
    codeevent_uarm: 2049,
    description: "Тест информационный",
  },
  {
    codeevent_proton: 704,
    codeevent_uarm: 704,
    description: "Невзятие (нет квитанции) шлейфов XXXXXXXX, пользователь 0",
  },
  {
    codeevent_proton: 705,
    codeevent_uarm: 705,
    description: "Невзятие нарушенных шлейфов XXXXXXXX, пользователь 0",
  },
  {
    codeevent_proton: 949,
    codeevent_uarm: 949,
    description: "Переполнение входного буфера ПЦН",
  },
  {
    codeevent_proton: 950,
    codeevent_uarm: 950,
    description: "Ошибка на входе данных от БС",
  },
  {
    codeevent_proton: 951,
    codeevent_uarm: 951,
    description: "Извещение принято оператором",
  },
  {
    codeevent_proton: 952,
    codeevent_uarm: 952,
    description: "Передатчик отключен на ПЦН",
  },
  {
    codeevent_proton: 953,
    codeevent_uarm: 953,
    description: "Передатчик подключен на ПЦН",
  },
  {
    codeevent_proton: 954,
    codeevent_uarm: 954,
    description: "Передатчик удален на ПЦН",
  },
  {
    codeevent_proton: 955,
    codeevent_uarm: 955,
    description: "Передатчик обучен на ПЦН",
  },
  {
    codeevent_proton: 960,
    codeevent_uarm: 960,
    description: "Перегрузка радиоканала",
  },
  {
    codeevent_proton: 1984,
    codeevent_uarm: 1984,
    description: "Отмена перегрузки радиоканала",
  },
  {
    codeevent_proton: 961,
    codeevent_uarm: 961,
    description: "Помеха радиоканала",
  },
  {
    codeevent_proton: 1985,
    codeevent_uarm: 1985,
    description: "Отмена помехи радиоканала",
  },
  {
    codeevent_proton: 962,
    codeevent_uarm: 589,
    description: "Разряд аккумулятора ПЦН ",
  },
  {
    codeevent_proton: 1986,
    codeevent_uarm: 1986,
    description: "Восстановление аккумулятора ПЦН",
  },
  {
    codeevent_proton: 963,
    codeevent_uarm: 963,
    description: "Авария аккумулятора ПЦН ",
  },
  {
    codeevent_proton: 964,
    codeevent_uarm: 964,
    description: "Отсутствие напряжения питания ПЦН",
  },
  {
    codeevent_proton: 1988,
    codeevent_uarm: 1988,
    description: "Восстановление напряжения питания ПЦН",
  },
  {
    codeevent_proton: 965,
    codeevent_uarm: 965,
    description: "Потеря прибора  ",
  },
  {
    codeevent_proton: 1989,
    codeevent_uarm: 1989,
    description: "Обнаружение прибора",
  },
  {
    codeevent_proton: 966,
    codeevent_uarm: 966,
    description: "Отсутствие охранного теста  ",
  },
  {
    codeevent_proton: 1990,
    codeevent_uarm: 1990,
    description: "Восстановление охранного теста ",
  },
  {
    codeevent_proton: 967,
    codeevent_uarm: 967,
    description: "Отсутствие снятия с охраны ",
  },
  {
    codeevent_proton: 968,
    codeevent_uarm: 968,
    description: "Отсутствие диагностического теста  ",
  },
  {
    codeevent_proton: 1992,
    codeevent_uarm: 1992,
    description: "Восстановление диагностического теста    ",
  },
  {
    codeevent_proton: 969,
    codeevent_uarm: 969,
    description: "Рестарт ПЦН",
  },
  {
    codeevent_proton: 970,
    codeevent_uarm: 970,
    description: "Сброс памяти ПЦН",
  },
  {
    codeevent_proton: 971,
    codeevent_uarm: 971,
    description: "Корректировка времени ПЦН ",
  },
  {
    codeevent_proton: 972,
    codeevent_uarm: 972,
    description: "Смена даты на ПЦН ",
  },
  {
    codeevent_proton: 973,
    codeevent_uarm: 973,
    description: "Регистрация по охранному тесту",
  },
  {
    codeevent_proton: 974,
    codeevent_uarm: 974,
    description: "Регистрация по диагностическому тесту",
  },
  {
    codeevent_proton: 975,
    codeevent_uarm: 975,
    description: "Нет бумаги в принтере",
  },
  {
    codeevent_proton: 976,
    codeevent_uarm: 976,
    description: "Потеря связи с принтером",
  },
  {
    codeevent_proton: 2000,
    codeevent_uarm: 2000,
    description: "Восстановление связи с принтером",
  },
  {
    codeevent_proton: 977,
    codeevent_uarm: 977,
    description: "Потеря связи с АРМ",
  },
  {
    codeevent_proton: 2001,
    codeevent_uarm: 2001,
    description: "Восстановление связи с АРМ",
  },
  {
    codeevent_proton: 978,
    codeevent_uarm: 978,
    description: "Неисправность ПЦН",
  },
  {
    codeevent_proton: 2002,
    codeevent_uarm: 2002,
    description: "Восстановление ПЦН после неисправности",
  },
  {
    codeevent_proton: 979,
    codeevent_uarm: 979,
    description: "Изменение настроек ПЦН",
  },
  {
    codeevent_proton: 2003,
    codeevent_uarm: 2003,
    description: "Сброс настроек ПЦН",
  },
  {
    codeevent_proton: 980,
    codeevent_uarm: 980,
    description: "Изменение настроек Объекта",
  },
  {
    codeevent_proton: 981,
    codeevent_uarm: 981,
    description: "Неисправность приемника",
  },
  {
    codeevent_proton: 2005,
    codeevent_uarm: 2005,
    description: "Восстановление приемника после неисправности",
  },
  {
    codeevent_proton: 982,
    codeevent_uarm: 2049,
    description: "Регистрация прибора на ПЦН",
  },
  {
    codeevent_proton: 983,
    codeevent_uarm: 983,
    description: "Пропуск сообщения с объекта",
  },
  {
    codeevent_proton: 984,
    codeevent_uarm: 984,
    description: "Подмена прибора",
  },
  {
    codeevent_proton: 985,
    codeevent_uarm: 985,
    description: "Потеря приемника",
  },
  {
    codeevent_proton: 2009,
    codeevent_uarm: 2009,
    description: "Обнаружение приемника",
  },
  {
    codeevent_proton: 986,
    codeevent_uarm: 2049,
    description: "Тест канала Ethernet ПЦН",
  },
  {
    codeevent_proton: 987,
    codeevent_uarm: 1793,
    description: "Отсутствие связи по каналу GPRS",
  },
  {
    codeevent_proton: 2011,
    codeevent_uarm: 1792,
    description: "Восстановление связи по каналу GPRS",
  },
  {
    codeevent_proton: 988,
    codeevent_uarm: 1793,
    description: "Отсутствие связи по каналу SMS",
  },
  {
    codeevent_proton: 2012,
    codeevent_uarm: 1792,
    description: "Восстановление связи по каналу SMS",
  },
  {
    codeevent_proton: 989,
    codeevent_uarm: 1793,
    description: "Отсутствие связи по каналу Ethernet",
  },
  {
    codeevent_proton: 2013,
    codeevent_uarm: 1792,
    description: "Восстановление связи по каналу Ethernet",
  },
  {
    codeevent_proton: 990,
    codeevent_uarm: 1793,
    description: "Отсутствие связи по каналу DialUP",
  },
  {
    codeevent_proton: 2014,
    codeevent_uarm: 1792,
    description: "Восстановление связи по каналу DialUP",
  },
  {
    codeevent_proton: 991,
    codeevent_uarm: 1793,
    description: "Отсутствие связи по всем каналам",
  },
  {
    codeevent_proton: 2015,
    codeevent_uarm: 1792,
    description: "Восстановление связи по всем каналам",
  },
];

const output: any = {};
for (const item of map) {
  output[item.codeevent_proton] = item.description;
}
fs.writeFileSync("./eventMap.json", JSON.stringify(output, null, 2));
