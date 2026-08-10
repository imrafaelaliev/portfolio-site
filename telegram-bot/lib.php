<?php
declare(strict_types=1);

function tb_initial_storage(): array
{
    return [
        'version' => 1,
        'next_material_id' => 1,
        'materials' => [],
        'users' => [],
        'requests' => [],
        'fsm' => [],
        'pending_keywords' => [],
        'processed_updates' => [],
        'settings' => [
            'welcome_text' => "Привет! Напиши кодовое слово, и я отправлю тебе материал.\nЕсли ты ещё не подписан на канал, сначала нужно будет подписаться.",
            'not_subscribed_text' => "Чтобы получить материал, подпишись на канал.\nПосле подписки вернись сюда и нажми «Проверить подписку».",
            'unknown_keyword_text' => "Не нашёл такой материал. Проверь кодовое слово и попробуй ещё раз.",
        ],
    ];
}

function tb_data_dir(array $config): string
{
    $directory = __DIR__ . '/data';
    if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
        throw new RuntimeException('Не удалось создать папку данных');
    }
    return $directory;
}

function tb_storage_path(array $config): string
{
    return tb_data_dir($config) . '/storage.json';
}

function tb_storage_read(array $config): array
{
    $path = tb_storage_path($config);
    if (!is_file($path)) {
        tb_storage_update($config, static function (array &$storage): void {
            // Создание хранилища происходит внутри storage_update.
        });
    }
    $handle = fopen($path, 'rb');
    if ($handle === false) {
        throw new RuntimeException('Не удалось открыть хранилище');
    }
    try {
        if (!flock($handle, LOCK_SH)) {
            throw new RuntimeException('Не удалось заблокировать хранилище');
        }
        $raw = stream_get_contents($handle);
        $storage = json_decode($raw ?: '', true);
        return is_array($storage) ? $storage : tb_initial_storage();
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}

function tb_storage_update(array $config, callable $callback)
{
    $path = tb_storage_path($config);
    $handle = fopen($path, 'c+');
    if ($handle === false) {
        throw new RuntimeException('Не удалось открыть хранилище');
    }
    try {
        if (!flock($handle, LOCK_EX)) {
            throw new RuntimeException('Не удалось заблокировать хранилище');
        }
        rewind($handle);
        $raw = stream_get_contents($handle);
        $storage = json_decode($raw ?: '', true);
        if (!is_array($storage)) {
            $storage = tb_initial_storage();
        }
        $result = $callback($storage);
        $encoded = json_encode(
            $storage,
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT
        );
        if ($encoded === false) {
            throw new RuntimeException('Не удалось сохранить данные');
        }
        rewind($handle);
        ftruncate($handle, 0);
        fwrite($handle, $encoded);
        fflush($handle);
        return $result;
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}

function tb_log_error(array $config, string $message): void
{
    $clean = str_replace($config['bot_token'] ?? '', '[token]', $message);
    error_log(date('c') . ' ' . $clean . PHP_EOL, 3, tb_data_dir($config) . '/error.log');
}

function tb_normalize(string $value): string
{
    $value = preg_replace('/\s+/u', ' ', trim($value)) ?? trim($value);
    if (function_exists('mb_strtolower')) {
        return mb_strtolower($value, 'UTF-8');
    }
    return strtr($value, [
        'А'=>'а','Б'=>'б','В'=>'в','Г'=>'г','Д'=>'д','Е'=>'е','Ё'=>'ё','Ж'=>'ж','З'=>'з','И'=>'и','Й'=>'й',
        'К'=>'к','Л'=>'л','М'=>'м','Н'=>'н','О'=>'о','П'=>'п','Р'=>'р','С'=>'с','Т'=>'т','У'=>'у','Ф'=>'ф',
        'Х'=>'х','Ц'=>'ц','Ч'=>'ч','Ш'=>'ш','Щ'=>'щ','Ъ'=>'ъ','Ы'=>'ы','Ь'=>'ь','Э'=>'э','Ю'=>'ю','Я'=>'я',
    ]);
}

function tb_claim_update(array $config, int $updateId): bool
{
    return (bool) tb_storage_update($config, static function (array &$storage) use ($updateId): bool {
        $key = (string) $updateId;
        if (isset($storage['processed_updates'][$key])) {
            return false;
        }
        $storage['processed_updates'][$key] = time();
        if (count($storage['processed_updates']) > 500) {
            asort($storage['processed_updates']);
            $storage['processed_updates'] = array_slice(
                $storage['processed_updates'], -300, null, true
            );
        }
        return true;
    });
}

function tb_release_update(array $config, int $updateId): void
{
    tb_storage_update($config, static function (array &$storage) use ($updateId): void {
        unset($storage['processed_updates'][(string) $updateId]);
    });
}

function tb_tg(array $config, string $method, array $params = []): array
{
    foreach ($params as $key => $value) {
        if (is_array($value)) {
            $params[$key] = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } elseif (is_bool($value)) {
            $params[$key] = $value ? 'true' : 'false';
        }
    }
    $url = 'https://api.telegram.org/bot' . $config['bot_token'] . '/' . $method;
    $payload = http_build_query($params);
    $raw = false;

    if (function_exists('curl_init')) {
        $curl = curl_init($url);
        curl_setopt_array($curl, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
        ]);
        $raw = curl_exec($curl);
        $curlError = curl_error($curl);
        curl_close($curl);
        if ($raw === false) {
            throw new RuntimeException('Telegram connection error: ' . $curlError);
        }
    } else {
        $context = stream_context_create(['http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
            'content' => $payload,
            'timeout' => 15,
            'ignore_errors' => true,
        ]]);
        $raw = file_get_contents($url, false, $context);
        if ($raw === false) {
            throw new RuntimeException('Telegram connection error');
        }
    }

    $response = json_decode($raw, true);
    if (!is_array($response) || empty($response['ok'])) {
        $description = is_array($response) ? ($response['description'] ?? 'unknown error') : 'invalid response';
        throw new RuntimeException('Telegram API error: ' . $description);
    }
    return $response;
}

function tb_tg_safe(array $config, string $method, array $params = []): ?array
{
    try {
        return tb_tg($config, $method, $params);
    } catch (Throwable $error) {
        tb_log_error($config, $error->getMessage());
        return null;
    }
}

function tb_send_message(array $config, int $chatId, string $text, ?array $keyboard = null): void
{
    $params = ['chat_id' => $chatId, 'text' => $text];
    if ($keyboard !== null) {
        $params['reply_markup'] = ['inline_keyboard' => $keyboard];
    }
    tb_tg($config, 'sendMessage', $params);
}

function tb_start_keyboard(array $config): array
{
    return [
        [['text' => 'Все материалы', 'callback_data' => 'all_materials']],
        [['text' => 'Как получить?', 'callback_data' => 'how_it_works']],
        [['text' => 'Мой канал', 'url' => $config['channel_link']]],
    ];
}

function tb_admin_keyboard(): array
{
    return [
        [['text' => '➕ Добавить материал', 'callback_data' => 'admin:add']],
        [['text' => '📚 Список материалов', 'callback_data' => 'admin:list']],
        [['text' => '📊 Статистика', 'callback_data' => 'admin:stats']],
    ];
}

function tb_is_admin(array $config, int $userId): bool
{
    return $userId === (int) $config['admin_id'];
}

function tb_register_user(array $config, array $user): void
{
    $id = (string) ((int) ($user['id'] ?? 0));
    if ($id === '0') {
        return;
    }
    tb_storage_update($config, static function (array &$storage) use ($id, $user): void {
        $existing = $storage['users'][$id] ?? [];
        $storage['users'][$id] = [
            'id' => (int) $id,
            'username' => $user['username'] ?? null,
            'first_name' => $user['first_name'] ?? null,
            'created_at' => $existing['created_at'] ?? date('c'),
            'last_active_at' => date('c'),
        ];
    });
}

function tb_log_request(
    array $config,
    int $userId,
    string $keyword,
    ?int $materialId,
    string $status,
    bool $successful,
    string $eventType = 'keyword'
): void {
    tb_storage_update($config, static function (array &$storage) use (
        $userId, $keyword, $materialId, $status, $successful, $eventType
    ): void {
        $storage['requests'][] = [
            'user_id' => $userId,
            'keyword' => $keyword,
            'material_id' => $materialId,
            'subscription_status' => $status,
            'successful' => $successful,
            'event_type' => $eventType,
            'created_at' => date('c'),
        ];
        if (count($storage['requests']) > 20000) {
            $storage['requests'] = array_slice($storage['requests'], -15000);
        }
    });
}

function tb_material_by_keyword(array $config, string $keyword): ?array
{
    $needle = tb_normalize($keyword);
    $storage = tb_storage_read($config);
    foreach ($storage['materials'] as $material) {
        if (empty($material['active'])) {
            continue;
        }
        $words = array_merge([$material['keyword']], $material['aliases'] ?? []);
        foreach ($words as $word) {
            if (tb_normalize((string) $word) === $needle) {
                return $material;
            }
        }
    }
    return null;
}

function tb_subscription_status(array $config, int $userId): string
{
    $response = tb_tg_safe($config, 'getChatMember', [
        'chat_id' => $config['channel_username'],
        'user_id' => $userId,
    ]);
    if ($response === null || !isset($response['result']['status'])) {
        return 'error';
    }
    $member = $response['result'];
    $status = $member['status'];
    if (in_array($status, ['creator', 'administrator', 'member'], true)) {
        return 'subscribed';
    }
    if ($status === 'restricted' && !empty($member['is_member'])) {
        return 'subscribed';
    }
    return 'not_subscribed';
}

function tb_send_material(array $config, int $chatId, array $material): void
{
    tb_send_message($config, $chatId, 'Готово! Забирай материал 👇');
    foreach (($material['items'] ?? []) as $item) {
        $type = $item['type'] ?? 'text';
        if ($type === 'text') {
            tb_send_message($config, $chatId, (string) ($item['content'] ?? ''));
        } elseif ($type === 'link') {
            tb_send_message(
                $config,
                $chatId,
                (string) ($item['caption'] ?? 'Материал по ссылке 👇'),
                [[['text' => $item['button_text'] ?? 'Открыть материал', 'url' => $item['content']]]]
            );
        } else {
            $methods = [
                'photo' => 'sendPhoto',
                'video' => 'sendVideo',
                'document' => 'sendDocument',
            ];
            $fields = ['photo' => 'photo', 'video' => 'video', 'document' => 'document'];
            if (isset($methods[$type])) {
                $params = [
                    'chat_id' => $chatId,
                    $fields[$type] => $item['file_id'],
                ];
                if (!empty($item['caption'])) {
                    $params['caption'] = $item['caption'];
                }
                tb_tg($config, $methods[$type], $params);
            }
        }
    }
}

function tb_deliver_keyword(array $config, int $chatId, int $userId, string $keyword, bool $recheck = false): void
{
    $material = tb_material_by_keyword($config, $keyword);
    if ($material === null) {
        $settings = tb_storage_read($config)['settings'];
        tb_send_message($config, $chatId, $settings['unknown_keyword_text'], tb_start_keyboard($config));
        tb_log_request($config, $userId, $keyword, null, 'not_found', false, $recheck ? 'recheck' : 'keyword');
        return;
    }

    $subscription = tb_subscription_status($config, $userId);
    if ($subscription === 'error') {
        tb_send_message($config, $chatId, 'Сейчас не получилось проверить подписку. Попробуй ещё раз через минуту.');
        tb_log_request($config, $userId, $keyword, (int) $material['id'], 'error', false, $recheck ? 'recheck' : 'keyword');
        return;
    }
    if ($subscription !== 'subscribed') {
        tb_storage_update($config, static function (array &$storage) use ($userId, $keyword): void {
            $storage['pending_keywords'][(string) $userId] = $keyword;
        });
        $settings = tb_storage_read($config)['settings'];
        tb_send_message($config, $chatId, $settings['not_subscribed_text'], [
            [['text' => 'Подписаться', 'url' => $config['channel_link']]],
            [['text' => '✅ Проверить подписку', 'callback_data' => 'recheck']],
        ]);
        tb_log_request($config, $userId, $keyword, (int) $material['id'], 'not_subscribed', false, $recheck ? 'recheck' : 'keyword');
        return;
    }

    tb_send_material($config, $chatId, $material);
    tb_storage_update($config, static function (array &$storage) use ($userId): void {
        unset($storage['pending_keywords'][(string) $userId]);
    });
    tb_log_request($config, $userId, $keyword, (int) $material['id'], 'subscribed', true, $recheck ? 'recheck' : 'keyword');
}

function tb_all_materials(array $config, int $chatId): void
{
    $materials = tb_storage_read($config)['materials'];
    $active = array_values(array_filter($materials, static function (array $material): bool {
        return !empty($material['active']);
    }));
    if (!$active) {
        tb_send_message($config, $chatId, 'Сейчас доступных материалов нет. Загляни сюда чуть позже.');
        return;
    }
    usort($active, static function (array $a, array $b): int {
        return strcmp(tb_normalize($a['title']), tb_normalize($b['title']));
    });
    $text = "Все доступные материалы:\n\nМатериал — кодовое слово\n\n";
    foreach ($active as $material) {
        $line = '• ' . $material['title'] . ' — ' . $material['keyword'] . "\n";
        if (strlen($text . $line) > 3800) {
            tb_send_message($config, $chatId, rtrim($text));
            $text = "Продолжение списка:\n\n";
        }
        $text .= $line;
    }
    tb_send_message($config, $chatId, rtrim($text));
}

function tb_set_fsm(array $config, int $userId, ?string $state, array $data = []): void
{
    tb_storage_update($config, static function (array &$storage) use ($userId, $state, $data): void {
        $key = (string) $userId;
        if ($state === null) {
            unset($storage['fsm'][$key]);
        } else {
            $storage['fsm'][$key] = ['state' => $state, 'data' => $data, 'updated_at' => date('c')];
        }
    });
}

function tb_get_fsm(array $config, int $userId): ?array
{
    return tb_storage_read($config)['fsm'][(string) $userId] ?? null;
}

function tb_keyword_is_taken(array $storage, string $keyword, array $aliases = []): bool
{
    $wanted = array_map('tb_normalize', array_merge([$keyword], $aliases));
    foreach ($storage['materials'] as $material) {
        $existing = array_merge([$material['keyword']], $material['aliases'] ?? []);
        foreach ($existing as $word) {
            if (in_array(tb_normalize((string) $word), $wanted, true)) {
                return true;
            }
        }
    }
    return false;
}

function tb_extract_item(array $message): ?array
{
    if (!empty($message['photo']) && is_array($message['photo'])) {
        $photos = $message['photo'];
        $photo = end($photos);
        return ['type' => 'photo', 'file_id' => $photo['file_id'], 'caption' => $message['caption'] ?? null];
    }
    if (!empty($message['video']['file_id'])) {
        return ['type' => 'video', 'file_id' => $message['video']['file_id'], 'caption' => $message['caption'] ?? null];
    }
    if (!empty($message['document']['file_id'])) {
        return ['type' => 'document', 'file_id' => $message['document']['file_id'], 'caption' => $message['caption'] ?? null];
    }
    if (isset($message['text']) && trim((string) $message['text']) !== '') {
        $text = trim((string) $message['text']);
        if (preg_match('~^https?://\S+$~ui', $text)) {
            return ['type' => 'link', 'content' => $text, 'caption' => null, 'button_text' => 'Открыть материал'];
        }
        return ['type' => 'text', 'content' => (string) $message['text']];
    }
    return null;
}

function tb_handle_admin_state(array $config, array $message, int $userId, int $chatId, array $fsm): bool
{
    $state = $fsm['state'] ?? '';
    $data = $fsm['data'] ?? [];
    $text = trim((string) ($message['text'] ?? ''));

    if ($state === 'add_title') {
        if ($text === '' || strlen($text) > 300) {
            tb_send_message($config, $chatId, 'Введи короткое название материала.');
            return true;
        }
        $data['title'] = $text;
        tb_set_fsm($config, $userId, 'add_keyword', $data);
        tb_send_message($config, $chatId, 'Теперь введи главное кодовое слово.');
        return true;
    }
    if ($state === 'add_keyword') {
        if ($text === '' || strlen($text) > 150) {
            tb_send_message($config, $chatId, 'Кодовое слово слишком длинное или пустое.');
            return true;
        }
        if (tb_keyword_is_taken(tb_storage_read($config), $text)) {
            tb_send_message($config, $chatId, 'Это слово уже используется. Введи другое.');
            return true;
        }
        $data['keyword'] = $text;
        tb_set_fsm($config, $userId, 'add_aliases', $data);
        tb_send_message($config, $chatId, 'Введи синонимы через запятую или отправь минус: -');
        return true;
    }
    if ($state === 'add_aliases') {
        if (!isset($message['text'])) {
            tb_send_message($config, $chatId, 'Отправь синонимы текстом или минус: -');
            return true;
        }
        $aliases = $text === '-' ? [] : array_values(array_filter(array_map('trim', explode(',', $text))));
        if (tb_keyword_is_taken(tb_storage_read($config), $data['keyword'], $aliases)) {
            tb_send_message($config, $chatId, 'Один из синонимов уже занят. Введи другие или минус.');
            return true;
        }
        $data['aliases'] = $aliases;
        tb_set_fsm($config, $userId, 'add_payload', $data);
        tb_send_message($config, $chatId, 'Теперь отправь сам материал: текст, ссылку, PDF/файл, фото или видео.');
        return true;
    }
    if ($state === 'add_payload') {
        $item = tb_extract_item($message);
        if ($item === null) {
            tb_send_message($config, $chatId, 'Этот формат пока не поддерживается.');
            return true;
        }
        $materialId = tb_storage_update($config, static function (array &$storage) use ($data, $item): int {
            $id = (int) $storage['next_material_id'];
            $storage['next_material_id'] = $id + 1;
            $storage['materials'][(string) $id] = [
                'id' => $id,
                'title' => $data['title'],
                'keyword' => $data['keyword'],
                'aliases' => $data['aliases'] ?? [],
                'active' => true,
                'items' => [$item],
                'created_at' => date('c'),
            ];
            return $id;
        });
        tb_set_fsm($config, $userId, null);
        tb_send_message(
            $config,
            $chatId,
            'Материал добавлен.\nКодовое слово: ' . $data['keyword'] . '\nID: ' . $materialId,
            tb_admin_keyboard()
        );
        return true;
    }
    return false;
}

function tb_admin_list(array $config, int $chatId): void
{
    $materials = tb_storage_read($config)['materials'];
    if (!$materials) {
        tb_send_message($config, $chatId, 'Материалов пока нет.', tb_admin_keyboard());
        return;
    }
    foreach (array_slice(array_reverse($materials, true), 0, 30, true) as $material) {
        $status = !empty($material['active']) ? 'включён' : 'выключен';
        $aliases = implode(', ', $material['aliases'] ?? []);
        tb_send_message(
            $config,
            $chatId,
            '#' . $material['id'] . ' — ' . $material['title'] .
            "\nКодовое слово: " . $material['keyword'] .
            "\nСинонимы: " . ($aliases ?: 'нет') .
            "\nСтатус: " . $status,
            [[
                ['text' => !empty($material['active']) ? '🚫 Выключить' : '✅ Включить', 'callback_data' => 'admin:toggle:' . $material['id']],
                ['text' => '🗑 Удалить', 'callback_data' => 'admin:delete_ask:' . $material['id']],
            ]]
        );
    }
}

function tb_admin_stats(array $config, int $chatId): void
{
    $storage = tb_storage_read($config);
    $today = date('Y-m-d');
    $delivered = 0;
    $todayRequests = 0;
    $denied = 0;
    foreach ($storage['requests'] as $request) {
        if (!empty($request['successful'])) {
            $delivered++;
        }
        if (substr((string) $request['created_at'], 0, 10) === $today && ($request['event_type'] ?? '') === 'keyword') {
            $todayRequests++;
        }
        if (($request['subscription_status'] ?? '') === 'not_subscribed') {
            $denied++;
        }
    }
    tb_send_message(
        $config,
        $chatId,
        "📊 Статистика\n\n" .
        'Пользователей: ' . count($storage['users']) .
        "\nЗапросов сегодня: " . $todayRequests .
        "\nМатериалов выдано: " . $delivered .
        "\nОтказов без подписки: " . $denied,
        tb_admin_keyboard()
    );
}

function tb_handle_callback(array $config, array $callback): void
{
    $user = $callback['from'] ?? [];
    $userId = (int) ($user['id'] ?? 0);
    $chatId = (int) ($callback['message']['chat']['id'] ?? $userId);
    $data = (string) ($callback['data'] ?? '');
    tb_register_user($config, $user);
    tb_tg_safe($config, 'answerCallbackQuery', ['callback_query_id' => $callback['id']]);

    if ($data === 'all_materials') {
        tb_all_materials($config, $chatId);
        return;
    }
    if ($data === 'how_it_works') {
        tb_send_message($config, $chatId, 'Просто отправь мне кодовое слово из поста. Я проверю подписку и сразу пришлю материал.');
        return;
    }
    if ($data === 'recheck') {
        $keyword = tb_storage_read($config)['pending_keywords'][(string) $userId] ?? null;
        if ($keyword === null) {
            tb_send_message($config, $chatId, 'Не нашёл ожидающий материал. Отправь кодовое слово ещё раз.');
            return;
        }
        tb_deliver_keyword($config, $chatId, $userId, $keyword, true);
        return;
    }

    if (strpos($data, 'admin:') !== 0 || !tb_is_admin($config, $userId)) {
        return;
    }
    if ($data === 'admin:add') {
        tb_set_fsm($config, $userId, 'add_title');
        tb_send_message($config, $chatId, 'Введи понятное название материала. Для отмены: /cancel');
    } elseif ($data === 'admin:list') {
        tb_admin_list($config, $chatId);
    } elseif ($data === 'admin:stats') {
        tb_admin_stats($config, $chatId);
    } elseif (preg_match('/^admin:toggle:(\d+)$/', $data, $match)) {
        $id = $match[1];
        tb_storage_update($config, static function (array &$storage) use ($id): void {
            if (isset($storage['materials'][$id])) {
                $storage['materials'][$id]['active'] = empty($storage['materials'][$id]['active']);
            }
        });
        tb_send_message($config, $chatId, 'Статус материала изменён.', tb_admin_keyboard());
    } elseif (preg_match('/^admin:delete_ask:(\d+)$/', $data, $match)) {
        $id = $match[1];
        tb_send_message(
            $config,
            $chatId,
            'Точно удалить материал #' . $id . '? Это нельзя отменить.',
            [[
                ['text' => '✅ Да, удалить', 'callback_data' => 'admin:delete_confirm:' . $id],
                ['text' => 'Отмена', 'callback_data' => 'admin:list'],
            ]]
        );
    } elseif (preg_match('/^admin:delete_confirm:(\d+)$/', $data, $match)) {
        $id = $match[1];
        tb_storage_update($config, static function (array &$storage) use ($id): void {
            unset($storage['materials'][$id]);
        });
        tb_send_message($config, $chatId, 'Материал удалён.', tb_admin_keyboard());
    }
}

function tb_handle_message(array $config, array $message): void
{
    $user = $message['from'] ?? [];
    $userId = (int) ($user['id'] ?? 0);
    $chatId = (int) ($message['chat']['id'] ?? $userId);
    $text = trim((string) ($message['text'] ?? ''));
    tb_register_user($config, $user);

    if ($text === '/cancel' && tb_is_admin($config, $userId)) {
        tb_set_fsm($config, $userId, null);
        tb_send_message($config, $chatId, 'Действие отменено.', tb_admin_keyboard());
        return;
    }
    if ($text === '/start' || strpos($text, '/start ') === 0) {
        $settings = tb_storage_read($config)['settings'];
        tb_log_request($config, $userId, '/start', null, 'not_checked', false, 'start');
        tb_send_message($config, $chatId, $settings['welcome_text'], tb_start_keyboard($config));
        return;
    }
    if ($text === '/admin') {
        if (tb_is_admin($config, $userId)) {
            tb_set_fsm($config, $userId, null);
            tb_send_message($config, $chatId, 'Админ-меню', tb_admin_keyboard());
        }
        return;
    }

    if (tb_is_admin($config, $userId)) {
        $fsm = tb_get_fsm($config, $userId);
        if ($fsm !== null && tb_handle_admin_state($config, $message, $userId, $chatId, $fsm)) {
            return;
        }
    }
    if ($text !== '') {
        tb_deliver_keyword($config, $chatId, $userId, $text);
    }
}

function tb_handle_update(array $config, array $update): void
{
    if (isset($update['callback_query']) && is_array($update['callback_query'])) {
        tb_handle_callback($config, $update['callback_query']);
    } elseif (isset($update['message']) && is_array($update['message'])) {
        tb_handle_message($config, $update['message']);
    }
}
