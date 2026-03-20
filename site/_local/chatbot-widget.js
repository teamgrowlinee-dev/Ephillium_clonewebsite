/* Ephilium AI Consultation Chatbot Widget
 * Self-contained IIFE — no external dependencies
 * Visual palette: #037dc9 primary, #212122 dark, #f4f3f0 bot bg, #e5e4e0 border
 */
(function () {
  'use strict';

  var ROOT_ID = 'eph-chat-root';
  var cfg = window.EphiliumChatConfig || { backendUrl: 'http://localhost:3001', debug: false };
  var API = cfg.backendUrl;

  // --- State ---
  var state = {
    sessionId: null,
    locale: 'en',
    open: false,
    pending: false,
    initPending: false,   // prevents duplicate session init calls
    booked: false,        // permanently locks input after booking
    slots: [],
    uiAction: 'show_input',
  };

  // --- CSS ---
  var CSS = [
    '#eph-chat-root *{box-sizing:border-box;margin:0;padding:0;}',
    '#eph-chat-root{position:fixed;bottom:28px;right:28px;z-index:9999;font-family:"Nunito Sans",-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;line-height:1.55;}',

    /* Bubble */
    '#eph-chat-bubble{width:56px;height:56px;border-radius:50%;background:#037dc9;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(3,125,201,.35);transition:transform .15s ease,box-shadow .15s ease;}',
    '#eph-chat-bubble:hover{transform:scale(1.06);box-shadow:0 6px 20px rgba(3,125,201,.45);}',
    '#eph-chat-bubble svg{width:26px;height:26px;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}',

    /* Panel */
    '#eph-chat-panel{position:absolute;bottom:68px;right:0;width:380px;height:540px;background:#fff;border:1px solid #e5e4e0;border-radius:12px;box-shadow:0 8px 32px rgba(33,33,34,.14);display:flex;flex-direction:column;overflow:hidden;transform-origin:bottom right;transition:transform .2s ease,opacity .2s ease;}',
    '#eph-chat-panel.eph-hidden{transform:scale(.92) translateY(8px);opacity:0;pointer-events:none;}',

    /* Header */
    '#eph-chat-header{background:#212122;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}',
    '#eph-chat-header-info{display:flex;flex-direction:column;}',
    '#eph-chat-title{color:#fff;font-size:15px;font-weight:600;letter-spacing:.01em;}',
    '#eph-chat-subtitle{color:rgba(255,255,255,.55);font-size:11.5px;margin-top:1px;}',
    '#eph-chat-close{background:none;border:none;cursor:pointer;color:rgba(255,255,255,.6);font-size:20px;line-height:1;padding:2px 4px;border-radius:4px;transition:color .1s;}',
    '#eph-chat-close:hover{color:#fff;}',

    /* Messages */
    '#eph-chat-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth;}',
    '#eph-chat-messages::-webkit-scrollbar{width:4px;}',
    '#eph-chat-messages::-webkit-scrollbar-track{background:transparent;}',
    '#eph-chat-messages::-webkit-scrollbar-thumb{background:#e5e4e0;border-radius:2px;}',

    /* Bubbles */
    '.eph-msg{max-width:82%;padding:10px 13px;border-radius:16px;word-wrap:break-word;white-space:pre-wrap;}',
    '.eph-msg-bot{background:#f4f3f0;color:#212122;border-radius:16px 16px 16px 4px;align-self:flex-start;}',
    '.eph-msg-user{background:#037dc9;color:#fff;border-radius:16px 16px 4px 16px;align-self:flex-end;}',
    '.eph-msg-error{background:#fef2f2;color:#c0392b;border:1px solid #fecaca;border-radius:16px 16px 16px 4px;align-self:flex-start;}',

    /* Typing indicator */
    '.eph-typing{display:flex;gap:4px;align-items:center;padding:10px 13px;background:#f4f3f0;border-radius:16px 16px 16px 4px;align-self:flex-start;}',
    '.eph-typing span{width:7px;height:7px;border-radius:50%;background:#9ca3af;display:inline-block;animation:eph-pulse 1.2s ease-in-out infinite;}',
    '.eph-typing span:nth-child(2){animation-delay:.2s;}',
    '.eph-typing span:nth-child(3){animation-delay:.4s;}',
    '@keyframes eph-pulse{0%,80%,100%{transform:scale(.7);opacity:.5;}40%{transform:scale(1);opacity:1;}}',

    /* Quick replies / slot buttons */
    '#eph-chat-quick-replies{padding:8px 16px 4px;display:flex;flex-wrap:wrap;gap:7px;flex-shrink:0;}',
    '.eph-slot-btn{border:1.5px solid #037dc9;color:#037dc9;background:#fff;border-radius:6px;padding:7px 12px;font-size:13px;font-family:inherit;cursor:pointer;transition:background .12s,color .12s;white-space:nowrap;}',
    '.eph-slot-btn:hover{background:#037dc9;color:#fff;}',
    '.eph-slot-btn.selected{background:#037dc9;color:#fff;}',

    /* Confirmation banner */
    '#eph-chat-confirm-banner{margin:10px 16px;padding:12px 14px;background:#ecfdf5;border:1px solid #6ee7b7;border-radius:8px;color:#065f46;font-size:13px;flex-shrink:0;}',
    '#eph-chat-confirm-banner.eph-hidden{display:none;}',

    /* Input */
    '#eph-chat-input-row{padding:10px 12px;border-top:1px solid #e5e4e0;display:flex;gap:8px;align-items:flex-end;flex-shrink:0;}',
    '#eph-chat-input-row.eph-hidden{display:none;}',
    '#eph-chat-textarea{flex:1;border:1px solid #e5e4e0;border-radius:8px;padding:9px 12px;font-family:inherit;font-size:14px;resize:none;outline:none;max-height:100px;overflow-y:auto;line-height:1.45;color:#212122;transition:border-color .15s;}',
    '#eph-chat-textarea:focus{border-color:#037dc9;}',
    '#eph-chat-textarea::placeholder{color:#9ca3af;}',
    '#eph-chat-send{width:36px;height:36px;border-radius:8px;background:#037dc9;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .12s;}',
    '#eph-chat-send:hover{background:#025e97;}',
    '#eph-chat-send:disabled{background:#9ca3af;cursor:not-allowed;}',
    '#eph-chat-send svg{width:17px;height:17px;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}',

    /* Footer */
    '#eph-chat-footer{text-align:center;padding:5px 0 8px;font-size:11px;color:#9ca3af;flex-shrink:0;}',
    '#eph-chat-footer a{color:#9ca3af;text-decoration:none;transition:color .2s ease,text-shadow .2s ease;}',
    '#eph-chat-footer a:hover{color:#037dc9;text-shadow:0 0 8px rgba(3,125,201,.6);}',

    /* Notification bubbles — speech cloud to the left of the button */
    '#eph-notif-stack{position:absolute;bottom:70px;right:0;pointer-events:none;}',
    '.eph-notif{position:relative;background:#fff;border:1px solid #e0dedd;border-radius:22px 22px 22px 6px;padding:18px 32px;font-size:14px;font-weight:500;color:#212122;line-height:1.5;box-shadow:0 6px 24px rgba(0,0,0,.13);white-space:nowrap;min-width:240px;text-align:center;opacity:0;transform:translateX(10px) scale(.96);transform-origin:right center;transition:opacity .45s ease,transform .45s ease;}',
    '.eph-notif.eph-notif-visible{opacity:1;transform:translateX(0) scale(1);}',
    /* speech bubble tail pointing right toward the chat button */
    '.eph-notif::before{content:"";position:absolute;right:12px;bottom:-9px;border:7px solid transparent;border-top-color:#e0dedd;border-bottom:0;}',
    '.eph-notif::after{content:"";position:absolute;right:13px;bottom:-7px;border:6px solid transparent;border-top-color:#fff;border-bottom:0;}',

    /* Bounce animation */
    '@keyframes eph-bounce{0%,100%{transform:translateY(0);}35%{transform:translateY(-11px);}65%{transform:translateY(-5px);}}',
    '#eph-chat-bubble.eph-bouncing{animation:eph-bounce .55s ease 3;}',

    /* Mobile */
    '@media(max-width:480px){',
    '#eph-chat-panel{width:calc(100vw - 20px);right:-10px;height:70vh;max-height:540px;bottom:66px;}',
    '#eph-chat-root{bottom:16px;right:16px;}',
    '}',
  ].join('');

  // --- HTML ---
  function buildHTML() {
    return [
      '<div id="eph-notif-stack"></div>',
      '<div id="eph-chat-bubble" role="button" aria-label="Open Ephilium consultation chat" tabindex="0">',
      '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
      '</div>',
      '<div id="eph-chat-panel" class="eph-hidden" role="dialog" aria-label="Ephilium AI Chat">',
        '<div id="eph-chat-header">',
          '<div id="eph-chat-header-info">',
            '<span id="eph-chat-title">Ephilium AI</span>',
            '<span id="eph-chat-subtitle">Consultation Assistant</span>',
          '</div>',
          '<button id="eph-chat-close" aria-label="Close chat">&times;</button>',
        '</div>',
        '<div id="eph-chat-messages" aria-live="polite"></div>',
        '<div id="eph-chat-quick-replies"></div>',
        '<div id="eph-chat-confirm-banner" class="eph-hidden"></div>',
        '<div id="eph-chat-input-row">',
          '<textarea id="eph-chat-textarea" rows="1" placeholder="Type your message…" aria-label="Chat message input"></textarea>',
          '<button id="eph-chat-send" aria-label="Send message">',
            '<svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
          '</button>',
        '</div>',
        '<div id="eph-chat-footer">Powered by <a href="https://growlinee.com/en" target="_blank" rel="noopener">Growlinee</a></div>',
      '</div>',
    ].join('');
  }

  // --- DOM helpers ---
  function el(id) { return document.getElementById(id); }

  function appendMessage(text, type) {
    var msgs = el('eph-chat-messages');
    if (!msgs) return;
    var div = document.createElement('div');
    div.className = 'eph-msg eph-msg-' + type;
    div.textContent = text;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
  }

  function showTyping() {
    var msgs = el('eph-chat-messages');
    if (!msgs) return null;
    var div = document.createElement('div');
    div.className = 'eph-typing';
    div.id = 'eph-typing-indicator';
    div.innerHTML = '<span></span><span></span><span></span>';
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
  }

  function removeTyping() {
    var t = el('eph-typing-indicator');
    if (t) t.remove();
  }

  function setInputVisible(visible) {
    var row = el('eph-chat-input-row');
    if (row) {
      if (visible) row.classList.remove('eph-hidden');
      else row.classList.add('eph-hidden');
    }
  }

  function clearSlots() {
    var qr = el('eph-chat-quick-replies');
    if (qr) qr.innerHTML = '';
  }

  function showSlots(slots) {
    clearSlots();
    var qr = el('eph-chat-quick-replies');
    if (!qr || !slots || !slots.length) return;

    setInputVisible(false);
    slots.forEach(function (slot, i) {
      var btn = document.createElement('button');
      btn.className = 'eph-slot-btn';
      btn.textContent = slot.label;
      btn.dataset.slotId = slot.id;
      btn.addEventListener('click', function () {
        qr.querySelectorAll('.eph-slot-btn').forEach(function (b) { b.classList.remove('selected'); });
        btn.classList.add('selected');
        sendMessage(slot.label);
      });
      qr.appendChild(btn);
    });
  }

  function showConfirmBanner(text) {
    var banner = el('eph-chat-confirm-banner');
    if (!banner) return;
    banner.textContent = text;
    banner.classList.remove('eph-hidden');
    clearSlots();
    setInputVisible(true);
  }

  function hideNotifications() {
    var stack = el('eph-notif-stack');
    if (!stack) return;
    var existing = stack.querySelector('.eph-notif');
    if (existing) {
      existing.classList.remove('eph-notif-visible');
      setTimeout(function () { stack.innerHTML = ''; }, 450);
    } else {
      stack.innerHTML = '';
    }
  }

  function showNotifications() {
    var messages = [
      'Hi, I am Sales',
      'Talk to me and let\'s find out the best fit for you',
      'Click me to start',
    ];
    var delays = [2000, 6000, 10000];

    function showOne(i) {
      if (i >= messages.length) return;
      setTimeout(function () {
        if (state.open) return;
        var stack = el('eph-notif-stack');
        if (!stack) return;

        // Fade out existing bubble first
        var existing = stack.querySelector('.eph-notif');
        if (existing) {
          existing.classList.remove('eph-notif-visible');
          setTimeout(function () {
            if (existing.parentNode) existing.parentNode.removeChild(existing);
            addBubble(i);
          }, 450);
        } else {
          addBubble(i);
        }
      }, delays[i]);
    }

    function addBubble(i) {
      if (state.open) return;
      var stack = el('eph-notif-stack');
      if (!stack) return;
      var div = document.createElement('div');
      div.className = 'eph-notif';
      div.textContent = messages[i];
      stack.appendChild(div);
      setTimeout(function () { div.classList.add('eph-notif-visible'); }, 30);
    }

    for (var i = 0; i < messages.length; i++) { showOne(i); }
  }

  function bounceBubble() {
    setTimeout(function () {
      var bubble = el('eph-chat-bubble');
      if (!bubble) return;
      bubble.classList.add('eph-bouncing');
      bubble.addEventListener('animationend', function handler() {
        bubble.removeEventListener('animationend', handler);
        bubble.classList.remove('eph-bouncing');
      });
    }, 800);
  }

  function openPanel() {
    state.open = true;
    hideNotifications();
    var panel = el('eph-chat-panel');
    var bubble = el('eph-chat-bubble');
    if (panel) panel.classList.remove('eph-hidden');
    if (bubble) bubble.setAttribute('aria-expanded', 'true');
    // Initialize session on first open (not if already attempted)
    if (!state.sessionId && state.sessionId !== '__error__') {
      initSession();
    }
    var ta = el('eph-chat-textarea');
    if (ta && !state.booked) setTimeout(function () { ta.focus(); }, 150);
  }

  function closePanel() {
    state.open = false;
    var panel = el('eph-chat-panel');
    var bubble = el('eph-chat-bubble');
    if (panel) panel.classList.add('eph-hidden');
    if (bubble) bubble.setAttribute('aria-expanded', 'false');
  }

  // --- API calls ---
  function initSession() {
    if (state.initPending) return;  // already in flight
    state.initPending = true;

    fetch(API + '/api/chat/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        state.initPending = false;
        if (!data.sessionId) throw new Error('No session ID returned');
        state.sessionId = data.sessionId;
        state.locale = data.locale || 'en';
        if (data.welcomeMessage) {
          appendMessage(data.welcomeMessage, 'bot');
        }
      })
      .catch(function (err) {
        state.initPending = false;
        state.sessionId = '__error__'; // prevent retry on next open
        if (cfg.debug) console.error('[Ephilium Chat] Session init failed:', err);
        // Clear any previous error messages first
        var msgs = el('eph-chat-messages');
        if (msgs) msgs.innerHTML = '';
        appendMessage('Unable to connect to the chat server. Please make sure the chatbot backend is running.', 'error');
      });
  }

  function sendMessage(text) {
    if (!text || !text.trim()) return;
    if (state.pending) return;
    if (!state.sessionId || state.sessionId === '__error__') return;

    var trimmed = text.trim();
    var ta = el('eph-chat-textarea');
    if (ta) ta.value = '';

    appendMessage(trimmed, 'user');
    clearSlots();

    state.pending = true;
    var send = el('eph-chat-send');
    if (send) send.disabled = true;
    showTyping();

    fetch(API + '/api/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: state.sessionId, message: trimmed }),
    })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        removeTyping();
        state.pending = false;
        if (send) send.disabled = false;

        if (data.locale) state.locale = data.locale;

        if (data.message) {
          appendMessage(data.message, 'bot');
        }

        var action = data.uiAction || 'show_input';
        state.uiAction = action;

        if (action === 'show_slots' && data.slots && data.slots.length) {
          state.slots = data.slots;
          showSlots(data.slots);
        } else if (action === 'confirm_booking') {
          var confirmText = state.locale === 'et'
            ? 'Teie konsultatsioonitaotlus on esitatud. Võtame teiega ühendust kinnitamiseks.'
            : 'Your consultation request has been submitted. We\'ll follow up to confirm your time.';
          showConfirmBanner(confirmText);
        } else {
          setInputVisible(true);
          clearSlots();
        }

        if (cfg.debug) console.log('[Ephilium Chat] Response:', data);
      })
      .catch(function (err) {
        removeTyping();
        state.pending = false;
        if (send) send.disabled = false;
        setInputVisible(true);
        if (cfg.debug) console.error('[Ephilium Chat] Message error:', err);
        var errText = state.locale === 'et'
          ? 'Midagi läks valesti. Palun proovige uuesti.'
          : 'Something went wrong. Please try again.';
        appendMessage(errText, 'error');
      });
  }

  // --- Mount ---
  function mount() {
    if (document.getElementById(ROOT_ID)) return; // already mounted

    // Inject CSS
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    // Inject root
    var root = document.createElement('div');
    root.id = ROOT_ID;
    root.innerHTML = buildHTML();
    document.body.appendChild(root);

    // Event listeners
    var bubble = el('eph-chat-bubble');
    var closeBtn = el('eph-chat-close');
    var sendBtn = el('eph-chat-send');
    var textarea = el('eph-chat-textarea');

    if (bubble) {
      bubble.addEventListener('click', function () {
        if (state.open) closePanel(); else openPanel();
      });
      bubble.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (state.open) closePanel(); else openPanel();
        }
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', closePanel);
    }

    if (sendBtn) {
      sendBtn.addEventListener('click', function () {
        var ta = el('eph-chat-textarea');
        if (ta) sendMessage(ta.value);
      });
    }

    if (textarea) {
      textarea.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage(textarea.value);
        }
      });
      textarea.addEventListener('input', function () {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px';
      });
    }

    // Re-mount guard: watch for root removal
    if (window.MutationObserver) {
      new MutationObserver(function () {
        if (!document.getElementById(ROOT_ID)) mount();
      }).observe(document.body, { childList: true });
    }

    // Attention sequence: bounce then notification bubbles
    bounceBubble();
    showNotifications();
  }

  // Bootstrap
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
