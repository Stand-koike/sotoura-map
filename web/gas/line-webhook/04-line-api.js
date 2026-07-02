// ==================================================================
// LINE Messaging API / Drive 画像
// ==================================================================

function lineAuthHeaders_() {
  return { Authorization: 'Bearer ' + getWebhookLineToken_() };
}

function replyText(replyToken, text) {
  if (!replyToken) {
    webhookExecErr_('[replyText] missing replyToken');
    return;
  }
  logTimingUntilLineApi_('reply');
  var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    contentType: 'application/json',
    headers: lineAuthHeaders_(),
    payload: JSON.stringify({ replyToken: replyToken, messages: [{ type: 'text', text: text }] }),
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  webhookExecLog_('[replyText] LINE reply API http=' + code);
  if (code < 200 || code >= 300) {
    webhookExecErr_('[replyText] http=' + code + ' body=' + res.getContentText().slice(0, 500));
  }
}

function pushText(userId, text) {
  logTimingUntilLineApi_('push');
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    contentType: 'application/json',
    headers: lineAuthHeaders_(),
    payload: JSON.stringify({ to: userId, messages: [{ type: 'text', text: text }] }),
    muteHttpExceptions: true
  });
}

function guessImageExtFromContentType_(contentType) {
  var ct = String(contentType || '').toLowerCase();
  if (ct.indexOf('png') >= 0) return 'png';
  if (ct.indexOf('gif') >= 0) return 'gif';
  if (ct.indexOf('webp') >= 0) return 'webp';
  if (ct.indexOf('heic') >= 0 || ct.indexOf('heif') >= 0) return 'heic';
  return 'jpg';
}

function getOrCreateLineImageFolder_() {
  var folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(DRIVE_FOLDER_NAME);
}

function shareLineImageFile_(file) {
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (shareErr) {
    webhookExecErr_('[shareLineImageFile_] ' + String(shareErr.message || shareErr));
  }
}

function fetchLineImageToDrive_(messageId) {
  var mid = String(messageId || '').trim();
  if (!mid) throw new Error('messageId が空です');

  var token = getWebhookLineToken_();
  if (!token) throw new Error('LINE_CHANNEL_ACCESS_TOKEN が未設定です');

  var response = UrlFetchApp.fetch(
    'https://api-data.line.me/v2/bot/message/' + encodeURIComponent(mid) + '/content',
    {
      method: 'GET',
      headers: lineAuthHeaders_(),
      muteHttpExceptions: true
    }
  );
  var code = response.getResponseCode();
  if (code !== 200) {
    var body = response.getContentText().slice(0, 300);
    webhookExecErr_('[fetchLineImageToDrive_] http=' + code + ' messageId=' + mid + ' body=' + body);
    if (code === 401) throw new Error('LINE トークンが無効です（401）');
    if (code === 404) throw new Error('画像の有効期限切れです。もう一度送り直してください（404）');
    throw new Error('LINE 画像 API エラー HTTP ' + code);
  }

  var blob = response.getBlob();
  var bytes = blob.getBytes();
  if (!bytes || !bytes.length) throw new Error('画像データが空です');
  if (bytes.length > LINE_LIMITS.MAX_IMAGE_SIZE_BYTES) throw new Error('サイズ上限超過');

  var ext    = guessImageExtFromContentType_(blob.getContentType());
  var folder = getOrCreateLineImageFolder_();
  var file   = folder.createFile(blob.setName('line_' + mid + '_' + Date.now() + '.' + ext));
  shareLineImageFile_(file);
  return 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w800';
}
