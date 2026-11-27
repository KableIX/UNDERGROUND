<?php
declare(strict_types=1);
header_remove('X-Powered-By');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
require __DIR__ . '/inc/token.php';
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'message' => 'Method not allowed.']);
    exit;
}
try {
    echo json_encode(['ok' => true, 'token' => ug_csrf_issue()]);
} catch (Throwable $e) {
    http_response_code(503);
    echo json_encode(['ok' => false, 'message' => 'Unable to submit right now.']);
}
