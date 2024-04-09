# Проект

Единый проект для новых СНОД для Протон, Мираж, Тандем.

Исходный коды в папке src.

Файл: index.ts - входная точка для запуска проекта. Основная логика работы в данном файле.

В папке: common - Основные модули для интеграции с Mqtt брокером, Redis кэшем, Логирование, а также вспомогательные функции Helper.

В папке aiuso - код интеграции с Тандем
В папке proton - код интеграции с ПротонВеб
В папке miraj - код интеграции с Мираж

Настройки СНОД находятся в файле config.json

Для запуска тестового окружения нужно установить следующие пакеты.

## Установка

### Docker и docker-compose

1. Установите Docker, следуя инструкциям для вашей операционной системы:

   - Для Windows и Mac: [Docker Desktop](https://www.docker.com/products/docker-desktop)
   - Для Linux: следуйте инструкциям для вашего дистрибутива

2. Проверьте, установлен ли Docker, запустив следующую команду в командной строке (терминале):

   docker --version

   docker-compose --version

3. Если команды выше выдают версии Docker и docker-compose соответственно, значит, установка прошла успешно.

### Node.js и NPM

1. Установите Node.js, следуя инструкциям для вашей операционной системы:

- Для Windows и Mac: скачайте установщик с [официального сайта Node.js](https://nodejs.org/) и запустите его
- Для Linux: воспользуйтесь пакетным менеджером вашего дистрибутива, например:
  - Ubuntu/Debian: `sudo apt install nodejs npm`
  - Fedora: `sudo dnf install nodejs npm`
  - Arch Linux: `sudo pacman -S nodejs npm`

2. Проверьте, установлены ли Node.js и NPM, запустив следующую команду в командной строке (терминале):

node --version

npm --version

3. Если команды выше выдают версии Node.js и NPM соответственно, значит, установка прошла успешно.

## Запуск проекта

1. Склонируйте репозиторий с проектом:

git clone git@gitlab.com:jasyes/new-gateway.git

2. Перейдите в директорию проекта:

cd <название_проекта>

3. Установите зависимости проекта, выполнив следующую команду:

npm install

4. Запустите проект, выполнив одну из следующих команд:

docker-compose up -d

или

docker compose up -d
(В зависимости от версии Docker)

5. Для просмотра логов проекта:

docker logs -f gateway

## Описание настроек config.json

```
{
"NAMESPACE": "Test", // Настройка Namespace СНОД
"SYSTEM": "Tandem", // Настройка Типа системы - Tandem | Proton | Mirazh
"GATEWAY_ID": "10", // ID СНОД из Сатурна
"REGION": "94", // Номер региона
"MQTT_USERNAME": "test", // Имя пользователя для подключения к Брокеру
"MQTT_PASSWORD": "BsWIltLhkNmjQrcwo9", // Пароль для подключения к Брокеру
"MQTT_SERVERS": [{
"host": "10.10.10.26",
"port": "1883",
"protocol": "mqtt"
}], // Настройки подключения к брокеру
"REDIS_HOST": "redis-gateway", // Имя сервиса для подключения к Redis
"REDIS_PORT": 6379, // Порт подключения к Redis
"CONNECTION_PORT": 3020, // Порт подключения к серверу Мираж | Протон. Либо порт для подключения Тандем к СНОД
"CONNECTION_HOST": "10.10.10.51", // IP адрес сервера для подключения
"RECONNECT_PERIOD": 1000, // Период переподключения к серверу в случае потери связи в мс (1000 мс = 1 сек)
"REQUEST_TIMEOUT": 45000, // Таймаут ответа от сервера на команды в мс
"REQUEST_RETRY": 1000, // Период повторной отправки команды управления в случае не получения подтверждения от сервера
"REQUEST_ATTEMPTS": 3, // Кол-во попыток отправки команды управления до отправки сообщения нет ответа от сервера
"SYSTEM_NUMBER": 1, // Номер системы для ПротонВеб
"DEFAULT_INTERVAL_MS": 7200000, // Не используется
"POSTGRES_DB": "F:\\test\\NEWCENTR.GDB", // Настройки подключения базы данных (имя базы данных) только для Мираж и Тандем
"POSTGRES_HOST": "10.10.10.51", // IP адрес базы данных
"POSTGRES_PORT": 3050, // Порт для подключения к БД (5432 для Мираж и 3050 для Тандем)
"POSTGRES_USER": "SYSDBA", // Имя пользователя БД
"POSTGRES_PASSWORD": "masterkey", // Пароль для подключения к БД
"GATEWAY_STATUS_PERIOD": 60000, // Период отправки статуса шлюза (раз в минуту)
"DEBUG": true, // Включение режима Debug (расширенное логирование)
"time": 1660900995761, // Дата в формате UnixTime в мс с датой последнего изменения настроек
"MQTT_HOST": "mqtt://broker.asbrok.kz", // Не используется
"QOS": 1, // Уровень качества отправки сообщения
"KRT": 120, // Номер КРТ для Тандем
"RMO_ID": 15, // Номер РМО Для Тандем
"UDP_PORT": 3020 // Порт подключения как к Тандем
}
```

