<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$configFile = __DIR__ . '/config.php';
if (!is_file($configFile)) {
    http_response_code(503);
    echo json_encode(['ok' => false]);
    exit;
}

$config = require $configFile;
require __DIR__ . '/lib.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false]);
    exit;
}

$receivedSecret = $_SERVER['HTTP_X_TELEGRAM_BOT_WORKER_SECRET'] ?? '';
if (!is_string($receivedSecret) || !hash_equals($config['webhook_secret'], $receivedSecret)) {
    http_response_code(401);
    echo json_encode(['ok' => false]);
    exit;
}

$job = (string) ($_GET['job'] ?? '');
if ($job === 'check') {
    try {
        $response = tb_tg($config, 'getMe');
        echo json_encode(
            [
                'ok' => true,
                'telegram_api' => true,
                'bot_id' => (int) ($response['result']['id'] ?? 0),
            ],
            JSON_UNESCAPED_UNICODE
        );
    } catch (Throwable $error) {
        tb_log_error($config, 'Telegram API check: ' . $error->getMessage());
        http_response_code(502);
        echo json_encode(
            [
                'ok' => false,
                'telegram_api' => false,
                'error' => $error->getMessage(),
            ],
            JSON_UNESCAPED_UNICODE
        );
    }
    exit;
}

if ($job === 'all') {
    $updateIds = tb_queued_update_ids($config, 20);
} elseif (preg_match('/^\d+$/', $job)) {
    $updateIds = [(int) $job];
} else {
    http_response_code(400);
    echo json_encode(['ok' => false]);
    exit;
}

if ($updateIds === []) {
    echo json_encode(['ok' => true, 'empty' => true]);
    exit;
}

// Внутренний запрос закрывает соединение сразу, но PHP продолжает работу.
ignore_user_abort(true);
set_time_limit(120);
echo json_encode(['ok' => true, 'processing' => count($updateIds)]);
if (function_exists('fastcgi_finish_request')) {
    fastcgi_finish_request();
} else {
    if (ob_get_level() > 0) {
        ob_end_flush();
    }
    flush();
}

foreach ($updateIds as $updateId) {
    try {
        $update = tb_take_queued_update($config, $updateId);
        if ($update === null) {
            continue;
        }
        tb_handle_update($config, $update);
        tb_complete_queued_update($config, $updateId);
    } catch (Throwable $error) {
        tb_restore_queued_update($config, $updateId);
        tb_log_error($config, 'Queued update ' . $updateId . ': ' . $error->getMessage());
    }
}
