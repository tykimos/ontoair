// OntoAir chat — ask questions about the loaded ontology, or tell it to edit it.
// Talks to /ontoair/api/chat (nginx → Azure OpenAI proxy, same model as the nfs
// service). Search → answer in the panel. Edit → re-render the new TTL (via the
// existing sessionStorage devFile reload path) and offer a download.
(function () {
  'use strict';
  var API = 'api/chat';                  // resolves to /ontoair/api/chat
  var STATE_KEY = 'oaChatState';         // survives the edit-triggered reload
  var MAX_TURNS = 12;                    // history sent to the backend

  // ---- styles ----
  var css = document.createElement('style');
  css.textContent = [
    '#oa-chat-fab{position:fixed;left:16px;bottom:16px;z-index:60;width:46px;height:46px;border-radius:23px;border:1px solid #d9d9d9;background:#1c4f99;color:#fff;font-size:20px;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.18);display:flex;align-items:center;justify-content:center;transition:transform .15s}',
    '#oa-chat-fab:hover{transform:scale(1.06)}',
    '#oa-chat{position:fixed;left:16px;bottom:16px;z-index:61;width:360px;max-width:calc(100vw - 32px);height:480px;max-height:calc(100vh - 32px);background:#fff;border:1px solid #e2e2e2;border-radius:14px;box-shadow:0 14px 48px rgba(0,0,0,.22);display:none;flex-direction:column;overflow:hidden;font-family:"SF Pro",system-ui,-apple-system,sans-serif}',
    '#oa-chat.open{display:flex}',
    '#oa-chat-head{display:flex;align-items:center;gap:8px;padding:11px 14px;border-bottom:1px solid #eee;background:#fafafa}',
    '#oa-chat-head .t{font-size:13px;font-weight:600;color:#1c2a3a;flex:1}',
    '#oa-chat-head .sub{font-size:10px;color:#9aa5b5;font-weight:400}',
    '#oa-chat-head button{border:none;background:transparent;font-size:18px;color:#888;cursor:pointer;line-height:1;padding:2px 4px}',
    '#oa-chat-body{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px;background:#fff}',
    '.oa-msg{max-width:86%;padding:8px 11px;border-radius:12px;font-size:12.5px;line-height:1.5;white-space:pre-wrap;word-break:break-word}',
    '.oa-msg.user{align-self:flex-end;background:#1c4f99;color:#fff;border-bottom-right-radius:4px}',
    '.oa-msg.bot{align-self:flex-start;background:#f1f3f6;color:#222;border-bottom-left-radius:4px}',
    '.oa-msg.err{align-self:flex-start;background:#fdecea;color:#b3261e;border-bottom-left-radius:4px}',
    '.oa-msg.note{align-self:center;background:#eaf6ec;color:#1e7a3a;font-size:11px;border-radius:8px}',
    '.oa-msg .dl{display:inline-block;margin-top:6px;font-size:11px;color:#1c4f99;text-decoration:underline;cursor:pointer}',
    '.oa-msg.bot .dl{color:#1c4f99}',
    '.oa-typing{align-self:flex-start;color:#9aa5b5;font-size:12px;padding:4px 6px}',
    '#oa-chat-foot{border-top:1px solid #eee;padding:8px;display:flex;gap:6px;background:#fafafa}',
    '#oa-chat-in{flex:1;border:1px solid #dcdcdc;border-radius:9px;padding:8px 10px;font-size:12.5px;outline:none;font-family:inherit;resize:none;max-height:96px;min-height:20px;line-height:1.4}',
    '#oa-chat-in:focus{border-color:#1c4f99}',
    '#oa-chat-send{border:none;background:#1c4f99;color:#fff;border-radius:9px;padding:0 14px;font-size:13px;cursor:pointer}',
    '#oa-chat-send:disabled{background:#aebfd6;cursor:default}',
    '#oa-chat-hint{padding:0 12px 8px;font-size:10px;color:#aab;background:#fafafa}',
    '@media (max-width:768px){#oa-chat{left:8px;right:8px;width:auto;bottom:8px;height:62vh}#oa-chat-fab{left:10px;bottom:10px}}'
  ].join('\n');
  document.head.appendChild(css);

  // ---- elements ----
  var fab = document.createElement('button');
  fab.id = 'oa-chat-fab'; fab.title = '온톨로지 챗 — 질문하거나 수정 요청'; fab.textContent = '💬';
  var panel = document.createElement('div');
  panel.id = 'oa-chat';
  panel.innerHTML =
    '<div id="oa-chat-head"><span class="t">온톨로지 챗 <span class="sub" id="oa-chat-sub"></span></span>' +
    '<button id="oa-chat-min" title="닫기">–</button></div>' +
    '<div id="oa-chat-body"></div>' +
    '<div id="oa-chat-hint">예: “클래스가 몇 개야?”, “Knight에 hasColor white 추가해줘”</div>' +
    '<div id="oa-chat-foot"><textarea id="oa-chat-in" rows="1" placeholder="질문하거나 수정 요청…"></textarea>' +
    '<button id="oa-chat-send">전송</button></div>';
  document.body.appendChild(fab);
  document.body.appendChild(panel);

  var body = panel.querySelector('#oa-chat-body');
  var input = panel.querySelector('#oa-chat-in');
  var sendBtn = panel.querySelector('#oa-chat-send');
  var sub = panel.querySelector('#oa-chat-sub');

  var history = [];   // [{role, content}] sent to backend
  var busy = false;

  function open(o) { panel.classList.toggle('open', o !== false); fab.style.display = (o !== false) ? 'none' : 'flex'; if (o !== false) input.focus(); }
  fab.addEventListener('click', function () { open(true); });
  panel.querySelector('#oa-chat-min').addEventListener('click', function () { open(false); });

  function curName() { return (window.FNAME || 'ontology'); }
  function curTTL() { return (typeof window.RAW === 'string' ? window.RAW : ''); }
  function refreshSub() { sub.textContent = '· ' + curName(); }

  function addMsg(kind, text) {
    var d = document.createElement('div');
    d.className = 'oa-msg ' + kind;
    d.textContent = text;
    body.appendChild(d); body.scrollTop = body.scrollHeight;
    return d;
  }
  function addDownload(el, ttl, name) {
    var a = document.createElement('a');
    a.className = 'dl'; a.textContent = '⬇ 수정본 다운로드 (' + name + ')';
    a.href = URL.createObjectURL(new Blob([ttl], { type: 'text/turtle' }));
    a.download = name;
    el.appendChild(document.createElement('br')); el.appendChild(a);
  }

  function setBusy(b) {
    busy = b; sendBtn.disabled = b; input.disabled = b;
    var t = body.querySelector('.oa-typing');
    if (b && !t) { t = document.createElement('div'); t.className = 'oa-typing'; t.textContent = '생각 중…'; body.appendChild(t); body.scrollTop = body.scrollHeight; }
    if (!b && t) t.remove();
  }

  function applyEdit(ttl, summary) {
    var name = curName().replace(/\s*\(edited.*\)$/, '') + ' (edited)';
    // persist chat so it survives the reload, with a download for the new TTL
    try {
      sessionStorage.setItem(STATE_KEY, JSON.stringify({
        history: history.slice(-MAX_TURNS),
        editSummary: summary, editTTL: ttl, editName: name
      }));
      // reuse the app's file-load path: set devFile + reload → re-parse & re-render
      sessionStorage.setItem('devFile', JSON.stringify({ text: ttl, fmt: 'ttl', name: name }));
    } catch (e) { /* sessionStorage may be full for huge TTL */ }
    location.hash = '';
    location.reload();
  }

  async function send() {
    var text = input.value.trim();
    if (!text || busy) return;
    input.value = ''; input.style.height = 'auto';
    addMsg('user', text);
    history.push({ role: 'user', content: text });
    if (history.length > MAX_TURNS) history = history.slice(-MAX_TURNS);
    setBusy(true);
    try {
      var res = await fetch(API, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, ontology: curTTL(), filename: curName() })
      });
      var data = await res.json();
      setBusy(false);
      if (!res.ok || data.error) { addMsg('err', '오류: ' + (data.error || res.status)); return; }
      if (data.action === 'edit' && data.ttl) {
        history.push({ role: 'assistant', content: data.message || '(수정함)' });
        var m = addMsg('bot', (data.message || '온톨로지를 수정했습니다.') + '\n적용하고 다시 그립니다…');
        addDownload(m, data.ttl, curName().replace(/\s*\(edited.*\)$/, '') + '.edited.ttl');
        setTimeout(function () { applyEdit(data.ttl, data.message || ''); }, 700);
      } else {
        history.push({ role: 'assistant', content: data.message || '' });
        addMsg('bot', data.message || '(응답 없음)');
      }
    } catch (e) {
      setBusy(false); addMsg('err', '네트워크 오류: ' + (e && e.message ? e.message : e));
    }
  }

  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
  input.addEventListener('input', function () { input.style.height = 'auto'; input.style.height = Math.min(96, input.scrollHeight) + 'px'; });

  // ---- restore after an edit-triggered reload ----
  function restore() {
    refreshSub();
    var s = null;
    try { s = JSON.parse(sessionStorage.getItem(STATE_KEY) || 'null'); } catch (e) {}
    if (!s) { addMsg('bot', '안녕하세요! 현재 온톨로지에 대해 질문하거나, 수정을 요청해 보세요.'); return; }
    sessionStorage.removeItem(STATE_KEY);
    history = Array.isArray(s.history) ? s.history : [];
    history.forEach(function (m) { addMsg(m.role === 'user' ? 'user' : 'bot', m.content); });
    if (s.editSummary) {
      var n = addMsg('note', '✅ 적용됨: ' + s.editSummary);
      if (s.editTTL) addDownload(n, s.editTTL, (s.editName || 'ontology') + '.ttl');
    }
    open(true);
  }
  restore();
})();
