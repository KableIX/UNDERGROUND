<?php
declare(strict_types=1);

function ug_csrf_secret(): string {
    $f = __DIR__ . '/secret.php';
    if (!is_file($f)) {
        throw new RuntimeException('CSRF is not configured.');
    }
    $s = require $f;
    if (!is_string($s) || strlen($s) < 32) {
        throw new RuntimeException('CSRF is not configured.');
    }
    return $s;
}

function ug_csrf_issue(): string {
    $ts = (string) time();
    $nonce = bin2hex(random_bytes(16));
    $msg = $ts . '.' . $nonce;
    $mac = hash_hmac('sha256', $msg, ug_csrf_secret());
    return $msg . '.' . $mac;
}

function ug_csrf_verify(?string $token): bool {
    if (!is_string($token) || $token === '') {
        return false;
    }
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        return false;
    }
    [$ts, $nonce, $mac] = $parts;
    if (!ctype_digit($ts) || !ctype_xdigit($nonce) || !ctype_xdigit($mac)) {
        return false;
    }
    if (strlen($nonce) !== 32 || strlen($mac) !== 64) {
        return false;
    }
    $age = time() - (int) $ts;
    if ($age < -30 || $age > 7200) {
        return false;
    }
    $calc = hash_hmac('sha256', $ts . '.' . $nonce, ug_csrf_secret());
    return hash_equals($calc, strtolower($mac));
}

function ug_csrf_origin_ok(): bool {
    $allowed = [
        'https://theunderground.vip',
        'https://www.theunderground.vip',
    ];
    $origin = trim((string) ($_SERVER['HTTP_ORIGIN'] ?? ''));
    if ($origin !== '') {
        return in_array(rtrim($origin, '/'), $allowed, true);
    }
    $ref = (string) ($_SERVER['HTTP_REFERER'] ?? '');
    if ($ref === '') {
        return false;
    }
    foreach ($allowed as $base) {
        if ($ref === $base || str_starts_with($ref, $base . '/')) {
            return true;
        }
    }
    return false;
}
