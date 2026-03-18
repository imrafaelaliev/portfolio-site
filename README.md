# Портфолио сайт Рафаэля

Статический сайт (HTML + CSS + JS):
- `index.html` — главная
- `marshall/index.html` — кейс MARSHALL
- `hios/index.html` — кейс HiOS
- `sladonezh/index.html` — кейс Сладонеж
- `lori/index.html` — кейс Lori

## Локальный запуск
Открой `index.html` в браузере или запусти простой сервер:

```bash
python3 -m http.server 8080
```

После этого открой `http://localhost:8080`.

## Деплой на reg.ru (статический хостинг)
1. Открой панель reg.ru.
2. Зайди в файловый менеджер сайта (`public_html` или корневая папка домена).
3. Залей все файлы и папки из проекта (`css`, `js`, `marshall`, `hios`, `sladonezh`, `lori`, `index.html`).
4. Убедись, что `index.html` лежит в корне сайта.
5. Проверь открытие страниц:
   - `/marshall`
   - `/hios`
   - `/sladonezh`
   - `/lori`

## Деплой на Netlify через API
В проекте есть файл `.netlify-deploy.env` c `NETLIFY_AUTH_TOKEN` и `NETLIFY_SITE_ID`.

### Разовый деплой
```bash
./scripts/deploy-netlify.sh
```

### Автодеплой при изменении файлов
```bash
./scripts/auto-deploy-netlify.sh
```

Этот режим сразу отправляет стартовый деплой, затем следит за изменениями.
Остановка автодеплоя: `Ctrl+C`.
