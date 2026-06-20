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

function fetchLineImageToDrive_(messageId) {
  var response = UrlFetchApp.fetch(
    'https://api-data.line.me/v2/bot/message/' + messageId + '/content',
    {
      method: 'GET',
      headers: lineAuthHeaders_(),
      muteHttpExceptions: true
    }
  );
  if (response.getResponseCode() !== 200) {
    throw new Error('HTTP ' + response.getResponseCode());
  }
  var blob = response.getBlob();
  if (blob.getBytes().length > LINE_LIMITS.MAX_IMAGE_SIZE_BYTES) {
    throw new Error('サイズ上限超過');
  }
  var folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  var folder  = folders.hasNext() ? folders.next() : DriveApp.createFolder(DRIVE_FOLDER_NAME);
  var file    = folder.createFile(blob.setName('line_' + messageId + '_' + Date.now() + '.jpg'));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w800';
}
