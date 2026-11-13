<?php
/**
 * admin.php — لوحة تحكم المطور المستقلة (خارج التطبيق نهائياً)
 * مربوطة مباشرة مع Firebase Realtime Database: mrwan-dd795
 *
 * كلمة مرور الدخول الافتراضية: admin1234
 * يُنصح بتغيير ADMIN_PASSWORD قبل الرفع على استضافة عامة.
 */

session_start();

define('ADMIN_PASSWORD', 'admin1234');
define('FIREBASE_DB_URL', 'https://mrwan-dd795-default-rtdb.firebaseio.com');

function fbRequest(string $path, string $method = 'GET', $data = null) {
    $url = rtrim(FIREBASE_DB_URL, '/') . '/' . ltrim($path, '/') . '.json';
    $payload = $data !== null ? json_encode($data, JSON_UNESCAPED_UNICODE) : null;

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        curl_setopt($ch, CURLOPT_TIMEOUT, 12);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        if ($payload !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        }
        $res = curl_exec($ch);
        $err = curl_error($ch);
        curl_close($ch);
        if ($res !== false && !$err) {
            return json_decode($res, true);
        }
    }

    $opts = [
        'http' => [
            'method' => $method,
            'header' => "Content-Type: application/json\r\n",
            'content' => $payload,
            'timeout' => 12,
        ]
    ];
    $context = stream_context_create($opts);
    $res = @file_get_contents($url, false, $context);
    return $res ? json_decode($res, true) : null;
}

function jsonOut($data, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function computeExpiration(string $unit, float $amount, ?string $customDate = null): array {
    $nowMs = (int) round(microtime(true) * 1000);

    if ($customDate !== null && trim($customDate) !== '') {
        $ts = strtotime($customDate);
        if ($ts !== false && ($ts * 1000) > $nowMs) {
            return [
                'expiresAt' => $ts * 1000,
                'label' => 'تاريخ محدد يدوياً',
            ];
        }
    }

    $safe = max(1, (int) $amount);
    $MIN = 60000;
    $HOUR = 3600000;
    $DAY = 86400000;

    switch ($unit) {
        case 'minutes':
            return ['expiresAt' => $nowMs + ($safe * $MIN), 'label' => $safe . ' دقيقة'];
        case 'hours':
            return ['expiresAt' => $nowMs + ($safe * $HOUR), 'label' => $safe === 1 ? 'ساعة واحدة' : $safe . ' ساعات'];
        case 'days':
            return ['expiresAt' => $nowMs + ($safe * $DAY), 'label' => $safe === 1 ? 'يوم واحد' : $safe . ' أيام'];
        case 'weeks':
            return ['expiresAt' => $nowMs + ($safe * 7 * $DAY), 'label' => $safe === 1 ? 'أسبوع واحد' : $safe . ' أسابيع'];
        case 'months':
            return ['expiresAt' => $nowMs + ($safe * 30 * $DAY), 'label' => $safe === 1 ? 'شهر واحد' : $safe . ' أشهر'];
        case 'years':
            return ['expiresAt' => $nowMs + ($safe * 365 * $DAY), 'label' => $safe === 1 ? 'سنة واحدة' : $safe . ' سنوات'];
        case 'unlimited':
        default:
            return ['expiresAt' => null, 'label' => 'فتح دائم (غير محدد)'];
    }
}

// Handle Logout
if (isset($_GET['logout'])) {
    unset($_SESSION['vf_admin_auth']);
    session_destroy();
    header('Location: admin.php');
    exit;
}

// Handle Login POST
$loginError = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['admin_login'])) {
    $pass = $_POST['password'] ?? '';
    if (hash_equals(ADMIN_PASSWORD, $pass)) {
        $_SESSION['vf_admin_auth'] = true;
        header('Location: admin.php');
        exit;
    } else {
        $loginError = 'كلمة المرور غير صحيحة';
    }
}

$isAuthed = !empty($_SESSION['vf_admin_auth']);

// AJAX JSON API Actions (Authenticated only)
if (isset($_GET['api'])) {
    if (!$isAuthed) {
        jsonOut(['error' => 'غير مصرح'], 401);
    }

    $action = $_GET['api'];
    $rawBody = file_get_contents('php://input');
    $body = $rawBody ? (json_decode($rawBody, true) ?: []) : $_POST;

    if ($action === 'list') {
        $devices = fbRequest('devices');
        if (!is_array($devices)) {
            $devices = [];
        }
        $nowMs = (int) round(microtime(true) * 1000);
        foreach ($devices as $id => &$dev) {
            if (($dev['status'] ?? '') === 'approved' && !empty($dev['expiresAt']) && $nowMs >= (int)$dev['expiresAt']) {
                $dev['status'] = 'expired';
                fbRequest('devices/' . rawurlencode($id), 'PATCH', ['status' => 'expired']);
            }
        }
        unset($dev);
        $list = array_values($devices);
        usort($list, function ($a, $b) {
            return ($b['lastSeenAt'] ?? 0) <=> ($a['lastSeenAt'] ?? 0);
        });
        jsonOut(['devices' => $list, 'serverTime' => $nowMs]);
    }

    if ($action === 'approve') {
        $deviceId = trim((string)($body['deviceId'] ?? ''));
        if ($deviceId === '') jsonOut(['error' => 'deviceId مطلوب'], 400);

        $unit = (string)($body['unit'] ?? 'unlimited');
        $amount = (float)($body['amount'] ?? 1);
        $customDate = isset($body['customExpiresAt']) ? (string)$body['customExpiresAt'] : null;
        $customLabel = isset($body['customLabel']) ? trim((string)$body['customLabel']) : null;

        $exp = computeExpiration($unit, $amount, $customDate);
        $nowMs = (int) round(microtime(true) * 1000);

        $patch = [
            'status' => 'approved',
            'approvedAt' => $nowMs,
            'expiresAt' => $exp['expiresAt'],
            'durationLabel' => $exp['label'],
        ];
        if ($customLabel !== null) {
            $patch['customLabel'] = mb_substr($customLabel, 0, 80);
        }

        fbRequest('devices/' . rawurlencode($deviceId), 'PATCH', $patch);
        $updated = fbRequest('devices/' . rawurlencode($deviceId));
        jsonOut(['ok' => true, 'device' => $updated]);
    }

    if ($action === 'reject') {
        $deviceId = trim((string)($body['deviceId'] ?? ''));
        if ($deviceId === '') jsonOut(['error' => 'deviceId مطلوب'], 400);

        fbRequest('devices/' . rawurlencode($deviceId), 'PATCH', [
            'status' => 'rejected',
            'expiresAt' => null,
            'durationLabel' => 'مرفوض من المطور',
        ]);
        jsonOut(['ok' => true]);
    }

    if ($action === 'update_label') {
        $deviceId = trim((string)($body['deviceId'] ?? ''));
        $customLabel = mb_substr(trim((string)($body['customLabel'] ?? '')), 0, 80);
        if ($deviceId === '') jsonOut(['error' => 'deviceId مطلوب'], 400);

        fbRequest('devices/' . rawurlencode($deviceId), 'PATCH', [
            'customLabel' => $customLabel,
        ]);
        jsonOut(['ok' => true]);
    }

    if ($action === 'add_developer') {
        $deviceId = trim((string)($body['deviceId'] ?? ''));
        $customLabel = mb_substr(trim((string)($body['customLabel'] ?? 'يوزر المطور')), 0, 80);
        $unit = (string)($body['unit'] ?? 'unlimited');
        $amount = (float)($body['amount'] ?? 1);
        if ($deviceId === '') jsonOut(['error' => 'معرف الجهاز أو اليوزر مطلوب'], 400);

        $exp = computeExpiration($unit, $amount, null);
        $nowMs = (int) round(microtime(true) * 1000);

        $record = [
            'deviceId' => $deviceId,
            'deviceName' => $customLabel ?: 'جهاز المطور',
            'customLabel' => $customLabel ?: 'يوزر المطور',
            'userAgent' => 'Added by Developer Admin',
            'platform' => 'Developer',
            'screenSize' => '',
            'status' => 'approved',
            'durationLabel' => $exp['label'],
            'approvedAt' => $nowMs,
            'expiresAt' => $exp['expiresAt'],
            'createdAt' => $nowMs,
            'lastSeenAt' => $nowMs,
        ];
        fbRequest('devices/' . rawurlencode($deviceId), 'PUT', $record);
        jsonOut(['ok' => true, 'device' => $record]);
    }

    if ($action === 'delete') {
        $deviceId = trim((string)($body['deviceId'] ?? ''));
        if ($deviceId === '') jsonOut(['error' => 'deviceId مطلوب'], 400);
        fbRequest('devices/' . rawurlencode($deviceId), 'DELETE');
        jsonOut(['ok' => true]);
    }

    jsonOut(['error' => 'أمر غير معروف'], 400);
}
?>
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>لوحة تحكم المطور — إدارة الأجهزة</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #07070a;
      --surface: #111116;
      --surface-2: #181820;
      --border: rgba(255, 255, 255, 0.09);
      --text: #f5f5f7;
      --muted: rgba(255, 255, 255, 0.55);
      --blue: #0a84ff;
      --green: #30d158;
      --amber: #ff9f0a;
      --red: #ff453a;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'IBM Plex Sans Arabic', -apple-system, BlinkMacSystemFont, sans-serif;
      background: radial-gradient(circle at top right, rgba(10,132,255,0.08), transparent 45%), var(--bg);
      color: var(--text);
      min-height: 100vh;
    }
    button, input, select { font-family: inherit; }

    /* Login Card */
    .login-wrap {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .login-card {
      width: 100%;
      max-width: 390px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 26px;
      padding: 32px 26px;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.65);
      text-align: center;
    }
    .login-icon {
      width: 58px;
      height: 58px;
      border-radius: 18px;
      background: rgba(10, 132, 255, 0.14);
      color: var(--blue);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 16px;
    }
    .login-card h1 { font-size: 21px; font-weight: 700; margin-bottom: 6px; }
    .login-card p { font-size: 13px; color: var(--muted); margin-bottom: 22px; }
    .field {
      width: 100%;
      background: rgba(0, 0, 0, 0.45);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 12px 14px;
      color: #fff;
      font-size: 14px;
      outline: none;
      transition: border-color .15s;
    }
    .field:focus { border-color: var(--blue); }
    .btn-primary {
      width: 100%;
      border: none;
      border-radius: 14px;
      padding: 12px 18px;
      background: var(--blue);
      color: #fff;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity .15s, transform .1s;
    }
    .btn-primary:hover { opacity: 0.92; }
    .btn-primary:active { transform: scale(0.985); }
    .err-msg { color: var(--red); font-size: 13px; margin: 12px 0 0; }

    /* Dashboard Layout */
    .container {
      max-width: 1280px;
      margin: 0 auto;
      padding: 24px 18px 60px;
    }
    .topbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 22px;
    }
    .title-group h1 { font-size: 22px; font-weight: 700; display: flex; align-items: center; gap: 10px; }
    .live-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 999px;
      background: rgba(48, 209, 88, 0.14);
      color: var(--green);
      border: 1px solid rgba(48, 209, 88, 0.25);
    }
    .live-dot {
      width: 7px; height: 7px; border-radius: 50%; background: var(--green);
      box-shadow: 0 0 8px var(--green);
      animation: pulse 1.6s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: .45; transform: scale(0.8); }
    }
    .subtitle { font-size: 13px; color: var(--muted); margin-top: 4px; }
    .top-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .btn {
      border: 1px solid var(--border);
      background: var(--surface-2);
      color: #fff;
      padding: 9px 15px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      text-decoration: none;
      transition: background .15s, border-color .15s, transform .1s;
    }
    .btn:hover { background: #22222c; border-color: rgba(255,255,255,0.18); }
    .btn-blue { background: var(--blue); border-color: var(--blue); }
    .btn-blue:hover { background: #0077ed; }
    .btn-danger { background: rgba(255, 69, 58, 0.14); color: var(--red); border-color: rgba(255, 69, 58, 0.25); }
    .btn-danger:hover { background: rgba(255, 69, 58, 0.24); }

    /* Stats & Filters */
    .filters-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 22px;
    }
    .filter-tabs { display: flex; flex-wrap: wrap; gap: 8px; }
    .tab-btn {
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--muted);
      padding: 8px 14px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all .15s;
    }
    .tab-btn.active {
      background: var(--blue);
      border-color: var(--blue);
      color: #fff;
    }
    .search-box {
      width: 260px;
      max-width: 100%;
    }

    /* Square Cards Grid (مربعات) */
    .squares-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(265px, 1fr));
      gap: 18px;
    }
    .device-square {
      position: relative;
      background: linear-gradient(160deg, #16161d 0%, #0f0f14 100%);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 18px;
      aspect-ratio: 1 / 1;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      cursor: pointer;
      transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease;
      overflow: hidden;
    }
    .device-square::before {
      content: '';
      position: absolute;
      inset: 0 0 auto 0;
      height: 3px;
      background: var(--accent, var(--blue));
      opacity: 0.9;
    }
    .device-square:hover {
      transform: translateY(-4px);
      border-color: rgba(255, 255, 255, 0.22);
      box-shadow: 0 18px 36px rgba(0, 0, 0, 0.45);
    }
    .device-square[data-status="approved"] { --accent: var(--green); }
    .device-square[data-status="pending"] { --accent: var(--blue); }
    .device-square[data-status="expired"] { --accent: var(--amber); }
    .device-square[data-status="rejected"] { --accent: var(--red); }

    .sq-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
    }
    .device-avatar {
      width: 46px;
      height: 46px;
      border-radius: 15px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      flex-shrink: 0;
    }
    .status-chip {
      font-size: 11.5px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 999px;
      white-space: nowrap;
    }
    .chip-approved { background: rgba(48, 209, 88, 0.16); color: var(--green); }
    .chip-pending  { background: rgba(10, 132, 255, 0.18); color: #54a8ff; }
    .chip-expired  { background: rgba(255, 159, 10, 0.16); color: var(--amber); }
    .chip-rejected { background: rgba(255, 69, 58, 0.16); color: var(--red); }

    .sq-body {
      margin: auto 0;
      padding: 8px 0;
    }
    .sq-name {
      font-size: 16.5px;
      font-weight: 700;
      color: #fff;
      line-height: 1.3;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      margin-bottom: 5px;
    }
    .sq-meta {
      font-size: 12px;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 8px;
    }
    .sq-id {
      display: inline-block;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      color: rgba(255,255,255,0.65);
      background: rgba(0,0,0,0.45);
      border: 1px solid rgba(255,255,255,0.08);
      padding: 3px 8px;
      border-radius: 8px;
      direction: ltr;
    }
    .sq-timer-box {
      margin-top: 10px;
      padding: 8px 10px;
      border-radius: 12px;
      background: rgba(0, 0, 0, 0.38);
      border: 1px solid rgba(255, 255, 255, 0.06);
      font-size: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
    }
    .sq-timer-label { color: var(--muted); }
    .sq-timer-val { font-weight: 700; color: #fff; font-variant-numeric: tabular-nums; }

    .sq-footer {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .sq-manage-btn {
      flex: 1;
      border: none;
      border-radius: 13px;
      padding: 10px 12px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      color: #fff;
      background: rgba(10, 132, 255, 0.22);
      border: 1px solid rgba(10, 132, 255, 0.35);
      transition: background .15s;
    }
    .device-square[data-status="pending"] .sq-manage-btn {
      background: var(--blue);
      border-color: var(--blue);
    }
    .sq-manage-btn:hover { background: var(--blue); }
    .sq-icon-btn {
      width: 38px;
      height: 38px;
      border-radius: 12px;
      border: 1px solid var(--border);
      background: rgba(255,255,255,0.05);
      color: var(--muted);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all .15s;
    }
    .sq-icon-btn.reject:hover { color: var(--red); background: rgba(255, 69, 58, 0.16); border-color: rgba(255, 69, 58, 0.35); }

    .empty-state {
      grid-column: 1 / -1;
      background: var(--surface);
      border: 1px dashed var(--border);
      border-radius: 24px;
      padding: 60px 20px;
      text-align: center;
      color: var(--muted);
      font-size: 14px;
    }

    /* Modal */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.72);
      backdrop-filter: blur(8px);
      display: none;
      align-items: center;
      justify-content: center;
      padding: 16px;
      z-index: 100;
    }
    .modal-backdrop.open { display: flex; }
    .modal-card {
      width: 100%;
      max-width: 560px;
      max-height: 92vh;
      overflow-y: auto;
      background: #131319;
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 26px;
      padding: 22px;
      box-shadow: 0 30px 80px rgba(0,0,0,0.8);
    }
    .modal-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 16px;
    }
    .modal-title { font-size: 18px; font-weight: 700; }
    .modal-sub { font-size: 12.5px; color: var(--muted); margin-top: 3px; }
    .close-x {
      width: 34px; height: 34px; border-radius: 10px;
      border: 1px solid var(--border); background: rgba(255,255,255,0.06);
      color: #fff; font-size: 18px; cursor: pointer;
    }
    .section-box {
      background: rgba(0,0,0,0.32);
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 14px;
      margin-bottom: 14px;
    }
    .section-title {
      font-size: 13px;
      font-weight: 700;
      color: rgba(255,255,255,0.82);
      margin-bottom: 10px;
    }
    .row-flex { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }

    .btn-forever {
      width: 100%;
      padding: 13px 16px;
      border-radius: 14px;
      border: 1px solid rgba(48, 209, 88, 0.45);
      background: linear-gradient(135deg, rgba(48, 209, 88, 0.25), rgba(16, 185, 129, 0.16));
      color: #70f797;
      font-size: 14.5px;
      font-weight: 700;
      cursor: pointer;
      margin-bottom: 10px;
      transition: transform .1s, background .15s;
    }
    .btn-forever:hover { background: linear-gradient(135deg, rgba(48, 209, 88, 0.35), rgba(16, 185, 129, 0.25)); }

    .presets-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
    .preset-tile {
      padding: 10px 8px;
      border-radius: 12px;
      border: 1px solid var(--border);
      background: var(--surface-2);
      color: #fff;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all .15s;
    }
    .preset-tile:hover {
      background: var(--blue);
      border-color: var(--blue);
    }

    @media (max-width: 600px) {
      .squares-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
      }
      .device-square {
        aspect-ratio: auto;
        min-height: 215px;
        padding: 14px;
        border-radius: 20px;
      }
      .sq-name { font-size: 14px; }
      .presets-grid { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body>

<?php if (!$isAuthed): ?>
  <div class="login-wrap">
    <form method="POST" class="login-card">
      <div class="login-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="4" y="11" width="16" height="10" rx="2.5"></rect>
          <path d="M8 11V7a4 4 0 1 1 8 0v4" stroke-linecap="round"></path>
        </svg>
      </div>
      <h1>لوحة تحكم المطور</h1>
      <p>مربوطة مباشرة بسيرفر Firebase للتحديث اللحظي للأجهزة</p>
      <input type="password" name="password" dir="ltr" class="field" placeholder="أدخل كلمة مرور المطور" required autofocus style="text-align:center; margin-bottom:12px;" />
      <button type="submit" name="admin_login" value="1" class="btn-primary">دخول لوحة التحكم</button>
      <?php if ($loginError !== ''): ?>
        <div class="err-msg"><?= htmlspecialchars($loginError, ENT_QUOTES, 'UTF-8') ?></div>
      <?php endif; ?>
    </form>
  </div>
<?php else: ?>
  <div class="container">
    <header class="topbar">
      <div class="title-group">
        <h1>
          إدارة الأجهزة والموافقات
          <span class="live-pill"><span class="live-dot"></span> متصل بـ Firebase</span>
        </h1>
        <p class="subtitle">اضغط على مربع أي جهاز لقبوله، تحديد فتح دائم، أو تحديد مدة مخصصة (ساعة / يوم / سنة)</p>
      </div>
      <div class="top-actions">
        <button type="button" class="btn btn-blue" onclick="openAddDevModal()">+ إضافة يوزر مطور / جهاز</button>
        <a href="?logout=1" class="btn btn-danger">تسجيل خروج</a>
      </div>
    </header>

    <div class="filters-bar">
      <div class="filter-tabs" id="filterTabs">
        <button type="button" class="tab-btn active" data-filter="all">الكل (<span id="cnt-all">0</span>)</button>
        <button type="button" class="tab-btn" data-filter="pending">بانتظار الموافقة (<span id="cnt-pending">0</span>)</button>
        <button type="button" class="tab-btn" data-filter="approved">مفعل (<span id="cnt-approved">0</span>)</button>
        <button type="button" class="tab-btn" data-filter="closed">منتهي / مرفوض (<span id="cnt-closed">0</span>)</button>
      </div>
      <input type="search" id="searchInput" class="field search-box" placeholder="بحث باسم الجهاز أو المعرف..." />
    </div>

    <div class="squares-grid" id="squaresGrid">
      <div class="empty-state">جاري تحميل الأجهزة من Firebase...</div>
    </div>
  </div>

  <!-- Device Control Modal -->
  <div class="modal-backdrop" id="deviceModal" onclick="if(event.target===this) closeDeviceModal()">
    <div class="modal-card">
      <div class="modal-head">
        <div>
          <div class="modal-title" id="mTitle">إدارة الجهاز</div>
          <div class="modal-sub" id="mSub"></div>
        </div>
        <button type="button" class="close-x" onclick="closeDeviceModal()">×</button>
      </div>

      <!-- Profile Name -->
      <div class="section-box">
        <div class="section-title">اسم الملف الشخصي للجهاز</div>
        <div class="row-flex">
          <input type="text" id="mLabelInput" class="field" style="flex:1;" placeholder="مثال: موبايل أحمد - iPhone" />
          <button type="button" class="btn" onclick="saveLabel()">حفظ الاسم</button>
        </div>
      </div>

      <!-- Permanent & Preset Durations -->
      <div class="section-box">
        <div class="section-title">الموافقة السريعة (تفتح عند المستخدم فوراً)</div>
        <button type="button" class="btn-forever" onclick="approveCurrent('unlimited', 1)">
          ✓ قبول وفتح دائم (مدى الحياة بدون انتهاء)
        </button>
        <div class="presets-grid">
          <button type="button" class="preset-tile" onclick="approveCurrent('hours', 1)">ساعة واحدة</button>
          <button type="button" class="preset-tile" onclick="approveCurrent('days', 1)">يوم واحد</button>
          <button type="button" class="preset-tile" onclick="approveCurrent('weeks', 1)">أسبوع</button>
          <button type="button" class="preset-tile" onclick="approveCurrent('months', 1)">شهر واحد</button>
          <button type="button" class="preset-tile" onclick="approveCurrent('years', 1)">سنة واحدة</button>
          <button type="button" class="preset-tile" onclick="approveCurrent('minutes', 15)">15 دقيقة</button>
        </div>
      </div>

      <!-- Custom Duration Picker -->
      <div class="section-box">
        <div class="section-title">تحديد مدة مخصصة يدوياً</div>
        <div class="row-flex" style="margin-bottom: 10px;">
          <input type="number" id="mCustomAmount" min="1" value="3" dir="ltr" class="field" style="width:90px; text-align:center;" />
          <select id="mCustomUnit" class="field" style="flex:1;">
            <option value="minutes">دقيقة</option>
            <option value="hours">ساعة</option>
            <option value="days" selected>يوم</option>
            <option value="weeks">أسبوع</option>
            <option value="months">شهر</option>
            <option value="years">سنة</option>
          </select>
          <button type="button" class="btn btn-blue" onclick="approveCustomAmount()">تفعيل بالمدة</button>
        </div>
        <div class="row-flex">
          <input type="datetime-local" id="mCustomDate" dir="ltr" class="field" style="flex:1;" />
          <button type="button" class="btn" onclick="approveCustomDate()">تحديد تاريخ انتهاء</button>
        </div>
      </div>

      <!-- Reject / Delete -->
      <div class="row-flex" style="justify-content: space-between;">
        <button type="button" class="btn btn-danger" style="flex:1; justify-content:center;" onclick="rejectCurrent()">رفض / إغلاق فوري</button>
        <button type="button" class="btn" style="color:var(--muted);" onclick="deleteCurrent()">حذف الجهاز</button>
      </div>
    </div>
  </div>

  <!-- Add Developer / Device Modal -->
  <div class="modal-backdrop" id="addDevModal" onclick="if(event.target===this) closeAddDevModal()">
    <div class="modal-card" style="max-width:440px;">
      <div class="modal-head">
        <div>
          <div class="modal-title">إضافة وتفعيل يوزر مطور / جهاز</div>
          <div class="modal-sub">يُفعّل تلقائياً في Firebase فور الإضافة</div>
        </div>
        <button type="button" class="close-x" onclick="closeAddDevModal()">×</button>
      </div>
      <div class="section-box" style="display:flex; flex-direction:column; gap:10px;">
        <input type="text" id="addDevId" dir="ltr" class="field" placeholder="معرف الجهاز (مثال: DEV-XXXX) أو يوزر المطور" />
        <input type="text" id="addDevLabel" class="field" placeholder="الاسم (مثال: جهاز المطور الأساسي)" />
        <div class="row-flex">
          <input type="number" id="addDevAmount" min="1" value="1" dir="ltr" class="field" style="width:85px; text-align:center;" />
          <select id="addDevUnit" class="field" style="flex:1;">
            <option value="unlimited" selected>فتح دائم (غير محدد)</option>
            <option value="hours">ساعة</option>
            <option value="days">يوم</option>
            <option value="months">شهر</option>
            <option value="years">سنة</option>
          </select>
        </div>
        <button type="button" class="btn-primary" onclick="submitAddDeveloper()">إضافة وتفعيل تلقائي</button>
      </div>
    </div>
  </div>

  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js"></script>
  <script>
    const firebaseConfig = {
      apiKey: "AIzaSyAlX1ASvDrf5BBtaB72AUYqSoW34YvP_y4",
      authDomain: "mrwan-dd795.firebaseapp.com",
      databaseURL: "https://mrwan-dd795-default-rtdb.firebaseio.com",
      projectId: "mrwan-dd795",
      storageBucket: "mrwan-dd795.firebasestorage.app",
      messagingSenderId: "12538399995",
      appId: "1:12538399995:web:4a7e6b40f611891fecb45e"
    };

    let allDevices = [];
    let currentFilter = 'all';
    let selectedDeviceId = null;

    function esc(str) {
      return String(str || '').replace(/[&<>"']/g, function(c) {
        return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
      });
    }

    function computeEffectiveStatus(dev) {
      if (dev.status === 'approved' && dev.expiresAt !== null && dev.expiresAt !== undefined && Date.now() >= dev.expiresAt) {
        return 'expired';
      }
      return dev.status || 'pending';
    }

    function formatRemaining(dev) {
      const st = computeEffectiveStatus(dev);
      if (st === 'approved') {
        if (dev.expiresAt === null || dev.expiresAt === undefined) return 'فتح دائم';
        const ms = Math.max(0, dev.expiresAt - Date.now());
        const sec = Math.floor(ms / 1000);
        const days = Math.floor(sec / 86400);
        const hrs = Math.floor((sec % 86400) / 3600);
        const mins = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        if (days > 0) return days + ' يوم ' + hrs + ' س';
        if (hrs > 0) return hrs + ' س ' + mins + ' د';
        if (mins > 0) return mins + ' د ' + s + ' ث';
        return s + ' ثانية';
      }
      if (st === 'pending') return 'بانتظار موافقتك';
      if (st === 'expired') return 'انتهى الوقت';
      return 'مرفوض';
    }

    function isPcDevice(dev) {
      const name = (dev.deviceName || '').toLowerCase();
      return name.includes('windows') || name.includes('mac') || name.includes('linux') || name.includes('pc');
    }

    function deviceIconSvg(dev) {
      if (isPcDevice(dev)) {
        return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>';
      }
      return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 18h4"/></svg>';
    }

    function renderGrid() {
      const grid = document.getElementById('squaresGrid');
      const query = (document.getElementById('searchInput').value || '').trim().toLowerCase();

      let cntPending = 0, cntApproved = 0, cntClosed = 0;
      allDevices.forEach(d => {
        const st = computeEffectiveStatus(d);
        if (st === 'pending') cntPending++;
        else if (st === 'approved') cntApproved++;
        else cntClosed++;
      });

      document.getElementById('cnt-all').textContent = allDevices.length;
      document.getElementById('cnt-pending').textContent = cntPending;
      document.getElementById('cnt-approved').textContent = cntApproved;
      document.getElementById('cnt-closed').textContent = cntClosed;

      const filtered = allDevices.filter(d => {
        const st = computeEffectiveStatus(d);
        if (currentFilter === 'pending' && st !== 'pending') return false;
        if (currentFilter === 'approved' && st !== 'approved') return false;
        if (currentFilter === 'closed' && st !== 'expired' && st !== 'rejected') return false;
        if (query) {
          const hay = ((d.customLabel || '') + ' ' + (d.deviceName || '') + ' ' + (d.deviceId || '')).toLowerCase();
          if (!hay.includes(query)) return false;
        }
        return true;
      });

      if (filtered.length === 0) {
        grid.innerHTML = '<div class="empty-state">لا توجد أجهزة مطابقة حالياً. عند فتح أي شخص للتطبيق سيظهر مربعه هنا مباشرة.</div>';
        return;
      }

      grid.innerHTML = filtered.map(dev => {
        const st = computeEffectiveStatus(dev);
        const statusLabel = st === 'approved' ? 'مفعل' : st === 'expired' ? 'منتهي' : st === 'rejected' ? 'مرفوض' : 'قيد الانتظار';
        const chipClass = st === 'approved' ? 'chip-approved' : st === 'expired' ? 'chip-expired' : st === 'rejected' ? 'chip-rejected' : 'chip-pending';
        const displayName = dev.customLabel || dev.deviceName || 'جهاز غير معروف';

        return `
          <div class="device-square" data-status="${st}" onclick="openDeviceModal('${esc(dev.deviceId)}')">
            <div class="sq-top">
              <div class="device-avatar">${deviceIconSvg(dev)}</div>
              <span class="status-chip ${chipClass}">${statusLabel}</span>
            </div>

            <div class="sq-body">
              <div class="sq-name">${esc(displayName)}</div>
              <div class="sq-meta">${esc(dev.deviceName)}${dev.screenSize ? ' · ' + esc(dev.screenSize) : ''}</div>
              <div class="sq-id">${esc(dev.deviceId)}</div>

              <div class="sq-timer-box">
                <span class="sq-timer-label">${st === 'approved' ? 'المتبقي:' : 'الحالة:'}</span>
                <span class="sq-timer-val" data-timer-id="${esc(dev.deviceId)}">${esc(formatRemaining(dev))}</span>
              </div>
            </div>

            <div class="sq-footer" onclick="event.stopPropagation()">
              <button type="button" class="sq-manage-btn" onclick="openDeviceModal('${esc(dev.deviceId)}')">
                ${st === 'pending' ? 'قبول وتحديد المدة' : 'تعديل الصلاحية'}
              </button>
              <button type="button" class="sq-icon-btn reject" title="رفض / إغلاق فوري" onclick="quickReject('${esc(dev.deviceId)}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
          </div>
        `;
      }).join('');
    }

    async function apiPost(action, payload) {
      const res = await fetch('admin.php?api=' + encodeURIComponent(action), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.status === 401) { location.reload(); return null; }
      return await res.json();
    }

    async function fetchPhpList() {
      try {
        const res = await fetch('admin.php?api=list');
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.devices)) {
          allDevices = data.devices;
          renderGrid();
        }
      } catch (e) {}
    }

    function openDeviceModal(deviceId) {
      const dev = allDevices.find(d => d.deviceId === deviceId);
      if (!dev) return;
      selectedDeviceId = deviceId;
      document.getElementById('mTitle').textContent = dev.customLabel || dev.deviceName || deviceId;
      document.getElementById('mSub').textContent = dev.deviceName + ' · ID: ' + dev.deviceId;
      document.getElementById('mLabelInput').value = dev.customLabel || '';
      document.getElementById('deviceModal').classList.add('open');
    }

    function closeDeviceModal() {
      selectedDeviceId = null;
      document.getElementById('deviceModal').classList.remove('open');
    }

    async function saveLabel() {
      if (!selectedDeviceId) return;
      await apiPost('update_label', {
        deviceId: selectedDeviceId,
        customLabel: document.getElementById('mLabelInput').value
      });
      await fetchPhpList();
    }

    async function approveCurrent(unit, amount) {
      if (!selectedDeviceId) return;
      await apiPost('approve', {
        deviceId: selectedDeviceId,
        unit: unit,
        amount: amount,
        customLabel: document.getElementById('mLabelInput').value
      });
      closeDeviceModal();
      await fetchPhpList();
    }

    async function approveCustomAmount() {
      const amt = Math.max(1, parseInt(document.getElementById('mCustomAmount').value, 10) || 1);
      const unit = document.getElementById('mCustomUnit').value;
      await approveCurrent(unit, amt);
    }

    async function approveCustomDate() {
      if (!selectedDeviceId) return;
      const dt = document.getElementById('mCustomDate').value;
      if (!dt) return;
      await apiPost('approve', {
        deviceId: selectedDeviceId,
        unit: 'custom',
        amount: 1,
        customExpiresAt: dt,
        customLabel: document.getElementById('mLabelInput').value
      });
      closeDeviceModal();
      await fetchPhpList();
    }

    async function rejectCurrent() {
      if (!selectedDeviceId) return;
      await apiPost('reject', { deviceId: selectedDeviceId });
      closeDeviceModal();
      await fetchPhpList();
    }

    async function quickReject(deviceId) {
      await apiPost('reject', { deviceId: deviceId });
      await fetchPhpList();
    }

    async function deleteCurrent() {
      if (!selectedDeviceId) return;
      await apiPost('delete', { deviceId: selectedDeviceId });
      closeDeviceModal();
      await fetchPhpList();
    }

    function openAddDevModal() {
      document.getElementById('addDevModal').classList.add('open');
    }
    function closeAddDevModal() {
      document.getElementById('addDevModal').classList.remove('open');
    }
    async function submitAddDeveloper() {
      const deviceId = document.getElementById('addDevId').value.trim();
      const customLabel = document.getElementById('addDevLabel').value.trim();
      const unit = document.getElementById('addDevUnit').value;
      const amount = Math.max(1, parseInt(document.getElementById('addDevAmount').value, 10) || 1);
      if (!deviceId) return;
      await apiPost('add_developer', { deviceId, customLabel, unit, amount });
      document.getElementById('addDevId').value = '';
      document.getElementById('addDevLabel').value = '';
      closeAddDevModal();
      await fetchPhpList();
    }

    document.getElementById('filterTabs').addEventListener('click', (e) => {
      const btn = e.target.closest('.tab-btn');
      if (!btn) return;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.getAttribute('data-filter') || 'all';
      renderGrid();
    });

    document.getElementById('searchInput').addEventListener('input', renderGrid);

    // Real-time Firebase listener + PHP sync
    try {
      firebase.initializeApp(firebaseConfig);
      const db = firebase.database();
      db.ref('devices').on('value', (snap) => {
        const val = snap.val() || {};
        allDevices = Object.values(val).sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0));
        renderGrid();
      });
    } catch (err) {
      fetchPhpList();
    }

    fetchPhpList();
    setInterval(() => {
      allDevices.forEach(dev => {
        const el = document.querySelector('[data-timer-id="' + CSS.escape(dev.deviceId) + '"]');
        if (el) el.textContent = formatRemaining(dev);
      });
    }, 1000);
  </script>
<?php endif; ?>
</body>
</html>
