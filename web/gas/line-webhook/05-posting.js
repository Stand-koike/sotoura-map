// ==================================================================
// 投稿フロー（店舗 fixed / 協力者 GPS）
// ==================================================================

function pendingWaitMinutes_() {
  return LINE_LIMITS.PENDING_EXPIRE_MS / 60000;
}

function replyPendingTextAck_(replyToken, preview) {
  replyText(replyToken,
    '📝 受け付けました「' + preview + '」\n' +
    '【順番: テキスト→写真】続けて📸写真を送ってください（' + pendingWaitMinutes_() + '分以内）\n' +
    '写真不要ならそのまま待つと自動でマップに反映されます。');
}

function replyPendingImageAck_(replyToken, hasExistingImage) {
  var verb = hasExistingImage ? '更新' : '受け付け';
  replyText(replyToken,
    '📸 写真を' + verb + 'しました。（順番: テキスト→写真）' +
    'テキストを送るとセットで反映されます（' + pendingWaitMinutes_() + '分以内）\n' +
    'テキスト不要ならそのまま待つと自動でマップに反映されます。');
}

function handleStoreContentText_(userId, replyToken, user, text) {
  deleteSession_(userId);
  var rawText    = text.substring(0, LINE_LIMITS.MAX_TITLE_LENGTH + 1 + LINE_LIMITS.MAX_MESSAGE_LENGTH);
  var pendingImg = loadPending_(userId);

  if (pendingImg && pendingImg.imageUrl) {
    deletePending_(userId);
    proceedToFinalizePost_(userId, replyToken, user, {
      text: rawText, imageUrl: pendingImg.imageUrl,
      lat: null, lng: null, spotId: '', spotName: ''
    });
    return;
  }

  savePending_(userId, user.fixedStoreId || '', rawText);
  replyPendingTextAck_(replyToken, rawText.split(/\r?\n/)[0].substring(0, 20));
}

function handleContributorContentText_(userId, replyToken, user, text) {
  var sess = getSession_(userId);
  if (sess.payload.lat == null || sess.payload.lng == null) {
    replyText(replyToken,
      '協力者の投稿は📍位置が先です。\n【順番】📍位置情報 → 短文テキスト → 📸写真');
    return;
  }
  var truncated = text.substring(0, LINE_LIMITS.MAX_MESSAGE_LENGTH).trim();
  if (!truncated) {
    replyText(replyToken, '先に内容のある短文（1文字以上）を送ってから、写真を送ってください。');
    return;
  }
  savePending_(userId, '_liv_', truncated);
  replyText(replyToken,
    '📝 受け付けました「' + truncated + '」\n【順番: テキスト→写真】続けて📸写真を送ってください（' +
    pendingWaitMinutes_() + '分以内）');
}

function mergeImageWithPendingThenFinalize_(userId, replyToken, user, imageUrl) {
  var pending = loadPendingWithGrace_(userId);
  var text    = pending ? String(pending.message || '') : '';
  var sess    = getSession_(userId);
  var useGps  = user.role === ROLE_CONTRIBUTOR && sess.payload.lat != null && sess.payload.lng != null;
  proceedToFinalizePost_(userId, replyToken, user, {
    text:     text,
    imageUrl: imageUrl || '',
    lat:      useGps ? sess.payload.lat : null,
    lng:      useGps ? sess.payload.lng : null,
    spotId:   sess.payload.spotId   || '',
    spotName: sess.payload.spotName || ''
  });
}

function proceedToFinalizePost_(userId, replyToken, user, payload) {
  setSession_(userId, STEP_AWAITING_FINALIZE, payload);
  finalizePost_(userId, replyToken, user);
}

function resolveStorePostCoords_(user) {
  var storeId = user.fixedStoreId || '';
  var coords  = getStoreCoordsFromMaster_(storeId);
  if (!coords) return { error: '店舗座標が見つかりません（店舗名: ' + storeId + '）。管理者に確認してください。' };
  return { storeId: storeId, sourceType: SOURCE_FIXED, lat: coords.lat, lng: coords.lng };
}

function resolveContributorPostCoords_(user, lat, lng) {
  var latNum = lat != null ? Number(lat) : NaN;
  var lngNum = lng != null ? Number(lng) : NaN;
  if (!isFinite(latNum) || !isFinite(lngNum)) {
    return { error: '位置情報がありません。' };
  }
  return {
    storeId:    user.fixedStoreId || '',
    sourceType: SOURCE_GPS,
    lat:        latNum,
    lng:        lngNum
  };
}

function finalizePost_(userId, replyToken, user) {
  if (user.role !== ROLE_STORE && user.role !== ROLE_CONTRIBUTOR) {
    if (replyToken !== 'PUSH') replyText(replyToken, MSG.LEGACY_ROLE);
    deleteSession_(userId);
    deletePending_(userId);
    return;
  }

  var sess = getSession_(userId);
  if (sess.step !== STEP_AWAITING_FINALIZE) {
    if (replyToken !== 'PUSH') {
      replyText(replyToken, '投稿のタイミングではありません。投稿を送り直してください。');
    }
    return;
  }

  var p     = sess.payload;
  var split = splitTitleAndBody_(p.text || '');
  if (!split.title && !split.body && !p.imageUrl) {
    if (replyToken !== 'PUSH') {
      replyText(replyToken, 'タイトル・本文か画像がありません。最初から送り直してください。');
    }
    deleteSession_(userId);
    return;
  }

  var resolved = user.role === ROLE_STORE
    ? resolveStorePostCoords_(user)
    : resolveContributorPostCoords_(user, p.lat, p.lng);

  if (resolved.error) {
    if (replyToken !== 'PUSH') replyText(replyToken, resolved.error);
    deleteSession_(userId);
    return;
  }

  appendPostRow_({
    postId:     Utilities.getUuid(),
    userId:     userId,
    role:       user.role,
    sourceType: resolved.sourceType,
    title:      split.title,
    text:       split.body,
    imageUrl:   p.imageUrl || '',
    lat:        resolved.lat,
    lng:        resolved.lng,
    storeId:    resolved.storeId,
    createdAt:  new Date(),
    isVisible:  true
  });

  deleteSession_(userId);
  deletePending_(userId);

  var doneMsg = '✅ マップに反映しました！' + (p.spotName ? '\n場所:' + p.spotName : '');
  if (replyToken === 'PUSH') pushText(userId, doneMsg);
  else replyText(replyToken, doneMsg);
}

function handleContributorImage_(userId, replyToken, user, messageId) {
  var pendingTxt = loadPending_(userId);
  if (!pendingTxt || !String(pendingTxt.message || '').trim()) {
    replyText(replyToken,
      '位置情報付きの投稿は【順番: 短文テキスト→📸写真】です。\n短文を先に送ってから写真を送ってください。');
    return;
  }
  try {
    mergeImageWithPendingThenFinalize_(userId, replyToken, user, fetchLineImageToDrive_(messageId));
  } catch (err) {
    replyText(replyToken, '⚠️ 画像取得に失敗しました。');
  }
}

function handleStoreImageIncoming_(userId, replyToken, user, messageId) {
  try {
    var imageUrl = fetchLineImageToDrive_(messageId);
    var pending  = loadPending_(userId);
    if (pending && pending.message) {
      mergeImageWithPendingThenFinalize_(userId, replyToken, user, imageUrl);
      return;
    }
    var hadImage = !!(pending && pending.imageUrl);
    savePending_(userId, user.fixedStoreId || '', '', imageUrl);
    replyPendingImageAck_(replyToken, hadImage);
  } catch (err) {
    webhookExecErr_('[handleStoreImageIncoming_] ' + String(err.message || err));
    replyText(replyToken, '⚠️ 画像の取得に失敗しました。もう一度お試しください。');
  }
}

function contributorHasGpsSession_(userId) {
  var sess = getSession_(userId);
  return sess.step === STEP_AWAITING_CONTENT &&
    sess.payload.lat != null && sess.payload.lng != null;
}

// --- pending のタイマーフラッシュ ---

function buildFlushPayload_(user, sess, message, imageUrl) {
  if (user.role === ROLE_CONTRIBUTOR && sess.payload.lat != null && sess.payload.lng != null) {
    return Object.assign({}, sess.payload, { text: message, imageUrl: imageUrl });
  }
  return { text: message, imageUrl: imageUrl, lat: null, lng: null, spotId: '', spotName: '' };
}

function flushExpiredPending_(excludeUserId) {
  invalidatePendingRowsCache_();
  var sheet = getPendingSheet_(false);
  if (!sheet) return;
  var data  = sheet.getDataRange().getValues();
  var nowMs = Date.now();

  for (var i = data.length - 1; i >= 1; i--) {
    var savedAt = data[i][3] ? new Date(data[i][3]).getTime() : 0;
    if (nowMs - savedAt <= LINE_LIMITS.PENDING_EXPIRE_MS) continue;

    var userId   = data[i][0];
    if (excludeUserId && sheetRowUserIdMatches_(userId, excludeUserId)) continue;

    var message  = data[i][2] ? String(data[i][2]) : '';
    var imageUrl = data[i][4] ? String(data[i][4]) : '';
    sheet.deleteRow(i + 1);
    if (!message.trim() && !imageUrl) continue;

    var user = getUserRecord_(userId);
    if (!isActiveUser_(user)) continue;
    if (user.role !== ROLE_STORE && user.role !== ROLE_CONTRIBUTOR) continue;

    var sess = getSession_(userId);
    if (user.role === ROLE_CONTRIBUTOR &&
        sess.payload.lat != null && sess.payload.lng != null &&
        !message.trim() && imageUrl) continue;

    proceedToFinalizePost_(userId, 'PUSH', user, buildFlushPayload_(user, sess, message, imageUrl));
  }
}
