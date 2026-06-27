// ==================================================================
// Webhook エントリ / メッセージルーティング
// ==================================================================

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    (body.events || []).forEach(processWebhookEvent_);
    return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    webhookExecErr_('[doPost] ' + String(err && err.message ? err.message : err));
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: String(err.message || err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  var action = e && e.parameter && e.parameter.action;
  if (action === 'posts') {
    var data     = getPostsForApi_();
    var callback = e.parameter.callback;
    var json     = JSON.stringify(data);
    var out      = callback ? callback + '(' + json + ')' : json;
    return ContentService.createTextOutput(out)
      .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);
}

function processWebhookEvent_(event) {
  if (event.type !== 'message') return;

  var lock     = LockService.getScriptLock();
  var lockHeld = false;
  try {
    lock.waitLock(10000);
    lockHeld = true;
  } catch (lockErr) {
    webhookExecErr_('[processWebhookEvent_] waitLock ' +
      String(lockErr && lockErr.message ? lockErr.message : lockErr));
  }

  try {
    beginWebhookEventTiming_();
    dispatchWebhookMessage_(event);
  } catch (innerErr) {
    webhookExecErr_('[processWebhookEvent_] ' +
      String(innerErr && innerErr.message ? innerErr.message : innerErr));
    if (event.replyToken) {
      try {
        replyText(event.replyToken, '⚠️ 処理中にエラーが発生しました。しばらくしてからもう一度お試しください。');
      } catch (replyErr) {
        webhookExecErr_('[processWebhookEvent_] error reply ' +
          String(replyErr && replyErr.message ? replyErr.message : replyErr));
      }
    }
  } finally {
    if (lockHeld) {
      try { lock.releaseLock(); } catch (e) { /* ignore */ }
    }
  }
}

function dispatchWebhookMessage_(event) {
  var userId     = event.source && event.source.userId;
  var replyToken = event.replyToken;
  var msg        = event.message;

  if (!msg) {
    if (replyToken) replyText(replyToken, '⚠️ メッセージ本文を取得できませんでした。もう一度お試しください。');
    return;
  }
  if (!userId) {
    if (replyToken) {
      replyText(replyToken,
        '⚠️ ユーザー情報を取得できませんでした。\n' +
        '・公式アカウントとの「1対1」のトークで試してください\n' +
        '・グループ利用時は userId が届かない設定だと利用できません');
    }
    return;
  }

  switch (String(msg.type || '').toLowerCase()) {
    case 'text':
      handleTextIncoming_(userId, replyToken, String(msg.text || '').trim());
      break;
    case 'image':
      handleImageIncoming_(userId, replyToken, msg.id);
      break;
    case 'location':
      var ll = readLineLocationLatLng_(msg);
      webhookExecLog_('[webhook] location ' + JSON.stringify({
        userPrefix: String(userId).slice(0, 10), lat: ll.lat, lng: ll.lng
      }));
      handleLocationIncoming_(userId, replyToken, ll.lat, ll.lng);
      break;
    default:
      if (replyToken) {
        replyText(replyToken,
          '⚠️ このメッセージ形式には未対応です（type: ' + String(msg.type || '?') + '）。');
      }
  }
}

function tryHandleGlobalTextCommand_(userId, replyToken, text) {
  if (text === MSG.RICH_MENU_EXAMPLE_CMD) {
    replyText(replyToken, buildRichMenuExampleMessage_());
    return true;
  }
  if (text === MSG.RICH_GUEST_ONBOARDING_CMD || text === MSG.RICH_GUEST_ONBOARDING) {
    var u = getUserRecord_(userId);
    replyText(replyToken, isActiveUser_(u) ? buildHelpMessage_(userId) : MSG.RICH_GUEST_ONBOARDING);
    return true;
  }
  if (/^マイID$/i.test(text) || /^my\s*id$/i.test(text)) {
    replyText(replyToken, buildMyIdMessage_(userId));
    return true;
  }
  if (/^ヘルプ$/.test(text) || /^help$/i.test(text)) {
    replyText(replyToken, buildHelpMessage_(userId));
    return true;
  }
  if (/^登録確認$/.test(text)) {
    handleCheckCommand_(userId, replyToken);
    return true;
  }
  if (/^登録解除$/.test(text)) {
    handleUnregisterCommand_(userId, replyToken);
    return true;
  }
  if (isAdminUser_(userId)) {
    if (/^ユーザー一覧$/.test(text)) {
      handleAdminListCommand_(replyToken);
      return true;
    }
    if (/^削除\s+\S+$/.test(text)) {
      handleAdminDeleteCommand_(replyToken, text.split(/\s+/)[1]);
      return true;
    }
    if (/^テスト投稿$/.test(text)) {
      handleAdminTestPost_(replyToken, userId);
      return true;
    }
  }
  return false;
}

function handleTextIncoming_(userId, replyToken, text) {
  if (!text) return;
  if (tryHandleGlobalTextCommand_(userId, replyToken, text)) return;

  var user = getUserRecord_(userId);

  if (!isActiveUser_(user)) {
    var inviteCode = extractInviteCodeFromText_(text);
    if (inviteCode) {
      handleInviteLink_(userId, replyToken, inviteCode);
      return;
    }
    if (/^登録/.test(text) || /^(店|店舗)$/.test(text)) {
      replyText(replyToken, MSG.OLD_REGISTER_REDIRECT);
      return;
    }
    replyText(replyToken, buildUnknownUserMessage_(userId));
    return;
  }

  if (user.role === ROLE_CONTRIBUTOR) {
    flushExpiredPending_();
    if (contributorHasGpsSession_(userId)) {
      handleContributorContentText_(userId, replyToken, user, text);
      return;
    }
    replyText(replyToken, MSG.LEGACY_ROLE);
    return;
  }

  if (user.role !== ROLE_STORE) {
    replyText(replyToken, MSG.LEGACY_ROLE);
    return;
  }

  flushExpiredPending_();
  handleStoreContentText_(userId, replyToken, user, text);
}

function handleImageIncoming_(userId, replyToken, messageId) {
  flushExpiredPending_(userId);
  var user = getUserRecord_(userId);
  if (replyIfNotRegistered_(userId, replyToken, user)) return;

  if (user.role === ROLE_CONTRIBUTOR) {
    var sess = getSession_(userId);
    if (sess.payload.lat == null || sess.payload.lng == null) {
      replyText(replyToken, '先に📍位置情報メッセージを送ってください。');
      return;
    }
    handleContributorImage_(userId, replyToken, user, messageId);
    return;
  }

  if (user.role !== ROLE_STORE) {
    replyText(replyToken, MSG.LEGACY_ROLE);
    return;
  }

  handleStoreImageIncoming_(userId, replyToken, user, messageId);
}

function handleLocationIncoming_(userId, replyToken, lat, lng) {
  try {
    var latNum = lat != null && lat !== '' ? Number(lat) : NaN;
    var lngNum = lng != null && lng !== '' ? Number(lng) : NaN;
    if (!isFinite(latNum) || !isFinite(lngNum)) {
      replyText(replyToken,
        '⚠️ 位置を認識できませんでした。\n' +
        'LINEの入力欄「＋」→「位置情報」から📍付きの「位置情報」メッセージにしてください。');
      return;
    }

    var user = getUserRecord_(userId);
    if (replyIfNotRegistered_(userId, replyToken, user)) return;

    if (user.role === ROLE_STORE) {
      replyText(replyToken, MSG.STORE_LOCATION_REJECTED);
      return;
    }
    if (user.role !== ROLE_CONTRIBUTOR) {
      replyText(replyToken, MSG.LEGACY_ROLE);
      return;
    }

    deletePending_(userId);
    setSession_(userId, STEP_AWAITING_CONTENT, {
      text: '', imageUrl: '', lat: latNum, lng: lngNum, spotId: '', spotName: ''
    });
    replyText(replyToken,
      '📍位置を受け取りました。\n【順番】①テキスト（1行目=タイトル' +
      LINE_LIMITS.MAX_TITLE_LENGTH + '字、2行目以降=本文' +
      LINE_LIMITS.MAX_MESSAGE_LENGTH + '字）→②📸写真');
  } catch (err) {
    webhookExecErr_('[handleLocationIncoming_] ' + String(err.message || err));
    replyText(replyToken, '⚠️ 位置の保存に失敗しました。管理者に連絡してください。');
  }
}
