/**
 * 外浦MAP かわら版 — WordPress 埋め込み用ウィジェット
 *
 * 使い方:
 *   1. GAS ウェブアプリを「全員」アクセスでデプロイ
 *   2. 下記 GAS_POSTS_API_URL を実際の URL に置き換え
 *   3. WordPress の「カスタム HTML」ブロックに以下を貼り付け:
 *
 *   <div id="sotoura-kawara-root"></div>
 *   <script>
 *     window.SOTOURA_KAWARA_CONFIG = {
 *       gasUrl: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',
 *       storeId: '',
 *       maxItems: 12,
 *       pollIntervalMs: 60000
 *     };
 *   </script>
 *   <script src="https://YOUR_GITHUB_PAGES/web/wordpress-kawara-widget.js"></script>
 *
 * 秘密情報は WordPress 側に置かない（GAS URL は公開可・読み取り専用 API）。
 *
 * エンジニア向け仕様: web/docs/WORDPRESS_INTEGRATION.md
 */
(function () {
    'use strict';

    var cfg = window.SOTOURA_KAWARA_CONFIG || {};
    var GAS_URL = String(cfg.gasUrl || '').trim();
    var ROOT_ID = cfg.rootId || 'sotoura-kawara-root';
    var MAX_ITEMS = cfg.maxItems != null ? Number(cfg.maxItems) : 12;
    var POLL_MS = cfg.pollIntervalMs != null ? Number(cfg.pollIntervalMs) : 60000;
    var FILTER_STORE = cfg.storeId != null ? String(cfg.storeId).trim() : '';

    function injectStyles() {
        if (document.getElementById('sotoura-kawara-styles')) return;
        var style = document.createElement('style');
        style.id = 'sotoura-kawara-styles';
        style.textContent =
            '.sotoura-kawara-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px}' +
            '.sotoura-kawara-card{background:#FFFDF7;border:1px solid #D7CCC8;border-radius:12px;padding:14px 16px}' +
            '.sotoura-kawara-card-label{font-size:11px;font-weight:bold;color:#8D6E63;letter-spacing:.08em;margin-bottom:6px}' +
            '.sotoura-kawara-card-store{font-size:12px;color:#888;margin-bottom:4px}' +
            '.sotoura-kawara-card-title{font-size:16px;font-weight:bold;color:#3E2723;margin:0 0 8px;line-height:1.4}' +
            '.sotoura-kawara-card-img{width:100%;border-radius:8px;margin-bottom:8px;max-height:180px;object-fit:cover}' +
            '.sotoura-kawara-card-text{font-size:13px;color:#333;line-height:1.6;margin:0 0 8px;white-space:pre-wrap}' +
            '.sotoura-kawara-card-date{font-size:11px;color:#999}' +
            '.sotoura-kawara-empty{color:#666;font-size:14px}';
        document.head.appendChild(style);
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatDate(iso) {
        if (!iso) return '';
        try {
            var d = new Date(iso);
            if (isNaN(d.getTime())) return '';
            return d.toLocaleString('ja-JP', {
                month: 'numeric', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        } catch (e) {
            return '';
        }
    }

    function renderKawaraBan(posts) {
        var root = document.getElementById(ROOT_ID);
        if (!root) return;

        var list = Array.isArray(posts) ? posts.slice() : [];
        if (FILTER_STORE) {
            list = list.filter(function (p) {
                return String(p.storeId || '').trim() === FILTER_STORE;
            });
        }
        list.sort(function (a, b) {
            return new Date(b.createdAt) - new Date(a.createdAt);
        });
        list = list.slice(0, MAX_ITEMS);

        if (list.length === 0) {
            root.innerHTML = '<p class="sotoura-kawara-empty">かわら版はまだありません</p>';
            return;
        }

        var html = '<div class="sotoura-kawara-grid">';
        list.forEach(function (p) {
            var title = p.title || (p.text ? String(p.text).substring(0, 14) : 'かわら版');
            var store = p.storeId ? escapeHtml(p.storeId) : '';
            var img = p.imageUrl
                ? '<img class="sotoura-kawara-card-img" src="' + escapeHtml(p.imageUrl) + '" alt="" loading="lazy">'
                : '';
            var body = p.text
                ? '<p class="sotoura-kawara-card-text">' + escapeHtml(p.text) + '</p>'
                : '';
            html +=
                '<article class="sotoura-kawara-card">' +
                    '<div class="sotoura-kawara-card-label">かわら版</div>' +
                    (store ? '<div class="sotoura-kawara-card-store">' + store + '</div>' : '') +
                    '<h3 class="sotoura-kawara-card-title">' + escapeHtml(title) + '</h3>' +
                    img + body +
                    '<time class="sotoura-kawara-card-date">' + escapeHtml(formatDate(p.createdAt)) + '</time>' +
                '</article>';
        });
        html += '</div>';
        root.innerHTML = html;
    }

    function fetchPosts() {
        if (!GAS_URL || GAS_URL.indexOf('YOUR_') >= 0) {
            var root = document.getElementById(ROOT_ID);
            if (root) {
                root.innerHTML = '<p class="sotoura-kawara-empty">GAS URL を設定してください</p>';
            }
            return;
        }
        var url = GAS_URL + (GAS_URL.indexOf('?') >= 0 ? '&' : '?') + 'action=posts&_=' + Date.now();
        fetch(url, { mode: 'cors', credentials: 'omit' })
            .then(function (res) { return res.json(); })
            .then(function (data) {
                renderKawaraBan(data && data.posts ? data.posts : []);
            })
            .catch(function () {
                var root = document.getElementById(ROOT_ID);
                if (root) {
                    root.innerHTML = '<p class="sotoura-kawara-empty">かわら版の取得に失敗しました</p>';
                }
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            injectStyles();
            fetchPosts();
        });
    } else {
        injectStyles();
        fetchPosts();
    }
    if (POLL_MS > 0) {
        setInterval(fetchPosts, POLL_MS);
    }
})();
