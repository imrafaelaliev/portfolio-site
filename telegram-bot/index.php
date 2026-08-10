<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

$configFile = __DIR__ . '/config.php';
if (!is_file($configFile)) {
    http_response_code(503);
    echo json_encode(['status' => 'config_missing'], JSON_UNESCAPED_UNICODE);
    exit;
}

$config = require $configFile;
require __DIR__ . '/lib.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    try {
        $storage = tb_storage_read($config);
        echo json_encode(
            [
                'status' => 'ok',
                'service' => 'telegram-materials-bot',
                'materials' => count($storage['materials'] ?? []),
                'queued_updates' => tb_queue_count($config),
            ],
            JSON_UNESCAPED_UNICODE
        );
    } catch (Throwable $error) {
        tb_log_error($config, $error->getMessage());
        http_response_code(503);
        echo json_encode(['status' => 'storage_error'], JSON_UNESCAPED_UNICODE);
    }
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false]);
    exit;
}

$receivedSecret = $_SERVER['HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN'] ?? '';
if (!is_string($receivedSecret) || !hash_equals($config['webhook_secret'], $receivedSecret)) {
    http_response_code(401);
    echo json_encode(['ok' => false]);
    exit;
}

$rawUpdate = file_get_contents('php://input');
$update = json_decode($rawUpdate ?: '', true);
if (!is_array($update) || !isset($update['update_id'])) {
    http_response_code(400);
    echo json_encode(['ok' => false]);
    exit;
}

try {
    $claimed = tb_claim_update($config, (int) $update['update_id']);
} catch (Throwable $error) {
    tb_log_error($config, $error->getMessage());
    http_response_code(500);
    echo json_encode(['ok' => false]);
    exit;
}

if (!$claimed) {
    echo json_encode(['ok' => true, 'duplicate' => true]);
    exit;
}

try {
    tb_enqueue_update($config, $update);
    if (!tb_trigger_worker($config, (int) $update['update_id'])) {
        throw new RuntimeException('Не удалось запустить внутренний обработчик');
    }
    // На этом HTTP-запрос Telegram закончен. Отправка ответа
    // и PDF идёт отдельным внутренним запросом и не вызывает таймаут.
    echo json_encode(['ok' => true, 'queued' => true]);
} catch (Throwable $error) {
    tb_delete_queued_update($config, (int) $update['update_id']);
    tb_release_update($config, (int) $update['update_id']);
    tb_log_error($config, $error->getMessage());
    http_response_code(500);
    echo json_encode(['ok' => false]);
}
