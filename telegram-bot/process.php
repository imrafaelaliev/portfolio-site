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
if (!preg_match('/^\d+$/', $job)) {
    http_response_code(400);
    echo json_encode(['ok' => false]);
    exit;
}

$updateId = (int) $job;
$update = tb_read_queued_update($config, $updateId);
if ($update === null) {
    echo json_encode(['ok' => true, 'empty' => true]);
    exit;
}

// Внутренний запрос закрывает соединение сразу, но PHP продолжает работу.
ignore_user_abort(true);
set_time_limit(120);
echo json_encode(['ok' => true, 'processing' => true]);
if (function_exists('fastcgi_finish_request')) {
    fastcgi_finish_request();
} else {
    if (ob_get_level() > 0) {
        ob_end_flush();
    }
    flush();
}

try {
    tb_handle_update($config, $update);
    tb_delete_queued_update($config, $updateId);
} catch (Throwable $error) {
    tb_log_error($config, 'Queued update ' . $updateId . ': ' . $error->getMessage());
}
