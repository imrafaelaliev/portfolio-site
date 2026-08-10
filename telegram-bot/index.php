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
        tb_storage_read($config);
        echo json_encode(
            ['status' => 'ok', 'service' => 'telegram-materials-bot'],
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

// Telegram ждёт ответ всего несколько секунд. На shared-хостинге
// сразу закрываем HTTP-ответ, а обработку заканчиваем после этого.
echo json_encode(['ok' => true]);
ignore_user_abort(true);
if (function_exists('fastcgi_finish_request')) {
    fastcgi_finish_request();
} else {
    if (ob_get_level() > 0) {
        ob_end_flush();
    }
    flush();
}

if (!$claimed) {
    exit;
}

try {
    tb_handle_update($config, $update);
} catch (Throwable $error) {
    tb_log_error($config, 'Update ' . (int) $update['update_id'] . ': ' . $error->getMessage());
}
