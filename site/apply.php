<?php
declare(strict_types=1);
header_remove('X-Powered-By');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function reply(int $status, string $message, bool $ok=false): never {
    http_response_code($status);
    echo json_encode(['ok'=>$ok,'message'=>$message]);
    exit;
}
require __DIR__ . '/inc/token.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') reply(405, 'Method not allowed.');
$contentLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
if ($contentLength > 8192) reply(413, 'Request too large.');
$raw = file_get_contents('php://input');
if (is_string($raw) && strlen($raw) > 8192) reply(413, 'Request too large.');
if (!ug_csrf_origin_ok() || !ug_csrf_verify(isset($_POST['csrf']) ? (string) $_POST['csrf'] : null)) {
    reply(403, 'Unable to submit right now.');
}
if (!empty($_POST['website'])) reply(200, 'Request received.', true);
$email = strtolower(trim((string)($_POST['email'] ?? '')));
$region = (string)($_POST['region'] ?? '');
$type = (string)($_POST['applicant_type'] ?? '');
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254 ||
    !in_array($region, ['california','florida','other'], true) ||
    !in_array($type, ['owner','club','creator'], true) ||
    ($_POST['consent'] ?? '') !== 'yes') reply(422, 'Please complete all fields and consent.');
// Store private records outside the website's public_html folder.
$dir = dirname(__DIR__) . '/underground-private';
if (!is_dir($dir) && !mkdir($dir, 0700, true)) reply(503, 'Applications temporarily unavailable.');
$file = $dir . '/applications.csv';
$fp = @fopen($file, 'c+');
if (!$fp) reply(503, 'Applications temporarily unavailable.');
@chmod($file, 0600);
if (!flock($fp, LOCK_EX)) { fclose($fp); reply(503, 'Please try again.'); }
$exists = false;
rewind($fp);
while (($row = fgetcsv($fp)) !== false) {
    if (isset($row[1]) && strtolower($row[1]) === $email) { $exists=true; break; }
}
if (!$exists) {
    fseek($fp, 0, SEEK_END);
    if (fputcsv($fp, [gmdate('c'),$email,$region,$type,'yes']) === false) {
        flock($fp, LOCK_UN); fclose($fp); reply(503, 'Please try again.');
    }
    fflush($fp);
}
flock($fp, LOCK_UN);
fclose($fp);
reply(200, 'Request received. If selected, we will contact you by email.', true);
