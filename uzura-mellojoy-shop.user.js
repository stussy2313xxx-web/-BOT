// ==UserScript==
// @name         うずら BOT — Mellojoy・Shop対応
// @namespace    uzura.mellojoy.shop
// @version      2.1.85.11035
// @updateURL    https://raw.githubusercontent.com/stussy2313xxx-web/-BOT/main/uzura-mellojoy-shop.meta.js
// @downloadURL  https://raw.githubusercontent.com/stussy2313xxx-web/-BOT/main/uzura-mellojoy-shop.user.js
// @description  Mellojoy・Shopify・Supreme・HUMAN MADE・Buffer・Palace・and ST・VANS Japan・BASE・FEILERの購入補助。購入成功時のDiscord通知に対応。
// @match        https://*/*
// @run-at       document-start
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.xmlHttpRequest
// @connect      discord.com
// @inject-into  content
// ==/UserScript==
if (!/(^|\.)livepocket\.jp$/i.test(location.hostname) && location.hostname !== 'test.valladstudio.com') {

// Storefronts with their own cart controls.
(function uzuraStorefrontCart() {
  const vans = /^(?:www\.)?vans\.co\.jp$/.test(location.hostname);
  const abcMart = /^(?:www\.)?abc-mart\.net$/.test(location.hostname);
  const billys = /^(?:www\.)?billys-tokyo\.net$/.test(location.hostname);
  if (window.top !== window || vans || (!abcMart && !billys && location.hostname !== 'jp.topps.com')) return;
  const store = vans ? 'VANS JP' : abcMart ? 'ABC-MART' : billys ? 'BILLY’S' : 'Topps JP';
  const productPath = abcMart || billys ? /^\/shop\/g\/g[^/]+\/?$/i : /^\/p\//;

  function mount() {
    const panel = document.createElement('aside');
    panel.style.cssText = 'position:fixed;right:12px;bottom:24px;z-index:2147483647;background:#142139;color:white;padding:12px;border-radius:10px;font:15px system-ui;max-width:85vw';
    const action = document.createElement('button');
    action.type = 'button';
    action.style.cssText = 'background:white;color:#142139;padding:8px;border:0;border-radius:6px';
    const status = document.createElement('div');
    status.setAttribute('role', 'status');
    panel.append(action, status);
    const log = [];
    function report(message) {
      status.textContent = message;
      log.push(new Date().toLocaleTimeString('ja-JP', {timeZone: 'Asia/Tokyo'}) + ' ' + message);
      if (log.length > 30) log.shift();
    }
    let observer;
    let timer;
    let path;

    function stop(message) {
      observer?.disconnect();
      observer = null;
      clearTimeout(timer);
      action.textContent = reviewStore && (reviewCart || reviewOrder) ? (billys ? 'ご注文内容の確認へ進む' : 'カートの確認へ進む') : vans || abcMart || billys ? '商品ページ・カートを操作' : store + '｜すぐ実行';
      report(message);
    }

    const vansAddLabel = /^(?:カートに(?:入れる|追加(?:する)?)|カートへ(?:入れる|追加(?:する)?)|Add to cart)$/i;

    function findControl(label, root = document) {
      return Array.from(root.querySelectorAll('button, a, input[type=submit], input[type=button], input[type=image]')).find(element =>
        !panel.contains(element) && !element.matches(':disabled,[aria-disabled="true"]') &&
        element.getClientRects().length && getComputedStyle(element).visibility === 'visible' &&
        [element.innerText, element.getAttribute('aria-label'), element.value, element.getAttribute('alt')].some(value =>
          value && label.test(value.normalize('NFKC').replace(/[\uE000-\uF8FF]/g, '').trim().replace(/\s+/g, ' '))));
    }

    let stopVansHandoff;
    function waitForVansCart() {
      stopVansHandoff?.();
      const host = panel.getRootNode().host;
      const added = /カートに商品(?:が)?追加されました/;
      let frame;
      let addedToCart = false;
      function cleanup() {
        cartObserver.disconnect();
        clearTimeout(timeout);
        cancelAnimationFrame(frame);
        host.style.removeProperty('display');
        stopVansHandoff = null;
      }
      function check() {
        frame = undefined;
        if (added.test(document.body.innerText)) {
          if (addedToCart) return;
          addedToCart = true;
          clearTimeout(timeout);
          report('カート追加を確認しました。公式画面で Apple Pay を選べます。');
          host.style.setProperty('display', 'none', 'important');
        } else if (addedToCart) {
          cleanup();
        }
      }
      const cartObserver = new MutationObserver(() => {
        if (frame === undefined) frame = requestAnimationFrame(check);
      });
      const timeout = setTimeout(() => {
        cleanup();
        report('カート追加の確認ができませんでした。公式画面をご確認ください。');
      }, 15000);
      stopVansHandoff = cleanup;
      cartObserver.observe(document.body, {subtree: true, childList: true, attributes: true, characterData: true});
    }

    const reviewStore = abcMart || billys;
    const reviewKey = abcMart ? 'uzura-abc-review-until' : 'uzura-billys-review-until';
    const reviewCart = location.pathname === '/shop/cart/cart.aspx';
    const reviewOrder = /^\/shop\/order\//i.test(location.pathname);

    function clearReview() {
      sessionStorage.removeItem(reviewKey);
      sessionStorage.removeItem(reviewKey + '-step');
    }

    function applyCreditCardDefault() {
      if (!billys || !reviewOrder) return;
      const normalize = text => text.normalize('NFKC').replace(/\s+/g, '');
      const radios = Array.from(document.querySelectorAll('input[type="radio"][name]'));
      const matches = radios.filter(radio =>
        !radio.matches(':disabled,[aria-disabled="true"]') &&
        Array.from(radio.labels || []).some(label => label.getClientRects().length &&
          getComputedStyle(label).visibility === 'visible' &&
          normalize(label.innerText) === 'クレジットカード'));
      if (matches.length !== 1) return;
      const [radio] = matches;
      if (radios.some(other => other.name === radio.name && other.form === radio.form && other.checked)) return;
      radio.click();
      if (radio.checked) report('お支払い方法にクレジットカードを選択しました。');
    }

    function applyBillysDeliveryDefault() {
      if (!billys || !reviewOrder) return;
      const radios = Array.from(document.querySelectorAll('input[type="radio"][name]'));
      const hasLabel = (radio, text) => Array.from(radio.labels || []).some(label =>
        label.getClientRects().length && getComputedStyle(label).visibility === 'visible' &&
        label.innerText.replace(/\s+/g, '') === text);
      const matches = radios.filter(radio =>
        !radio.matches(':disabled,[aria-disabled="true"]') && hasLabel(radio, '指定しない') &&
        radios.some(other => other.name === radio.name && other.form === radio.form && hasLabel(other, '指定する')));
      if (matches.length !== 1 || !document.body.innerText.replace(/\s+/g, '').includes('宅配ボックス指定')) return;
      const [radio] = matches;
      if (radios.some(other => other.name === radio.name && other.form === radio.form && other.checked)) return;
      radio.click();
      if (radio.checked) report('宅配ボックスを「指定しない」に設定しました。');
    }

    function applyBillysCardReuseDefault() {
      if (!billys || !reviewOrder || !findControl(/^(?:ご)?注文を確定する$/)) return;
      const normalize = text => text.normalize('NFKC').replace(/\s+/g, '');
      if (!normalize(document.body.innerText).includes('入力したクレジットカードを次回以降利用する')) return;
      const radios = Array.from(document.querySelectorAll('input[type="radio"][name]'));
      const hasLabel = (radio, text) => Array.from(radio.labels || []).some(label =>
        label.getClientRects().length && getComputedStyle(label).visibility === 'visible' &&
        normalize(label.innerText) === text);
      const sameGroup = (a, b) => a.name === b.name && a.form === b.form;
      const matches = radios.filter(radio =>
        !radio.matches(':disabled,[aria-disabled="true"]') && hasLabel(radio, '利用する') &&
        radios.some(other => sameGroup(radio, other) && hasLabel(other, '利用しない')));
      if (matches.length !== 1) return;
      const [radio] = matches;
      if (radios.some(other => sameGroup(radio, other) && other.checked)) return;
      radio.click();
      if (radio.checked) report('カードの次回利用を「利用する」に設定しました。');
    }

    function continueReview() {
      if (!reviewStore || (!reviewCart && !reviewOrder)) return;
      const reachedReview = () =>
        Array.from(document.querySelectorAll('h1,h2,h3')).some(heading =>
          !reviewCart && heading.textContent.trim() === (billys ? 'ご注文内容の確認' : 'カートの確認')) ||
        Boolean(findControl(/^(?:ご注文を確定する|注文を確定する|d払い（ドコモ）へ|au PAYへ|PayPayへ)$/i));
      function finish(message) {
        clearReview();
        stop(message);
      }
      function check() {
        if (reachedReview()) {
          applyBillysDeliveryDefault();
          applyBillysCardReuseDefault();
          finish(billys ? '「ご注文内容の確認」に到着しました。注文確定は手動です。'
            : 'Step3「カートの確認」に到着しました。内容を確認してご自身で確定してください。');
          return;
        }
        if (findControl(/^ログイン$/) || document.querySelector('input[type=password]:not([disabled])')) {
          finish('公式サイトにログインしてから購入手続きを続けてください。');
          return;
        }
        const next = reviewCart
          ? findControl(/^(?:ご購入手続きへ(?:進む)?|レジに進む|購入手続きへ(?:進む)?|ご注文手続きへ(?:進む)?)(?:\s+\d{1,2}月\d{1,2}日までに出荷予定)?$/)
          : findControl(/^(?:ご?注文内容を確認する|ご?注文(?:内容)?の確認へ(?:進む)?|カートの確認へ進む|確認画面へ進む)$/);
        if (!next) return;
        applyCreditCardDefault();
        if (next.form && !next.form.checkValidity()) {
          finish('公式画面の必須項目を入力してから続けてください。');
          return;
        }
        const step = reviewCart ? 'cart' : 'order';
        if (sessionStorage.getItem(reviewKey + '-step') === step) {
          finish('公式画面で入力内容を確認し、手続きを続けてください。');
          return;
        }
        sessionStorage.setItem(reviewKey + '-step', step);
        stop(reviewCart ? '公式の購入手続きへ進みます。' : '公式の確認画面へ進みます。');
        next.click();
      }
      action.textContent = '停止';
      report('公式の購入手続きを確認しています。');
      observer = new MutationObserver(check);
      observer.observe(document.body, {subtree: true, childList: true, attributes: true, characterData: true});
      timer = setTimeout(() => finish('公式画面で配送先・支払い方法を確認し、手続きを続けてください。'), 8000);
      check();
    }

    action.addEventListener('click', () => {
      if (observer) { if (reviewStore) clearReview(); stop('停止しました'); return; }
      if (reviewStore && (reviewCart || reviewOrder)) {
        clearReview();
        sessionStorage.setItem(reviewKey, String(Date.now() + 120000));
        continueReview();
        return;
      }
      path = location.pathname;
      const cart = /^\/(?:checkout\/)?cart\/?$/.test(path) || ((abcMart || billys) && path === '/shop/cart/cart.aspx');
      if ((abcMart || billys) && !cart) { stop('商品URLとサイズを入力して「すぐ実行」を押してください。'); return; }
      if (vans && !cart && !productPath.test(path)) {
        stop('公式の商品ページを開き、サイズを選択してください');
        return;
      }
      const label = cart
        ? /^(?:チェックアウトに進む|チェックアウト|ご購入手続きへ|レジに進む|購入手続きへ|ご注文手続きへ|購入手続きへ進む(?: .*)?|Checkout)$/i
        : vansAddLabel;
      function check() {
        if (location.pathname !== path) { stop('ページが変わったため停止しました'); return; }
        const control = findControl(label);
        if (!control) return;
        stop(cart ? '公式の購入手続きボタンを押しました' : '公式のカート追加ボタンを押しました');
        if (vans && !cart) waitForVansCart();
        control.click();
      }
      action.textContent = '停止';
      report('公式ボタンの表示を待っています（最大2分）');
      observer = new MutationObserver(check);
      observer.observe(document.body, {subtree: true, childList: true, attributes: true, characterData: true});
      timer = setTimeout(() => stop('操作できるボタンが見つかりませんでした'), 120000);
      check();
    });
    if (vans || abcMart || billys) {
      const search = document.createElement('form');
      const keyword = document.createElement('input');
      keyword.placeholder = abcMart || billys ? '公式の商品URL' : '商品名・品番・商品URL';
      keyword.required = true;
      keyword.setAttribute('aria-label', keyword.placeholder);
      const time = document.createElement('input');
      time.type = 'time';
      time.setAttribute('aria-label', '発売時刻（日本時間、空欄ですぐ検索）');
      const submit = document.createElement('button');
      submit.textContent = '予約・自動スタート';
      const heading = document.createElement('strong');
      heading.textContent = 'うずら BOT';
      heading.style.cssText = 'display:block;font-size:23px;font-weight:800;line-height:1.1';
      const header = document.createElement('header');
      header.className = 'hd';
      const icon = document.createElement('span');
      icon.textContent = 'U';
      icon.setAttribute('aria-hidden', 'true');
      icon.style.cssText = 'display:grid;place-items:center;width:40px;height:40px;border-radius:50%;background:white;color:#0e1b2d;font-weight:800';
      const title = document.createElement('div');
      title.className = 'ttl';
      const subtitle = document.createElement('small');
      subtitle.className = 'ver';
      subtitle.textContent = store;
      title.append(heading, subtitle);
      const position = document.createElement('button');
      position.type = 'button';
      position.textContent = '上下';
      const hide = document.createElement('button');
      hide.type = 'button';
      hide.textContent = '隠す';
      header.append(icon, title, position, hide);
      position.onclick = () => {
        panel.className = panel.classList.contains('top') ? 'bot' : 'top';
      };
      hide.onclick = () => { panel.hidden = true; };
      const runNow = document.createElement('button');
      runNow.type = 'button';
      runNow.textContent = 'すぐ実行';
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.textContent = '停止';
      const showLog = document.createElement('button');
      showLog.type = 'button';
      showLog.textContent = 'ログを見る';
      const output = document.createElement('pre');
      output.hidden = true;
      output.style.cssText = 'white-space:pre-wrap;max-height:8em;overflow:auto';
      showLog.onclick = () => {
        output.textContent = log.join('\n');
        output.hidden = !output.hidden;
      };
      panel.id = 'sxbbox';
      panel.className = 'top';
      panel.removeAttribute('style');
      status.className = 'st';
      search.className = 'body';
      const size = document.createElement('input');
      size.placeholder = vans ? 'サイズ（27.5 cm / US 9.5）' : 'サイズ（cm、例 27.5）';
      size.inputMode = 'decimal';
      size.setAttribute('aria-label', 'サイズ（cm）');

      const timeRow = document.createElement('label');
      timeRow.className = 'r';
      const clock = document.createElement('span');
      clock.className = 'lb';
      clock.textContent = '⏰';
      const timeLabel = document.createElement('span');
      timeLabel.className = 'desc';
      timeLabel.textContent = '販売開始（日本時間）';
      timeRow.append(clock, time, timeLabel);
      const productRow = document.createElement('label');
      productRow.className = 'r';
      const kwLabel = document.createElement('span');
      kwLabel.className = 'lb';
      kwLabel.textContent = 'KW1';
      productRow.append(kwLabel, keyword);
      const sizeRow = document.createElement('label');
      sizeRow.className = 'r';
      const sizeLabel = document.createElement('span');
      sizeLabel.className = 'lb';
      sizeLabel.textContent = 'サイズ';
      sizeRow.append(sizeLabel, size);
      const product = document.createElement('div');
      product.className = 'kw';
      product.append(productRow, sizeRow);
      const toolbar = document.createElement('div');
      toolbar.className = 'r btns';
      submit.className = 'main';
      toolbar.append(submit, runNow, cancel, showLog);
      const syncScheduleLabel = () => {
        submit.textContent = time.value ? time.value + ' に予約・自動スタート' : '予約・自動スタート';
      };
      time.addEventListener('input', syncScheduleLabel);
      const profile = document.createElement('details');
      profile.className = 'sec';
      const summary = document.createElement('summary');
      summary.textContent = '⚙️ 配送先・支払い';
      profile.append(summary);
      const profileKey = 'uzura-storefront-shipping-v1';
      const fields = [
        ['family-name', '姓'], ['given-name', '名'], ['postal-code', '郵便番号'],
        ['address-level1', '都道府県'], ['address-level2', '市区町村'],
        ['address-line1', '町名・番地'], ['address-line2', '建物名・部屋番号'],
        ['tel', '電話番号'], ['email', 'メールアドレス']
      ];
      const inputs = new Map();
      const note = document.createElement('div');
      note.className = 'desc';
      note.textContent = 'カードは公式の決済画面でブラウザの自動入力を利用してください。';
      for (const [key, caption] of fields) {
        const row = document.createElement('label');
        row.className = 'r';
        const input = document.createElement('input');
        input.placeholder = caption;
        input.setAttribute('aria-label', caption);
        input.autocomplete = 'off';
        inputs.set(key, input);
        row.append(input);
        profile.append(row);
      }
      const saveProfile = document.createElement('button');
      saveProfile.type = 'button';
      saveProfile.textContent = '配送先を保存';
      saveProfile.disabled = true;
      async function loadProfile() {
        try {
          const saved = await GM.getValue(profileKey, {});
          for (const [key, input] of inputs) input.value = saved?.[key] || '';
          saveProfile.disabled = false;
        } catch {
          report('配送先を読み込めませんでした。');
        }
      }
      saveProfile.onclick = async () => {
        saveProfile.disabled = true;
        try {
          const values = Object.fromEntries(Array.from(inputs, ([key, input]) => [key, input.value.trim()]));
          await GM.setValue(profileKey, values);
          report('配送先を保存しました。');
        } catch {
          report('配送先を保存できませんでした。');
        } finally {
          saveProfile.disabled = false;
        }
      };
      profile.append(saveProfile);
      if (!billys) profile.append(note);
      const checkout = vans ? /^\/checkout(?:\/|$)/.test(location.pathname)
        : /^\/shop\/order\//.test(location.pathname);
      if (billys) {
        const brandKey = 'uzura-billys-card-brand';
        const brands = ['', 'Visa', 'MasterCard', 'JCB', 'American Express'];
        const brand = document.createElement('select');
        brand.setAttribute('aria-label', 'BILLY’Sのカード会社');
        for (const value of brands) {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = value || 'カード会社を指定しない';
          brand.append(option);
        }
        const row = document.createElement('label');
        row.className = 'r';
        row.append('カード会社', brand);
        const saveBrand = document.createElement('button');
        saveBrand.type = 'button';
        saveBrand.textContent = 'カード会社を保存';
        saveBrand.disabled = true;
        function applyBrand(value) {
          if (!checkout || !value) return;
          const normalize = text => text.normalize('NFKC').replace(/\s+/g, '').toLowerCase();
          const radios = Array.from(document.querySelectorAll('input[type="radio"][name]'));
          const matches = radios.filter(radio => !radio.matches(':disabled,[aria-disabled="true"]') &&
            Array.from(radio.labels || []).some(label => label.getClientRects().length &&
              getComputedStyle(label).visibility === 'visible' &&
              normalize(label.innerText) === normalize(value)));
          if (matches.length !== 1) return;
          const [radio] = matches;
          if (radios.some(other => other.name === radio.name && other.form === radio.form && other.checked)) return;
          radio.click();
          if (radio.checked) report('カード会社を選択しました。カード欄はSafariの自動入力を利用できます。');
        }
        saveBrand.onclick = async () => {
          saveBrand.disabled = true;
          const value = brand.value;
          try {
            await GM.setValue(brandKey, value);
            report(value ? 'カード会社を保存しました。' : 'カード会社の事前指定を解除しました。');
            applyBrand(value);
          } catch {
            report('カード会社を保存できませんでした。');
          } finally {
            saveBrand.disabled = false;
          }
        };
        const paymentTitle = document.createElement('b');
        paymentTitle.className = 'r';
        paymentTitle.textContent = '支払い方法：クレジットカード';
        profile.append(paymentTitle, row, saveBrand);
        const cardKey = 'uzura-billys-encrypted-card-v1';
        const pendingCardKey = 'uzura-billys-pending-card:' + location.origin;
        const cardSettings = document.createElement('div');
        function cardInput(label, token, numeric = false) {
          const input = document.createElement('input');
          input.type = 'text';
          input.name = token;
          input.autocomplete = token;
          if (numeric) input.inputMode = 'numeric';
          input.placeholder = label;
          input.setAttribute('aria-label', label);
          const row = document.createElement('div');
          row.className = 'r';
          row.append(input);
          cardSettings.append(row);
          return input;
        }
        const number = cardInput('カード番号', 'cc-number', true);
        const expiry = cardInput('MM/YY', 'cc-exp');
        const cardholder = cardInput('カード名義（例 TARO YAMADA）', 'cc-name');
        const securityCode = cardInput('セキュリティコード（今回の購入のみ）', 'cc-csc', true);
        securityCode.type = 'password';
        securityCode.maxLength = 4;
        function cardButton(label, handler) {
          const button = document.createElement('button');
          button.type = 'button';
          button.style.marginTop = '6px';
          button.textContent = label;
          button.onclick = async () => {
            button.disabled = true;
            try { await handler(); }
            catch { report('カード情報を処理できませんでした。入力内容をご確認ください。'); }
            finally { button.disabled = false; }
          };
          cardSettings.append(button);
        }
        function readCardFields() {
          const digits = number.value.normalize('NFKC').replace(/[\s-]/g, '');
          const date = expiry.value.normalize('NFKC').trim().match(/^(0?[1-9]|1[0-2])\s*\/\s*(?:20)?(\d{2})$/);
          if (!/^\d{13,19}$/.test(digits) || !date) throw new Error('card');
          const code = securityCode.value.normalize('NFKC').trim();
          if (code && !/^\d{3,4}$/.test(code)) throw new Error('security code');
          return [digits, date[1].padStart(2, '0'), date[2], cardholder.value.trim(), code];
        }
        function clearCardFields() {
          number.value = '';
          expiry.value = '';
          cardholder.value = '';
          securityCode.value = '';
        }
        async function clearPendingCard() {
          sessionStorage.removeItem(pendingCardKey);
          await GM.setValue(pendingCardKey, null);
        }
        cardButton('カードをこのタブで準備', async () => {
          const card = readCardFields();
          const raw = crypto.getRandomValues(new Uint8Array(32));
          const iv = crypto.getRandomValues(new Uint8Array(12));
          const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt']);
          const expiresAt = Date.now() + 15 * 60 * 1000;
          const data = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, key,
            new TextEncoder().encode(JSON.stringify({card, expiresAt})));
          await GM.setValue(pendingCardKey, {iv: Array.from(iv), data: Array.from(new Uint8Array(data))});
          sessionStorage.setItem(pendingCardKey, JSON.stringify(Array.from(raw)));
          clearCardFields();
          report('カードを準備しました。同じタブで購入画面へ進んでください。');
        });
        cardButton('カード情報を消去', async () => {
          clearCardFields();
          await clearPendingCard();
          await GM.setValue(cardKey, null);
          report('BOT欄と準備済みカードを消去しました。');
        });
        if (checkout) {
          async function fillCard() {
            let card;
            if (number.value.trim() || expiry.value.trim()) {
              card = readCardFields();
            } else {
              const raw = JSON.parse(sessionStorage.getItem(pendingCardKey) || 'null');
              const pending = raw && await GM.getValue(pendingCardKey, null);
              if (!pending) { report('カードを入力するか、このタブでカードを準備してください。'); return; }
              const key = await crypto.subtle.importKey('raw', Uint8Array.from(raw), 'AES-GCM', false, ['decrypt']);
              const data = await crypto.subtle.decrypt({name: 'AES-GCM', iv: Uint8Array.from(pending.iv)},
                key, Uint8Array.from(pending.data));
              const prepared = JSON.parse(new TextDecoder().decode(data));
              if (Array.isArray(prepared)) {
                card = prepared;
              } else {
                if (!Number.isFinite(prepared.expiresAt) || Date.now() >= prepared.expiresAt) {
                  await clearPendingCard();
                  report('準備したカードの有効時間が過ぎました。再入力してください。');
                  return;
                }
                card = prepared.card;
              }
            }
            const [digits, month, year, name, code = ''] = card;
            const confirmation = findControl(/^(?:ご)?注文を確定する$/);
            if (code && !confirmation) {
              report('注文確認画面でカード欄への入力を実行してください。');
              return;
            }
            const controls = Array.from(document.querySelectorAll('input,select')).filter(control =>
              !control.matches(':disabled,[readonly],[type=hidden]') &&
              control.getClientRects().length && getComputedStyle(control).visibility === 'visible');
            const normalizeLabel = text => text.normalize('NFKC').replace(/\s+/g, '');
            function controlsUnderCaption(caption, selector) {
              const titles = Array.from(document.querySelectorAll('label,dt,th,legend,p,span,div,strong,h2,h3,h4'))
                .filter(title => title.getClientRects().length && normalizeLabel(title.innerText) === caption);
              const found = new Set();
              for (const title of titles) {
                const roots = [title, title.nextElementSibling, title.parentElement];
                for (const root of roots) {
                  if (!root || root.matches('form,main,body')) continue;
                  const matches = controls.filter(control => control.matches(selector) && root.contains(control));
                  if (matches.length === 1 || (caption === '有効期限' && matches.length === 2)) {
                    for (const match of matches) found.add(match);
                    break;
                  }
                }
              }
              return controls.filter(control => found.has(control));
            }
            const expirySelects = controlsUnderCaption('有効期限', 'select');
            const numberInputs = controlsUnderCaption('カード番号', 'input:not([type=radio],[type=checkbox],[type=button],[type=submit])');
            const fields = [['cc-number', 'カード番号', [digits]], ['cc-exp', '有効期限', [month + '/' + year]],
              ['cc-exp-month', '有効期限月', [month, String(Number(month))]],
              ['cc-exp-year', '有効期限年', ['20' + year, year]], ['cc-name', 'カード名義', [name]],
              ['cc-csc', 'セキュリティコード', [code]]];
            if (code) {
              await clearPendingCard();
              securityCode.value = '';
            }
            let count = 0;
            for (const [token, caption, values] of fields) {
              let matches = controls.filter(control => control.autocomplete?.split(/\s+/).includes(token) ||
                (!control.autocomplete?.startsWith('cc-') && Array.from(control.labels || []).some(label =>
                  label.innerText.normalize('NFKC').replace(/\s+/g, '') === caption)));
              if (!matches.length && token === 'cc-number') {
                matches = numberInputs.filter(input => (input.maxLength < 0 || input.maxLength >= 13) &&
                  !/cvc|cvv|security/i.test([input.id, input.name, input.autocomplete].join(' ')) &&
                  !Array.from(input.labels || []).some(label => normalizeLabel(label.innerText).includes('セキュリティコード')));
              }
              if (!matches.length && token === 'cc-csc') {
                matches = controlsUnderCaption(caption, 'input[type=text],input[type=tel],input[type=password],input[type=number]')
                  .filter(input => [3, 4].includes(input.maxLength) || /cvc|cvv|security/i.test(input.id + ' ' + input.name));
              }
              if (!matches.length && expirySelects.length === 2) {
                if (token === 'cc-exp-month') matches = [expirySelects[0]];
                if (token === 'cc-exp-year') matches = [expirySelects[1]];
              }
              if (matches.length !== 1) continue;
              const [control] = matches;
              const current = control.value.trim();
              const placeholder = control.tagName === 'SELECT' && /^(?:--+|選択(?:してください)?)$/.test(control.selectedOptions[0]?.textContent.trim() || '');
              if (current && !placeholder) continue;
              const value = control.tagName === 'SELECT'
                ? values.find(candidate => Array.from(control.options).some(option => !option.disabled && option.value === candidate))
                : control.type === 'month' ? '20' + year + '-' + month : values[0];
              if (!value) continue;
              control.value = value;
              if (!control.value) continue;
              control.dispatchEvent(new Event('input', {bubbles: true}));
              control.dispatchEvent(new Event('change', {bubbles: true}));
              count++;
            }
            if (count) {
              clearCardFields();
              await clearPendingCard();
            }
            report(count ? 'カード欄に入力しました。残りの項目と注文内容をご確認ください。'
              : '入力できるカード欄が見つかりません。公式画面をご確認ください。');
          }
          cardButton('購入画面のカード欄へ入力', fillCard);
          if (sessionStorage.getItem(pendingCardKey)) {
            const watch = new MutationObserver(tryPreparedCard);
            const deadline = setTimeout(() => watch.disconnect(), 15000);
            function tryPreparedCard() {
              if (!findControl(/^(?:ご)?注文を確定する$/)) return;
              watch.disconnect();
              clearTimeout(deadline);
              void fillCard().catch(() => report('準備済みカードを入力できませんでした。'));
            }
            watch.observe(document.body, {subtree: true, childList: true, attributes: true});
            tryPreparedCard();
          }
        }
        const cardNote = document.createElement('div');
        cardNote.className = 'desc';
        cardNote.textContent = '入力後に「カードをこのタブで準備」を押し、同じタブで購入画面へ進むと準備済みカードを入力します。セキュリティコードは今回の購入用で、準備から15分以内に入力できます。注文確定は手動です。';
        profile.append(cardSettings, cardNote);
        void (async () => {
          try {
            const saved = await GM.getValue(brandKey, '');
            if (brands.includes(saved)) brand.value = saved;
            applyBrand(brand.value);
          } catch {
            report('カード会社を読み込めませんでした。');
          } finally {
            saveBrand.disabled = false;
          }
        })();
      }
      if (checkout) {
        const fill = document.createElement('button');
        fill.type = 'button';
        fill.textContent = '空欄に配送先を入力';
        fill.onclick = async () => {
          let saved;
          try { saved = await GM.getValue(profileKey, {}); }
          catch { report('配送先を読み込めませんでした。'); return; }
          let count = 0;
          for (const [key] of fields) {
            if (!saved?.[key]) continue;
            const candidates = Array.from(document.querySelectorAll('input[autocomplete]')).filter(input =>
              !input.matches(':disabled,[readonly],input[type=hidden],input[type=password]') &&
              input.getClientRects().length &&
              input.autocomplete.split(/\s+/).includes(key) &&
              !input.autocomplete.split(/\s+/).includes('billing'));
            if (candidates.length !== 1 || candidates[0].value.trim()) continue;
            const input = candidates[0];
            input.value = saved[key];
            input.dispatchEvent(new Event('input', {bubbles: true}));
            input.dispatchEvent(new Event('change', {bubbles: true}));
            count++;
          }
          report(count ? count + '項目を入力しました。内容を確認してください。' : '入力できる空欄がありません。');
        };
        profile.append(fill);
      }
      void loadProfile();
      search.append(timeRow, product, profile, toolbar);
      panel.prepend(header);
      panel.append(search, output, action);
      action.removeAttribute('style');
      action.hidden = !/^(?:\/(?:checkout\/)?cart\/?|\/shop\/cart\/cart\.aspx)$/.test(location.pathname);
      if (reviewStore && (reviewCart || reviewOrder)) {
        action.hidden = false;
      }
      if (productPath.test(location.pathname)) keyword.value = location.href;
      const key = 'uzura-vans-search';
      const sizeKey = 'uzura-storefront-cart-size';
      let reservation;
      function prepareProduct(url, startedAt) {
        if (size.value.trim()) {
          sessionStorage.setItem(sizeKey, JSON.stringify({
            pathname: url.pathname, cm: Number(size.value.trim().replace(/^US\s*/i, '').replace(/\s*cm$/i, '')), us: vans && /^US\s*\d/i.test(size.value.trim()), expires: abcMart ? Date.now() + 120000 : startedAt + 60000
          }));
        }
        if (url.href === location.href) location.reload();
        else location.assign(url.href);
      }
      function lookup(query, startedAt = Date.now()) {
        if (/^https?:/i.test(query) || abcMart || billys) {
          let url;
          try { url = new URL(query); } catch {}
          if (url?.origin === location.origin && productPath.test(url.pathname)) {
            prepareProduct(url, startedAt);
          } else {
            report('このストアの公式商品URLを入力してください。');
          }
          return;
        }
        if (location.pathname !== '/new_arrival/') {
          sessionStorage.setItem(key, JSON.stringify({query, size: size.value, startedAt}));
          location.assign('/new_arrival/');
          return;
        }
        const normalize = value => value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
        const matches = new Map();
        for (const link of document.querySelectorAll('a[href*="/p/"]')) {
          const url = new URL(link.href);
          if (url.origin !== location.origin || !url.pathname.startsWith('/p/')) continue;
          const name = [link.textContent, link.getAttribute('aria-label'), link.querySelector('img')?.alt].join(' ');
          if (normalize(name + ' ' + url.pathname).includes(normalize(query))) matches.set(url.pathname, url);
        }
        if (matches.size === 1) prepareProduct(matches.values().next().value, startedAt);
        else report(matches.size ? '複数の商品が一致しました。品番で絞ってください。' : '現在の新着一覧に一致する商品がありません。');
      }
      function start(scheduled) {
        clearTimeout(reservation);
        const query = keyword.value.trim();
        if (!query) return;
        if (vans && !size.value.trim()) {
          report('サイズ（cm）を入力してください。例 26.5');
          return;
        }
        const sizePattern = vans ? /^(?:(?:[1-3]\d)(?:\.[05])?(?:\s*cm)?|US\s*\d{1,2}(?:\.[05])?)$/i : /^(?:[1-3]\d)(?:\.[05])?$/;
        if (size.value.trim() && !sizePattern.test(size.value.trim())) {
          report(vans ? 'サイズを入力してください（例 27.5 cm または US 9.5）。' : 'サイズはcmで入力してください（例 27.5）。');
          return;
        }
        if (!scheduled) { lookup(query); return; }
        if (!time.value) { report('発売時刻を入力してください。'); return; }
        const now = Date.now();
        const jstDay = new Date(now + 9 * 3600000).toISOString().slice(0, 10);
        let at = Date.parse(jstDay + 'T' + time.value + ':00+09:00');
        if (at < now) at += 86400000;
        reservation = setTimeout(() => {
          if (abcMart || billys || /^https?:/i.test(query)) { lookup(query, at); return; }
          sessionStorage.setItem(key, JSON.stringify({query, size: size.value, startedAt: at}));
          if (location.pathname === '/new_arrival/') location.reload();
          else location.assign('/new_arrival/');
        }, at - now);
        report('日本時間 ' + time.value + ' に商品を確認します。');
      }
      search.addEventListener('submit', event => {
        event.preventDefault();
        start(true);
      });
      runNow.onclick = () => start(false);
      cancel.onclick = () => {
        if (reviewStore) clearReview();
        stopVansHandoff?.();
        clearTimeout(reservation);
        stop('停止しました');
      };
      const pending = sessionStorage.getItem(key);
      if (pending && location.pathname === '/new_arrival/') {
        sessionStorage.removeItem(key);
        const run = () => {
          const saved = JSON.parse(pending);
          panel.hidden = false;
          size.value = saved.size;
          lookup(saved.query, saved.startedAt);
        };
        if (document.readyState === 'complete') setTimeout(run, 0);
        else window.addEventListener('load', run, {once: true});
      }
    }
    if ((vans || abcMart || billys) && productPath.test(location.pathname)) {
      const key = 'uzura-storefront-cart-size';
      const saved = sessionStorage.getItem(key);
      if (saved) {
        sessionStorage.removeItem(key);
        const target = JSON.parse(saved);
        if (target.pathname === location.pathname && target.expires > Date.now()) {
          setTimeout(() => {
            panel.hidden = false;
            function watchSize(check) {
              const expired = () => stop('1分以内に指定サイズをカートへ追加できませんでした。');
              const verify = () => {
                if (location.pathname !== target.pathname) { stop('商品ページが変わったため停止しました。'); return; }
                if (Date.now() >= target.expires) { expired(); return; }
                check();
              };
              action.textContent = '停止';
              report('指定サイズとカートボタンの表示を確認しています（最大1分）。');
              observer = new MutationObserver(verify);
              observer.observe(document.body, {subtree: true, childList: true, attributes: true, characterData: true});
              timer = setTimeout(expired, Math.max(0, target.expires - Date.now()));
              verify();
            }
            if (billys) {
              let clickedSize;
              watchSize(() => {
                const form = document.querySelector('#cartin_form');
                const sizes = Array.from(form?.querySelectorAll('input[type="radio"]') || []).filter(input =>
                  !input.matches(':disabled,[aria-disabled="true"]') &&
                  Array.from(input.labels || []).some(label => {
                    const match = label.textContent.normalize('NFKC').match(/\(\s*(\d+(?:\.\d+)?)\s*cm\s*\)/i);
                    return match && Number(match[1]) === target.cm && label.getClientRects().length;
                  }));
                if (sizes.length !== 1) return;
                if (!sizes[0].checked && clickedSize !== sizes[0]) {
                  clickedSize = sizes[0];
                  clickedSize.click();
                }
                const add = sizes[0].checked && findControl(/^カートに入れる$/, form);
                if (!add) return;
                clearReview();
                sessionStorage.setItem(reviewKey, String(Date.now() + 120000));
                stop('指定サイズのカートボタンを押しました。');
                add.click();
              });
              return;
            }
            if (abcMart) {
              const rows = Array.from(document.querySelectorAll('#cartin_form dl')).filter(row => {
                const match = row.querySelector('dt')?.textContent.normalize('NFKC').match(/\(\s*(\d+(?:\.\d+)?)\s*cm\s*\)/i);
                return match && Number(match[1]) === target.cm;
              });
              const add = rows.length === 1 && findControl(/^カートへ入れる$/, rows[0]);
              if (!add) { stop('指定サイズのカートボタンが見つかりません。'); return; }
              clearReview();
              sessionStorage.setItem(reviewKey, String(Date.now() + 120000));
              stop('指定サイズのカートボタンを押しました。');
              add.click();
              return;
            }
            const cm = String(target.cm).replace('.', '\\.');
            const jp = Number.isInteger(target.cm) ? cm + String.raw`(?:\.0)?` : cm;
            const sizeText = target.us
              ? String.raw`US\s*${jp}\s*\(\s*JP\s*\d+(?:\.\d+)?\s*(?:cm)?\s*\)`
              : String.raw`US\s*\d+(?:\.\d+)?\s*\(\s*JP\s*${jp}\s*(?:cm)?\s*\)`;
            const sizeLabel = new RegExp('^' + sizeText + '$', 'i');
            const selected = new RegExp(String.raw`サイズ\s*[:：]\s*${sizeText}`, 'i');
            let sizeClicked = false;
            const verify = () => {
              if (selected.test(document.body.innerText.normalize('NFKC')) && findControl(vansAddLabel)) {
                observer.disconnect();
                observer = null;
                clearTimeout(timer);
                action.click();
                return;
              }
              if (sizeClicked) return;
              const sizeControl = findControl(sizeLabel);
              if (!sizeControl) return;
              sizeClicked = true;
              sizeControl.click();
              verify();
            };
            watchSize(verify);
          }, 0);
        }
      }
    }
    stop('商品ページまたはカートで使えます');
    if (vans || abcMart || billys) {
      const root = uzuraMountShopPanel(panel, 'uzura-storefront-panel');
      const launcher = document.createElement('button');
      launcher.type = 'button';
      launcher.textContent = 'U';
      launcher.setAttribute('aria-label', 'うずら BOT を開く');
      launcher.style.cssText = 'position:fixed;right:10px;bottom:calc(env(safe-area-inset-bottom) + 90px);z-index:2147483647;width:48px;height:48px;border-radius:50%;background:#0d1b32;color:white;border:2px solid white;font:bold 24px system-ui';
      launcher.onclick = () => { panel.hidden = !panel.hidden; };
      if (reviewStore && (reviewCart || reviewOrder)) {
        if (Number(sessionStorage.getItem(reviewKey)) > Date.now()) {
          continueReview();
        } else {
          clearReview();
          report('購入手続きは公式の確認画面まで進みます。');
        }
      }
      root.append(launcher);
      if (billys && reviewOrder) {
        applyCreditCardDefault();
        if (document.readyState !== 'complete') {
          window.addEventListener('load', applyCreditCardDefault, {once: true});
        }
      }
      if (billys && reviewOrder) {
        applyBillysDeliveryDefault();
        applyBillysCardReuseDefault();
        if (document.readyState !== 'complete') {
          window.addEventListener('load', applyBillysDeliveryDefault, {once: true});
          window.addEventListener('load', applyBillysCardReuseDefault, {once: true});
        }
      }
    } else {
      document.body.append(panel);
    }
  }
  if (document.readyState !== 'loading') queueMicrotask(mount);
  else document.addEventListener('DOMContentLoaded', mount, {once: true});
})();

// Store registry: catalog schema checked using read-only requests on 2026-11-06.
const UZURA_STORES = [{"name":"VALLAD STUDIO","hosts":["valladstudio.com"],"group":"street"},{"name":"STÜSSY","hosts":["jp.stussy.com"],"group":"street"},{"name":"A+S","hosts":["architectureandsneakers.com"],"group":"street"},{"name":"DOVER STREET MARKET GINZA","hosts":["shop-jp.doverstreetmarket.com"],"group":"street"},{"name":"NUBIAN","hosts":["nubiantokyo.com"],"group":"street"},{"name":"WTAPS","hosts":["wtaps.com"],"group":"street"},{"name":"NEIGHBORHOOD","hosts":["neighborhood.jp"],"group":"street"},{"name":"BAPE","hosts":["jp.bape.com"],"group":"street"},{"name":"UNION TOKYO","hosts":["uniontokyo.jp"],"group":"street"},{"name":"JJJJOUND","hosts":["jjjjound.com"],"group":"street"},{"name":"GDC","hosts":["gdc.tokyo"],"group":"street"},{"name":"NEW ERA","hosts":["neweracap.jp"],"group":"street"},{"name":"mita sneakers","hosts":["mita-sneakers.co.jp"],"group":"street"},{"name":"WIND AND SEA","hosts":["windandsea.jp"],"group":"street"},{"name":"FTC","hosts":["ftcsf.com"],"group":"street"},{"name":"UNDEFEATED","hosts":["undefeated.jp"],"group":"street"},{"name":"HUF","hosts":["hufworldwide.jp"],"group":"street"},{"name":"SC Subculture","hosts":["sc-subculture.jp"],"group":"street"},{"name":"Denim Tears","hosts":["denimtears.com"],"group":"street"},{"name":"Carhartt WIP","hosts":["carhartt-wip.jp"],"group":"street"},{"name":"FreshService","hosts":["freshservice.jp"],"group":"street"},{"name":"Aimé Leon Dore","hosts":["aimeleondore.com"],"group":"street"},{"name":"Cactus Plant Flea Market","hosts":["cactusplantfleamarket.com"],"group":"street"},{"name":"NOAH","hosts":["noahny.com"],"group":"street"},{"name":"Awake NY","hosts":["awakenyclothing.com"],"group":"street"},{"name":"BlackEyePatch","hosts":["blackeyepatch.com"],"group":"street"},{"name":"KICKS LAB.","hosts":["kickslab.com"],"group":"street"},{"name":"CONVERSE","hosts":["converse.co.jp"],"group":"street"},{"name":"Clarks","hosts":["clarks.co.jp"],"group":"street"},{"name":"sacai","hosts":["sacai.jp"],"group":"street"},{"name":"Graphpaper","hosts":["graphpaper-tokyo.com"],"group":"street"},{"name":"N.HOOLYWOOD","hosts":["n-hoolywood.com"],"group":"street"},{"name":"Fear of God","hosts":["fearofgod.com"],"group":"street"},{"name":"Gallery Dept.","hosts":["gallerydept.com"],"group":"street"},{"name":"#FR2","hosts":["fr2.tokyo"],"group":"street"},{"name":"Liberaiders","hosts":["liberaiders.jp"],"group":"street"},{"name":"SUICOKE","hosts":["suicoke.com"],"group":"street"},{"name":"KEEN","hosts":["keenfootwear.jp"],"group":"street"},{"name":"Salomon","hosts":["salomon.jp"],"group":"street"},{"name":"Hellstar","hosts":["hellstar.com"],"group":"street"},{"name":"Sp5der","hosts":["kingspider.co"],"group":"street"},{"name":"Brain Dead","hosts":["wearebraindead.com"],"group":"street"},{"name":"PLEASURES","hosts":["pleasuresnow.com"],"group":"street"},{"name":"Dime","hosts":["dimemtl.com"],"group":"street"},{"name":"Polar Skate Co.","hosts":["polarskateco.com"],"group":"street"},{"name":"ERL","hosts":["erl.store"],"group":"street"},{"name":"Aries","hosts":["ariesarise.com"],"group":"street"},{"name":"BODE","hosts":["bode.com"],"group":"street"},{"name":"Patta","hosts":["patta.nl"],"group":"street"},{"name":"Anti Social Social Club","hosts":["antisocialsocialclub.com"],"group":"street"},{"name":"REPRESENT","hosts":["representclo.com"],"group":"street"},{"name":"Trapstar","hosts":["uk.trapstarlondon.com"],"group":"street"},{"name":"Corteiz","hosts":["corteiz.com"],"group":"street"},{"name":"PATRICK","hosts":["patrick.jp"],"group":"street"},{"name":"LFYT","hosts":["lfyt.jp"],"group":"street"},{"name":"V.A.","hosts":["vatokyo.com"],"group":"street"},{"name":"Diaspora","hosts":["diasporaskateboards.com"],"group":"skate"},{"name":"Evisen","hosts":["shop.evisenskateboards.com"],"group":"skate"},{"name":"Quasi","hosts":["quasiskateboards.com"],"group":"skate"},{"name":"Last Resort AB","hosts":["lastresortab.com"],"group":"skate"},{"name":"Frog","hosts":["frogskateboards.com"],"group":"skate"},{"name":"THRASHER","hosts":["shop.thrashermagazine.com"],"group":"skate"},{"name":"WKND","hosts":["wkndbrand.com"],"group":"skate"},{"name":"Bronze 56k","hosts":["shop.bronze56k.com"],"group":"skate"},{"name":"Butter Goods","hosts":["buttergoods.com"],"group":"skate"},{"name":"ちいかわマーケット","hosts":["chiikawamarket.jp"],"group":"hobby"},{"name":"hololive production","hosts":["shop.hololivepro.com"],"group":"hobby"},{"name":"JUMP SHOP","hosts":["jumpshop-benelic.com"],"group":"hobby"},{"name":"Filmarks Store","hosts":["store.filmarks.com"],"group":"hobby"},{"name":"Kaikai Kiki","hosts":["store.kaikaikiki.com"],"group":"hobby"},{"name":"9090","hosts":["yz-store.com"],"group":"hobby","collection":"9090"},{"name":"LIBERTY WALK","hosts":["lbwk.jp"],"group":"hobby"},{"name":"ANNA SUI","hosts":["annasui.co.jp"],"group":"ladies"},{"name":"FORGET ME NOTS","hosts":["forgetmenots.jp"],"group":"ladies"},{"name":"DEADLY DOLL","hosts":["deadlydoll.com"],"group":"ladies"},{"name":"Darich","hosts":["darich.shop"],"group":"ladies"},{"name":"Mame Kurogouchi","hosts":["mamekurogouchi.com"],"group":"ladies"},{"name":"louren","hosts":["louren.jp"],"group":"ladies"},{"name":"MURRAL","hosts":["murral.jp"],"group":"ladies"},{"name":"JUEMI","hosts":["juemi.jp"],"group":"ladies"},{"name":"COHINA","hosts":["cohina.net"],"group":"ladies"},{"name":"EDIKTED","hosts":["edikted.com"],"group":"ladies"},{"name":"House of Sunny","hosts":["houseofsunny.com"],"group":"ladies"},{"name":"Alo Yoga","hosts":["aloyoga.com"],"group":"ladies"},{"name":"Rouje","hosts":["rouje.com"],"group":"ladies"},{"name":"Marine Serre","hosts":["marineserre.com"],"group":"ladies"},{"name":"Paloma Wool","hosts":["palomawool.com"],"group":"ladies"},{"name":"Andmary","hosts":["andmary.co.jp"],"group":"ladies"},{"name":"JAM HOME MADE","hosts":["jamhomemade.com"],"group":"ladies"},{"name":"CHARI&CO","hosts":["chariandco.jp"],"group":"ladies"},{"name":"Maker’s Watch Knot","hosts":["knot-designs.com"],"group":"other"},{"name":"UNDONE","hosts":["undone.com"],"group":"other"},{"name":"Lorier","hosts":["lorierwatches.com"],"group":"other"},{"name":"MVMT","hosts":["mvmt.com"],"group":"other"},{"name":"Serica","hosts":["serica-watches.com"],"group":"other"},{"name":"anOrdain","hosts":["anordain.com"],"group":"other"},{"name":"WHIMSY","hosts":["whimsysocks.com"],"group":"other"}];
const uzuraStoreFor = host => UZURA_STORES.find(s => s.hosts.includes(String(host).toLowerCase().replace(/^www\./, ''))) || null;
const UZURA_CURRENT = uzuraStoreFor(location.hostname);
const UZURA_PENDING_HOSTS = ["marketstudios.com", "chinatownmarket.com", "nagano-market.jp", "herlipto.jp"];
const uzuraLocaleRoot = path => { const m = /^\/([a-z]{2}(?:-[a-z]{2})?)\//i.exec(path || '/'); return m ? '/' + m[1] + '/' : '/'; };

// Purchase-success webhook settings shared through Userscripts GM storage.
(async function uzuraDiscord() {
  'use strict';
  if (window.top !== window) return;
  const setupPage = location.origin === 'https://github.com' &&
    /^\/stussy2313xxx-web\/uzura-bot\/?$/.test(location.pathname) &&
    new URLSearchParams(location.search).get('money-lab-notify') === 'setup';
  const dedicated = location.hostname === 'www.dot-st.com' || /(^|\.)feiler\.jp$/.test(location.hostname);
  if (!setupPage && !dedicated && !UZURA_CURRENT && !/(^|\.)(?:mellojoy(?:lucky\.cn|japan\.com|us\.com)|shop\.app|supreme\.com|humanmade\.jp|buffering\.jp)$|^(?:checkout\.)?jp\.palaceskateboards\.com$/i.test(location.hostname)) return;
  const VALID = /^https:\/\/discord\.com\/api\/webhooks\/1570274974416113755\/[\w-]+$/;
  const MONEY_LAB_GUILD = '1556313614053408889';
  const MONEY_LAB_CHANNEL = '1570274906040569976';
  const load = (k,d) => GM.getValue('uzura_notify_'+k,d);
  const save = (k,v) => GM.setValue('uzura_notify_'+k,v);
  if (setupPage) {
    if (document.body) mountSettings();
    else document.addEventListener('DOMContentLoaded', mountSettings, { once: true });
    return;
  }
  const request = (hook, payload) => new Promise((resolve,reject) => {
    GM.xmlHttpRequest({method:'POST',url:hook+'?wait=true',headers:{'Content-Type':'application/json'},
      data:JSON.stringify(payload),timeout:15000,
      onload:r=>r.status>=200&&r.status<300 ? resolve() : reject(new Error('Discord HTTP '+r.status)),
      onerror:()=>reject(new Error('通知通信エラー')),ontimeout:()=>reject(new Error('通知がタイムアウトしました'))});
  });
  const stripUrl = u => {try {const x=new URL(u);return x.protocol==='https:' ? x.origin+x.pathname : undefined;}catch{return undefined;}};
  let queue = Promise.resolve();
  window.addEventListener('uzura-purchase-success',e => {
    let data;try {data=JSON.parse(e.detail);} catch{return;}
    const respond = (status, message = '') => { if (data.requestId) window.dispatchEvent(new CustomEvent('uzura-notification-status', { detail: JSON.stringify({requestId: data.requestId, status, message}) })); };
    queue=queue.then(async()=>{
      const hook = await load('hook', '');
      if (!VALID.test(hook) || !Array.isArray(data.embeds)) { respond('unconfigured', '通知先が未設定です'); return; }
      const lottery = /(^|\.)mellojoylucky\.cn$/i.test(location.hostname);
      const embeds=data.embeds.filter(x=>lottery ? /Lottery Won/.test(x.author||'') : /Checkout Successful/.test(x.author||'')).slice(0,10).map(x=>({
        title:String(x.title||'購入成功').slice(0,250),color:0x2ecc71,
        author:{name:lottery ? '入店抽選 当選' : '購入成功'},url:stripUrl(x.url),thumbnail:stripUrl(x.thumb)?{url:stripUrl(x.thumb)}:undefined,
        fields:(x.fields||[]).filter(f=>/^(Size|Quantity|Site|価格|サイズ|数量|来店日|時間|Order|注文番号)$/i.test(f[0]) && f[1]!=null && f[1]!=='').map(f=>({name:String(f[0]),value:String(f[1]).slice(0,1000),inline:true})),
        timestamp:new Date().toISOString(),footer:{text:'うずら BOT'}
      }));
      if(!embeds.length || /komoju\.com$/.test(location.hostname)) { respond('filtered', '対象の購入成功通知がありません'); return; }
      const order = (/^[A-Z0-9-]{4,64}$/i.test(String(data.order || '')) && data.order) || embeds.flatMap(x=>x.fields).find(f=>/^(Order|注文番号)$/i.test(f.name))?.value;
      const appointment = lottery && embeds[0].fields.filter(field => /^(来店日|時間)$/.test(field.name)).map(field => field.value).join(' ');
      const localKey = /^t[0-9]+$/.test(String(data.dedupeKey || '')) ? data.dedupeKey : location.pathname;
      const id=location.hostname+':'+(order || appointment || localKey);
      embeds.forEach(e => { e.fields = e.fields.filter(f => !/^(Order|注文番号)$/i.test(f.name)); }); // Order ID is used only locally for deduplication.
      const sent=await load('sent',{});
      if(sent[id]) { respond('duplicate', 'この注文は通知済みです'); return; }
      try {
        await request(hook, {username:'うずら BOT',allowed_mentions:{parse:[]},embeds});
        sent[id]=Date.now();await save('sent',Object.fromEntries(Object.entries(sent).slice(-100)));say(lottery ? '入店抽選の当選通知を送信しました。' : '購入成功の通知を送信しました。');respond('sent', '購入成功通知を送信しました');
      } catch(err){respond('error', err.message || '通知通信エラー');say(err.message+'。送信先や通信状況を管理者に確認してください。');}
    }).catch(()=>respond('error', '通知処理に失敗しました'));
  });
  const say=t=>{console.info('[うずら BOT 通知]',t);};
  function mountSettings() {
    const settings = document.createElement('button');
    settings.type = 'button';
    settings.textContent = 'MONEY LAB 通知先を設定';
    settings.style.cssText = 'position:fixed;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:2147483647;background:#10213b;color:#fff;border:1px solid #9bb3d2;border-radius:16px;padding:10px 12px;font:700 13px -apple-system,sans-serif';
    settings.onclick = async event => {
      if (!event.isTrusted || settings.disabled) return;
      const next = window.prompt('MONEY LABの新しいWebhook URLを入力してください')?.trim();
      if (!next) return;
      if (!VALID.test(next)) { window.alert('DiscordのWebhook URLを確認してください。'); return; }
      settings.disabled = true;
      try {
        const target = await new Promise((resolve, reject) => {
          GM.xmlHttpRequest({
            method: 'GET', url: next, timeout: 10000,
            onload: response => {
              if (response.status !== 200) { reject(new Error('Webhookを確認できませんでした。HTTP ' + response.status)); return; }
              try { resolve(JSON.parse(response.responseText)); }
              catch { reject(new Error('Discordの応答を確認できませんでした。')); }
            },
            onerror: () => reject(new Error('Discordに接続できませんでした。')),
            ontimeout: () => reject(new Error('Discordへの接続がタイムアウトしました。')),
          });
        });
        if (target?.guild_id !== MONEY_LAB_GUILD || target.channel_id !== MONEY_LAB_CHANNEL) {
          throw new Error('指定のMONEY LABチャンネルに紐づくWebhookを入力してください。');
        }
        await save('hook', next);
        window.alert('MONEY LABの購入成功通知先を保存しました。');
      } catch (error) {
        window.alert(error.message || 'Webhookを保存できませんでした。');
      } finally {
        settings.disabled = false;
      }
    };
    document.body.append(settings);
  }
})();


// and ST uses an independent checkout. Require a completed receipt.
(function uzuraDedicatedReceipt() {
  const andSt = location.hostname === 'www.dot-st.com';
  if (window.top !== window || !andSt) return;

  function readReceipt() {
    if (!/(?:^|\/)(?:checkout|order|purchase)(?:[-_/]|$)/i.test(location.pathname)) return null;
    const complete = [...document.querySelectorAll('h1,h2,[role="heading"]')].some(element =>
      /^(?:ご?注文(?:が)?完了(?:しました)?|ご注文ありがとうございます)[。！!\s]*$/.test(element.innerText?.trim() || ''));
    if (!complete) return null;
    const order = /(?:ご?注文番号|オーダー番号)\s*[:：#＃]?\s*([A-Z0-9][A-Z0-9-]{3,})/i.exec(document.body?.innerText || '')?.[1];
    return order ? { order, embeds: [] } : null;
  }

  let checks = 0;
  const timer = setInterval(() => {
    const receipt = readReceipt();
    if (!receipt) { if (++checks >= 120) clearInterval(timer); return; }
    clearInterval(timer);
    if (!receipt.embeds.length) {
      const title = 'and ST';
      receipt.embeds.push({ author: 'Checkout Successful', title, fields: [['Site', title]] });
    }
    window.dispatchEvent(new CustomEvent('uzura-purchase-success', { detail: JSON.stringify(receipt) }));
  }, 750);
})();



const uzuraMonitorDelay = (value, minimum) => {
  const ms = Number(value);
  return Number.isFinite(ms) && ms > 0 ? Math.min(30000, Math.max(minimum, Math.round(ms))) : 0;
};



const UZURA_AND_ST_VERSION = "2.1.44.10938";
const UZURA_SHOP_PANEL_ICON = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MCIgaGVpZ2h0PSI4MCIgdmlld0JveD0iMCAwIDgwIDgwIj48Y2lyY2xlIGN4PSI0MCIgY3k9IjQwIiByPSIzNiIgZmlsbD0iI2ZmZmZmZiIvPjx0ZXh0IHg9IjQwIiB5PSI1NSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9IkFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iNDYiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSIjMTAyMTNiIj5VPC90ZXh0Pjwvc3ZnPg==";
const UZURA_SHOP_PANEL_CSS = `#sxbbox,#sxbbox *{box-sizing:border-box;line-height:1.35;text-transform:none;letter-spacing:normal}
#sxbbox button{width:auto;height:auto;min-height:0;min-width:0;max-width:none;display:inline-block;text-align:center;cursor:pointer}
#sxbbox input,#sxbbox select{height:auto;min-height:0;max-width:none;width:auto;display:block}
#sxbbox img{max-width:100%;border:0}
#sxbbox{position:fixed;left:8px;right:8px;z-index:2147483647;background:#0d1b32;color:#f2f2f2;border:1px solid #527198;border-radius:16px;
  box-shadow:0 6px 24px #000c;padding:10px 12px;font:13px -apple-system,"Hiragino Sans",sans-serif;text-align:left;letter-spacing:0;text-transform:none}
#sxbbox.top{top:calc(env(safe-area-inset-top) + 6px)} #sxbbox.bot{bottom:calc(env(safe-area-inset-bottom) + 10px)}
#sxbbox .hd{display:flex;gap:6px;align-items:center;font-weight:700}
#sxbbox .hd button{padding:6px 7px;font-size:12px;white-space:nowrap;flex:none}
#sxbbox .ttl{flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;justify-content:center}
#sxbbox .ver{font-size:10px;font-weight:600;color:#b7c8df;letter-spacing:.5px;margin-top:1px;line-height:1}
#sxbbox button{border:1px solid #527198;background:#203a5d;color:#ffffff;border-radius:10px;padding:7px 10px;font-size:13px;font-weight:700;text-shadow:none;box-shadow:none;margin:0}
#sxbbox .btns{flex-wrap:wrap} #sxbbox .btns button{flex:1;white-space:nowrap} #sxbbox .btns button.main{flex:1 1 100%}
#sxbbox button.main{font-size:14px;padding:9px 10px;background:linear-gradient(180deg,#e8f0fc,#ffffff);color:#10213b;border:0;box-shadow:0 2px 10px #ffffff40}
#sxbbox .r{display:flex;gap:6px;margin-top:6px;align-items:center}
#sxbbox input{flex:1;min-width:0;font-size:16px;padding:6px 8px;border:1px solid #527198;border-radius:8px;background:#162a46;color:#fff;margin:0;height:auto}
#sxbbox input.sz{flex:0 0 64px} #sxbbox .kw{border-top:1px solid #1f1d24;margin-top:6px} #sxbbox .kw .r{margin-top:4px}
#sxbbox .sec{border:1px solid #385573;border-radius:10px;padding:4px 8px 8px;margin-top:8px} #sxbbox .sec b{color:#ffffff;font-size:12px}
#sxbbox label.ck{display:flex;gap:8px;align-items:center;margin-top:6px;font-size:13px} #sxbbox label.ck input{flex:none;width:20px;height:20px;padding:0;border:0;background:none;-webkit-appearance:checkbox;appearance:auto;accent-color:#ffffff}
#sxbbox input::placeholder{color:#a9bed8}
#sxbbox input:focus,#sxbbox select:focus{outline:none;border-color:#ffffff;box-shadow:0 0 0 2px #ffffff40}
#sxbbox select{-webkit-appearance:none;appearance:none;font-size:16px;padding:6px 22px 6px 10px;border-radius:8px;background:#162a46 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23ffffff' stroke-width='2' fill='none'/%3E%3C/svg%3E") no-repeat right 7px center;color:#fff;border:1px solid #527198;font-weight:700;margin:0;height:auto}
#sxbbox input[type=time]{flex:0 0 auto;width:110px;color-scheme:dark}
#sxbbox .lb{width:34px;font-size:11px;color:#ffffff;font-weight:700;flex:none}
#sxbbox .desc{font-size:12px;color:#c2d1e5;margin-top:4px} #sxbbox .st{font-size:12px;color:#ffffff;font-weight:700;margin-top:3px}
#sxbbox .body{max-height:calc(100vh - 160px);overflow-y:auto;-webkit-overflow-scrolling:touch}
#sxbbox button:disabled{opacity:.35}
#sxbbox button,#sxbbox input,#sxbbox select{font-family:-apple-system,"Hiragino Sans",sans-serif}
#sxblog{display:block;max-height:220px;overflow:auto;white-space:pre-wrap;font:11px ui-monospace,monospace;background:#10213b;color:#cfdeef;border:1px solid #385573;border-radius:8px;padding:6px;margin-top:6px}
`;

function uzuraMountShopPanel(box, id) {
  const host = document.createElement('div');
  host.id = id;
  host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;top:0;left:0;width:0;height:0';
  const root = host.attachShadow({mode: 'open'});
  const style = document.createElement('style');
  style.textContent = UZURA_SHOP_PANEL_CSS + '#sxbbox [hidden]{display:none!important}';
  root.append(style, box);
  document.body.append(host);
  return root;
}

// and ST uses the official product picker and its existing cart handler.
(function uzuraAndSt() {
  'use strict';
  const origin = 'https://www.dot-st.com';
  if (window.top !== window || location.origin !== origin || /^\/(?:cart|checkout|order|login|member)(?:\/|$)/.test(location.pathname)) return;

  const key = 'uzura-and-st-run-v1';
  const every = 5000;
  const runLength = 120000;
  const clean = value => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
  const productId = url => /^\/(?:[a-z0-9_-]+\/)?disp\/item\/([0-9]+)\/?$/i.exec(url.pathname)?.[1];
  const urlFor = value => {
    try {
      const url = new URL(value, origin);
      if (url.origin === origin && productId(url)) {
        url.search = '';
        url.hash = '';
        return url;
      }
    } catch {}
    return null;
  };
  const visible = element => element && element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden';

  class SearchError extends Error {}
  async function search(task, signal) {
    const url = new URL('/disp/itemlist/', origin);
    url.searchParams.set('q', task.query.normalize('NFKC'));
    const response = await fetch(url, { cache: 'no-store', signal });
    if (!response.ok) throw new SearchError('商品検索を停止しました（HTTP ' + response.status + '）');
    if (new URL(response.url).pathname !== url.pathname) throw new SearchError('公式ストアの商品検索画面を開いてください。');
    const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
    if (!doc.querySelector('form[action="/disp/itemlist/"]')) throw new SearchError('公式ストアの検索結果を確認できません。');
    const matches = new Map();
    const query = clean(task.query);
    const byCode = /^\d+$/.test(query);
    for (const title of doc.querySelectorAll('.item-list-content__item a[href] .item-name')) {
      const item = urlFor(title.closest('a').getAttribute('href'));
      const name = clean(title.textContent);
      if (item && (byCode ? productId(item) === query : name.includes(query))) {
        matches.set(productId(item), { item, exact: byCode || name === query });
      }
    }
    const exact = [...matches.values()].filter(match => match.exact);
    const candidates = exact.length ? exact : [...matches.values()];
    if (candidates.length > 1) throw new SearchError('複数の商品が一致しました。品番か商品URLを指定してください。');
    return candidates[0]?.item ?? null;
  }

  function mount() {
    if (document.getElementById('uzura-and-st')) return;
    const host = document.createElement('div');
    host.id = 'uzura-and-st';
    host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;top:0;left:0;width:0;height:0';
    const shadow = host.attachShadow({ mode: 'open' });
    const panel = document.createElement('div');
    panel.id = 'sxbbox';
    panel.innerHTML = `
      <style>
      ${UZURA_SHOP_PANEL_CSS}
      #sxbbox [hidden]{display:none!important}
      #sxbbox .body{max-height:70vh}
      #sxbbox a{color:#fff;text-decoration:underline}
      #sxbbox .purchase-actions{flex-wrap:wrap}
      #sxbbox .restore{margin-left:auto}
      #sxbbox .qty{flex:none}
      </style>
      <div class="hd"><img src="${UZURA_SHOP_PANEL_ICON}" alt="" width="40" height="40" style="flex:none;mix-blend-mode:screen"><b class="ttl"><span style="font:900 20px/1.3 -apple-system,sans-serif;color:#ffffff">うずら BOT</span><span class="ver">and ST · v${UZURA_AND_ST_VERSION}</span></b><button type="button" data-position>上下</button><button type="button" data-collapse>隠す</button></div>
      <div class="st" data-status role="status">停止中</div>
      <div class="body" data-body>
        <div class="desc">and ST公式。通常販売の商品を1点カートに入れます。先に公式ストアでログインして配送先を準備してください。</div>
        <div class="r"><span class="lb">⏰</span><input data-time type="datetime-local" aria-label="発売日時（日本時間）"><span class="desc">発売日時（日本時間）</span></div>
        <div class="r"><label class="desc" for="and-st-monitor">モニターディレイ（ms）</label><input data-monitor id="and-st-monitor" type="number" min="${every}" max="30000" step="1" inputmode="numeric" placeholder="自動"></div>
        <div class="kw">
          <div class="r"><label class="lb" for="and-st-query">KW1</label><input id="and-st-query" data-query type="text" placeholder="商品名・品番・商品URL"></div>
          <div class="r"><span class="lb"></span><input data-color type="text" aria-label="色" placeholder="色（ショップ表記）"><input data-size class="sz" type="text" aria-label="サイズ" placeholder="サイズ"><select class="qty" aria-label="数量" disabled><option>1</option></select></div>
        </div>
        <div class="desc">商品詳細を開いている場合はKW1を空欄にできます。色・サイズが複数ある場合は公式の表記で指定してください。</div>
        <div class="r"><button type="button" data-purchase aria-expanded="false" aria-controls="and-st-purchase">⚙️ 配送先・支払い</button></div>
        <div class="sec" id="and-st-purchase" data-purchase-panel hidden>
          <b>配送先</b>
          <div class="desc">公式マイページの「会員情報の変更」で氏名・住所を登録してください。注文画面でお届け先を確認できます。</div>
          <div class="r purchase-actions"><a href="/member/login/" target="_blank" rel="noopener">公式ログイン・マイページ</a></div>
          <b style="display:block;margin-top:8px">支払い方法</b>
          <div class="desc">クレジットカードの登録は公式の注文手続きで行います。登録済みのカードも、利用できる場合は公式の支払い画面から選べます。</div>
          <div class="r purchase-actions"><a href="/cart/" target="_blank" rel="noopener">公式カートを開く</a></div>
        </div>
        <div class="r btns"><button type="button" class="main" data-schedule>発売時刻に予約・自動スタート</button><button type="button" data-now>すぐ実行</button><button type="button" data-stop disabled>停止</button><button type="button" data-log-toggle aria-expanded="false" aria-controls="and-st-log">ログを見る</button></div>
        <div id="and-st-log" data-log-panel hidden><div class="r"><button type="button" data-log-clear>ログ消去</button><button type="button" data-log-copy>ログをコピー</button><span class="desc" data-log-note>日本時間</span></div><pre id="sxblog" data-log></pre></div>
        <div class="r"><a data-cart href="/cart/" hidden>公式カートを開く</a></div>
      </div>`;
    shadow.append(panel);
    document.body.append(host);
    const field = name => panel.querySelector('[data-' + name + ']');
    const read = (name, fallback) => {
      try { return JSON.parse(sessionStorage.getItem(name)) ?? fallback; } catch { return fallback; }
    };
    const write = (name, value) => { try { sessionStorage.setItem(name, JSON.stringify(value)); } catch {} };
    const logKey = 'uzura-and-st-log-v1';
    const uiKey = 'uzura-and-st-ui-v1';
    const ui = read(uiKey, { top: true, hidden: false });
    const log = read(logKey, []);
    const clock = new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    });
    const renderLog = () => { field('log').textContent = log.map(entry => entry.line).join('\n') || 'ログはまだありません。'; };
    function status(message) {
      field('status').textContent = message;
      if (log.at(-1)?.message === message) return;
      log.push({ message, line: clock.format(new Date()) + ' ' + message });
      if (log.length > 60) log.shift();
      write(logKey, log);
      if (!field('log-panel').hidden) renderLog();
    }
    function applyUi() {
      panel.className = ui.top ? 'top' : 'bot';
      field('body').hidden = ui.hidden;
      field('collapse').textContent = ui.hidden ? '表示' : '隠す';
      field('collapse').setAttribute('aria-expanded', String(!ui.hidden));
      write(uiKey, ui);
    }
    function toggle(button, target) {
      target.hidden = !target.hidden;
      button.setAttribute('aria-expanded', String(!target.hidden));
    }
    field('position').onclick = () => { ui.top = !ui.top; applyUi(); };
    field('collapse').onclick = () => { ui.hidden = !ui.hidden; applyUi(); };
    field('purchase').onclick = () => toggle(field('purchase'), field('purchase-panel'));
    field('log-toggle').onclick = () => {
      toggle(field('log-toggle'), field('log-panel'));
      field('log-toggle').textContent = field('log-panel').hidden ? 'ログを見る' : 'ログを閉じる';
      if (!field('log-panel').hidden) renderLog();
    };
    field('log-clear').onclick = () => { log.length = 0; write(logKey, log); renderLog(); };
    field('log-copy').onclick = async () => {
      try {
        await navigator.clipboard.writeText(log.map(entry => entry.line).join('\n'));
        field('log-note').textContent = 'コピーしました';
      } catch { field('log-note').textContent = 'コピーできません。ログを選択してコピーしてください。'; }
    };
    applyUi();
    let task = read(key, null);
    const delay = field('monitor');
    const delayKey = 'uzura-and-st-monitor-delay';
    try { delay.value = uzuraMonitorDelay(localStorage.getItem(delayKey), every) || ''; } catch {}
    function saveDelay() {
      const value = uzuraMonitorDelay(delay.value, every);
      delay.value = value || '';
      try { localStorage.setItem(delayKey, String(value)); } catch {}
      return value;
    }
    delay.onchange = saveDelay;
    const mountedAt = Date.now();
    let timer;
    let request;

    const persist = () => task ? sessionStorage.setItem(key, JSON.stringify(task)) : sessionStorage.removeItem(key);
    function controls() {
      field('now').disabled = field('schedule').disabled = delay.disabled = !!task;
      field('stop').disabled = !task || !!task.submittedAt;
    }
    function finish(message, showCart = false) {
      clearTimeout(timer);
      request?.abort();
      task = null;
      persist();
      controls();
      status(message);
      field('cart').hidden = !showCart;
    }
    function again(callback, time) {
      clearTimeout(timer);
      timer = setTimeout(callback, Math.max(0, time));
    }
    function confirmCart() {
      if (visible(document.getElementById('modal-cart-in'))) {
        finish('カートに1点追加されました。', true);
      } else if (visible(document.getElementById('modal-cart-error'))) {
        finish('ショップがカート追加を受け付けませんでした。商品ページをご確認ください。');
      } else if (Date.now() - task.submittedAt >= 15000) {
        finish('追加結果を確認できません。重複を避けるため、公式カートを確認してください。', true);
      } else {
        again(confirmCart, 200);
      }
    }
    function checkProduct() {
      const now = Date.now();
      const deadline = task.start + runLength;
      if (now >= deadline) return finish('2分で終了しました。指定の色・サイズで在庫を確認できませんでした。');
      const modal = document.getElementById('modal-cart-favorite');
      const rows = [...(modal?.querySelectorAll('.modal-cart-favorite__item-list > li') || [])];
      if (!rows.length && now < mountedAt + every) {
        status('商品ページの色・サイズを読み込んでいます。');
        return again(checkProduct, Math.min(250, deadline - now));
      }
      const variants = rows.map(row => ({
        color: clean(row.closest('.modal-cart-favorite__item')?.querySelector('dt')?.textContent),
        size: clean(row.querySelector('.modal-cart-favorite__item-list__l__size')?.textContent).replace(/^サイズ\s*:\s*/, ''),
        button: row.querySelector('button.modal-cart-favorite__cart-btn[data-index]')
      }));
      const matches = variants.filter(variant => (!task.color || task.color === variant.color) && (!task.size || task.size === variant.size));
      if (matches.length > 1) return finish('色・サイズが複数一致しました。公式の商品ページに表示される表記で絞り込んでください。');
      const button = matches[0]?.button;
      if (button && !button.disabled && !visible(document.getElementById('modal-cart-in')) &&
          !visible(document.getElementById('modal-cart-error'))) {
        task.submittedAt = Date.now();
        persist();
        controls();
        status('カート追加の結果を確認しています。');
        button.click();
        confirmCart();
        return;
      }
      status('指定の色・サイズでカートに入れられる在庫を確認しています。');
      const untilEnd = deadline - Date.now();
      const interval = uzuraMonitorDelay(task.monitorDelay, every) || every;
      again(interval < untilEnd ? () => location.reload() : checkProduct, Math.min(interval, untilEnd));
    }
    async function run() {
      const current = task;
      if (current.submittedAt) return confirmCart();
      const now = Date.now();
      if (now < current.start) {
        status('予約済みです。このタブを開いたままにしてください。');
        return again(run, Math.min(current.start - now, 2147483647));
      }
      if (now >= current.start + runLength) return finish('2分で終了しました。対象商品・在庫を確認できませんでした。');
      try {
        if (!current.url) {
          status('公式の商品検索で対象を探しています。');
          request = new AbortController();
          const timeout = setTimeout(() => request.abort(), Math.min(10000, current.start + runLength - now));
          let match;
          try { match = await search(current, request.signal); }
          finally { clearTimeout(timeout); }
          if (task !== current) return;
          if (!match) {
            status('商品検索 · 一致なし。再確認します。');
            const interval = uzuraMonitorDelay(current.monitorDelay, every) || every;
            return again(run, Math.min(interval, current.start + runLength - Date.now()));
          }
          if (Date.now() >= current.start + runLength) return finish('2分で終了しました。');
          current.url = match.href;
          persist();
          status('商品を検出しました。商品詳細を開きます。');
        }
        const here = new URL(location.href);
        if (productId(here) !== productId(new URL(current.url))) {
          location.assign(current.url);
          return;
        }
        checkProduct();
      } catch (error) {
        if (task === current) finish(error.name === 'AbortError' ? '検索がタイムアウトしました。'
          : error instanceof SearchError ? error.message : '商品検索・カート処理でエラーが発生しました。');
      }
    }

    function start(scheduled) {
      const query = field('query').value.trim();
      const item = urlFor(query || location.href);
      if (!item && (/^(?:https?:|\/)/i.test(query) || clean(query).length < 3)) {
        return status('and STの商品名（3文字以上）・品番・商品URLを入力してください。');
      }
      const startAt = scheduled ? Date.parse(field('time').value + ':00+09:00') : Date.now();
      if (scheduled && (!Number.isFinite(startAt) || startAt <= Date.now())) {
        return status('これからの発売日時を日本時間で指定してください。');
      }
      task = { query, url: item?.href, color: clean(field('color').value), size: clean(field('size').value), start: startAt, monitorDelay: saveDelay() };
      persist();
      controls();
      field('cart').hidden = true;
      status(scheduled ? '発売日時の予約を設定しました。' : 'すぐ実行を開始しました。');
      void run();
    }
    field('now').onclick = () => start(false);
    field('schedule').onclick = () => start(true);
    field('stop').onclick = () => finish('停止しました。');
    if (task) {
      field('query').value = task.query;
      field('color').value = task.color;
      field('size').value = task.size;
      delay.value = uzuraMonitorDelay(task.monitorDelay, every) || '';
      controls();
      void run();
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
}());

// Customized for うずら from SYNOVAJOY; original functionality and author attribution retained.
// ===== Ban GOP (thu nghiem): Mellojoy BOT 2.1.43 + SYNOVA Shop BOT 1.9.8 =====
(function () {
  'use strict';
  var H = location.hostname;
  // ---- BOT Mellojoy: cac trang cua ban rieng (@match) ; @noframes -> chi khung chinh ----
  if (window.top === window && /(^|\.)mellojoy(lucky\.cn|japan\.com|us\.com)$|(^|\.)shop\.app$/.test(H)) {
    var MJ_CODE = "\n\n// ===================== Ng\\u00f4n ng\\u1eef (build.py t\\u1ea1o 2 b\\u1ea3n: ja / vi) =====================\nconst SYNOVA_LANG = 'ja';\nconst L = (ja, vi) => (SYNOVA_LANG === 'vi' ? vi : ja);\n// C\\u00e0i c\\u1ea3 b\\u1ea3n Nh\\u1eadt l\\u1eabn b\\u1ea3n Vi\\u1ec7t -> ch\\u1ec9 b\\u1ea3n ch\\u1ea1y tr\\u01b0\\u1edbc ho\\u1ea1t \\u0111\\u1ed9ng (tr\\u00e1nh 2 khung b\\u1ea5m tr\\u00f9ng)\nconst SYNOVA_DUP = !!window.__synovajoy;\nwindow.__synovajoy = true;\n\n// ===================== Discord webhook =====================\n// URL webhook + logo (base64 PNG) \\u0111\\u01b0\\u1ee3c build.py ch\\u00e8n v\\u00e0o t\\u1eeb webhook.txt / logo.png.\nconst SYNOVA_WEBHOOK = ''; // Author's fixed notification destination disabled.\nconst SYNOVA_LOGO_B64 = '';\nconst SYNOVA_NAME = 'うずら BOT';\nconst SYNOVA_VERSION = '2.1.85.11035';   // build.py ch\\u00e8n t\\u1eeb @version\n// logo nh\\u1ecf trong khung bot (build.py ch\\u00e8n t\\u1eeb icon_panel.png)\nconst SYNOVA_ICON = \"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MCIgaGVpZ2h0PSI4MCIgdmlld0JveD0iMCAwIDgwIDgwIj48Y2lyY2xlIGN4PSI0MCIgY3k9IjQwIiByPSIzNiIgZmlsbD0iI2ZmZmZmZiIvPjx0ZXh0IHg9IjQwIiB5PSI1NSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9IkFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iNDYiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSIjMTAyMTNiIj5VPC90ZXh0Pjwvc3ZnPg==\";\n// b\\u1ea3ng b\\u1ecb \\u1ea9n -> ch\\u1ec9 c\\u00f2n n\\u00fat tr\\u00f2n logo \\u1edf m\\u00e9p ph\\u1ea3i, ch\\u1ea1m \\u0111\\u1ec3 hi\\u1ec7n l\\u1ea1i (th\\u00e0nh vi\\u00ean y\\u00eau c\\u1ea7u 28/10 thay cho Thu nh\\u1ecf/M\\u1edf r\\u1ed9ng)\nfunction synovaBubble(id, onShow) {\n  let b = document.getElementById(id);\n  if (!b) {\n    b = document.createElement('div');\n    b.id = id;\n    b.style.cssText = 'position:fixed;right:10px;z-index:2147483647;width:52px;height:52px;border-radius:50%;background:#0d1b32;' +\n      'border:2px solid #ffffff;box-shadow:0 4px 16px #000c;display:none;align-items:center;justify-content:center;cursor:pointer';\n    b.innerHTML = `<img src=\"${SYNOVA_ICON}\" alt=\"\" style=\"width:40px;height:40px;mix-blend-mode:screen;pointer-events:none\">` +\n      '<span style=\"position:absolute;right:1px;top:1px;width:12px;height:12px;border-radius:50%;border:2px solid #0d1b32\"></span>';\n    b.onclick = onShow;\n    document.body.appendChild(b);\n  }\n  return {\n    show(top, active) {                       // ch\\u1ea5m xanh = BOT \\u0111ang ch\\u1ea1y, x\\u00e1m = \\u0111ang t\\u1eaft\n      b.style.top = top ? 'calc(env(safe-area-inset-top) + 60px)' : 'auto';\n      b.style.bottom = top ? 'auto' : 'calc(env(safe-area-inset-bottom) + 90px)';\n      b.lastChild.style.background = active ? '#2ecc71' : '#777';\n      b.style.display = 'flex';\n    },\n    hide() { b.style.display = 'none'; },\n  };\n}\nconst ICON_TAG = `<img src=\"${SYNOVA_ICON}\" alt=\"\" style=\"width:40px;height:40px;flex:none;mix-blend-mode:screen\">`;\n// d\\u00f2ng ch\\u1eef \"SYNOVAJOY BOT\" c\\u1eaft t\\u1eeb logo (c\\u00f3 s\\u1eebng tr\\u00ean ch\\u1eef O) \\u2013 build.py ch\\u00e8n t\\u1eeb title_panel.jpg\nconst SYNOVA_TITLE = '';\nconst TITLE_TAG = `<span style=\"font:900 20px/1.3 -apple-system,sans-serif;color:#ffffff\">うずら BOT</span>`;\n// embed: { author, title, url, thumb, fields:[[name, value, inline]], site, color }\n// Logo g\\u1eedi k\\u00e8m l\\u00e0m t\\u1ec7p logo.png -> d\\u00f9ng 'attachment://logo.png' cho icon tr\\u00ean \\u0111\\u1ea7u v\\u00e0 cu\\u1ed1i embed.\n// multipart + no-cors: kh\\u00f4ng c\\u1ea7n Discord tr\\u1ea3 CORS; keepalive \\u0111\\u1ec3 tin v\\u1eabn \\u0111i khi trang chuy\\u1ec3n trang.\n// \\u1ea2nh trong webhook: ch\\u1ec9 g\\u1eedi URL http(s) \\u0111\\u1ea7y \\u0111\\u1ee7 (URL sai l\\u00e0m Discord t\\u1eeb ch\\u1ed1i c\\u1ea3 tin), kh\\u00f4ng c\\u00f3 \\u1ea3nh th\\u00ec d\\u00f9ng logo\nfunction synovaThumb(u) {\n  try {\n    const s = String(u || '').trim();\n    if (!s || /^(data|blob):/i.test(s)) return '';\n    const x = new URL(s, location.origin);\n    return /^https?:$/.test(x.protocol) ? x.href : '';\n  } catch (e) { return ''; }\n}\n// \\u1ea3nh s\\u1ea3n ph\\u1ea9m tr\\u00ean trang c\\u1ea3m \\u01a1n (khi kh\\u00f4ng bi\\u1ebft m\\u00f3n \\u0111\\u00e3 mua): b\\u1ecf logo v\\u00e0 \\u1ea3nh \\u1edf \\u0111\\u1ea7u trang\nconst SYNOVA_BAD_IMG = /map|staticmap|logo|icon|carrier|shipping|delivery|express|yamato|sagawa|japan ?post|yupack|fedex|dhl|ups\\b|usps|payment|visa|master|jcb|amex|paypay|apple|google|shop ?pay|badge|avatar/i;\nconst SYNOVA_PRICE = /(?:[\\u00a5\\uffe5$\\u20ac\\u00a3]\\s?\\d[\\d,]*(?:\\.\\d{1,2})?|\\d[\\d,]*\\s?\\u5186)/g;\nfunction synovaPageItems() {\n  try {\n    const out = [];\n    const imgs = [...document.querySelectorAll('img')].filter((e) => {\n      const src = e.currentSrc || e.src || '';\n      if (e.closest('header,footer,nav,[role=banner],#pjbox,#pjcbox,[id^=sxb]')) return false;\n      if (!/^https:\\/\\/cdn\\.shopify\\.com\\/s\\/files\\/|\\/cdn\\/shop\\/(files|products)\\//i.test(src)) return false;\n      if (SYNOVA_BAD_IMG.test(src + ' ' + (e.alt || '') + ' ' + (e.className || '') + ' ' + (e.title || ''))) return false;\n      if (e.naturalWidth && e.naturalWidth < 24) return false;\n      return true;\n    });\n    for (const img of imgs) {\n      // leo l\\u00ean t\\u00ecm khung c\\u1ee7a D\\u00d2NG m\\u00f3n: c\\u00f3 gi\\u00e1, v\\u00e0 ch\\u1ec9 ch\\u1ee9a 1 \\u1ea3nh\n      let row = img.parentElement, txt = '';\n      for (let k = 0; row && k < 7; k++, row = row.parentElement) {\n        if (row.querySelectorAll('img').length > 1) { row = null; break; }\n        txt = (row.innerText || '').trim();\n        if (txt.match(SYNOVA_PRICE)) break;\n      }\n      if (!row || !txt) continue;\n      // s\\u1ed1 l\\u01b0\\u1ee3ng: ch\\u1eef \"\\u6570\\u91cf 2\" / \"Quantity 2\", ho\\u1eb7c \\u00f4 s\\u1ed1 nh\\u1ecf \\u0111\\u00e8 l\\u00ean \\u1ea3nh (badge)\n      let qty = 0;\n      const mq = txt.match(/(?:\\u6570\\u91cf|quantity|qty)\\s*[:\\uff1a\\u00d7x]?\\s*(\\d{1,3})/i);\n      if (mq) qty = +mq[1];\n      else {\n        const b = [...row.querySelectorAll('span,div,p')].find((x) => !x.children.length && /^\\d{1,3}$/.test((x.textContent || '').trim()));\n        if (b) qty = +b.textContent.trim();\n      }\n      if (!qty) continue;                       // kh\\u00f4ng c\\u00f3 s\\u1ed1 l\\u01b0\\u1ee3ng = kh\\u00f4ng ph\\u1ea3i d\\u00f2ng m\\u00f3n (logo giao h\\u00e0ng, qu\\u1ea3ng c\\u00e1o\\u2026)\n      const lines = txt.split(/\\n+/).map((x) => x.trim()).filter((x) => x && !/^\\d{1,3}$/.test(x) && !/^(\\u6570\\u91cf|quantity|qty)\\b/i.test(x));\n      const prices = txt.match(SYNOVA_PRICE) || [];\n      const alt = (img.alt || '').trim();\n      const title = alt.length > 1 ? alt : (lines.find((x) => !x.match(SYNOVA_PRICE)) || '');\n      if (!title || out.some((o) => o.title === title)) continue;\n      const size = lines.find((x) => x !== title && !x.match(SYNOVA_PRICE) && x.length < 40) || '-';\n      out.push({ title, image: synovaThumb(img.currentSrc || img.src), qty, price: prices[prices.length - 1] || '', size });\n    }\n    return out.slice(0, 10);\n  } catch (e) { return []; }\n}\n// \\u1ea3nh s\\u1ea3n ph\\u1ea9m tr\\u00ean trang c\\u1ea3m \\u01a1n (khi m\\u00f3n \\u0111\\u00e3 bi\\u1ebft m\\u00e0 thi\\u1ebfu \\u1ea3nh): \\u0111\\u00fang t\\u00ean m\\u00f3n th\\u00ec l\\u1ea5y \\u1ea3nh m\\u00f3n \\u0111\\u00f3; kh\\u00f4ng ch\\u1eafc th\\u00ec ''\nfunction synovaPageImg(title) {\n  const items = synovaPageItems();\n  const m = title && items.find((x) => x.title === title || x.title.includes(title) || title.includes(x.title));\n  return (m || (items.length === 1 ? items[0] : null) || {}).image || '';\n}\nfunction synovaOrderNo(text) {\n  const m = (text || '').match(/(?:\\u3054\\u6ce8\\u6587\\u756a\\u53f7|\\u6ce8\\u6587\\u756a\\u53f7|\\u78ba\\u8a8d\\u756a\\u53f7|\\u6ce8\\u6587\\s*[#\\uff03]|Order\\s*(?:number|No\\.?)?\\s*[#\\uff03]?|Confirmation\\s*(?:number)?\\s*[#\\uff03]?)\\s*[:\\uff1a#\\uff03]?\\s*([A-Z0-9][A-Z0-9-]{3,})/i);\n  return m ? m[1].toUpperCase() : '';\n}\n// th\\u1eddi gian t\\u1eeb l\\u00fac m\\u00f3n V\\u00c0O GI\\u1ece t\\u1edbi l\\u00fac HO\\u00c0N T\\u1ea4T \\u0110\\u01a0N (14/11 user): m\\u1ed1c cu\\u1ed1i = l\\u00fac trang c\\u1ea3m \\u01a1n hi\\u1ec7n (t\\u1ea3i th\\u1eb3ng -> gi\\u1edd b\\u1eaft \\u0111\\u1ea7u t\\u1ea3i trang;\n// checkout \\u0111\\u1ed5i trang kh\\u00f4ng t\\u1ea3i l\\u1ea1i -> l\\u1ea7n \\u0111\\u1ea7u th\\u1ea5y \\u0111\\u1ecba ch\\u1ec9 trang c\\u1ea3m \\u01a1n, d\\u00f2 0,2s/l\\u1ea7n), kh\\u00f4ng ph\\u1ea3i l\\u00fac g\\u1eedi tin (ch\\u1edd m\\u00e3 \\u0111\\u01a1n v\\u00e0i gi\\u00e2y)\nconst SYNOVA_THANKS_RE = /thank[-_]you|\\/orders\\/[0-9a-z]{16,}|order[-/]?confirm|\\/confirmation/i;\nlet synovaThanksAt = SYNOVA_THANKS_RE.test(location.pathname + location.search) ? Math.round(performance.timeOrigin) : 0;\nif (!synovaThanksAt && /checkout/i.test(location.href)) {\n  const w = setInterval(() => { if (SYNOVA_THANKS_RE.test(location.pathname + location.search)) { synovaThanksAt = Date.now(); clearInterval(w); } }, 200);\n  setTimeout(() => clearInterval(w), 3600e3);\n}\nfunction synovaSpeed(at) {\n  const d = (synovaThanksAt || Date.now()) - Number(at || 0);\n  return at && d > 0 && d < 3600e3 ? (d / 1000).toFixed(2) + 's' : '';\n}\nfunction synovaNotify(embeds) {\n  window.dispatchEvent(new CustomEvent('uzura-purchase-success', {detail:JSON.stringify({embeds})}));\n  return; // Purchase-success only; old notification destinations are disabled.\n  if (!/^https:\\/\\/(discord|discordapp)\\.com\\/api\\/webhooks\\//.test(SYNOVA_WEBHOOK)) return;\n  try {\n    const hasLogo = SYNOVA_LOGO_B64.length > 100;\n    const icon = hasLogo ? 'attachment://logo.png' : undefined;\n    const payload = {\n      username: SYNOVA_NAME,\n      embeds: embeds.slice(0, 10).map((e) => ({\n        author: { name: e.author, icon_url: icon },\n        title: (e.title || '').slice(0, 250),\n        url: e.url || undefined,\n        color: e.color || 0x2ecc71,\n        thumbnail: synovaThumb(e.thumb) ? { url: synovaThumb(e.thumb) } : (icon ? { url: icon } : undefined),\n        fields: (e.fields || []).filter((f) => f[1] != null && f[1] !== '').map(([name, value, inline]) => ({ name, value: String(value).slice(0, 1000), inline: inline !== false })),\n        footer: { text: `${SYNOVA_NAME} \\u00b7 ${e.site || location.hostname}`, icon_url: icon },\n        timestamp: new Date().toISOString(),\n      })),\n    };\n    const fd = new FormData();\n    if (hasLogo) {\n      const bin = atob(SYNOVA_LOGO_B64), u8 = new Uint8Array(bin.length);\n      for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);\n      fd.append('files[0]', new Blob([u8], { type: 'image/png' }), 'logo.png');\n      payload.attachments = [{ id: 0, filename: 'logo.png' }];\n    }\n    fd.append('payload_json', JSON.stringify(payload));\n    fetch(SYNOVA_WEBHOOK, { method: 'POST', mode: 'no-cors', body: fd, keepalive: true }).catch(() => {});\n  } catch (e) {}\n}\n\n// ===================== 13\\u6642 \\u62bd\\u9078 (mellojoylucky.cn) =====================\nif (!SYNOVA_DUP && /mellojoylucky\\.cn$/.test(location.hostname)) (function () {\n  'use strict';\n\n  let popupSession = 0;\n  const popupControllers = new Set();\n  class PopupCancelled extends Error { constructor() { super('停止しました'); this.cancelled = true; } }\n  const popupCheck = epoch => { if (epoch !== popupSession) throw new PopupCancelled(); };\n  async function popupAwait(promise, epoch) {\n    try { const result = await promise; popupCheck(epoch); return result; }\n    catch (error) { popupCheck(epoch); throw error; }\n  }\n  function cancelPopupTasks() {\n    popupSession++;\n    for (const controller of popupControllers) controller.abort();\n    popupControllers.clear();\n    pollFound = null;\n    if (pollWake) { const wake = pollWake; pollWake = null; wake(); }\n  }\n  function popupContinue(promise) {\n    return Promise.resolve(promise).catch(error => { if (!error.cancelled && st.active) { soft = null; finish('エラーで停止: ' + error.message); } });\n  }\n  function beginPopupStart(fn) {\n    if (st.active) return;\n    const epoch = ++popupSession;\n    st.active = true; st.mode = 'init'; save(K_STATE, st);\n    setStatus('日付を読み込み中…（停止できます）');\n    return popupContinue(fn()).finally(() => {\n      if (epoch === popupSession && st.active && st.mode === 'init') { st.active = false; st.mode = null; save(K_STATE, st); }\n    });\n  }\n  function startWait() { return beginPopupStart(startWaitImpl); }\n  function startNow() { return beginPopupStart(startNowImpl); }\n\n\n  // ================= C\\u1ea5u h\\u00ecnh =================\n  // khung gi\\u1edd m\\u1eb7c \\u0111\\u1ecbnh (\\u539f\\u5bbf, 1 ti\\u1ebfng/khung). 18/11: m\\u1ed7i c\\u1eeda h\\u00e0ng c\\u00f3 khung ri\\u00eang (\\u6e0b\\u8c37PARCO: 30 ph\\u00fat/khung, 20 khung) -> slotTimes()\n  const SLOTS_DEF = ['10:30', '11:30', '12:30', '13:30', '14:30', '15:30', '16:30', '17:30', '18:30', '19:30'];\n  const OPEN_H = 13, OPEN_M = 0;          // gi\\u1edd m\\u1edf ng\\u00e0y m\\u1edbi (JST)\n  const WATCH_FROM_SEC = 10;              // b\\u1eaft \\u0111\\u1ea7u d\\u00f2 tr\\u01b0\\u1edbc gi\\u1edd m\\u1edf bao nhi\\u00eau gi\\u00e2y (12:59:50)\n  const POLL_MS = 300;                    // nh\\u1ecbp d\\u00f2 bookable-dates quanh gi\\u1edd m\\u1edf\n  const MAX_LOSE = 3;                     // tr\\u01b0\\u1ee3t li\\u00ean ti\\u1ebfp bao nhi\\u00eau l\\u1ea7n th\\u00ec d\\u1eebng\n  const WAIT_AGREE_MS = 6000;             // ch\\u1edd h\\u1ed9p \\u540c\\u610f\\u3057\\u3066\\u53c2\\u52a0\\u3059\\u308b\n  const WAIT_RESULT_MS = 25000;           // m\\u00e1y ch\\u1ee7 hay tr\\u1ea3 l\\u1eddi \\u1edf gi\\u00e2y 16-19\n  // 13:00 m\\u00e1y ch\\u1ee7 qu\\u00e1 t\\u1ea3i tr\\u1ea3 409 SYSTEM_BUSY / HTTP 500 = CH\\u01afA x\\u00e9t \\u0111\\u01a1n -> g\\u1eedi l\\u1ea1i \\u0111\\u00fang khung \\u0111\\u00f3 thay v\\u00ec b\\u1ecf sang khung k\\u1ebf (log user 2/11)\n  // 3/11 (h\\u1ecdc BOT \\u0111\\u1ed1i th\\u1ee7): g\\u1eedi d\\u1ed3n d\\u1ec5 d\\u00ednh RATE_LIMIT / COOLDOWN = h\\u1ebft l\\u01b0\\u1ee3t c\\u1ea3 ng\\u00e0y -> ngh\\u1ec9 T\\u0102NG D\\u1ea6N, m\\u1ed7i khung t\\u1ed1i \\u0111a 2 l\\u1ea7n,\n  // c\\u1ea3 l\\u01b0\\u1ee3t t\\u1ed1i \\u0111a 8 l\\u1ea7n qu\\u00e1 t\\u1ea3i, v\\u00e0 c\\u1ea3 ng\\u00e0y t\\u1ed1i \\u0111a MAX_POSTS l\\u1ea7n g\\u1eedi (m\\u1ecdi l\\u1ea7n g\\u1eedi t\\u1edbi m\\u00e1y ch\\u1ee7 \\u0111\\u1ec1u t\\u00ednh)\n  const BUSY_PER_SLOT = 2;                // qu\\u00e1 t\\u1ea3i \\u1edf 1 khung bao nhi\\u00eau l\\u1ea7n th\\u00ec sang khung k\\u1ebf (v\\u00f2ng sau quay l\\u1ea1i)\n  const BUSY_WAITS = [600, 600, 900, 1200, 2000, 3000, 4000, 5000];   // ngh\\u1ec9 tr\\u01b0\\u1edbc l\\u1ea7n g\\u1eedi l\\u1ea1i th\\u1ee9 1, 2, 3\\u2026\n  const BUSY_MAX = 8;                     // qu\\u00e1 t\\u1ea3i qu\\u00e1 8 l\\u1ea7n trong 1 l\\u01b0\\u1ee3t -> d\\u1eebng\n  const BUSY_UNTIL_MS = 180e3;            // ch\\u1ebf \\u0111\\u1ed9 request: c\\u00f2n khung ch\\u1ec9 b\\u1ecb qu\\u00e1 t\\u1ea3i / ch\\u01b0a m\\u1edf th\\u00ec quay v\\u00f2ng th\\u1eed ti\\u1ebfp t\\u1edbi 3 ph\\u00fat\n  // \"ch\\u01b0a m\\u1edf\" (g\\u1eedi s\\u1edbm v\\u00e0i ms tr\\u01b0\\u1edbc 13:00 / m\\u00e1y ch\\u1ee7 ch\\u01b0a k\\u1ecbp m\\u1edf ng\\u00e0y) -> g\\u1eedi l\\u1ea1i \\u0110\\u00daNG khung \\u0111\\u00f3 sau 1,2 gi\\u00e2y, kh\\u00f4ng b\\u1ecf khung\n  const EARLY_CODES = new Set(['SLOT_NOT_STARTED', 'SLOT_CLOSED', 'SLOT_DATE_NOT_BOOKABLE', 'ACTIVITY_NOT_STARTED']);\n  const EARLY_SLOT = new Set(['SLOT_NOT_STARTED', 'SLOT_CLOSED']);   // ch\\u1ec9 khung \\u0111\\u00f3 ch\\u01b0a m\\u1edf -> 2 l\\u1ea7n th\\u00ec sang khung k\\u1ebf\n  const EARLY_GAP_MS = 1200, EARLY_PER_SLOT = 2, EARLY_MAX = 6;\n  // 11/11 log kh\\u00e1ch: 13:00 g\\u1eedi \\u0111\\u1ee7 5 l\\u1ea7n -> BOT t\\u1ef1 kh\\u00f3a C\\u1ea2 NG\\u00c0Y, 13:01 ng\\u00e0y 11-17 v\\u1eabn c\\u00f2n ch\\u1ed7 m\\u00e0 kh\\u00f4ng g\\u1eedi.\n  // M\\u00e1y ch\\u1ee7 \\u0111o \\u0111\\u01b0\\u1ee3c (30/9): 5 l\\u01b0\\u1ee3t / 60 gi\\u00e2y \\u0111\\u01b0\\u1ee3c nh\\u1eadn, l\\u01b0\\u1ee3t 6 -> RATE_LIMIT. N\\u00ean gi\\u1edbi h\\u1ea1n THEO PH\\u00daT, \\u0111\\u1ee7 5 th\\u00ec ch\\u1edd r\\u1ed3i g\\u1eedi ti\\u1ebfp.\n  // C\\u1ea3 ng\\u00e0y v\\u1eabn ch\\u1eb7n tr\\u1ea7n MAX_POSTS (28/9: 35\\u201371 l\\u01b0\\u1ee3t/ng\\u00e0y b\\u1ecb BLACKLISTED).\n  // 17/11 trang m\\u1edbi: b\\u1ea3n PC g\\u1eedi 3 l\\u01b0\\u1ee3t/ph\\u00fat v\\u1eabn c\\u00f3 l\\u01b0\\u1ee3t d\\u00ednh RATE_LIMITED -> gi\\u1ed1ng PC, 3 l\\u01b0\\u1ee3t / 62 gi\\u00e2y\n  const WIN_POSTS = 3, WIN_MS = 62e3;     // t\\u1ed1i \\u0111a 3 l\\u1ea7n g\\u1eedi trong 62 gi\\u00e2y (d\\u01b0 2 gi\\u00e2y cho l\\u1ec7ch gi\\u1edd m\\u00e1y ch\\u1ee7)\n  const MAX_POSTS = 20;                   // c\\u1ea3 ng\\u00e0y (gi\\u1edd Nh\\u1eadt)\n  // 8/11 user b\\u00e1o: c\\u00f3 v\\u00e9 h\\u1ee7y \\u0111\\u01b0\\u1ee3c nh\\u1ea3 ra (restock) m\\u00e0 b\\u1eadt BOT kh\\u00f4ng ph\\u1ea3n h\\u1ed3i -> BOT ch\\u01b0a c\\u00f3 ch\\u1ebf \\u0111\\u1ed9 canh v\\u00e9 h\\u1ee7y.\n  // Gi\\u1edd \"Ch\\u1ea1y Ngay\" h\\u1ebft ch\\u1ed7 th\\u00ec kh\\u00f4ng d\\u1eebng m\\u00e0 chuy\\u1ec3n sang canh: c\\u1ee9 WATCH_MS h\\u1ecfi khung c\\u1ee7a c\\u00e1c ng\\u00e0y, c\\u00f3 ch\\u1ed7 l\\u00e0 \\u0111\\u0103ng k\\u00fd ngay\n  const WATCH_MS = 3000;                  // 7 ng\\u00e0y x 1 l\\u1ea7n / 3 gi\\u00e2y \\u2248 140 l\\u1ea7n/ph\\u00fat (m\\u00e1y ch\\u1ee7 gi\\u1edbi h\\u1ea1n 300/ph\\u00fat)\n  const GAP_MS = 800;\n  const MULTI_PEEK_MS = 1200, MULTI_FIRST_POSTS = 2;\n\n  const K_PRIO = 'pj_prio_v1';            // { \"10:30\": 1, \"11:30\": \"x\", ... }\n  const K_STATE = 'pj_state_v1';\n  const K_UI = 'pj_ui_v1';\n  const K_LOG = 'pj_log_v2';\n\n  const STOP_CODES = new Set(['EMAIL_DUPLICATE_1D', 'EMAIL_DUPLICATE_TODAY', 'PHONE_DUPLICATE_1D',\n    'BLACKLISTED', 'DESKTOP_DEVICE_BLOCKED', 'GPS_REJECTED', 'GPS_OUT_OF_FENCE',\n    'IP_OUT_OF_FENCE', 'TURNSTILE_INVALID']);\n  // 17/11 gi\\u1ed1ng b\\u1ea3n PC: m\\u00e1y ch\\u1ee7 b\\u1ea3o g\\u1eedi ch\\u1eadm l\\u1ea1i th\\u00ec NGH\\u1ec8 r\\u1ed3i g\\u1eedi ti\\u1ebfp, kh\\u00f4ng d\\u1eebng h\\u1eb3n\n  //   RATE_LIMIT / RATE_LIMITED (HTTP 429) / TOO_FREQUENT -> ngh\\u1ec9 60s ; COOLDOWN (kh\\u00f3a 10 ph\\u00fat) -> \\u0111\\u1ee9ng y\\u00ean 10 ph\\u00fat 3 gi\\u00e2y\n  const WAIT_CODES = { RATE_LIMIT: 60e3, RATE_LIMITED: 60e3, TOO_FREQUENT: 60e3, COOLDOWN: 603e3 };\n  const WAIT_MAX = 4;                     // ngh\\u1ec9 ki\\u1ec3u n\\u00e0y qu\\u00e1 4 l\\u1ea7n trong 1 l\\u01b0\\u1ee3t -> d\\u1eebng (tr\\u00e1nh BLACKLISTED)\n  // DEVICE_DUPLICATE_1D = m\\u00e1y n\\u00e0y \\u0111\\u00e3 \\u0111\\u0103ng k\\u00fd KHUNG N\\u00c0Y r\\u1ed3i -> sang khung k\\u1ebf (tr\\u01b0\\u1edbc 3/11 l\\u00e0 d\\u1eebng h\\u1eb3n)\n  const SKIP_CODES = new Set(['SLOT_FULL', 'QUOTA_FULL', 'SLOT_NOT_FOUND', 'SLOT_ENDED', 'TIME_SLOT_NOT_FOUND', 'DEVICE_DUPLICATE_1D']);   // 18/11: QUOTA_FULL = khung h\\u1ebft su\\u1ea5t (m\\u00e3 m\\u1edbi c\\u1ee7a trang)\n\n  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };\n  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };\n  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));\n\n  // ================= B\\u1eaft ph\\u1ea3n h\\u1ed3i POST /api/registrations =================\n  // Ch\\u1ea1y \\u1edf document-start + inject-into page -> b\\u1ecdc fetch/XHR tr\\u01b0\\u1edbc khi trang t\\u1ea3i xong.\n  let resultWaiter = null;\n  let regPosted = false;                  // l\\u01b0\\u1ee3t b\\u1ea5m giao di\\u1ec7n: trang \\u0111\\u00e3 th\\u1eadt s\\u1ef1 g\\u1eedi POST \\u0111\\u0103ng k\\u00fd ch\\u01b0a\n  function onRegResponse(status, body) {\n    let j = {};\n    try { j = JSON.parse(body); } catch (e) {}\n    if (resultWaiter) { const w = resultWaiter; resultWaiter = null; w({ status, data: j || {} }); }\n  }\n  const isRegPost = (url, method) => /\\/api\\/registrations(\\?|$)/.test(url || '') && String(method || 'GET').toUpperCase() === 'POST';\n  const nativePopupFetch = window.fetch;\n  async function _fetch(input, init = {}) { const __session = popupSession; \n    const epoch = popupSession, controller = new AbortController();\n    const parent = init.signal;\n    const abort = () => controller.abort();\n    if (parent) { if (parent.aborted) abort(); else parent.addEventListener('abort', abort, { once: true }); }\n    popupControllers.add(controller);\n    try {\n      const response = await popupAwait(nativePopupFetch.call(window, input, { ...init, signal: controller.signal }), __session);\n      popupCheck(epoch);\n      return response;\n    } finally { popupControllers.delete(controller); if (parent) parent.removeEventListener('abort', abort); }\n  }\n  window.fetch = async function (input, init) { const __session = popupSession; \n    const url = typeof input === 'string' ? input : (input && input.url) || '';\n    const method = (init && init.method) || (input && input.method) || 'GET';\n    if (isRegPost(url, method)) regSent();\n    if (isRegPost(url, method) && init && typeof init.body === 'string') init = { ...init, body: tsPatchBody(init.body) };\n    const res = await popupAwait(_fetch.call(this, input, init), __session);\n    if (isRegPost(url, method)) res.clone().text().then((t) => onRegResponse(res.status, t)).catch(() => { if (__session !== popupSession) return; });\n    return res;\n  };\n  const _open = XMLHttpRequest.prototype.open;\n  const _send = XMLHttpRequest.prototype.send;\n  XMLHttpRequest.prototype.open = function (m, u) { this.__pj = { m, u }; return _open.apply(this, arguments); };\n  XMLHttpRequest.prototype.send = function (body) {\n    if (this.__pj && isRegPost(this.__pj.u, this.__pj.m)) {\n      this.addEventListener('loadend', () => onRegResponse(this.status, this.responseText));\n      regSent();\n      if (typeof body === 'string') return _send.call(this, tsPatchBody(body));\n    }\n    return _send.apply(this, arguments);\n  };\n\n  // Log t\\u1ed1c \\u0111\\u1ed9: t\\u1eeb l\\u00fac th\\u1ea5y ng\\u00e0y m\\u1edbi t\\u1edbi l\\u00fac g\\u1eedi \\u0111\\u0103ng k\\u00fd \\u0111\\u1ea7u ti\\u00ean\n  function regSent() {\n    regPosted = true;\n    try {\n      if (!st.tDetect) return;\n      log(L(`\\u23f1 \\u65b0\\u3057\\u3044\\u65e5\\u4ed8\\u3092\\u691c\\u51fa\\u3057\\u3066\\u304b\\u3089 ${Date.now() - st.tDetect}ms \\u3067\\u7533\\u8fbc\\u9001\\u4fe1`, `\\u23f1 G\\u1eedi \\u0111\\u0103ng k\\u00fd sau ${Date.now() - st.tDetect}ms t\\u1eeb l\\u00fac th\\u1ea5y ng\\u00e0y m\\u1edbi`));\n      st.tDetect = 0; save(K_STATE, st);\n    } catch (e) {}\n  }\n\n  // ================= GPS: d\\u00f9ng v\\u1ecb tr\\u00ed th\\u1eadt \\u0111o s\\u1eb5n =================\n  // Trang \\u0111o GPS M\\u1edaI m\\u1ed7i l\\u1ea7n b\\u1ea5m (maximumAge:0) -> iPhone m\\u1ea5t 1\\u20135 gi\\u00e2y m\\u1ed7i l\\u01b0\\u1ee3t. Khi bot \\u0111ang ch\\u1ea1y, bot theo d\\u00f5i\n  // v\\u1ecb tr\\u00ed th\\u1eadt c\\u1ee7a m\\u00e1y (watchPosition) t\\u1eeb tr\\u01b0\\u1edbc gi\\u1edd m\\u1edf; trang h\\u1ecfi th\\u00ec tr\\u1ea3 ngay v\\u1ecb tr\\u00ed th\\u1eadt m\\u1edbi nh\\u1ea5t (\\u2264 30 gi\\u00e2y).\n  // Kh\\u00f4ng gi\\u1ea3 GPS: ch\\u01b0a c\\u00f3 v\\u1ecb tr\\u00ed th\\u1eadt th\\u00ec trang t\\u1ef1 \\u0111o nh\\u01b0 b\\u00ecnh th\\u01b0\\u1eddng.\n  const geo = navigator.geolocation;\n  let geoLast = null, geoWatch = null, geoOrig = null;\n  try {\n    const _gcp = geo.getCurrentPosition.bind(geo);\n    geoOrig = _gcp;\n    geo.getCurrentPosition = function (ok, err, opt) {\n      if (st.active && geoLast && Date.now() - geoLast.at < 30e3) { const p = geoLast.p; setTimeout(() => ok(p), 0); return; }\n      return _gcp((p) => { geoLast = { p, at: Date.now() }; if (ok) ok(p); }, err, opt);\n    };\n  } catch (e) {}\n  function geoWarm() {\n    if (!geo || geoWatch != null) return;\n    try { geoWatch = geo.watchPosition((p) => { geoLast = { p, at: Date.now() }; }, () => {}, { enableHighAccuracy: true, maximumAge: 0, timeout: 15e3 }); } catch (e) {}\n  }\n  function geoStop() { if (geoWatch != null) { try { geo.clearWatch(geoWatch); } catch (e) {} geoWatch = null; } }\n\n  // ================= T\\u1ea3i l\\u1ea1i khung \\u0111\\u1eb7t v\\u00e9 KH\\u00d4NG t\\u1ea3i l\\u1ea1i c\\u1ea3 trang =================\n  // Danh s\\u00e1ch ng\\u00e0y ch\\u1ec9 \\u0111\\u01b0\\u1ee3c trang t\\u1ea3i 1 l\\u1ea7n l\\u00fac khung \\u0111\\u1eb7t v\\u00e9 (route \"/\") hi\\u1ec7n ra. Thay v\\u00ec location.reload (2\\u20135 gi\\u00e2y),\n  // chuy\\u1ec3n SPA sang /my-tickets r\\u1ed3i quay v\\u1ec1 -> React g\\u1eafn l\\u1ea1i khung, ch\\u1ec9 g\\u1ecdi l\\u1ea1i bookable-dates (~0,3 gi\\u00e2y).\n  async function spaRemount() { const __session = popupSession; \n    const back = location.pathname + location.search;\n    if (back.startsWith('/my-tickets')) return false;\n    try {\n      history.replaceState(history.state, '', '/my-tickets'); dispatchEvent(new PopStateEvent('popstate', { state: history.state }));\n      await popupAwait(sleep(40), __session);\n      history.replaceState(history.state, '', back); dispatchEvent(new PopStateEvent('popstate', { state: history.state }));\n      return true;\n    } catch (e) { if (e && e.cancelled) throw e;  return false; }\n  }\n  // c\\u00f3 ng\\u00e0y m\\u1edbi m\\u00e0 ch\\u01b0a c\\u00f3 n\\u00fat ng\\u00e0y \\u0111\\u00f3 -> g\\u1eafn l\\u1ea1i khung, qu\\u00e1 2,5 gi\\u00e2y v\\u1eabn ch\\u01b0a th\\u1ea5y th\\u00ec m\\u1edbi t\\u1ea3i l\\u1ea1i c\\u1ea3 trang\n  async function refreshDates(date) { const __session = popupSession; \n    if (await popupAwait(spaRemount(), __session) && await popupAwait(waitFor(() => findDateTab(date), 2500, 25), __session)) return true;\n    st.reloads = (st.reloads || 0) + 1; save(K_STATE, st);\n    location.reload();\n    return false;\n  }\n\n  // ================= CapSolver: gi\\u1ea3i Cloudflare Turnstile =================\n  // Trang ch\\u1ec9 g\\u1eedi POST /api/registrations khi \\u00f4 Turnstile (interaction-only) \\u0111\\u00e3 tr\\u1ea3 token cho React.\n  // B\\u1ecdc window.turnstile.render \\u0111\\u1ec3 gi\\u1eef callback c\\u1ee7a trang -> \\u0111\\u01b0a token CapSolver v\\u00e0o khi Safari ch\\u01b0a c\\u00f3 token\n  // (th\\u1ef1c t\\u1ebf tr\\u00ean iPhone Turnstile hay \\u0111\\u00f2i b\\u1ea5m tay; ai \\u0111\\u00e3 b\\u1ea5m tay c\\u00f3 token th\\u00ec d\\u00f9ng token \\u0111\\u00f3, kh\\u00f4ng t\\u1ed1n ti\\u1ec1n). Gi\\u00e1 CapSolver: $1.2 / 1000 l\\u01b0\\u1ee3t gi\\u1ea3i th\\u00e0nh c\\u00f4ng.\n  const K_CAP = 'pj_capsolver_v1';        // key nh\\u1eadp trong khung (ghi \\u0111\\u00e8 key build s\\u1eb5n)\n  const K_CAPN = 'pj_capsolver_n_v1';     // \\u0111\\u1ebfm l\\u01b0\\u1ee3t gi\\u1ea3i theo ng\\u00e0y JST: { d, n }\n  const CAP_PRICE = 1.2 / 1000;           // USD / l\\u01b0\\u1ee3t\n  const TS_LIFE_MS = 250e3;               // token Turnstile s\\u1ed1ng 300s, ch\\u1eeba 50s\n  const TS_POOL = 3;                      // s\\u1ed1 token gi\\u1ea3i s\\u1eb5n tr\\u01b0\\u1edbc 13:00 / khi \\u0111ang \\u0111\\u1eb7t\n  // 16/11: c\\u00f3 key chung (Worker) -> B\\u1ece key ri\\u00eang (\\u1ea9n khung nh\\u1eadp, key c\\u0169 \\u0111\\u00e3 l\\u01b0u c\\u0169ng kh\\u00f4ng d\\u00f9ng) \\u0111\\u1ec3 m\\u1ecdi ng\\u01b0\\u1eddi ch\\u1ea1y gi\\u1ed1ng nhau\n  const capKey = () => { if (CAP_RELAY) return ''; const k = String(load(K_CAP, '') || '').trim() || ''; return /^CAP-[0-9A-F]{20,}$/i.test(k) ? k : ''; };\n  // 16/11: kh\\u00f4ng nh\\u1eadp key ri\\u00eang -> d\\u00f9ng key CHUNG c\\u1ee7a SYNOVA qua Worker (.../cap). Key n\\u1eb1m tr\\u00ean Cloudflare, kh\\u00f4ng n\\u1eb1m trong file BOT.\n  // Worker gi\\u1edbi h\\u1ea1n m\\u1ed7i IP + tr\\u1ea7n c\\u1ea3 ng\\u00e0y; h\\u1ebft tr\\u1ea7n / h\\u1ebft ti\\u1ec1n -> t\\u1eaft key chung 30 ph\\u00fat, BOT quay v\\u1ec1 b\\u1ea5m \\u00f4 x\\u00e1c nh\\u1eadn nh\\u01b0 c\\u0169.\n  const CAP_RELAY = \"https://synova-relay.synova-relay.workers.dev/cap\";\n  const K_CAPOFF = 'pj_capoff_v1';         // key chung h\\u1ebft l\\u01b0\\u1ee3t: nh\\u1edb qua l\\u1ea7n t\\u1ea3i l\\u1ea1i trang\n  let { u: relayOffUntil = 0, m: relayOffMsg = '' } = load(K_CAPOFF, {}) || {};\n  const capShared = () => !capKey() && !!CAP_RELAY && Date.now() >= relayOffUntil;\n  const capOn = () => !!capKey() || capShared();\n  let capLastErr = '';\n  const TS_SITEKEY_PIN = '0x4AAAAAAFF0MPh5SYT7ywAo';   // sitekey trong JS c\\u1ee7a trang (16/11 + 17/11)\n  let tsSiteKey = '', tsPool = [], tsSolving = 0, capErrUntil = 0, pageTok = null, forceCap = false;\n  const tsUsed = new Set(), tsOurs = new Set(), tsCbs = new Map();   // id \\u00f4 Turnstile -> callback c\\u1ee7a trang\n\n  function hookTurnstile(ts) {\n    if (!ts || ts.__pj || typeof ts.render !== 'function') return ts;\n    const _render = ts.render.bind(ts), _reset = ts.reset && ts.reset.bind(ts), _remove = ts.remove && ts.remove.bind(ts);\n    ts.render = function (el, opts) {\n      let cb = null;\n      if (opts && typeof opts === 'object') {\n        if (opts.sitekey) tsSiteKey = opts.sitekey;\n        const ex = opts['expired-callback'];\n        if (typeof opts.callback === 'function') { cb = opts.callback; opts.callback = (t) => { pageTok = t; return cb(t); }; }\n        if (typeof ex === 'function') opts['expired-callback'] = () => { pageTok = null; return ex(); };\n      }\n      const id = _render(el, opts);\n      if (cb) tsCbs.set(id, cb);\n      return id;\n    };\n    if (_reset) ts.reset = function (id) { pageTok = null; return _reset(id); };\n    if (_remove) ts.remove = function (id) { tsCbs.delete(id); return _remove(id); };\n    ts.__pj = true;\n    return ts;\n  }\n  // ch\\u1ea1y \\u1edf document-start: b\\u1eaft l\\u00fac api.js c\\u1ee7a Cloudflare g\\u00e1n window.turnstile\n  let _ts = hookTurnstile(window.turnstile);\n  try { Object.defineProperty(window, 'turnstile', { configurable: true, get: () => _ts, set: (v) => { _ts = hookTurnstile(v); } }); } catch (e) {}\n\n  function capCount() {\n    const d = jstDateStr(jstNow()), c = load(K_CAPN, { d, n: 0 });\n    if (c.d !== d) { c.d = d; c.n = 0; }\n    c.n++; save(K_CAPN, c);\n    return c.n;\n  }\n  async function capApi(path, body) { const __session = popupSession; \n    const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 15e3);   // m\\u1ea1ng treo -> b\\u00e1o l\\u1ed7i, kh\\u00f4ng \\u0111\\u1ee9ng im\n    try {\n      const r = await popupAwait(_fetch('https://api.capsolver.com/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ac.signal }), __session);\n      const j = await popupAwait(r.json(), __session);\n      if (j.errorId) throw new Error(j.errorCode || j.errorDescription || 'errorId ' + j.errorId);\n      return j;\n    } catch (e) { if (e && e.cancelled) throw e; \n      throw e.name === 'AbortError' ? new Error(L('CapSolver \\u5fdc\\u7b54\\u306a\\u3057(15\\u79d2)', 'CapSolver kh\\u00f4ng tr\\u1ea3 l\\u1eddi (15 gi\\u00e2y)')) : e;\n    } finally { clearTimeout(tm); }\n  }\n  async function relaySolve() { const __session = popupSession; \n    const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 42e3), t0 = Date.now();\n    let j;\n    try {\n      const r = await popupAwait(_fetch(CAP_RELAY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ p: location.pathname }), signal: ac.signal }), __session);\n      j = await popupAwait(r.json(), __session);\n    } catch (e) { if (e && e.cancelled) throw e; \n      throw e.name === 'AbortError' ? new Error(L('\\u8a8d\\u8a3c\\u306e\\u81ea\\u52d5\\u89e3\\u6c7a \\u5fdc\\u7b54\\u306a\\u3057(42\\u79d2)', 't\\u1ef1 gi\\u1ea3i x\\u00e1c nh\\u1eadn kh\\u00f4ng tr\\u1ea3 l\\u1eddi (42 gi\\u00e2y)')) : new Error(L('\\u8a8d\\u8a3c\\u306e\\u81ea\\u52d5\\u89e3\\u6c7a \\u63a5\\u7d9a\\u30a8\\u30e9\\u30fc', 'kh\\u00f4ng k\\u1ebft n\\u1ed1i \\u0111\\u01b0\\u1ee3c m\\u00e1y t\\u1ef1 gi\\u1ea3i x\\u00e1c nh\\u1eadn'));\n    } finally { clearTimeout(tm); }\n    if (j && j.token) { tsOurs.add(j.token); return j.token; }   // 16/11: user y\\u00eau c\\u1ea7u log KH\\u00d4NG ghi d\\u00f2ng d\\u00f9ng key chung\n    const code = (j && j.error) || 'FAIL';\n    if (code === 'NOTS') return null;\n    const off = L('\\u8a8d\\u8a3c\\u306e\\u81ea\\u52d5\\u89e3\\u6c7a\\u306f\\u4e00\\u6642\\u505c\\u6b62\\u4e2d\\uff08\\u30c1\\u30a7\\u30c3\\u30af\\u3092\\u81ea\\u5206\\u3067\\u30bf\\u30c3\\u30d7\\uff09', 't\\u1ea1m ng\\u01b0ng t\\u1ef1 gi\\u1ea3i x\\u00e1c nh\\u1eadn (h\\u00e3y t\\u1ef1 b\\u1ea5m \\u00f4 x\\u00e1c nh\\u1eadn Cloudflare)');\n    const msg = { DAILY: off, BALANCE: off, KEY: off, OFF: off,\n      RATE: L('\\u8a8d\\u8a3c\\u306e\\u81ea\\u52d5\\u89e3\\u6c7a: \\u56de\\u6570\\u304c\\u591a\\u3059\\u304e\\u307e\\u3059\\uff08\\u5c11\\u3057\\u5f85\\u3064\\uff09', 't\\u1ef1 gi\\u1ea3i x\\u00e1c nh\\u1eadn: qu\\u00e1 nhi\\u1ec1u l\\u01b0\\u1ee3t, ch\\u1edd ch\\u00fat'),\n    }[code] || L('\\u8a8d\\u8a3c\\u306e\\u81ea\\u52d5\\u89e3\\u6c7a \\u30a8\\u30e9\\u30fc ', 't\\u1ef1 gi\\u1ea3i x\\u00e1c nh\\u1eadn l\\u1ed7i ') + code;\n    if (/DAILY|BALANCE|KEY|OFF/.test(code)) { relayOffUntil = Date.now() + 30 * 60e3; relayOffMsg = msg; save(K_CAPOFF, { u: relayOffUntil, m: msg }); }\n    throw new Error(msg);\n  }\n  async function capSolve() { const __session = popupSession; \n    const key = capKey();\n    if (!key) return capShared() ? relaySolve() : null;\n    if (!tsSiteKey) {\n      // 17/11 chi\\u1ec1u: /api/turnstile-config b\\u1ecb g\\u1ee1 (404, tr\\u1ea3 trang HTML) - sitekey n\\u1eb1m c\\u1ee9ng trong JS c\\u1ee7a trang -> d\\u00f9ng s\\u1ed1 d\\u1ef1 ph\\u00f2ng\n      let j = {};\n      try {\n        const r0 = await popupAwait(_fetch('/api/turnstile-config', { credentials: 'include', cache: 'no-store' }), __session);\n        const j0 = r0.ok ? await popupAwait(r0.json(), __session) : null;\n        j = (j0 && typeof j0.code === 'number' && j0.data) || j0 || {};   // 17/11: m\\u00e1y ch\\u1ee7 b\\u1ecdc { code, data }\n      } catch (e) { if (e && e.cancelled) throw e;  j = {}; }\n      if (j.enabled === false) return null;\n      tsSiteKey = j.siteKey || TS_SITEKEY_PIN;\n      if (!tsSiteKey) throw new Error(L('sitekey\\u53d6\\u5f97\\u5931\\u6557', 'kh\\u00f4ng l\\u1ea5y \\u0111\\u01b0\\u1ee3c sitekey'));\n    }\n    const t0 = Date.now();\n    const { taskId } = await popupAwait(capApi('createTask', { clientKey: key,\n      task: { type: 'AntiTurnstileTaskProxyLess', websiteURL: location.origin + location.pathname, websiteKey: tsSiteKey } }), __session);\n    while (Date.now() - t0 < 40e3) {\n      await popupAwait(sleep(1000), __session);\n      const j = await popupAwait(capApi('getTaskResult', { clientKey: key, taskId }), __session);\n      if (j.status === 'ready') {\n        const t = j.solution && j.solution.token;\n        if (!t) throw new Error('token r\\u1ed7ng');\n        tsOurs.add(t);\n        const n = capCount();\n        log(L(`CapSolver \\u89e3\\u6c7a ${((Date.now() - t0) / 1000).toFixed(1)}\\u79d2\\uff08\\u672c\\u65e5 ${n}\\u56de \\u2248 $${(n * CAP_PRICE).toFixed(4)}\\uff09`,\n              `CapSolver gi\\u1ea3i xong ${((Date.now() - t0) / 1000).toFixed(1)}s (h\\u00f4m nay ${n} l\\u01b0\\u1ee3t \\u2248 $${(n * CAP_PRICE).toFixed(4)})`));\n        return t;\n      }\n      if (j.status === 'failed') throw new Error(j.errorCode || 'failed');\n    }\n    throw new Error(L('\\u30bf\\u30a4\\u30e0\\u30a2\\u30a6\\u30c8 40\\u79d2', 'qu\\u00e1 40 gi\\u00e2y'));\n  }\n  const tsPrune = () => { tsPool = tsPool.filter((x) => Date.now() - x.at < TS_LIFE_MS && !tsUsed.has(x.t)); };\n  // gi\\u1ea3i s\\u1eb5n cho \\u0111\\u1ee7 n token (ch\\u1ea1y n\\u1ec1n, l\\u1ed7i th\\u00ec ngh\\u1ec9 10 gi\\u00e2y)\n  function tsFill(n) {\n    if (!capOn() || Date.now() < capErrUntil) return;\n    tsPrune();\n    while (tsPool.length + tsSolving < n) {\n      tsSolving++;\n      capSolve().then((t) => { if (t) tsPool.push({ t, at: Date.now() }); })\n        .catch((e) => { capErrUntil = Date.now() + 10e3; log('CapSolver ' + L('\\u30a8\\u30e9\\u30fc: ', 'l\\u1ed7i: ') + e.message); })\n        .finally(() => { tsSolving--; });\n    }\n  }\n  const tsTakeNow = () => { tsPrune(); const x = tsPool.shift(); return x ? x.t : null; };\n  async function tsTake() { const __session = popupSession; \n    let t = tsTakeNow();\n    if (t) return t;\n    if (tsSolving) {\n      await popupAwait(waitFor(() => tsPool.length || !tsSolving, 45e3, 50), __session);\n      t = tsTakeNow();\n      if (t) return t;\n    }\n    capLastErr = '';\n    try {\n      return await popupAwait(Promise.race([capSolve(), sleep(45e3).then(() => { if (__session !== popupSession) return;  throw new Error(L('\\u30bf\\u30a4\\u30e0\\u30a2\\u30a6\\u30c8 45\\u79d2', 'qu\\u00e1 45 gi\\u00e2y')); })]), __session);\n    } catch (e) { if (e && e.cancelled) throw e;  capLastErr = e.message || ''; log('CapSolver ' + L('\\u30a8\\u30e9\\u30fc: ', 'l\\u1ed7i: ') + e.message); return null; }\n  }\n  // Tr\\u01b0\\u1edbc khi b\\u1ea5m \\u540c\\u610f\\u3057\\u3066\\u53c2\\u52a0\\u3059\\u308b: trang ch\\u01b0a c\\u00f3 token (ho\\u1eb7c token Safari b\\u1ecb t\\u1eeb ch\\u1ed1i) -> \\u0111\\u01b0a token CapSolver v\\u00e0o React\n  async function ensureToken() { const __session = popupSession; \n    if (!capOn()) return;\n    if (pageTok && !tsUsed.has(pageTok) && (!forceCap || tsOurs.has(pageTok))) return;\n    if (!tsCbs.size) await popupAwait(waitFor(() => tsCbs.size, 1500, 50), __session);\n    const t = await popupAwait(tsTake(), __session);\n    if (!t) return;\n    pageTok = t;\n    for (const cb of tsCbs.values()) { try { cb(t); } catch (e) { if (e && e.cancelled) throw e; } }\n    await popupAwait(sleep(60), __session);                      // ch\\u1edd React c\\u1eadp nh\\u1eadt state\n  }\n  // L\\u01b0\\u1edbi an to\\u00e0n: body g\\u1eedi \\u0111i kh\\u00f4ng c\\u00f3 token / token \\u0111\\u00e3 d\\u00f9ng -> thay token CapSolver gi\\u1ea3i s\\u1eb5n\n  function tsPatchBody(body) {\n    try {\n      const j = JSON.parse(body);\n      if (!j || typeof j !== 'object') return body;\n      if ((!j.turnstileToken || tsUsed.has(j.turnstileToken)) && capOn()) { const t = tsTakeNow(); if (t) j.turnstileToken = t; }\n      if (j.turnstileToken) tsUsed.add(j.turnstileToken);   // token ch\\u1ec9 d\\u00f9ng \\u0111\\u01b0\\u1ee3c 1 l\\u1ea7n\n      pageTok = null;\n      return JSON.stringify(j);\n    } catch (e) { return body; }\n  }\n\n  // ================= Th\\u1eddi gian JST =================\n  // Gi\\u1edd m\\u00e1y ch\\u1ee7: \\u0111\\u1ecdc header Date (tr\\u1eeb n\\u1eeda th\\u1eddi gian m\\u1ea1ng), \\u0111i\\u1ec7n tho\\u1ea1i l\\u1ec7ch gi\\u1edd v\\u1eabn d\\u00f2 \\u0111\\u00fang 13:00\n  let clockOff = 0, clockLogged = false;\n  const nowS = () => Date.now() + clockOff;\n  const jstNow = () => new Date(nowS() + 9 * 3600e3);          // d\\u00f9ng getUTC* \\u0111\\u1ec3 \\u0111\\u1ecdc gi\\u1edd JST\n  const jstDateStr = (d) => d.toISOString().slice(0, 10);\n  // 4/11 user b\\u00e1o h\\u1eb9n 13:00 m\\u00e0 BOT kh\\u00f4ng b\\u1ea5m, log 1 d\\u00f2ng: tr\\u01b0\\u1edbc \\u0111\\u00e2y qu\\u00e1 13:10 h\\u00e0m n\\u00e0y nh\\u1ea3y sang 13:00 NG\\u00c0Y MAI n\\u00ean\n  // modeWait kh\\u00f4ng bao gi\\u1edd t\\u1edbi nh\\u00e1nh \"qu\\u00e1 13:10 \\u2013 d\\u1eebng\", l\\u1eb7ng l\\u1ebd \\u0111\\u1ebfm ng\\u01b0\\u1ee3c ti\\u1ebfp. Gi\\u1edd m\\u1ed1c ch\\u1edd l\\u01b0u c\\u1ed1 \\u0111\\u1ecbnh l\\u00fac b\\u1ea5m (st.openAt).\n  function nextOpenAt() {\n    const n = jstNow();\n    let t = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), OPEN_H, OPEN_M, 0) - n;\n    if (t < 0) t += 86400e3;                            // b\\u1ea5m l\\u00fac \\u0111\\u00e3 qu\\u00e1 13:00 (ng\\u00e0y h\\u00f4m nay \\u0111\\u00e3 m\\u1edf) -> ch\\u1edd 13:00 ng\\u00e0y mai\n    return nowS() + t;\n  }\n  const msToOpen = () => (st.openAt || nextOpenAt()) - nowS();\n\n  // ================= API =================\n  // 17/11: trang \\u0111\\u1ed5i sang NHI\\u1ec0U C\\u1eecA H\\u00c0NG (trang \\u0111\\u1eb7t v\\u00e9 = /?store_id=N, kh\\u00f4ng c\\u00f3 th\\u00ec trang t\\u1ef1 v\\u1ec1 /home):\n  //  - m\\u1ecdi API (k\\u1ec3 c\\u1ea3 bookable-dates / slots) \\u0111\\u00f2i Authorization: Bearer <h5.accessToken>  -> tr\\u01b0\\u1edbc \\u0111\\u00e2y BOT kh\\u00f4ng g\\u1eedi = HTTP 401\n  //  - bookable-dates / slots th\\u00eam ?store_id=N ; POST /api/registrations th\\u00eam store_id (+ mode 1|2 khi v\\u00e0o t\\u1eeb trang c\\u1eeda h\\u00e0ng)\n  //  - m\\u00e1y ch\\u1ee7 b\\u1ecdc k\\u1ebft qu\\u1ea3 { code, message, data } (code 0 = \\u0111\\u01b0\\u1ee3c) -> unwrap()\n  //  - mode 2 = \\u0110\\u0102NG K\\u00dd B\\u1ed0C TH\\u0102M: result 'pending_draw' (b\\u00e1o k\\u1ebft qu\\u1ea3 sau qua mail/SMS) ; sing_up:true = h\\u00f4m nay \\u0111\\u00e3 \\u0111\\u0103ng k\\u00fd r\\u1ed3i\n  const K_STORE = 'pj_store_v1', K_MULTI = 'pj_multi_v1';\n  let storeNow = 0;                        // ch\\u1ebf \\u0111\\u1ed9 t\\u1ea5t c\\u1ea3 c\\u1eeda h\\u00e0ng: c\\u1eeda h\\u00e0ng \\u0111ang \\u0111\\u01b0\\u1ee3c h\\u1ecfi / \\u0111\\u0103ng k\\u00fd\n  const multiOn = () => load(K_MULTI, false) === true;\n  // ch\\u1ea1y fn v\\u1edbi c\\u1eeda h\\u00e0ng sid (c\\u00e1c h\\u00e0m API \\u0111\\u1ecdc storeId() ngay l\\u00fac g\\u1ecdi) r\\u1ed3i tr\\u1ea3 l\\u1ea1i nh\\u01b0 c\\u0169\n  const withStore = (sid, fn) => { const prev = storeNow; storeNow = sid; try { return fn(); } finally { storeNow = prev; } };\n  // kh\\u00f3a \"khung \\u0111\\u00e3 tr\\u01b0\\u1ee3t\": c\\u1eeda h\\u00e0ng kh\\u00e1c nhau c\\u00f3 th\\u1ec3 tr\\u00f9ng ng\\u00e0y + gi\\u1edd -> th\\u00eam m\\u00e3 c\\u1eeda h\\u00e0ng (\\u539f\\u5bbf id 2 gi\\u1eef kh\\u00f3a c\\u0169)\n  const lostKey = (date, t) => { const sid = storeId(); return (!sid || sid === 2 ? '' : 's' + sid + ':') + date + '#' + t; };\n  function storeId() {\n    if (storeNow) return storeNow;\n    try {\n      const n = Number(new URLSearchParams(location.search).get('store_id'));\n      if (Number.isInteger(n) && n > 0) { if (load(K_STORE, 0) !== n) save(K_STORE, n); return n; }\n    } catch (e) {}\n    return Number(load(K_STORE, 0)) || 0;\n  }\n  // danh s\\u00e1ch c\\u1eeda h\\u00e0ng (nh\\u1edb l\\u1ea1i \\u0111\\u1ec3 b\\u1ea3ng BOT hi\\u1ec7n t\\u00ean ngay c\\u1ea3 khi ch\\u01b0a h\\u1ecfi m\\u00e1y ch\\u1ee7): [{ id, name, slots: ['10:30', ...] }]\n  const K_STORES = 'pj_stores_v1';\n  let storesCache = load(K_STORES, []);\n  const hmMin = (x) => { const m = /^(\\d{1,2}):(\\d{2})/.exec(x || ''); return m ? +m[1] * 60 + +m[2] : NaN; };\n  const minHm = (n) => String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');\n  function slotTimes(sid) {\n    const st0 = storesCache.find((x) => x.id === (sid || storeId()));\n    return st0 && st0.slots && st0.slots.length ? st0.slots : SLOTS_DEF;\n  }\n  // c\\u00e0i \\u0111\\u1eb7t \\u01b0u ti\\u00ean khung gi\\u1edd: \\u539f\\u5bbf (id 2) gi\\u1eef kh\\u00f3a c\\u0169, c\\u1eeda h\\u00e0ng kh\\u00e1c c\\u00f3 kh\\u00f3a ri\\u00eang (khung gi\\u1edd kh\\u00e1c nhau)\n  const prioKey = () => { const sid = storeId(); return !sid || sid === 2 ? K_PRIO : K_PRIO + '_s' + sid; };\n  async function loadStores() { const __session = popupSession; \n    const r = await popupAwait(apiGet('/member/store/list'), __session);\n    if (!r.ok) throw new Error('store list HTTP ' + r.status);\n    const d = (await popupAwait(apiJson(r, 'store list'), __session)) || {};\n    const list = (d.list || []).filter((x) => x && x.id).map((x) => {\n      const ts = x.time_slot || {}, a = hmMin(ts.start_time), b = hmMin(ts.end_time), n = +ts.daily_slots || 0, slots = [];\n      if (n > 0 && b > a) { const step = Math.round((b - a) / n); for (let k = 0; k < n; k++) slots.push(minHm(a + k * step)); }\n      const old = storesCache.find((o) => o.id === x.id);\n      return { id: x.id, name: String(x.store_name || 'Store ' + x.id).slice(0, 60), slots: slots.length ? slots : (old && old.slots) || [] };\n    });\n    if (list.length) { storesCache = list; save(K_STORES, storesCache); }\n    return storesCache;\n  }\n  const storeName = (sid) => { const x = storesCache.find((o) => o.id === (sid || storeId())); return x ? x.name : ''; };\n  const unwrap = (j) => (j && typeof j === 'object' && typeof j.code === 'number' && 'data' in j ? j.data : j);\n  const noStore = () => new Error(L('\\u5e97\\u8217\\u304c\\u672a\\u9078\\u629e\\u3067\\u3059\\u3002\\u5e97\\u8217\\u3092\\u9078\\u3093\\u3067\\u300c\\u6642\\u9593\\u5e2f\\u3092\\u9078\\u629e\\u300d\\u3092\\u958b\\u3044\\u3066\\u304f\\u3060\\u3055\\u3044', 'ch\\u01b0a ch\\u1ecdn c\\u1eeda h\\u00e0ng: h\\u00e3y ch\\u1ecdn c\\u1eeda h\\u00e0ng r\\u1ed3i b\\u1ea5m \\u6642\\u9593\\u5e2f\\u3092\\u9078\\u629e (m\\u1edf trang ch\\u1ecdn khung gi\\u1edd)'));\n  // GET c\\u00f3 token; 401 -> l\\u00e0m m\\u1edbi token 1 l\\u1ea7n r\\u1ed3i g\\u1eedi l\\u1ea1i\n  // 18/11 (m\\u00e1y ch\\u1ee7 trang m\\u1edbi hay l\\u1ed7i): m\\u1ed7i l\\u01b0\\u1ee3t GET t\\u1ed1i \\u0111a API_TIMEOUT gi\\u00e2y. Tr\\u01b0\\u1edbc \\u0111\\u00e2y kh\\u00f4ng c\\u00f3 h\\u1ea1n -> m\\u00e1y ch\\u1ee7 treo th\\u00ec\n  // 8 l\\u01b0\\u1ee3t d\\u00f2 ng\\u00e0y m\\u1edbi \\u0111\\u1ee9ng h\\u1ebft (pollInflight \\u0111\\u1ea7y) v\\u00e0 BOT ng\\u1eebng d\\u00f2 m\\u00e0 kh\\u00f4ng b\\u00e1o g\\u00ec.\n  const API_TIMEOUT = 8000;\n  async function apiGet(url) { const __session = popupSession; \n    for (let k = 0; k < 2; k++) {\n      const tok = getTok();\n      const ac = new AbortController(), tm = setTimeout(() => ac.abort(), API_TIMEOUT);\n      let r;\n      try { r = await popupAwait(_fetch(url, { credentials: 'include', cache: 'no-store', signal: ac.signal, headers: tok ? { Authorization: 'Bearer ' + tok } : {} }), __session); }\n      catch (e) { if (e && e.cancelled) throw e;  throw new Error(e.name === 'AbortError' ? L(`\\u30b5\\u30fc\\u30d0\\u30fc\\u5fdc\\u7b54\\u306a\\u3057\\uff08${API_TIMEOUT / 1000}\\u79d2\\uff09`, `m\\u00e1y ch\\u1ee7 kh\\u00f4ng tr\\u1ea3 l\\u1eddi (${API_TIMEOUT / 1000} gi\\u00e2y)`) : (e.message || 'network')); }\n      finally { clearTimeout(tm); }\n      if (r.status === 401 && k === 0 && await popupAwait(rqRefresh(), __session)) continue;\n      return r;\n    }\n  }\n  // \\u0111\\u1ecdc JSON \\u0111\\u00e3 b\\u1ecdc { code, message, data }: code kh\\u00e1c 0 d\\u00f9 HTTP 200 = m\\u00e1y ch\\u1ee7 b\\u00e1o l\\u1ed7i (VD SYSTEM_BUSY) -> n\\u00e9m l\\u1ed7i c\\u00f3 t\\u00ean,\n  // kh\\u00f4ng coi l\\u00e0 \"danh s\\u00e1ch r\\u1ed7ng\" (tr\\u01b0\\u1edbc \\u0111\\u00e2y: l\\u1ed7i ki\\u1ec3u n\\u00e0y l\\u00e0m BOT t\\u01b0\\u1edfng ch\\u01b0a c\\u00f3 ng\\u00e0y m\\u1edbi / h\\u1ebft khung)\n  async function apiJson(r, what) { const __session = popupSession; \n    let j;\n    try { j = await popupAwait(r.json(), __session); } catch (e) { if (e && e.cancelled) throw e;  throw new Error(`${what} HTTP ${r.status} ` + L('\\uff08JSON\\u3067\\u306a\\u3044\\u5fdc\\u7b54\\uff09', '(m\\u00e1y ch\\u1ee7 tr\\u1ea3 v\\u1ec1 kh\\u00f4ng ph\\u1ea3i JSON)')); }\n    if (j && typeof j === 'object' && typeof j.code === 'number' && j.code !== 0) {\n      throw new Error(`${what} ${(j.data && j.data.code) || j.code} ${String(j.message || '').slice(0, 40)}`.trim());\n    }\n    return unwrap(j);\n  }\n  // 18/11 th\\u00e0nh vi\\u00ean y\\u00eau c\\u1ea7u: NG\\u00c0Y CH\\u1ec8 \\u0110\\u1ecaNH. \"11/20\" = ch\\u1ec9 ng\\u00e0y 20/11 ; \"11/20&11/21&11/22\" = ch\\u1ec9 3 ng\\u00e0y \\u0111\\u00f3, th\\u1ee9 t\\u1ef1 NG\\u1eaaU NHI\\u00caN.\n  // Nh\\u1eadn: 11/20, 11-20, 2026-11-20, ho\\u1eb7c ch\\u1ec9 s\\u1ed1 ng\\u00e0y \"20\" ; ng\\u0103n b\\u1eb1ng & , \\u3001 ho\\u1eb7c d\\u1ea5u c\\u00e1ch. \\u0110\\u1ec3 tr\\u1ed1ng = m\\u1ecdi ng\\u00e0y nh\\u01b0 c\\u0169.\n  const K_DAYS = 'pj_days_v1';\n  function wantDays() {\n    const out = [];\n    for (const tk of String(load(K_DAYS, '') || '').split(/[&\\uff06,\\uff0c\\u3001;\\s]+/).filter(Boolean)) {\n      let m = /^(?:\\d{4}[-/.])?(\\d{1,2})[-/.](\\d{1,2})$/.exec(tk);\n      if (m) { out.push({ m: +m[1], d: +m[2] }); continue; }\n      m = /^(\\d{1,2})$/.exec(tk);\n      if (m) out.push({ m: 0, d: +m[1] });\n    }\n    return out.filter((w) => w.d >= 1 && w.d <= 31 && w.m >= 0 && w.m <= 12);\n  }\n  const dayHit = (date, w) => +date.slice(8, 10) === w.d && (!w.m || +date.slice(5, 7) === w.m);\n  const wantText = () => wantDays().map((w) => (w.m ? w.m + '/' : '') + w.d).join(', ');\n  function pickDays(dates) {\n    const w = wantDays();\n    if (!w.length) return dates;\n    const a = dates.filter((d) => w.some((x) => dayHit(d, x)));\n    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }   // ng\\u1eabu nhi\\u00ean\n    return a;\n  }\n  let lastAllDates = [];                   // danh s\\u00e1ch ng\\u00e0y m\\u00e1y ch\\u1ee7 tr\\u1ea3 (ch\\u01b0a l\\u1ecdc) \\u2013 \\u0111\\u1ec3 b\\u00e1o r\\u00f5 khi ng\\u00e0y ch\\u1ec9 \\u0111\\u1ecbnh kh\\u00f4ng c\\u00f3\n  async function apiDates() { const __session = popupSession; \n    const t0 = Date.now(), sid = storeId();\n    if (!sid) throw noStore();\n    const r = await popupAwait(apiGet(`/api/registrations/bookable-dates?store_id=${sid}&_=${Date.now()}`), __session);\n    if (r.status === 401) throw new Error(L('\\u30ed\\u30b0\\u30a4\\u30f3\\u304c\\u5207\\u308c\\u3066\\u3044\\u307e\\u3059\\uff08\\u30ed\\u30b0\\u30a4\\u30f3\\u3057\\u76f4\\u3057\\u3066\\u304f\\u3060\\u3055\\u3044\\uff09', 'ch\\u01b0a \\u0111\\u0103ng nh\\u1eadp / h\\u1ebft phi\\u00ean (h\\u00e3y \\u0111\\u0103ng nh\\u1eadp l\\u1ea1i trang)'));\n    if (!r.ok) throw new Error('bookable-dates HTTP ' + r.status);\n    const sv = Date.parse(r.headers.get('date') || ''), t1 = Date.now();\n    if (sv && t1 - t0 < 2000) {\n      const off = sv + 500 - (t0 + t1) / 2;              // header ch\\u1ec9 ch\\u00ednh x\\u00e1c t\\u1edbi gi\\u00e2y -> l\\u1ea5y gi\\u1eefa gi\\u00e2y\n      clockOff = Math.abs(off) > 2000 ? off : 0;         // l\\u1ec7ch d\\u01b0\\u1edbi 2 gi\\u00e2y: gi\\u1eef gi\\u1edd m\\u00e1y\n      if (clockOff && !clockLogged) { clockLogged = true; log(L(`\\u7aef\\u672b\\u306e\\u6642\\u8a08\\u304c ${Math.round(off / 1000)}\\u79d2 \\u305a\\u308c\\u3066\\u3044\\u307e\\u3059 \\u2192 \\u30b5\\u30fc\\u30d0\\u30fc\\u6642\\u523b\\u3067\\u52d5\\u4f5c`, `Gi\\u1edd \\u0111i\\u1ec7n tho\\u1ea1i l\\u1ec7ch ${Math.round(off / 1000)} gi\\u00e2y \\u2192 BOT d\\u00f9ng gi\\u1edd m\\u00e1y ch\\u1ee7`)); }\n    }\n    const j = (await popupAwait(apiJson(r, 'bookable-dates'), __session)) || {};\n    lastAllDates = (j.dates || []).map((d) => (typeof d === 'string' ? d : d.date || d.slotDate)).filter(Boolean);\n    return pickDays(lastAllDates);\n  }\n  const slotIdx = {};\n  // mode 1 = l\\u1ea5y v\\u00e9 ngay, 2 = b\\u1ed1c th\\u0103m. Nh\\u01b0 trang: l\\u1ea5y t\\u1eeb history.state khi v\\u00e0o t\\u1eeb trang c\\u1eeda h\\u00e0ng; kh\\u00f4ng c\\u00f3 th\\u00ec h\\u1ecfi c\\u1eeda h\\u00e0ng\n  const modeCache = {}, modeForce = {};\n  // m\\u00e1y ch\\u1ee7 b\\u00e1o MODE_MISMATCH (ki\\u1ec3u \\u0111\\u0103ng k\\u00fd BOT g\\u1eedi kh\\u00f4ng kh\\u1edbp c\\u1eeda h\\u00e0ng): h\\u1ecfi l\\u1ea1i c\\u1eeda h\\u00e0ng; v\\u1eabn nh\\u01b0 c\\u0169 th\\u00ec \\u0111\\u1ed5i sang ki\\u1ec3u c\\u00f2n l\\u1ea1i\n  async function modeFlip(sent) { const __session = popupSession; \n    const sid = storeId();\n    delete modeCache[sid]; delete modeForce[sid];\n    let m = 0;\n    try { const r = await popupAwait(apiGet(`/member/store/${sid}`), __session); const d = r.ok ? unwrap(await popupAwait(r.json(), __session)) || {} : {}; const ms = (d.activity || []).filter((a) => a && a.status !== 'ended').map((a) => a.mode).filter((x) => x === 1 || x === 2); m = ms.find((x) => x !== sent) || 0; } catch (e) { if (e && e.cancelled) throw e; }\n    modeForce[sid] = m || (sent === 1 ? 2 : sent === 2 ? 1 : 1);\n    log(L(`\\u7533\\u8fbc\\u65b9\\u5f0f\\u3092\\u5207\\u66ff: ${sent || '\\u306a\\u3057'} \\u2192 ${modeForce[sid]}`, `\\u0110\\u1ed5i ki\\u1ec3u \\u0111\\u0103ng k\\u00fd: ${sent || 'kh\\u00f4ng g\\u1eedi'} \\u2192 ${modeForce[sid]} (1 = l\\u1ea5y v\\u00e9 ngay, 2 = b\\u1ed1c th\\u0103m)`));\n  }\n  let lastMode = 0;\n  async function storeMode() { const __session = popupSession; \n    const sid0 = storeId();\n    if (modeForce[sid0]) return modeForce[sid0];\n    // (ch\\u1ebf \\u0111\\u1ed9 t\\u1ea5t c\\u1ea3 c\\u1eeda h\\u00e0ng: history.state l\\u00e0 c\\u1ee7a trang \\u0111ang m\\u1edf, kh\\u00f4ng d\\u00f9ng cho c\\u1eeda h\\u00e0ng kh\\u00e1c)\n    if (!storeNow) { try { const m = history.state && history.state.usr && history.state.usr.mode; if (m === 1 || m === 2) return m; } catch (e) { if (e && e.cancelled) throw e; } }\n    const sid = storeId();\n    if (!sid) return 0;\n    if (sid in modeCache) return modeCache[sid];\n    try {\n      const r = await popupAwait(apiGet(`/member/store/${sid}`), __session);\n      const d = r.ok ? unwrap(await popupAwait(r.json(), __session)) || {} : {};\n      const ms = [...new Set((d.activity || []).filter((a) => a && a.status !== 'ended').map((a) => a.mode).filter((m) => m === 1 || m === 2))];\n      modeCache[sid] = ms.length === 1 ? ms[0] : 0;      // c\\u1eeda h\\u00e0ng c\\u00f3 c\\u1ea3 2 ki\\u1ec3u -> kh\\u00f4ng t\\u1ef1 \\u0111o\\u00e1n (trang c\\u0169ng kh\\u00f4ng g\\u1eedi mode khi m\\u1edf th\\u1eb3ng link)\n    } catch (e) { if (e && e.cancelled) throw e;  return 0; }\n    return modeCache[sid];\n  }\n  async function apiSlots(date) { const __session = popupSession; \n    try {\n      const sid = storeId();\n      if (!sid) return null;\n      const r = await popupAwait(apiGet(`/api/registrations/slots?date=${date}&store_id=${sid}&_=${Date.now()}`), __session);\n      if (!r.ok) return null;\n      const j = await popupAwait(apiJson(r, 'slots'), __session);\n      if (!Array.isArray(j)) return null;\n      for (const x of j) if (x && x.slotIndex && x.startTime) slotIdx[date + '#' + x.startTime.slice(0, 5)] = x.slotIndex;   // slotIndex l\\u1ea5y t\\u1eeb m\\u00e1y ch\\u1ee7\n      // khung gi\\u1edd c\\u1ee7a c\\u1eeda h\\u00e0ng theo \\u0111\\u00fang m\\u00e1y ch\\u1ee7 (b\\u1ecf khung ch\\u01b0a t\\u1eebng m\\u1edf: capacity 0 + \\u0111\\u00f3ng, VD 19:30 c\\u1ee7a \\u539f\\u5bbf)\n      const real = j.filter((x) => x && x.startTime).sort((x1, x2) => (x1.slotIndex || 0) - (x2.slotIndex || 0)).map((x) => x.startTime.slice(0, 5));\n      const cur = storesCache.find((o) => o.id === sid);\n      if (real.length && (!cur || cur.slots.join() !== real.join())) {\n        if (cur) cur.slots = real; else storesCache.push({ id: sid, name: 'Store ' + sid, slots: real });\n        save(K_STORES, storesCache);\n      }\n      return j;\n    } catch (e) { if (e && e.cancelled) throw e;  return null; }\n  }\n\n  // ================= Th\\u1ee9 t\\u1ef1 khung theo c\\u00e0i \\u0111\\u1eb7t =================\n  function slotOrder(apiList) {\n    const prio = load(prioKey(), {});\n    const free = (t) => {\n      if (!apiList) return true;                        // API h\\u1ecfng -> \\u0111\\u1ec3 UI quy\\u1ebft (n\\u00fat x\\u00e1m = b\\u1ecf)\n      const s = apiList.find((x) => (x.startTime || '').slice(0, 5) === t);\n      if (!s) return true;\n      return s.isOpen !== false && !s.isFull && !s.isPast && s.isDrawn !== true && (s.remaining == null || s.remaining > 0);\n    };\n    const all = slotTimes();\n    const ranked = all.filter((t) => typeof prio[t] === 'number').sort((a, b) => prio[a] - prio[b]);\n    const normal = all.filter((t) => prio[t] == null);\n    return [...ranked, ...normal].filter(free);\n  }\n\n  // ================= Thao t\\u00e1c giao di\\u1ec7n =================\n  const btns = () => [...document.querySelectorAll('button, [role=button]')].filter((b) => !b.closest('#pjbox'));\n  const txt = (e) => (e.innerText || e.textContent || '').replace(/\\s+/g, ' ').trim();\n  const visible = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };\n\n  function findDateTab(date) {\n    const m = +date.slice(5, 7), d = +date.slice(8, 10);\n    const re = new RegExp('(^|[^0-9/])' + m + '/' + d + '(?![0-9])');\n    return btns().find((b) => re.test(txt(b)));\n  }\n  // n\\u00fat ng\\u00e0y \\u0111ang ch\\u1ecdn c\\u00f3 vi\\u1ec1n h\\u1ed3ng (border-[#fe198a]); ch\\u1edd h\\u1ebft v\\u00f2ng xoay t\\u1ea3i khung\n  async function waitDateShown(date) { const __session = popupSession; \n    await popupAwait(waitFor(() => { const b = findDateTab(date); return b && /fe198a/i.test(b.className || '') && !document.querySelector('.animate-spin'); }, 2500, 25), __session);\n  }\n  function findSlotBtn(t) { return btns().find((b) => txt(b).startsWith(t) || txt(b).includes(t + '-') || txt(b).includes(t + '\\u2013')); }\n  function findByText(re) { return btns().find((b) => re.test(txt(b)) && visible(b) && !b.disabled); }\n  function findByTextAny(re) { return btns().find((b) => re.test(txt(b)) && visible(b)); }\n  function closeAgreeDialog() {\n    const ok = findByText(/\\u540c\\u610f\\u3057\\u3066\\u53c2\\u52a0/);\n    if (!ok) return;\n    const cancel = btns().find((b) => txt(b) === '\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb');\n    if (cancel) cancel.click();\n  }\n  async function waitFor(fn, ms, step = 25) { const __session = popupSession; \n    const end = Date.now() + ms;\n    while (Date.now() < end) { const v = fn(); if (v) return v; await popupAwait(sleep(step), __session); }\n    return null;\n  }\n  function toastText() {\n    return [...document.querySelectorAll('[role=status],[role=alert],[data-sonner-toast],[class*=toast],[class*=Toast]')]\n      .map(txt).filter(Boolean).reverse().join(' | ');\n  }\n\n  // 1 l\\u01b0\\u1ee3t: b\\u1ea5m khung -> \\u62bd\\u9078\\u306b\\u53c2\\u52a0 -> \\u540c\\u610f\\u3057\\u3066\\u53c2\\u52a0\\u3059\\u308b -> \\u0111\\u1ecdc k\\u1ebft qu\\u1ea3\n  async function trySlot(t) { const __session = popupSession; \n    closeAgreeDialog();\n    const sb = await popupAwait(waitFor(() => findSlotBtn(t), 8000), __session);\n    if (!sb) return { kind: 'skip', note: L('\\u67a0\\u30dc\\u30bf\\u30f3\\u306a\\u3057', 'kh\\u00f4ng th\\u1ea5y n\\u00fat khung') };\n    if (sb.disabled || /\\u6e80\\u5e2d|\\u7d42\\u4e86/.test(txt(sb))) return { kind: 'skip', note: '\\u6e80\\u5e2d' };\n    sb.click();\n    await popupAwait(sleep(50), __session);                         // \\u0111\\u1ec3 React ghi khung v\\u1eeba ch\\u1ecdn\n    if (findByTextAny(/\\u672c\\u65e5\\u5fdc\\u52df\\u6e08\\u307f/)) return { kind: 'stop', notSent: true, note: L('\\u672c\\u65e5\\u306f\\u3059\\u3067\\u306b\\u5fdc\\u52df\\u6e08\\u307f\\u3067\\u3059', 'h\\u00f4m nay t\\u00e0i kho\\u1ea3n n\\u00e0y \\u0111\\u00e3 \\u0111\\u0103ng k\\u00fd r\\u1ed3i (\\u672c\\u65e5\\u5fdc\\u52df\\u6e08\\u307f)') };\n    await popupAwait(ensureToken(), __session);                     // 17/11: n\\u00fat \\u62bd\\u9078\\u306b\\u53c2\\u52a0 b\\u1ecb kh\\u00f3a t\\u1edbi khi trang c\\u00f3 token Cloudflare\n    const join = await popupAwait(waitFor(() => findByText(/\\u62bd\\u9078\\u306b\\u53c2\\u52a0/), 3000), __session);\n    if (!join) return { kind: 'skip', note: L('\\u62bd\\u9078\\u306b\\u53c2\\u52a0 \\u62bc\\u305b\\u305a', 'kh\\u00f4ng b\\u1ea5m \\u0111\\u01b0\\u1ee3c \\u62bd\\u9078\\u306b\\u53c2\\u52a0') };\n\n    regPosted = false;\n    const resP = new Promise((res) => { resultWaiter = res; setTimeout(() => { if (resultWaiter === res) { resultWaiter = null; res(null); } }, WAIT_RESULT_MS); });\n    join.click();\n    const agree = await popupAwait(waitFor(() => findByText(/\\u540c\\u610f\\u3057\\u3066\\u53c2\\u52a0/), WAIT_AGREE_MS), __session);\n    await popupAwait(ensureToken(), __session);\n    if (agree) agree.click();\n    if (st.active) tsFill(st.fresh ? TS_POOL : 1);   // gi\\u1ea3i b\\u00f9 token cho l\\u01b0\\u1ee3t sau\n\n    const r = await popupAwait(resP, __session);\n    if (!r) {\n      const tt = toastText();\n      if (/\\u5f53\\u9078\\u304a\\u3081\\u3067\\u3068\\u3046|\\u3059\\u3067\\u306b\\u53d6\\u5f97\\u6e08\\u307f/.test(tt)) return { kind: 'won', note: tt.slice(0, 40) };\n      if (/\\u7533\\u3057\\u8fbc\\u307f\\u5b8c\\u4e86/.test(document.body.innerText || '')) return { kind: 'won', applied: true, note: 'pending_draw' };\n      if (findByTextAny(/\\u672c\\u65e5\\u5fdc\\u52df\\u6e08\\u307f/)) return { kind: 'stop', note: L('\\u672c\\u65e5\\u306f\\u3059\\u3067\\u306b\\u5fdc\\u52df\\u6e08\\u307f\\u3067\\u3059', 'h\\u00f4m nay t\\u00e0i kho\\u1ea3n n\\u00e0y \\u0111\\u00e3 \\u0111\\u0103ng k\\u00fd r\\u1ed3i (\\u672c\\u65e5\\u5fdc\\u52df\\u6e08\\u307f)') };\n      if (/\\u5b9a\\u54e1\\u306b\\u9054\\u3057\\u307e\\u3057\\u305f/.test(tt)) return { kind: 'lose', note: L('\\u5b9a\\u54e1\\u306b\\u9054\\u3057\\u307e\\u3057\\u305f', '\\u0111\\u00e3 \\u0111\\u1ee7 ng\\u01b0\\u1eddi') };\n      // trang CH\\u01afA g\\u1eedi \\u0111\\u0103ng k\\u00fd: kh\\u00f4ng t\\u00ednh v\\u00e0o l\\u01b0\\u1ee3t g\\u1eedi. Kh\\u00f4ng c\\u00f3 key th\\u00ec khung sau c\\u0169ng v\\u1eady -> d\\u1eebng v\\u00e0 b\\u00e1o r\\u00f5\n      if (!regPosted && !capOn()) return { kind: 'stop', notSent: true, note: L('\\u9001\\u4fe1\\u3067\\u304d\\u307e\\u305b\\u3093: Cloudflare \\u8a8d\\u8a3c\\u5f85\\u3061\\uff08\\u30c1\\u30a7\\u30c3\\u30af\\u3092\\u30bf\\u30c3\\u30d7 or CapSolver \\u30ad\\u30fc\\u3092\\u5165\\u529b\\uff09', 'ch\\u01b0a g\\u1eedi \\u0111\\u01b0\\u1ee3c: Cloudflare \\u0111ang ch\\u1edd x\\u00e1c nh\\u1eadn (b\\u1ea5m \\u00f4 x\\u00e1c nh\\u1eadn ho\\u1eb7c nh\\u1eadp key CapSolver)') };\n      if (!regPosted) return { kind: 'error', notSent: true, note: L('\\u30da\\u30fc\\u30b8\\u304c\\u7533\\u8fbc\\u3092\\u9001\\u4fe1\\u3057\\u307e\\u305b\\u3093\\u3067\\u3057\\u305f', 'trang ch\\u01b0a g\\u1eedi \\u0111\\u0103ng k\\u00fd') + (tt ? ': ' + tt.slice(0, 40) : '') };\n      // kh\\u00f4ng c\\u00f3 key m\\u00e0 Turnstile \\u0111\\u00f2i b\\u1ea5m tay -> trang kh\\u00f4ng g\\u1eedi \\u0111\\u0103ng k\\u00fd, b\\u00e1o r\\u00f5 cho ng\\u01b0\\u1eddi d\\u00f9ng\n      const hint = !capOn() && !pageTok ? L('\\uff08\\u8a8d\\u8a3c\\u5f85\\u3061: \\u30c1\\u30a7\\u30c3\\u30af\\u3092\\u30bf\\u30c3\\u30d7 or CapSolver \\u30ad\\u30fc\\u3092\\u5165\\u529b\\uff09', ' (ch\\u1edd x\\u00e1c nh\\u1eadn Cloudflare: b\\u1ea5m \\u00f4 x\\u00e1c nh\\u1eadn ho\\u1eb7c nh\\u1eadp key CapSolver)') : '';\n      return { kind: 'error', note: L('\\u5fdc\\u7b54\\u306a\\u3057', 'kh\\u00f4ng c\\u00f3 ph\\u1ea3n h\\u1ed3i') + hint + (tt ? ': ' + tt.slice(0, 40) : '') };\n    }\n    return parseReg(r);\n  }\n\n  // \\u0110\\u1ecdc k\\u1ebft qu\\u1ea3 POST /api/registrations (d\\u00f9ng chung cho ch\\u1ebf \\u0111\\u1ed9 giao di\\u1ec7n v\\u00e0 ch\\u1ebf \\u0111\\u1ed9 request)\n  function parseReg(r) {\n    // 17/11: { code: 0, message, data: {...} } ; l\\u1ed7i: { code: 401, message, data: { code: 'AUTH_INVALID', ... } }\n    const raw = r.data || {}, wrapped = typeof raw.code === 'number';\n    const inner = wrapped ? (raw.data && typeof raw.data === 'object' ? raw.data : {}) : raw;\n    const d = { ...inner, message: raw.message || inner.message || '' };\n    const res = String(inner.result || '').toLowerCase();\n    const code = String(inner.code || (wrapped && raw.code !== 0 ? raw.code : '') || '');\n    // 17/11: sing_up = t\\u00e0i kho\\u1ea3n b\\u1ecb ch\\u1eb7n g\\u1eedi h\\u00f4m nay (trang hi\\u1ec7n \\u300c\\u3053\\u306e\\u6642\\u9593\\u5e2f\\u306f\\u6e80\\u54e1\\u3067\\u3059\\u300d nh\\u01b0ng kh\\u00f3a n\\u00fat g\\u1eedi c\\u1ea3 trang;\n    // b\\u1ea3n PC th\\u1ea5y 142/205 TK b\\u1ecb ngay l\\u01b0\\u1ee3t \\u0111\\u1ea7u d\\u00f9 khung c\\u00f2n 23-41 ch\\u1ed7) -> nh\\u01b0 PC: ch\\u1edd t\\u1edbi 0:00 JST r\\u1ed3i ch\\u1ea1y ti\\u1ebfp\n    const SIGNED = L('\\u672c\\u65e5\\u306f\\u3053\\u308c\\u4ee5\\u4e0a\\u7533\\u3057\\u8fbc\\u3081\\u307e\\u305b\\u3093\\uff08\\u672c\\u65e5\\u5fdc\\u52df\\u6e08\\u307f\\uff09', 'h\\u00f4m nay t\\u00e0i kho\\u1ea3n n\\u00e0y kh\\u00f4ng g\\u1eedi \\u0111\\u01b0\\u1ee3c n\\u1eefa (\\u672c\\u65e5\\u5fdc\\u52df\\u6e08\\u307f)');\n    if (inner.sing_up === true) return { kind: 'stop', nextDay: true, note: SIGNED };\n    if (res === 'pending_draw') return { kind: 'won', applied: true, note: res, draw: [inner.drawDate, inner.drawStartTime, inner.drawEndTime].filter(Boolean).map((x) => String(x).slice(0, 10)).join(' ') };\n    if (res === 'won' || res === 'already_won') return { kind: 'won', note: res };\n    if (res) return { kind: 'lose', note: res };\n    // c\\u00f3 CapSolver: token b\\u1ecb t\\u1eeb ch\\u1ed1i -> t\\u1eeb gi\\u1edd lu\\u00f4n d\\u00f9ng token CapSolver, th\\u1eed khung k\\u1ebf thay v\\u00ec d\\u1eebng\n    if (code === 'TURNSTILE_INVALID' && capOn() && !forceCap) { forceCap = true; pageTok = null; return { kind: 'error', note: code + L(' \\u2192 \\u6b21\\u304b\\u3089 CapSolver', ' \\u2192 t\\u1eeb l\\u01b0\\u1ee3t sau d\\u00f9ng CapSolver') }; }\n    if (code === 'MODE_MISMATCH') { modeFlip(lastMode); return { kind: 'early', slotLevel: true, note: code }; }\n    if (WAIT_CODES[code]) return { kind: 'wait', ms: WAIT_CODES[code], note: `${code} ${d.message || ''}`.trim() };\n    if (r.status === 429) return { kind: 'wait', ms: 60e3, note: 'HTTP 429' };\n    if (EARLY_CODES.has(code)) return { kind: 'early', slotLevel: EARLY_SLOT.has(code), note: code };\n    if (STOP_CODES.has(code)) return { kind: 'stop', note: `${code} ${d.message || ''}` };\n    if (SKIP_CODES.has(code)) return { kind: 'skip', lost: true, note: code };\n    if (code === 'SYSTEM_BUSY' || r.status >= 500) return { kind: 'error', busy: true, note: `HTTP ${r.status} ${code} ${d.message || ''}` };\n    if (r.status === 401) return { kind: 'stop', note: L('\\u30ed\\u30b0\\u30a4\\u30f3\\u5207\\u308c\\uff08\\u518d\\u30ed\\u30b0\\u30a4\\u30f3\\u3057\\u3066\\u304f\\u3060\\u3055\\u3044\\uff09', 'h\\u1ebft phi\\u00ean \\u0111\\u0103ng nh\\u1eadp (h\\u00e3y \\u0111\\u0103ng nh\\u1eadp l\\u1ea1i)') };\n    return { kind: 'error', note: `HTTP ${r.status} ${code} ${d.message || ''}` };\n  }\n\n  // ms c\\u00f2n ph\\u1ea3i ch\\u1edd \\u0111\\u1ec3 l\\u1ea7n g\\u1eedi k\\u1ebf kh\\u00f4ng v\\u01b0\\u1ee3t 5 l\\u1ea7n / 62 gi\\u00e2y\n  function postWaitMs() {\n    const now = Date.now();\n    st.postTimes = (st.postTimes || []).filter((x) => x <= now && now - x < WIN_MS);\n    return st.postTimes.length >= WIN_POSTS ? st.postTimes[0] + WIN_MS - now : 0;\n  }\n  async function waitPostWin() { const __session = popupSession; \n    let w = postWaitMs();\n    if (w <= 0) return true;\n    log(L(`1\\u5206\\u9593\\u306e\\u9001\\u4fe1\\u4e0a\\u9650\\uff08${WIN_POSTS}\\u56de\\uff09\\u2192 ${Math.ceil(w / 1000)}\\u79d2\\u5f85\\u3063\\u3066\\u304b\\u3089\\u7d9a\\u3051\\u307e\\u3059\\uff08RATE_LIMIT \\u9632\\u6b62\\uff09`,\n          `\\u0110\\u00e3 g\\u1eedi ${WIN_POSTS} l\\u1ea7n trong 1 ph\\u00fat \\u2192 ch\\u1edd ${Math.ceil(w / 1000)} gi\\u00e2y r\\u1ed3i g\\u1eedi ti\\u1ebfp (tr\\u00e1nh RATE_LIMIT)`));\n    while (w > 0 && st.active) {\n      setStatus(L(`RATE_LIMIT \\u9632\\u6b62: \\u3042\\u3068 ${Math.ceil(w / 1000)}\\u79d2\\u3067\\u518d\\u958b`, `Tr\\u00e1nh RATE_LIMIT: ${Math.ceil(w / 1000)} gi\\u00e2y n\\u1eefa g\\u1eedi ti\\u1ebfp`));\n      await popupAwait(sleep(Math.min(w, 1000)), __session);\n      w = postWaitMs();\n    }\n    return st.active;\n  }\n\n  // ngh\\u1ec9 ms (v\\u1eabn d\\u1eebng \\u0111\\u01b0\\u1ee3c b\\u1eb1ng n\\u00fat D\\u1eebng), hi\\u1ec7n \\u0111\\u1ebfm ng\\u01b0\\u1ee3c; tr\\u1ea3 false n\\u1ebfu b\\u1ecb d\\u1eebng gi\\u1eefa ch\\u1eebng\n  async function waitActive(ms, label) { const __session = popupSession; \n    const end = Date.now() + ms;\n    while (st.active && Date.now() < end) {\n      const c = Math.ceil((end - Date.now()) / 1000);\n      setStatus(`${label}: ${c >= 3600 ? Math.floor(c / 3600) + 'h' + String(Math.floor(c % 3600 / 60)).padStart(2, '0') + 'm' : c >= 60 ? Math.floor(c / 60) + 'm' + String(c % 60).padStart(2, '0') + 's' : c + 's'}`);\n      await popupAwait(sleep(Math.min(1000, end - Date.now())), __session);\n    }\n    return st.active;\n  }\n\n  // Ch\\u1ea1y tr\\u00ean danh s\\u00e1ch ng\\u00e0y, d\\u1eebng khi tr\\u00fang / d\\u1eebng / tr\\u01b0\\u1ee3t \\u0111\\u1ee7 MAX_LOSE\n  async function runDates(dates, opt = {}) { const __session = popupSession; \n    let lose = 0, busyLeft = false, busyN = 0, earlyN = 0, waitN = 0, postsHere = 0;\n    const rq = useRq(), until = Date.now() + BUSY_UNTIL_MS, done = new Set();   // done: khung \\u0111\\u00e3 c\\u00f3 k\\u1ebft qu\\u1ea3, kh\\u1ecfi g\\u1eedi l\\u1ea1i\n    // \\u0111\\u1ebfm s\\u1ed1 l\\u1ea7n g\\u1eedi + khung \\u0111\\u00e3 tr\\u01b0\\u1ee3t TRONG NG\\u00c0Y (gi\\u1edd Nh\\u1eadt): b\\u1ea5m ch\\u1ea1y l\\u1ea1i c\\u0169ng kh\\u00f4ng g\\u1eedi qu\\u00e1 MAX_POSTS, kh\\u00f4ng g\\u1eedi l\\u1ea1i khung \\u0111\\u00e3 tr\\u01b0\\u1ee3t\n    const today = jstDateStr(jstNow());\n    dates = dates.filter((d) => d >= today);             // m\\u00e1y ch\\u1ee7 tr\\u1ea3 c\\u1ea3 ng\\u00e0y \\u0111\\u00e3 qua t\\u1edbi 13:00 -> kh\\u00f4ng t\\u1ed1n l\\u01b0\\u1ee3t g\\u1eedi cho ng\\u00e0y \\u0111\\u00f3\n    if (!dates.length) { finish(L('\\u7533\\u8fbc\\u3067\\u304d\\u308b\\u65e5\\u4ed8\\u304c\\u3042\\u308a\\u307e\\u305b\\u3093', 'Hi\\u1ec7n kh\\u00f4ng c\\u00f3 ng\\u00e0y n\\u00e0o \\u0111\\u1ec3 \\u0111\\u0103ng k\\u00fd')); return; }\n    if (st.postDay !== today) { st.postDay = today; st.posts = 0; st.lost = []; st.postTimes = []; save(K_STATE, st); }\n    const markLost = (k) => { if (!st.lost.includes(k)) { st.lost.push(k); save(K_STATE, st); } };\n    if (st.posts && !opt.quiet) log(L(`\\u4eca\\u65e5\\u306f\\u3059\\u3067\\u306b ${st.posts}\\u56de \\u9001\\u4fe1\\uff081\\u65e5 ${MAX_POSTS}\\u56de\\u30fb1\\u5206 ${WIN_POSTS}\\u56de\\u307e\\u3067\\uff09`, `H\\u00f4m nay \\u0111\\u00e3 g\\u1eedi ${st.posts} l\\u1ea7n (t\\u1ed1i \\u0111a ${MAX_POSTS}/ng\\u00e0y, ${WIN_POSTS}/ph\\u00fat)`));\n    if (!opt.quiet) log(rq ? L('\\u30e2\\u30fc\\u30c9: \\u30ea\\u30af\\u30a8\\u30b9\\u30c8\\uff08API \\u306b\\u76f4\\u63a5\\u9001\\u4fe1\\u3059\\u308b\\u306e\\u3067\\u753b\\u9762\\u306f\\u52d5\\u304d\\u307e\\u305b\\u3093\\u3002\\u7d50\\u679c\\u306f\\u3053\\u306e\\u30ed\\u30b0\\u306b\\u51fa\\u307e\\u3059\\uff09', 'Ch\\u1ebf \\u0111\\u1ed9 REQUEST (g\\u1eedi th\\u1eb3ng API n\\u00ean m\\u00e0n h\\u00ecnh KH\\u00d4NG chuy\\u1ec3n \\u0111\\u1ed9ng \\u2013 k\\u1ebft qu\\u1ea3 hi\\u1ec7n \\u1edf log n\\u00e0y)')\n           : L('\\u30e2\\u30fc\\u30c9: \\u753b\\u9762\\u64cd\\u4f5c\\uff08CapSolver \\u30ad\\u30fc\\u306a\\u3057\\uff09', 'Ch\\u1ebf \\u0111\\u1ed9 b\\u1ea5m giao di\\u1ec7n (ch\\u01b0a c\\u00f3 key CapSolver)'));\n    for (let pass = 1; ; pass++) {\n    busyLeft = false;\n    for (const date of dates) {\n      if (!st.active) return;\n      let tab = null;\n      if (!rq) {\n        tab = findDateTab(date);\n        if (!tab) {\n          if ((st.reloads || 0) < 2) {\n            if (!(await popupAwait(refreshDates(date), __session))) return;       // t\\u1ea3i l\\u1ea1i c\\u1ea3 trang -> script t\\u1ef1 ch\\u1ea1y ti\\u1ebfp\n            tab = findDateTab(date);\n          }\n          if (!tab) { log(L(`${date.slice(5)} \\u306e\\u65e5\\u4ed8\\u30dc\\u30bf\\u30f3\\u304c\\u898b\\u3064\\u304b\\u308a\\u307e\\u305b\\u3093\\uff08\\u30ed\\u30b0\\u30a4\\u30f3\\u72b6\\u614b\\u3092\\u78ba\\u8a8d\\uff09`, `Kh\\u00f4ng th\\u1ea5y n\\u00fat ng\\u00e0y ${date.slice(5)} tr\\u00ean trang (ki\\u1ec3m tra \\u0111\\u00e3 \\u0111\\u0103ng nh\\u1eadp ch\\u01b0a)`)); continue; }\n        }\n        tab.click();\n        await popupAwait(waitDateShown(date), __session);\n      }\n      // ng\\u00e0y m\\u1edbi m\\u1edf: khung n\\u00e0o c\\u0169ng c\\u00f2n ch\\u1ed7 -> kh\\u1ecfi h\\u1ecfi API slots (\\u0111\\u1ee1 0,2\\u20130,5 gi\\u00e2y); ng\\u00e0y c\\u0169 th\\u00ec h\\u1ecfi song song l\\u00fac ch\\u1edd trang v\\u1ebd khung\n      const slotsP = st.fresh ? Promise.resolve(null) : apiSlots(date);\n      if (!rq) await popupAwait(sleep(120), __session);                         // ch\\u1edd trang \\u0111\\u1ed5i sang khung c\\u1ee7a ng\\u00e0y v\\u1eeba b\\u1ea5m\n      const slotList = await popupAwait(slotsP, __session);\n      let order = slotOrder(slotList), refetched = false;\n      if (slotList && !order.length && !opt.quiet) log(L(`${date.slice(5)} \\u7a7a\\u304d\\u306a\\u3057`, `${date.slice(5).replace('-', '/')}: h\\u1ebft ch\\u1ed7`));\n      for (let oi = 0; oi < order.length; oi++) {\n        const t = order[oi];\n        if (!st.active) return;\n        if (done.has(date + t) || st.lost.includes(lostKey(date, t))) continue;\n        const md = date.slice(5).replace('-', '/');\n        let r, busyHere = 0, earlyHere = 0;\n        for (;;) {\n          if (st.posts >= MAX_POSTS) {\n            if (soft) soft.fatal = true;\n            finish(L(`\\u672c\\u65e5\\u306e\\u9001\\u4fe1\\u4e0a\\u9650\\uff08${MAX_POSTS}\\u56de\\uff09\\u306b\\u9054\\u3057\\u305f\\u306e\\u3067\\u505c\\u6b62\\uff08BLACKLIST \\u9632\\u6b62\\uff09`, `H\\u00f4m nay \\u0111\\u00e3 g\\u1eedi \\u0111\\u1ee7 ${MAX_POSTS} l\\u1ea7n \\u2013 d\\u1eebng (tr\\u00e1nh b\\u1ecb BLACKLISTED)`)); beep(1); return;\n          }\n          if (opt.maxPosts && postsHere >= opt.maxPosts) {\n            log(L(`\\u3053\\u306e\\u5e97\\u8217\\u306f ${postsHere}\\u56de \\u9001\\u4fe1 \\u2192 \\u5148\\u306b\\u4ed6\\u306e\\u5e97\\u8217\\u3078\\uff08\\u3042\\u3068\\u3067\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u67a0\\u3092\\u76e3\\u8996\\uff09`, `\\u0110\\u00e3 g\\u1eedi ${postsHere} l\\u1ea7n \\u1edf c\\u1eeda h\\u00e0ng n\\u00e0y \\u2192 sang c\\u1eeda h\\u00e0ng kia tr\\u01b0\\u1edbc (sau \\u0111\\u00f3 canh v\\u00e9 h\\u1ee7y)`));\n            return 'switch';\n          }\n          if (!(await popupAwait(waitPostWin(), __session))) return;\n          if (!rq) { log(L(`${md} ${t} \\u7533\\u8fbc\\u4e2d\\u2026`, `${md} ${t}: \\u0111ang b\\u1ea5m \\u0111\\u0103ng k\\u00fd\\u2026`)); setStatus(L(`${md} ${t} \\u7533\\u8fbc\\u4e2d\\u2026`, `\\u0110ang \\u0111\\u0103ng k\\u00fd ${md} ${t}\\u2026`)); }\n          const tSend = Date.now();                       // t\\u00ednh theo l\\u00fac G\\u1eecI, kh\\u00f4ng ph\\u1ea3i l\\u00fac m\\u00e1y ch\\u1ee7 tr\\u1ea3 l\\u1eddi\n          r = rq ? await popupAwait(rqTry(date, t), __session) : await popupAwait(trySlot(t), __session);\n          if ((r.kind !== 'skip' || r.lost) && !r.notSent) { st.posts = (st.posts || 0) + 1; postsHere++; postWaitMs(); st.postTimes.push(tSend); save(K_STATE, st); }   // skip \\u1edf giao di\\u1ec7n (kh\\u00f4ng th\\u1ea5y n\\u00fat) = ch\\u01b0a g\\u1eedi\n          if (!st.active) return;\n          if (r.busy) {\n            if (++busyN > BUSY_MAX) { finish(L(`\\u30b5\\u30fc\\u30d0\\u30fc\\u6df7\\u96d1\\u304c${BUSY_MAX}\\u56de\\u7d9a\\u3044\\u305f\\u306e\\u3067\\u505c\\u6b62`, `M\\u00e1y ch\\u1ee7 qu\\u00e1 t\\u1ea3i ho\\u1eb7c kh\\u00f4ng tr\\u1ea3 l\\u1eddi ${BUSY_MAX} l\\u1ea7n li\\u00ean ti\\u1ebfp \\u2013 d\\u1eebng`)); beep(1); return; }\n            if (++busyHere >= BUSY_PER_SLOT) break;            // khung n\\u00e0y qu\\u00e1 t\\u1ea3i 2 l\\u1ea7n -> sang khung k\\u1ebf, v\\u00f2ng sau quay l\\u1ea1i\n            const w = BUSY_WAITS[Math.min(busyN - 1, BUSY_WAITS.length - 1)];\n            log(L(`${md} ${t} \\u30b5\\u30fc\\u30d0\\u30fc\\u6df7\\u96d1: ${r.note} \\u2192 ${(w / 1000).toFixed(1)}\\u79d2\\u5f8c\\u306b\\u540c\\u3058\\u6642\\u9593\\u5e2f\\u3067\\u518d\\u9001`, `${md} ${t} m\\u00e1y ch\\u1ee7 qu\\u00e1 t\\u1ea3i: ${r.note} \\u2192 ${(w / 1000).toFixed(1)} gi\\u00e2y sau g\\u1eedi l\\u1ea1i \\u0111\\u00fang khung n\\u00e0y`));\n            await popupAwait(sleep(w), __session);\n          } else if (r.kind === 'wait') {\n            if (++waitN > WAIT_MAX) { finish(L(`\\u9001\\u4fe1\\u5236\\u9650\\u304c${WAIT_MAX}\\u56de\\u7d9a\\u3044\\u305f\\u306e\\u3067\\u505c\\u6b62`, `M\\u00e1y ch\\u1ee7 b\\u1eaft g\\u1eedi ch\\u1eadm l\\u1ea1i ${WAIT_MAX} l\\u1ea7n \\u2013 d\\u1eebng (tr\\u00e1nh b\\u1ecb ch\\u1eb7n)`)); beep(1); return; }\n            log(L(`${md} ${t} \\u9001\\u4fe1\\u5236\\u9650\\uff08${r.note}\\uff09\\u2192 ${Math.round(r.ms / 1000)}\\u79d2\\u5f85\\u3063\\u3066\\u540c\\u3058\\u6642\\u9593\\u5e2f\\u3067\\u518d\\u9001`,\n                  `${md} ${t} m\\u00e1y ch\\u1ee7 b\\u1eaft g\\u1eedi ch\\u1eadm l\\u1ea1i (${r.note}) \\u2192 ngh\\u1ec9 ${Math.round(r.ms / 1000)} gi\\u00e2y r\\u1ed3i g\\u1eedi l\\u1ea1i khung n\\u00e0y`));\n            if (!(await popupAwait(waitActive(r.ms, L('\\u9001\\u4fe1\\u5236\\u9650\\u3067\\u5f85\\u6a5f\\u4e2d', '\\u0110ang ngh\\u1ec9 do m\\u00e1y ch\\u1ee7 gi\\u1edbi h\\u1ea1n')), __session))) return;\n          } else if (r.kind === 'early') {\n            if (++earlyN > EARLY_MAX) { finish(L(`\\u53d7\\u4ed8\\u524d\\u306e\\u30a8\\u30e9\\u30fc\\u304c${EARLY_MAX}\\u56de\\u7d9a\\u3044\\u305f\\u306e\\u3067\\u505c\\u6b62`, `M\\u00e1y ch\\u1ee7 b\\u00e1o \"ch\\u01b0a m\\u1edf\" ${EARLY_MAX} l\\u1ea7n \\u2013 d\\u1eebng`)); beep(1); return; }\n            if (r.slotLevel && ++earlyHere >= EARLY_PER_SLOT) break;   // ri\\u00eang khung n\\u00e0y ch\\u01b0a m\\u1edf -> sang khung k\\u1ebf\n            log(L(`${md} ${t} \\u307e\\u3060\\u53d7\\u4ed8\\u524d\\uff08${r.note}\\uff09\\u2192 1.2\\u79d2\\u5f8c\\u306b\\u540c\\u3058\\u6642\\u9593\\u5e2f\\u3067\\u518d\\u9001`, `${md} ${t} ch\\u01b0a m\\u1edf (${r.note}) \\u2192 1,2 gi\\u00e2y sau g\\u1eedi l\\u1ea1i \\u0111\\u00fang khung n\\u00e0y`));\n            await popupAwait(sleep(EARLY_GAP_MS), __session);\n          } else break;\n          if (!rq) { const tb = findDateTab(date); if (tb) { tb.click(); await popupAwait(waitDateShown(date), __session); } await popupAwait(sleep(150), __session); }\n        }\n        if (r.kind === 'skip' && !r.lost) log(L(`${md} ${t} \\u30b9\\u30ad\\u30c3\\u30d7: ${r.note}`, `${md} ${t} b\\u1ecf qua: ${r.note}`));\n        if (!r.busy && r.kind !== 'early') done.add(date + t);\n        if (r.kind === 'lose' || r.lost) markLost(lostKey(date, t));\n        if (r.kind === 'early') { busyLeft = true; log(L(`${md} ${t} \\u307e\\u3060\\u53d7\\u4ed8\\u524d \\u2192 \\u6b21\\u306e\\u6642\\u9593\\u5e2f\\u3078`, `${md} ${t} v\\u1eabn ch\\u01b0a m\\u1edf \\u2192 sang khung k\\u1ebf`)); }\n        if (r.lost) { log(L(`${md} ${t} \\u2192 \\u6b21\\u306e\\u6642\\u9593\\u5e2f: ${r.note}`, `${md} ${t} \\u2192 sang khung k\\u1ebf: ${r.note}`)); await popupAwait(sleep(GAP_MS), __session); }\n        // ng\\u00e0y m\\u1edbi g\\u1eedi m\\u00f9 theo th\\u1ee9 t\\u1ef1 \\u01b0u ti\\u00ean; g\\u1eb7p khung \\u0111\\u1ea7y -> h\\u1ecfi API 1 l\\u1ea7n, ch\\u1ec9 gi\\u1eef khung c\\u00f2n ch\\u1ed7 (kh\\u00f4ng t\\u1ed1n l\\u01b0\\u1ee3t v\\u00e0o khung \\u0111\\u1ea7y)\n        if (r.lost && st.fresh && rq && !refetched && st.active) {\n          refetched = true;\n          try {\n            const fl = await popupAwait(apiSlots(date), __session);\n            if (fl) {\n              const tried = order.slice(0, oi + 1), nx = slotOrder(fl).filter((x) => !tried.includes(x));\n              order = tried.concat(nx);\n              log(L(`${md} \\u7a7a\\u304d\\u67a0\\u3092\\u518d\\u78ba\\u8a8d: \\u6b8b\\u308a ${nx.length}\\u67a0`, `${md}: \\u0111\\u1ecdc l\\u1ea1i khung c\\u00f2n ch\\u1ed7 \\u2192 c\\u00f2n ${nx.length} khung`));\n            }\n          } catch (e) { if (e && e.cancelled) throw e; }\n        }\n        if (r.kind === 'won' && soft) soft.won = { md, t, applied: !!r.applied };\n        if (r.kind === 'won' && r.applied) {\n          finish(L(`\\u2705 \\u62bd\\u9078\\u306b\\u7533\\u8fbc\\u5b8c\\u4e86 ${md} ${t}\\uff08\\u62bd\\u9078: ${r.draw || '\\u5f8c\\u65e5'}\\u30fb\\u7d50\\u679c\\u306f\\u30e1\\u30fc\\u30eb/SMS\\u3067\\u5c4a\\u304d\\u307e\\u3059\\uff09`, `\\u2705 \\u0110\\u00c3 \\u0110\\u0102NG K\\u00dd B\\u1ed0C TH\\u0102M ${md} ${t} (b\\u1ed1c th\\u0103m: ${r.draw || 'sau'} \\u2013 k\\u1ebft qu\\u1ea3 g\\u1eedi qua mail/SMS)`)); beep(2);\n          return;\n        }\n        if (r.kind === 'won') {\n          finish(L(`\\ud83c\\udf89 \\u5f53\\u9078\\uff01 ${md} ${t}`, `\\ud83c\\udf89 TR\\u00daNG V\\u00c9! ${md} ${t}`)); beep(3);\n          synovaNotify([{ author: '\\u2705 Lottery Won', title: `MelloJoy \\u5165\\u5834\\u5238 ${md} ${t}`, url: location.origin + '/register',\n            fields: [['\\u5e97\\u8217', storeName() || ''], ['\\u6765\\u5e97\\u65e5', md], ['\\u6642\\u9593', t], ['Site', location.hostname, false]] }]);   // 19/11: th\\u00eam t\\u00ean c\\u1eeda h\\u00e0ng\n          if (rq && !soft) setTimeout(() => { location.href = '/my-tickets'; }, 1500);   // m\\u1edf trang v\\u00e9 \\u0111\\u1ec3 xem v\\u00e9 v\\u1eeba tr\\u00fang\n          return;\n        }\n        if (r.kind === 'stop' && soft && (r.uiNext || r.nextDay)) {   // t\\u1ea5t c\\u1ea3 c\\u1eeda h\\u00e0ng: kh\\u00f4ng chuy\\u1ec3n sang b\\u1ea5m giao di\\u1ec7n / kh\\u00f4ng ch\\u1edd t\\u1edbi 0:00 \\u1edf gi\\u1eefa ch\\u1eebng\n          if (r.uiNext) soft.fatal = true;\n          soft.block = true;\n          finish(L('\\u505c\\u6b62: ', 'D\\u1eebng: ') + r.note); beep(1); return;\n        }\n        if (r.kind === 'stop' && r.uiNext && st.active) {\n          log(L(`${r.note} \\u2192 \\u753b\\u9762\\u64cd\\u4f5c\\u30e2\\u30fc\\u30c9\\u306b\\u5207\\u66ff\\uff08\\u30c1\\u30a7\\u30c3\\u30af\\u3092\\u81ea\\u5206\\u3067\\u30bf\\u30c3\\u30d7\\uff09`, `${r.note} \\u2192 chuy\\u1ec3n sang ch\\u1ebf \\u0111\\u1ed9 b\\u1ea5m giao di\\u1ec7n (b\\u1ea1n t\\u1ef1 b\\u1ea5m \\u00f4 x\\u00e1c nh\\u1eadn Cloudflare)`)); beep(1);\n          return runDates(dates, opt);\n        }\n        if (r.kind === 'stop' && r.nextDay) {\n          const n = jstNow(), ms = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1, 0, 0, 30) - n.getTime();\n          log(L(`${r.note} \\u2192 \\u660e\\u65e5 0:00\\uff08\\u65e5\\u672c\\u6642\\u9593\\uff09\\u307e\\u3067\\u5f85\\u3063\\u3066\\u81ea\\u52d5\\u3067\\u518d\\u958b\\uff08\\u3053\\u306e\\u30da\\u30fc\\u30b8\\u3092\\u958b\\u3044\\u305f\\u307e\\u307e\\uff09`,\n                `${r.note} \\u2192 ch\\u1edd t\\u1edbi 0:00 gi\\u1edd Nh\\u1eadt r\\u1ed3i t\\u1ef1 ch\\u1ea1y l\\u1ea1i (gi\\u1eef trang n\\u00e0y m\\u1edf)`)); beep(1);\n          if (!(await popupAwait(waitActive(ms, L('\\u660e\\u65e5 0:00 \\u307e\\u3067\\u5f85\\u6a5f', 'Ch\\u1edd t\\u1edbi 0:00 gi\\u1edd Nh\\u1eadt')), __session))) return;\n          log(L('0:00 \\u306b\\u306a\\u308a\\u307e\\u3057\\u305f \\u2192 \\u518d\\u958b', '\\u0110\\u00e3 sang ng\\u00e0y m\\u1edbi (gi\\u1edd Nh\\u1eadt) \\u2192 ch\\u1ea1y l\\u1ea1i'));\n          return startNow();\n        }\n        if (r.kind === 'stop') { if (soft) soft.block = true; finish(L('\\u505c\\u6b62: ', 'D\\u1eebng: ') + r.note); beep(1); return; }\n        if (r.kind === 'lose') { lose++; log(L(`${md} ${t} \\u843d\\u9078 (${lose}/${MAX_LOSE})`, `${md} ${t} tr\\u01b0\\u1ee3t (${lose}/${MAX_LOSE})`)); if (lose >= MAX_LOSE) { finish(L(`${MAX_LOSE}\\u56de\\u7d9a\\u3051\\u3066\\u843d\\u9078 \\u2192 \\u505c\\u6b62`, `Tr\\u01b0\\u1ee3t ${MAX_LOSE} l\\u1ea7n li\\u00ean ti\\u1ebfp \\u2013 d\\u1eebng`)); return; } await popupAwait(sleep(GAP_MS), __session); }\n        if (r.kind === 'error') {\n          if (r.busy) { busyLeft = true; log(L(`${md} ${t} \\u6df7\\u96d1\\u304c\\u7d9a\\u304f \\u2192 \\u6b21\\u306e\\u6642\\u9593\\u5e2f\\u3078\\uff08\\u5f8c\\u3067\\u3082\\u3046\\u4e00\\u5ea6\\uff09`, `${md} ${t} v\\u1eabn qu\\u00e1 t\\u1ea3i \\u2192 sang khung k\\u1ebf (v\\u00f2ng sau th\\u1eed l\\u1ea1i)`)); }\n          else log(L(`${md} ${t} \\u30a8\\u30e9\\u30fc: ${r.note}`, `${md} ${t} l\\u1ed7i: ${r.note}`));\n          await popupAwait(sleep(r.busy ? BUSY_WAITS[Math.min(busyN, BUSY_WAITS.length - 1)] : 1500), __session);\n        }\n        if (!rq) { tab = findDateTab(date); if (tab) { tab.click(); await popupAwait(waitDateShown(date), __session); } await popupAwait(sleep(150), __session); }\n      }\n    }\n    // ch\\u1ebf \\u0111\\u1ed9 request: khung n\\u00e0o ch\\u1ec9 b\\u1ecb qu\\u00e1 t\\u1ea3i (ch\\u01b0a x\\u00e9t) th\\u00ec quay l\\u1ea1i th\\u1eed ti\\u1ebfp, kh\\u00f4ng b\\u00e1o nh\\u1ea7m \"h\\u1ebft khung\"\n    if (!rq || !busyLeft || !st.active || Date.now() > until) break;\n    log(L(`\\u6df7\\u96d1\\u30fb\\u53d7\\u4ed8\\u524d \\u2192 \\u7d50\\u679c\\u306e\\u51fa\\u3066\\u3044\\u306a\\u3044\\u6642\\u9593\\u3092\\u3082\\u3046\\u4e00\\u5ea6\\uff08${pass + 1}\\u5468\\u76ee\\uff09`, `Qu\\u00e1 t\\u1ea3i / ch\\u01b0a m\\u1edf \\u2192 th\\u1eed l\\u1ea1i c\\u00e1c khung ch\\u01b0a c\\u00f3 k\\u1ebft qu\\u1ea3 (v\\u00f2ng ${pass + 1})`));\n    }\n    if (opt.watch && !busyLeft && st.active) return 'nofree';\n    finish(busyLeft ? L('\\u30b5\\u30fc\\u30d0\\u30fc\\u6df7\\u96d1\\u304c\\u7d9a\\u3044\\u305f\\u305f\\u3081\\u505c\\u6b62', 'M\\u00e1y ch\\u1ee7 qu\\u00e1 t\\u1ea3i li\\u00ean t\\u1ee5c \\u2013 d\\u1eebng')\n                    : L('\\u7a7a\\u3044\\u3066\\u3044\\u308b\\u6642\\u9593\\u306a\\u3057', 'Kh\\u00f4ng c\\u00f2n khung tr\\u1ed1ng'));\n  }\n\n  // ================= Ch\\u1ebf \\u0111\\u1ed9 REQUEST (gi\\u1ed1ng b\\u1ea3n PC SYNOVAJOY BOT PC) =================\n  // Kh\\u00f4ng b\\u1ea5m giao di\\u1ec7n: g\\u1eedi th\\u1eb3ng POST /api/registrations y nh\\u01b0 trang g\\u1eedi:\n  //  - token \\u0111\\u0103ng nh\\u1eadp: trang l\\u01b0u \\u1edf localStorage 'h5.accessToken' (h\\u1ebft h\\u1ea1n -> POST /api/user-auth/refresh b\\u1eb1ng cookie)\n  //  - deviceFingerprint: t\\u00ednh \\u0111\\u00fang c\\u00f4ng th\\u1ee9c c\\u1ee7a trang tr\\u00ean ch\\u00ednh m\\u00e1y n\\u00e0y (ra c\\u00f9ng gi\\u00e1 tr\\u1ecb trang g\\u1eedi)\n  //  - GPS: v\\u1ecb tr\\u00ed th\\u1eadt c\\u1ee7a m\\u00e1y (\\u0111o s\\u1eb5n t\\u1eeb 12:59) ; turnstileToken: CapSolver gi\\u1ea3i s\\u1eb5n\n  // B\\u1eaft bu\\u1ed9c c\\u00f3 key CapSolver (kh\\u00f4ng c\\u00f3 token Turnstile th\\u00ec m\\u00e1y ch\\u1ee7 tr\\u1ea3 TURNSTILE_INVALID) -> kh\\u00f4ng c\\u00f3 key th\\u00ec b\\u1ea5m giao di\\u1ec7n nh\\u01b0 c\\u0169.\n  // V\\u1eabn g\\u1eedi L\\u1ea6N L\\u01af\\u1ee2T t\\u1eebng khung (kh\\u00f4ng song song): g\\u1eedi song song t\\u1eebng l\\u00e0m 1 TK tr\\u00fang nhi\\u1ec1u v\\u00e9 c\\u00f9ng ng\\u00e0y (b\\u1ea3n PC 1/10).\n  const POLL_MAX_INFLIGHT = 8;\n  let pollInflight = 0, pollFound = null, pollWake = null;\n  const useRq = () => capOn();\n  const K_TOK = 'h5.accessToken';\n  const getTok = () => { try { return localStorage.getItem(K_TOK) || ''; } catch (e) { return ''; } };\n  function jwtExp(t) { try { return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp * 1000 || 0; } catch (e) { return 0; } }\n  let refreshP = null;\n  function rqRefresh() {\n    if (!refreshP) refreshP = rqRefresh1().finally(() => { refreshP = null; });\n    return refreshP;\n  }\n  async function rqRefresh1() { const __session = popupSession; \n    try {\n      const r = await popupAwait(_fetch('/api/user-auth/refresh', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } }), __session);\n      const j = unwrap(await popupAwait(r.json().catch(() => ({})), __session)) || {};\n      if (r.ok && j.accessToken) { localStorage.setItem(K_TOK, j.accessToken); return j.accessToken; }\n    } catch (e) { if (e && e.cancelled) throw e; }\n    return '';\n  }\n  let rqWarmAt = 0;\n  // tr\\u01b0\\u1edbc gi\\u1edd m\\u1edf: token s\\u1eafp h\\u1ebft h\\u1ea1n (< 5 ph\\u00fat) th\\u00ec l\\u00e0m m\\u1edbi lu\\u00f4n, kh\\u1ecfi m\\u1ea5t 1 v\\u00f2ng 401 l\\u00fac 13:00\n  function rqWarmToken() {\n    if (!useRq() || Date.now() - rqWarmAt < 60e3) return;\n    rqWarmAt = Date.now();\n    const exp = jwtExp(getTok());\n    if (!getTok() || (exp && exp - Date.now() < 5 * 60e3)) rqRefresh();\n  }\n  // deviceFingerprint: ch\\u00e9p \\u0111\\u00fang h\\u00e0m Zc() c\\u1ee7a trang (UA|ng\\u00f4n ng\\u1eef|m\\u00e0n h\\u00ecnh|m\\u00fai gi\\u1edd|CPU|deviceId|canvas -> FNV-1a)\n  let fpCache = '';\n  function deviceId() {\n    try {\n      let id = localStorage.getItem('h5.deviceId');\n      if (id) return id;\n      id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;\n      localStorage.setItem('h5.deviceId', id);\n      return id;\n    } catch (e) { return ''; }\n  }\n  function pageFp() {\n    if (fpCache) return fpCache;\n    try {\n      const a = [navigator.userAgent, navigator.language, `${screen.width}x${screen.height}x${screen.colorDepth}`,\n        Intl.DateTimeFormat().resolvedOptions().timeZone ?? '', String(navigator.hardwareConcurrency ?? 0), deviceId()];\n      const c = document.createElement('canvas');\n      c.width = 240; c.height = 60;\n      const g = c.getContext('2d');\n      if (g) {\n        g.textBaseline = 'top'; g.font = \"14px 'Arial'\"; g.fillStyle = '#d34325'; g.fillRect(2, 2, 80, 20);\n        g.fillStyle = '#161310'; g.fillText('\\u5165\\u5834\\u5238\\u00b7Backstage\\u00b72026', 4, 4);\n        g.strokeStyle = 'rgba(22,19,16,0.4)'; g.beginPath(); g.arc(180, 30, 18, 0, Math.PI * 2); g.stroke();\n        a.push(c.toDataURL());\n      }\n      const o = a.join('|');\n      let h = 2166136261;\n      for (let k = 0; k < o.length; k++) { h ^= o.charCodeAt(k); h = h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0; }\n      fpCache = h.toString(16).padStart(8, '0') + '-' + o.length.toString(16);\n    } catch (e) {\n      try { fpCache = localStorage.getItem('h5.fallbackFp') || ''; } catch (e2) {}\n    }\n    return fpCache;\n  }\n  // GPS th\\u1eadt: v\\u1ecb tr\\u00ed \\u0111o s\\u1eb5n \\u2264 30 gi\\u00e2y, ch\\u01b0a c\\u00f3 th\\u00ec \\u0111o ngay (t\\u1ed1i \\u0111a 10 gi\\u00e2y nh\\u01b0 trang)\n  function rqGps() {\n    // \\u0111\\u1ee9ng y\\u00ean th\\u00ec watchPosition \\u00edt b\\u00e1o m\\u1edbi; v\\u1ecb tr\\u00ed th\\u1eadt \\u0111o trong 2 ph\\u00fat v\\u1eabn h\\u1ee3p l\\u1ec7 -> l\\u1ea7n g\\u1eedi l\\u1ea1i kh\\u00f4ng m\\u1ea5t th\\u00eam v\\u00e0i gi\\u00e2y \\u0111o GPS\n    if (geoLast && Date.now() - geoLast.at < 120e3) return Promise.resolve(geoLast.p.coords);\n    return new Promise((res) => {\n      if (!geoOrig) return res(null);\n      setTimeout(() => res(null), 12e3);                 // iPhone c\\u00f3 l\\u00fac kh\\u00f4ng g\\u1ecdi l\\u1ea1i (\\u0111ang ch\\u1edd cho ph\\u00e9p v\\u1ecb tr\\u00ed) -> kh\\u00f4ng \\u0111\\u1ee9ng im\n      geoOrig((p) => { geoLast = { p, at: Date.now() }; res(p.coords); }, () => res(null), { enableHighAccuracy: true, timeout: 10e3, maximumAge: 0 });\n    });\n  }\n  async function rqRegister(date, idx, label) { const __session = popupSession; \n    setStatus(L(`${label} \\u4f4d\\u7f6e\\u60c5\\u5831\\u3068\\u8a8d\\u8a3c\\u3092\\u6e96\\u5099\\u4e2d\\u2026`, `${label}: \\u0111ang l\\u1ea5y GPS + token\\u2026`));\n    const gps = await popupAwait(rqGps(), __session);\n    const ts = gps ? await popupAwait(tsTake(), __session) : null;\n    if (!gps) return { status: 0, noGps: true, notSent: true, data: { message: L('\\u4f4d\\u7f6e\\u60c5\\u5831\\u3092\\u53d6\\u5f97\\u3067\\u304d\\u307e\\u305b\\u3093\\uff08Safari \\u306e\\u4f4d\\u7f6e\\u60c5\\u5831\\u3092\\u8a31\\u53ef\\u3057\\u3066\\u304f\\u3060\\u3055\\u3044\\uff09', 'kh\\u00f4ng l\\u1ea5y \\u0111\\u01b0\\u1ee3c v\\u1ecb tr\\u00ed GPS (h\\u00e3y cho Safari d\\u00f9ng v\\u1ecb tr\\u00ed)') } };\n    // key chung v\\u1eeba h\\u1ebft l\\u01b0\\u1ee3t / h\\u1ebft ti\\u1ec1n -> chuy\\u1ec3n sang b\\u1ea5m giao di\\u1ec7n (ng\\u01b0\\u1eddi d\\u00f9ng t\\u1ef1 b\\u1ea5m \\u00f4 x\\u00e1c nh\\u1eadn Cloudflare)\n    if (!ts && !capOn()) return { status: 0, noGps: true, notSent: true, uiNext: true, data: { message: relayOffMsg || capLastErr } };\n    if (!ts && /KEY|BALANCE|ZERO|DENIED|INVALID/i.test(capLastErr)) return { status: 0, noGps: true, notSent: true, data: { message: L('CapSolver \\u30ad\\u30fc\\u304c\\u7121\\u52b9\\u307e\\u305f\\u306f\\u6b8b\\u9ad8\\u4e0d\\u8db3: ', 'key CapSolver sai ho\\u1eb7c h\\u1ebft ti\\u1ec1n: ') + capLastErr } };\n    if (!ts) return { status: 0, notSent: true, data: { message: L('Turnstile \\u30c8\\u30fc\\u30af\\u30f3\\u306a\\u3057', 'kh\\u00f4ng c\\u00f3 token Cloudflare') } };\n    tsUsed.add(ts);\n    const sid = storeId(), md = await popupAwait(storeMode(), __session);\n    lastMode = md;\n    if (!sid) return { status: 0, noGps: true, notSent: true, data: { message: noStore().message } };\n    // \\u0111\\u00fang t\\u00ean tr\\u01b0\\u1eddng trang g\\u1eedi (17/11): store_id, slotDate, slotIndex, deviceFingerprint, gpsLat, gpsLng, turnstileToken, mode\n    const body = JSON.stringify({ store_id: sid, slotDate: date, slotIndex: idx, deviceFingerprint: pageFp(), gpsLat: gps.latitude, gpsLng: gps.longitude, turnstileToken: ts, ...(md ? { mode: md } : {}) });\n    for (let k = 0; k < 2; k++) {\n      // m\\u00e1y ch\\u1ee7 hay tr\\u1ea3 l\\u1eddi \\u1edf gi\\u00e2y 16\\u201319 l\\u00fac \\u0111\\u00f4ng -> ch\\u1edd t\\u1edbi 30 gi\\u00e2y (trang ch\\u1ec9 ch\\u1edd 20 gi\\u00e2y r\\u1ed3i b\\u1ecf)\n      const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 30e3), t0 = Date.now();\n      log(L(`${label} \\u9001\\u4fe1 \\u2192 \\u30b5\\u30fc\\u30d0\\u30fc\\u306e\\u5fdc\\u7b54\\u5f85\\u3061\\uff08\\u6700\\u592730\\u79d2\\uff09`, `${label}: \\u0111\\u00e3 g\\u1eedi \\u2192 ch\\u1edd m\\u00e1y ch\\u1ee7 tr\\u1ea3 l\\u1eddi (t\\u1ed1i \\u0111a 30 gi\\u00e2y)`));\n      const tick = setInterval(() => popupSession === __session && setStatus(L(`${label} \\u5fdc\\u7b54\\u5f85\\u3061 ${Math.round((Date.now() - t0) / 1000)}\\u79d2`, `${label}: ch\\u1edd m\\u00e1y ch\\u1ee7 ${Math.round((Date.now() - t0) / 1000)} gi\\u00e2y`)), 1000);\n      try {\n        regSent();\n        const r = await popupAwait(_fetch('/api/registrations', { method: 'POST', credentials: 'include', signal: ac.signal,\n          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getTok() }, body }), __session);\n        const t = await popupAwait(r.text(), __session);\n        let j = {};\n        try { j = JSON.parse(t) || {}; } catch (e) { if (e && e.cancelled) throw e; }\n        if (r.status === 401 && k === 0 && await popupAwait(rqRefresh(), __session)) continue;   // phi\\u00ean h\\u1ebft h\\u1ea1n -> l\\u00e0m m\\u1edbi r\\u1ed3i g\\u1eedi l\\u1ea1i 1 l\\u1ea7n\n        return { status: r.status, data: j };\n      } catch (e) { if (e && e.cancelled) throw e; \n        return { status: 0, data: { message: e.name === 'AbortError' ? L('\\u5fdc\\u7b54\\u306a\\u3057(30\\u79d2)', 'kh\\u00f4ng ph\\u1ea3n h\\u1ed3i (30 gi\\u00e2y)') : e.message } };\n      } finally { clearTimeout(tm); clearInterval(tick); }\n    }\n    return { status: 401, data: {} };\n  }\n  async function rqTry(date, t) { const __session = popupSession; \n    const idx = slotIdx[date + '#' + t] || slotTimes().indexOf(t) + 1;   // \\u01b0u ti\\u00ean slotIndex m\\u00e1y ch\\u1ee7; ng\\u00e0y v\\u1eeba m\\u1edf ch\\u01b0a h\\u1ecfi: 10:30 = khung 1, 11:30 = khung 2\\u2026\n    const t0 = Date.now();\n    const r = await popupAwait(rqRegister(date, idx, `${date.slice(5).replace('-', '/')} ${t}`), __session);\n    // kh\\u00f4ng tr\\u1ea3 l\\u1eddi / r\\u1edbt m\\u1ea1ng = CH\\u01afA bi\\u1ebft k\\u1ebft qu\\u1ea3 -> g\\u1eedi l\\u1ea1i nh\\u01b0 qu\\u00e1 t\\u1ea3i, kh\\u00f4ng b\\u1ecf khung. Ch\\u01b0a g\\u1eedi \\u0111\\u01b0\\u1ee3c th\\u00ec kh\\u00f4ng t\\u1ed1n l\\u01b0\\u1ee3t\n    const out = r.status ? parseReg(r)\n      : !r.notSent ? { kind: 'stop', pending: true, note: '申込結果を確認できません。申込履歴を確認してから再実行してください。' }\n      : r.noGps ? { kind: 'stop', notSent: true, uiNext: !!r.uiNext, note: r.data.message || '' }\n      : { kind: 'error', busy: true, notSent: !!r.notSent, note: r.data.message || '' };\n    if (st.active && out.kind !== 'won' && out.kind !== 'stop') tsFill(st.fresh ? TS_POOL : 1);   // c\\u00f2n th\\u1eed ti\\u1ebfp m\\u1edbi gi\\u1ea3i b\\u00f9 token (tr\\u00fang r\\u1ed3i th\\u00ec th\\u00f4i, \\u0111\\u1ee1 t\\u1ed1n)\n    out.note = `${out.note} \\u00b7 ${Date.now() - t0}ms`;\n    return out;\n  }\n\n  // ================= Ch\\u1ebf \\u0111\\u1ed9 =================\n  // st.mode: 'wait' (ch\\u1edd ng\\u00e0y m\\u1edbi 13:00) | 'run' (\\u0111ang \\u0111\\u1eb7t) ; st.active\n  const st = load(K_STATE, { active: false });\n\n  // gi\\u1eef m\\u00e0n h\\u00ecnh s\\u00e1ng khi ch\\u1edd / \\u0111ang \\u0111\\u1eb7t (Safari kh\\u00f3a m\\u00e0n h\\u00ecnh = trang ng\\u1ee7, BOT kh\\u00f4ng ch\\u1ea1y)\n  let wakeLock = null;\n  async function keepAwake() { const __session = popupSession; \n    try { if (st.active && !wakeLock && navigator.wakeLock) { wakeLock = await popupAwait(navigator.wakeLock.request('screen'), __session); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (e) { if (e && e.cancelled) throw e; }\n  }\n  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') keepAwake(); });\n  async function modeWait() { const __session = popupSession; \n    setStatus(L('13:00 \\u5f85\\u6a5f\\u4e2d', 'Ch\\u1edd 13:00 gi\\u1edd Nh\\u1eadt'));\n    keepAwake();\n    if (!st.openAt) { st.openAt = nextOpenAt(); save(K_STATE, st); }\n    let lastTick = Date.now(), pollStartLogged = false, pollN = 0, errN = 0, errLogAt = 0, beatAt = 0;\n    while (st.active && st.mode === 'wait') {\n      // Safari cho trang \"ng\\u1ee7\" (kh\\u00f3a m\\u00e0n h\\u00ecnh / chuy\\u1ec3n app / tab n\\u1ec1n) -> v\\u00f2ng l\\u1eb7p \\u0111\\u1ee9ng; th\\u1ee9c d\\u1eady th\\u00ec b\\u00e1o cho bi\\u1ebft\n      const gap = Date.now() - lastTick; lastTick = Date.now();\n      if (gap > 5000) log(L(`\\u26a0\\ufe0f \\u30da\\u30fc\\u30b8\\u304c ${Math.round(gap / 1000)}\\u79d2 \\u505c\\u6b62\\u3057\\u3066\\u3044\\u307e\\u3057\\u305f\\uff08\\u753b\\u9762\\u30ed\\u30c3\\u30af / Safari \\u3092\\u88cf\\u306b\\u56de\\u3057\\u305f\\uff09`, `\\u26a0\\ufe0f Trang b\\u1ecb Safari cho ng\\u1ee7 ${Math.round(gap / 1000)} gi\\u00e2y (kh\\u00f3a m\\u00e0n h\\u00ecnh / chuy\\u1ec3n app) \\u2013 BOT kh\\u00f4ng ch\\u1ea1y trong l\\u00fac \\u0111\\u00f3`));\n      const left = msToOpen();\n      if (left < 60e3) { tsFill(TS_POOL); geoWarm(); rqWarmToken(); }   // t\\u1eeb 12:59:00 gi\\u1ea3i s\\u1eb5n token CapSolver + \\u0111o s\\u1eb5n GPS + l\\u00e0m m\\u1edbi phi\\u00ean\n      if (left > WATCH_FROM_SEC * 1000) {\n        const s = Math.ceil(left / 1000);\n        setStatus(L('\\u30b9\\u30bf\\u30fc\\u30c8\\u307e\\u3067 ', 'C\\u00f2n t\\u1edbi 13:00 ') + `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`);\n        await popupAwait(sleep(Math.min(1000, left - WATCH_FROM_SEC * 1000)), __session);\n        continue;\n      }\n      if (left < -10 * 60e3 && wantDays().length) {\n        log(L('13:10 \\u307e\\u3067\\u6307\\u5b9a\\u65e5\\u306e\\u65b0\\u3057\\u3044\\u67a0\\u306a\\u3057 \\u2192 \\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u67a0\\u306e\\u76e3\\u8996\\u306b\\u5207\\u66ff', 'Qu\\u00e1 13:10 ch\\u01b0a th\\u1ea5y ng\\u00e0y ch\\u1ec9 \\u0111\\u1ecbnh m\\u1edf \\u2192 chuy\\u1ec3n sang canh v\\u00e9 h\\u1ee7y c\\u1ee7a c\\u00e1c ng\\u00e0y \\u0111\\u00f3'));\n        st.mode = null; save(K_STATE, st);\n        return startNowImpl();\n      }\n      if (left < -10 * 60e3) {\n        finish(L(`13:10\\u307e\\u3067\\u65b0\\u3057\\u3044\\u65e5\\u4ed8\\u306a\\u3057 \\u2192 \\u505c\\u6b62\\uff08\\u78ba\\u8a8d ${pollN}\\u56de\\u30fb\\u30a8\\u30e9\\u30fc ${errN}\\u56de\\uff09`, `Qu\\u00e1 13:10 ch\\u01b0a th\\u1ea5y ng\\u00e0y m\\u1edbi \\u2013 d\\u1eebng (\\u0111\\u00e3 d\\u00f2 ${pollN} l\\u1ea7n, l\\u1ed7i ${errN} l\\u1ea7n)`)); beep(1); return;\n      }\n      if (!pollStartLogged) {\n        pollStartLogged = true;\n        log(L(`\\u65b0\\u3057\\u3044\\u65e5\\u4ed8\\u306e\\u78ba\\u8a8d\\u3092\\u958b\\u59cb\\uff08\\u4eca\\u3042\\u308b\\u65e5\\u4ed8: ${st.known.map((d) => d.slice(5)).join(', ') || '\\u306a\\u3057'}\\uff09`, `B\\u1eaft \\u0111\\u1ea7u d\\u00f2 ng\\u00e0y m\\u1edbi (ng\\u00e0y \\u0111ang c\\u00f3: ${st.known.map((d) => d.slice(5)).join(', ') || 'kh\\u00f4ng c\\u00f3'})`));\n      }\n      if (Date.now() - beatAt > 10e3) {        // 10 gi\\u00e2y 1 d\\u00f2ng: cho bi\\u1ebft BOT v\\u1eabn \\u0111ang d\\u00f2\n        if (beatAt) log(L(`\\u78ba\\u8a8d\\u4e2d\\u2026 ${pollN}\\u56de\\uff08\\u30a8\\u30e9\\u30fc ${errN}\\u56de\\uff09`, `V\\u1eabn \\u0111ang d\\u00f2 ng\\u00e0y m\\u1edbi\\u2026 ${pollN} l\\u1ea7n (l\\u1ed7i ${errN} l\\u1ea7n)`));\n        beatAt = Date.now();\n      }\n      tsFill(TS_POOL);                        // 12:59:50: gi\\u1ea3i s\\u1eb5n token, ng\\u00e0y m\\u1edbi ra l\\u00e0 b\\u1ea5m \\u0111\\u01b0\\u1ee3c ngay\n      setStatus(L('\\u65b0\\u3057\\u3044\\u65e5\\u4ed8\\u3092\\u78ba\\u8a8d\\u4e2d\\u2026', '\\u0110ang d\\u00f2 ng\\u00e0y m\\u1edbi\\u2026'));\n      // nh\\u01b0 b\\u1ea3n PC: c\\u1ee9 POLL_MS b\\u1eafn 1 l\\u01b0\\u1ee3t h\\u1ecfi bookable-dates, KH\\u00d4NG ch\\u1edd l\\u01b0\\u1ee3t tr\\u01b0\\u1edbc tr\\u1ea3 l\\u1eddi\n      // (m\\u00e1y ch\\u1ee7 l\\u00fac 13:00 c\\u00f3 khi tr\\u1ea3 l\\u1eddi 2\\u20138 gi\\u00e2y); l\\u01b0\\u1ee3t n\\u00e0o th\\u1ea5y ng\\u00e0y m\\u1edbi tr\\u01b0\\u1edbc th\\u00ec ch\\u1ea1y ngay\n      // 18/11 c\\u1eeda h\\u00e0ng m\\u1edf khung theo ng\\u00e0y (\\u6e0b\\u8c37PARCO): ng\\u00e0y mai \\u0110\\u00c3 c\\u00f3 trong danh s\\u00e1ch, 13:00 khung m\\u1edbi m\\u1edf -> xen k\\u1ebd 1 l\\u01b0\\u1ee3t h\\u1ecfi ng\\u00e0y m\\u1edbi,\n      // 1 l\\u01b0\\u1ee3t h\\u1ecfi khung c\\u1ee7a ng\\u00e0y ch\\u01b0a m\\u1edf (t\\u1ed5ng s\\u1ed1 request kh\\u00f4ng \\u0111\\u1ed5i)\n      const un = (st.unopened || []).filter((d) => d >= jstDateStr(jstNow()));\n      if (un.length && pollN % 2 === 1 && pollInflight < POLL_MAX_INFLIGHT) {\n        pollInflight++;\n        pollN++;\n        const d0 = un[un.length - 1];\n        apiSlots(d0).then((list) => { if (__session !== popupSession) return; \n          if (list && !pollFound && list.some((x) => x.isOpen !== false && x.capacity > 0 && !x.isFull && !x.isPast && (x.remaining == null || x.remaining > 0))) { pollFound = [d0]; if (pollWake) pollWake(); }\n        }).finally(() => { pollInflight--; });\n      } else if (pollInflight < POLL_MAX_INFLIGHT) {\n        pollInflight++;\n        pollN++;\n        apiDates().then((dates) => { if (__session !== popupSession) return; \n          const fresh = dates.filter((d) => !st.known.includes(d));\n          if (fresh.length && !pollFound) { pollFound = fresh; if (pollWake) pollWake(); }\n        }).catch((e) => { if (__session !== popupSession) return; \n          errN++;\n          setStatus(L('\\u8aad\\u307f\\u8fbc\\u307f\\u30a8\\u30e9\\u30fc: ', 'L\\u1ed7i \\u0111\\u1ecdc: ') + e.message);\n          // tr\\u01b0\\u1edbc \\u0111\\u00e2y l\\u1ed7i ch\\u1ec9 hi\\u1ec7n \\u1edf d\\u00f2ng tr\\u1ea1ng th\\u00e1i, log tr\\u1ed1ng tr\\u01a1n -> ghi log (5 gi\\u00e2y t\\u1ed1i \\u0111a 1 d\\u00f2ng)\n          if (Date.now() - errLogAt > 5000) { errLogAt = Date.now(); log(L('\\u65e5\\u4ed8\\u306e\\u8aad\\u307f\\u8fbc\\u307f\\u30a8\\u30e9\\u30fc: ', 'L\\u1ed7i \\u0111\\u1ecdc danh s\\u00e1ch ng\\u00e0y: ') + e.message); }\n        }).finally(() => { pollInflight--; });\n      }\n      await popupAwait(new Promise((r) => { pollWake = r; setTimeout(r, POLL_MS); }), __session);\n      if (pollFound && st.active && st.mode === 'wait') {\n        const fresh = pollFound; pollFound = null;\n        log(L('\\u65b0\\u3057\\u3044\\u65e5\\u4ed8: ', 'Ng\\u00e0y m\\u1edbi: ') + fresh.map((d) => d.slice(5).replace('-', '/')).join(', '));\n        st.mode = 'run'; st.dates = fresh; st.fresh = true; st.reloads = 0; st.tDetect = Date.now(); st.runAt = Date.now(); save(K_STATE, st);\n        if (useRq() || findDateTab(fresh[0]) || await popupAwait(refreshDates(fresh[0]), __session)) return popupContinue(modeRun());\n        return;\n      }\n    }\n  }\n  async function modeRun() { const __session = popupSession; \n    setStatus(L('\\u7533\\u8fbc\\u4e2d\\u2026', '\\u0110ang \\u0111\\u0103ng k\\u00fd\\u2026'));\n    tsFill(1); geoWarm();\n    try {\n      if (!useRq()) {\n        setStatus(L('\\u65e5\\u4ed8\\u30dc\\u30bf\\u30f3\\u306e\\u8868\\u793a\\u3092\\u5f85\\u3063\\u3066\\u3044\\u307e\\u3059\\u2026', '\\u0110ang ch\\u1edd trang hi\\u1ec7n c\\u00e1c ng\\u00e0y\\u2026'));\n        const ok = await popupAwait(waitFor(() => findDateTab(st.dates[0]) || btns().some((b) => /\\d+\\/\\d+/.test(txt(b))), 10000), __session);\n        if (!ok) log(L('10\\u79d2\\u5f85\\u3063\\u3066\\u3082\\u65e5\\u4ed8\\u30dc\\u30bf\\u30f3\\u304c\\u51fa\\u307e\\u305b\\u3093\\uff08\\u30ed\\u30b0\\u30a4\\u30f3\\u72b6\\u614b\\u3092\\u78ba\\u8a8d\\uff09', 'Ch\\u1edd 10 gi\\u00e2y v\\u1eabn kh\\u00f4ng th\\u1ea5y n\\u00fat ng\\u00e0y (ki\\u1ec3m tra \\u0111\\u00e3 \\u0111\\u0103ng nh\\u1eadp ch\\u01b0a)'));\n      }\n      const out = await popupAwait(runDates(st.dates, { watch: true }), __session);\n      if (out === 'nofree' && st.active) {\n        log(L('\\u4eca\\u306f\\u7a7a\\u304d\\u306a\\u3057 \\u2192 \\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u67a0\\u306e\\u76e3\\u8996\\u306b\\u5207\\u308a\\u66ff\\u3048\\uff08\\u7a7a\\u304d\\u304c\\u51fa\\u305f\\u3089\\u3059\\u3050\\u7533\\u8fbc\\uff09', 'Hi\\u1ec7n h\\u1ebft ch\\u1ed7 \\u2192 chuy\\u1ec3n sang CANH V\\u00c9 H\\u1ee6Y (c\\u00f3 ch\\u1ed7 tr\\u1ed1ng l\\u00e0 \\u0111\\u0103ng k\\u00fd ngay)'));\n        st.mode = 'watch'; save(K_STATE, st);\n        return popupContinue(modeWatch());\n      }\n    } catch (e) { if (e && e.cancelled) throw e; \n      finish(L('\\u30a8\\u30e9\\u30fc\\u3067\\u505c\\u6b62: ', 'D\\u1eebng v\\u00ec l\\u1ed7i: ') + (e && e.message || e)); beep(1);\n    }\n  }\n\n  // Canh v\\u00e9 h\\u1ee7y (restock): h\\u1ecfi khung c\\u1ee7a m\\u1ecdi ng\\u00e0y \\u0111ang m\\u1edf, khung n\\u00e0o trong c\\u00e0i \\u0111\\u1eb7t c\\u00f3 ch\\u1ed7 th\\u00ec \\u0111\\u0103ng k\\u00fd ngay\n  async function modeWatch() { const __session = popupSession; \n    keepAwake(); geoWarm();                             // GPS \\u0111o s\\u1eb5n: c\\u00f3 ch\\u1ed7 l\\u00e0 g\\u1eedi ngay, kh\\u1ecfi ch\\u1edd \\u0111o\n    let n = 0, err = 0, beatAt = Date.now(), datesAt = 0, lastTick = Date.now();\n    while (st.active && st.mode === 'watch') {\n      if (useRq() && capKey()) tsFill(1);                // key ri\\u00eang: lu\\u00f4n gi\\u1eef s\\u1eb5n 1 token (key chung th\\u00ec c\\u00f3 ch\\u1ed7 m\\u1edbi gi\\u1ea3i, \\u0111\\u1ee1 t\\u1ed1n l\\u01b0\\u1ee3t chung) (s\\u1ed1ng ~4 ph\\u00fat, \\u2248 15 l\\u01b0\\u1ee3t gi\\u1ea3i/gi\\u1edd \\u2248 $0,02/gi\\u1edd)\n      const gap = Date.now() - lastTick; lastTick = Date.now();\n      if (gap > 15000) log(L(`\\u26a0\\ufe0f \\u30da\\u30fc\\u30b8\\u304c ${Math.round(gap / 1000)}\\u79d2 \\u505c\\u6b62\\u3057\\u3066\\u3044\\u307e\\u3057\\u305f\\uff08\\u753b\\u9762\\u30ed\\u30c3\\u30af / Safari \\u3092\\u88cf\\u306b\\u56de\\u3057\\u305f\\uff09`, `\\u26a0\\ufe0f Trang b\\u1ecb Safari cho ng\\u1ee7 ${Math.round(gap / 1000)} gi\\u00e2y (kh\\u00f3a m\\u00e0n h\\u00ecnh / chuy\\u1ec3n app) \\u2013 BOT kh\\u00f4ng canh trong l\\u00fac \\u0111\\u00f3`));\n      const t0 = Date.now(), today = jstDateStr(jstNow());\n      if (Date.now() - datesAt > 60e3) {                 // 1 ph\\u00fat c\\u1eadp nh\\u1eadt danh s\\u00e1ch ng\\u00e0y 1 l\\u1ea7n (13:00 c\\u00f3 ng\\u00e0y m\\u1edbi)\n        try { const d = await popupAwait(apiDates(), __session); if (d.length) { st.dates = d; save(K_STATE, st); } datesAt = Date.now(); } catch (e) { if (e && e.cancelled) throw e;  err++; }\n      }\n      const dates = (st.dates || []).filter((d) => d >= today);\n      if (!dates.length) { finish(L('\\u7533\\u8fbc\\u3067\\u304d\\u308b\\u65e5\\u4ed8\\u304c\\u3042\\u308a\\u307e\\u305b\\u3093', 'Hi\\u1ec7n kh\\u00f4ng c\\u00f3 ng\\u00e0y n\\u00e0o \\u0111\\u1ec3 \\u0111\\u0103ng k\\u00fd')); return; }\n      const lists = await popupAwait(Promise.all(dates.map((d) => apiSlots(d))), __session);\n      n++;\n      if (!st.active || st.mode !== 'watch') return;\n      const free = [];\n      dates.forEach((d, i) => {\n        if (!lists[i]) { err++; return; }\n        const ts = slotOrder(lists[i]).filter((t) => !(st.lost || []).includes(lostKey(d, t)));\n        if (ts.length) free.push([d, ts, lists[i]]);\n      });\n      if (free.length) {\n        const info = free.map(([d, ts, l]) => `${d.slice(5).replace('-', '/')} ` + ts.map((t) => {\n          const x = l.find((y) => (y.startTime || '').slice(0, 5) === t); return t + (x && x.remaining != null ? `(${x.remaining})` : '');\n        }).join(' ')).join(' \\u00b7 ');\n        log(L('\\ud83d\\udd14 \\u7a7a\\u304d\\u304c\\u51fa\\u307e\\u3057\\u305f: ', '\\ud83d\\udd14 C\\u00f3 ch\\u1ed7 tr\\u1ed1ng: ') + info);\n        beep(1);\n        st.mode = 'run'; st.runAt = Date.now(); save(K_STATE, st);\n        tsFill(1); geoWarm();\n        const out = await popupAwait(runDates(free.map((x) => x[0]), { watch: true, quiet: true }), __session);\n        if (out !== 'nofree' || !st.active) return;      // tr\\u00fang / d\\u1eebng / h\\u1ebft l\\u01b0\\u1ee3t -> runDates \\u0111\\u00e3 finish\n        log(L('\\u3053\\u306e\\u7a7a\\u304d\\u3067\\u306f\\u53d6\\u308c\\u307e\\u305b\\u3093\\u3067\\u3057\\u305f \\u2192 \\u76e3\\u8996\\u3092\\u7d9a\\u3051\\u307e\\u3059', 'L\\u01b0\\u1ee3t n\\u00e0y ch\\u01b0a l\\u1ea5y \\u0111\\u01b0\\u1ee3c v\\u00e9 \\u2192 ti\\u1ebfp t\\u1ee5c canh v\\u00e9 h\\u1ee7y'));\n        st.mode = 'watch'; save(K_STATE, st);\n        await popupAwait(sleep(1000), __session);                               // l\\u01b0\\u1ee3t v\\u1eeba r\\u1ed3i k\\u1ebft th\\u00fac ngay (VD kh\\u00f4ng th\\u1ea5y n\\u00fat ng\\u00e0y) -> kh\\u00f4ng l\\u1eb7p d\\u1ed3n d\\u1eadp\n        continue;\n      }\n      setStatus(L(`\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u67a0\\u3092\\u76e3\\u8996\\u4e2d\\u2026 ${n}\\u56de`, `\\u0110ang canh v\\u00e9 h\\u1ee7y\\u2026 \\u0111\\u00e3 d\\u00f2 ${n} l\\u1ea7n`) + (err ? L(`\\uff08\\u30a8\\u30e9\\u30fc ${err}\\uff09`, ` (l\\u1ed7i ${err})`) : ''));\n      if (Date.now() - beatAt > 60e3) { beatAt = Date.now(); log(L(`\\u76e3\\u8996\\u4e2d\\u2026 ${n}\\u56de \\u78ba\\u8a8d\\u30fb\\u7a7a\\u304d\\u306a\\u3057`, `V\\u1eabn \\u0111ang canh v\\u00e9 h\\u1ee7y\\u2026 ${n} l\\u1ea7n d\\u00f2, ch\\u01b0a c\\u00f3 ch\\u1ed7`)); }\n      await popupAwait(sleep(Math.max(300, WATCH_MS - (Date.now() - t0))), __session);\n    }\n  }\n\n  // ================= T\\u1ea4T C\\u1ea2 C\\u1eecA H\\u00c0NG (ch\\u1ec9 ch\\u1ebf \\u0111\\u1ed9 request) =================\n  // 18/11 user: ch\\u1ea1y song song c\\u00e1c c\\u1eeda h\\u00e0ng, c\\u1eeda h\\u00e0ng n\\u00e0o c\\u00f3 ch\\u1ed7 th\\u00ec \\u0111\\u0103ng k\\u00fd; tr\\u00fang 1 c\\u1eeda h\\u00e0ng v\\u1eabn th\\u1eed c\\u1eeda h\\u00e0ng c\\u00f2n l\\u1ea1i.\n  // 13:00: xen k\\u1ebd h\\u1ecfi t\\u1eebng c\\u1eeda h\\u00e0ng (ng\\u00e0y m\\u1edbi / khung c\\u1ee7a ng\\u00e0y ch\\u01b0a m\\u1edf); th\\u1ea5y c\\u1eeda h\\u00e0ng n\\u00e0o m\\u1edf tr\\u01b0\\u1edbc th\\u00ec \\u0111\\u0103ng k\\u00fd c\\u1eeda h\\u00e0ng \\u0111\\u00f3,\n  // xong th\\u1eed ngay c\\u00e1c c\\u1eeda h\\u00e0ng c\\u00f2n l\\u1ea1i (th\\u1ee9 t\\u1ef1 ng\\u1eabu nhi\\u00ean). C\\u00f2n c\\u1eeda h\\u00e0ng ch\\u01b0a c\\u00f3 v\\u00e9 -> canh v\\u00e9 h\\u1ee7y l\\u1ea7n l\\u01b0\\u1ee3t c\\u00e1c c\\u1eeda h\\u00e0ng \\u0111\\u00f3.\n  // Gi\\u1edbi h\\u1ea1n g\\u1eedi (3 l\\u01b0\\u1ee3t / 62 gi\\u00e2y, MAX_POSTS / ng\\u00e0y) d\\u00f9ng CHUNG cho m\\u1ecdi c\\u1eeda h\\u00e0ng.\n  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };\n  // c\\u1eeda h\\u00e0ng c\\u00f2n ph\\u1ea3i l\\u1ea5y v\\u00e9: ch\\u01b0a tr\\u00fang v\\u00e0 h\\u00f4m nay ch\\u01b0a b\\u1ecb m\\u00e1y ch\\u1ee7 t\\u1eeb ch\\u1ed1i h\\u1eb3n (\\u0111\\u00e3 \\u0111\\u0103ng k\\u00fd r\\u1ed3i / b\\u1ecb ch\\u1eb7n...) -> kh\\u00f4ng g\\u1eedi l\\u1ea1i cho \\u0111\\u1ee1 b\\u1ecb gi\\u1edbi h\\u1ea1n\n  const mLeft = () => Object.keys(st.m || {}).map(Number).filter((sid) => !st.m[sid].won && st.m[sid].blocked !== jstDateStr(jstNow()));\n  const tag = (sid) => '[' + (storeName(sid) || 'Store ' + sid).slice(0, 14) + '] ';\n  const slotFree = (x) => x.isOpen !== false && x.capacity > 0 && !x.isFull && !x.isPast && x.isDrawn !== true && (x.remaining == null || x.remaining > 0);\n  async function multiInit() { const __session = popupSession; \n    if (!useRq()) { log(L('\\u5168\\u5e97\\u8217\\u30e2\\u30fc\\u30c9\\u306f\\u30ea\\u30af\\u30a8\\u30b9\\u30c8\\u65b9\\u5f0f\\u306e\\u307f\\u3067\\u3059\\uff08\\u8a8d\\u8a3c\\u306e\\u81ea\\u52d5\\u89e3\\u6c7a\\u304c\\u5fc5\\u8981\\uff09', 'Ch\\u1ebf \\u0111\\u1ed9 t\\u1ea5t c\\u1ea3 c\\u1eeda h\\u00e0ng ch\\u1ec9 ch\\u1ea1y b\\u1eb1ng request (c\\u1ea7n t\\u1ef1 gi\\u1ea3i x\\u00e1c nh\\u1eadn Cloudflare)')); return false; }\n    try { await popupAwait(loadStores(), __session); } catch (e) { if (e && e.cancelled) throw e;  log(L('\\u5e97\\u8217\\u4e00\\u89a7\\u3092\\u8aad\\u307f\\u8fbc\\u3081\\u307e\\u305b\\u3093: ', 'Kh\\u00f4ng \\u0111\\u1ecdc \\u0111\\u01b0\\u1ee3c danh s\\u00e1ch c\\u1eeda h\\u00e0ng: ') + e.message); return false; }\n    if (storesCache.length < 2) { log(L('\\u5e97\\u8217\\u304c1\\u3064\\u3060\\u3051\\u3067\\u3059 \\u2192 \\u901a\\u5e38\\u30e2\\u30fc\\u30c9\\u3067\\u5b9f\\u884c\\u3057\\u3066\\u304f\\u3060\\u3055\\u3044', 'Hi\\u1ec7n ch\\u1ec9 c\\u00f3 1 c\\u1eeda h\\u00e0ng \\u2192 h\\u00e3y ch\\u1ecdn c\\u1eeda h\\u00e0ng \\u0111\\u00f3 \\u0111\\u1ec3 ch\\u1ea1y')); return false; }\n    st.m = {};\n    const today = jstDateStr(jstNow());\n    if (wantDays().length) log(L(`\\u6307\\u5b9a\\u65e5\\u306e\\u307f: ${wantText()}\\uff08\\u9806\\u756a\\u306f\\u30e9\\u30f3\\u30c0\\u30e0\\uff09`, `Ch\\u1ec9 ch\\u1ea1y NG\\u00c0Y CH\\u1ec8 \\u0110\\u1ecaNH: ${wantText()} (th\\u1ee9 t\\u1ef1 ng\\u1eabu nhi\\u00ean)`));\n    for (const x of storesCache) {\n      let known = [];\n      storeNow = x.id;                           // l\\u1ea7n l\\u01b0\\u1ee3t t\\u1eebng c\\u1eeda h\\u00e0ng (datesRetry c\\u00f3 th\\u1ec3 g\\u1ecdi l\\u1ea1i sau khi ngh\\u1ec9)\n      try { known = await popupAwait(datesRetry(), __session); } catch (e) { if (e && e.cancelled) throw e;  storeNow = 0; log(tag(x.id) + L('\\u65e5\\u4ed8\\u3092\\u8aad\\u307f\\u8fbc\\u3081\\u307e\\u305b\\u3093: ', 'kh\\u00f4ng \\u0111\\u1ecdc \\u0111\\u01b0\\u1ee3c danh s\\u00e1ch ng\\u00e0y: ') + e.message); continue; }\n      const cand = known.filter((d) => d >= today);\n      const lists = await popupAwait(Promise.all(cand.map((d) => apiSlots(d))), __session);\n      storeNow = 0;\n      const unopened = cand.filter((d, i) => lists[i] && lists[i].length && lists[i].every((y) => y.isOpen === false || !y.capacity));\n      st.m[x.id] = { known, unopened, won: false };\n      log(tag(x.id) + L(`${slotTimes(x.id).length}\\u67a0\\u30fb\\u65e5\\u4ed8 ${known.length}\\u4ef6`, `${slotTimes(x.id).length} khung gi\\u1edd, \\u0111ang c\\u00f3 ${known.length} ng\\u00e0y`) +\n        (unopened.length ? L(`\\u30fb\\u53d7\\u4ed8\\u524d: ${unopened.map((d) => d.slice(5)).join(', ')}`, `, ng\\u00e0y ch\\u01b0a m\\u1edf khung: ${unopened.map((d) => d.slice(5).replace('-', '/')).join(', ')}`) : ''));\n    }\n    if (Object.keys(st.m).length < 1) return false;\n    return true;\n  }\n  // \\u0111\\u0103ng k\\u00fd 1 c\\u1eeda h\\u00e0ng; tr\\u1ea3 { won, fatal }\n  async function runStore(sid, dates, fresh, maxPosts) { const __session = popupSession; \n    storeNow = sid; st.cur = sid; st.dates = dates; st.fresh = !!fresh; st.runAt = Date.now(); save(K_STATE, st);\n    soft = {};\n    log('\\u25b6 ' + tag(sid) + L('\\u7533\\u8fbc\\u958b\\u59cb: ', 'b\\u1eaft \\u0111\\u1ea7u \\u0111\\u0103ng k\\u00fd: ') + dates.map((d) => d.slice(5).replace('-', '/')).join(', '));\n    let out;\n    try { out = await popupAwait(runDates(dates, { watch: true, quiet: true, maxPosts: maxPosts || 0 }), __session); } catch (e) { if (e && e.cancelled) throw e;  log(tag(sid) + L('\\u30a8\\u30e9\\u30fc: ', 'l\\u1ed7i: ') + (e && e.message || e)); }\n    const res = soft; soft = null; storeNow = 0;\n    if (out === 'switch') res.switched = true;\n    if (res.won && st.m && st.m[sid]) { st.m[sid].won = res.won; save(K_STATE, st); }\n    else if (res.block && st.m && st.m[sid]) { st.m[sid].blocked = jstDateStr(jstNow()); save(K_STATE, st); log(tag(sid) + L('\\u672c\\u65e5\\u306f\\u3053\\u306e\\u5e97\\u8217\\u3078\\u306e\\u9001\\u4fe1\\u3092\\u6b62\\u3081\\u307e\\u3059', 'h\\u00f4m nay kh\\u00f4ng g\\u1eedi cho c\\u1eeda h\\u00e0ng n\\u00e0y n\\u1eefa')); }\n    return res;\n  }\n  function multiEnd(msg) {\n    const wins = Object.keys(st.m || {}).map(Number).filter((sid) => st.m[sid].won);\n    const sum = wins.map((sid) => `${storeName(sid) || sid} ${st.m[sid].won.md} ${st.m[sid].won.t}`).join(' / ');\n    soft = null; storeNow = 0;\n    finish((wins.length ? L(`\\ud83c\\udf89 \\u53d6\\u5f97 ${wins.length}\\u5e97\\u8217: `, `\\ud83c\\udf89 C\\u00f3 v\\u00e9 \\u1edf ${wins.length} c\\u1eeda h\\u00e0ng: `) + sum + ' \\u00b7 ' : '') + msg);\n    if (wins.length) setTimeout(() => { location.href = '/my-tickets'; }, 1500);\n  }\n  async function startWaitMulti() { const __session = popupSession; \n    if (!(await popupAwait(multiInit(), __session))) return;\n    Object.assign(st, { active: true, mode: 'mwait', dates: [], fresh: false, tDetect: 0, reloads: 0, openAt: nextOpenAt() });\n    save(K_STATE, st);\n    log(L('\\u5168\\u5e97\\u8217\\u30e2\\u30fc\\u30c9: 13:00 \\u81ea\\u52d5\\u30b9\\u30bf\\u30fc\\u30c8\\uff08\\u7a7a\\u304d\\u304c\\u51fa\\u305f\\u5e97\\u8217\\u304b\\u3089\\u7533\\u8fbc\\u307f\\uff09', 'T\\u1ea4T C\\u1ea2 C\\u1eecA H\\u00c0NG: ch\\u1edd 13:00, c\\u1eeda h\\u00e0ng n\\u00e0o m\\u1edf tr\\u01b0\\u1edbc th\\u00ec \\u0111\\u0103ng k\\u00fd tr\\u01b0\\u1edbc. Gi\\u1eef Safari m\\u1edf, m\\u00e0n h\\u00ecnh s\\u00e1ng'));\n    popupContinue(modeWaitMulti());\n  }\n  async function startNowMulti() { const __session = popupSession; \n    if (!(await popupAwait(multiInit(), __session))) return;\n    Object.assign(st, { active: true, mode: 'mwatch', dates: [], fresh: false, tDetect: 0, reloads: 0, openAt: 0, runAt: Date.now() });\n    save(K_STATE, st);\n    keepAwake();\n    log(L('\\u5168\\u5e97\\u8217\\u30e2\\u30fc\\u30c9: \\u3059\\u3050\\u5b9f\\u884c\\uff08\\u7a7a\\u304d\\u306e\\u3042\\u308b\\u5e97\\u8217\\u306b\\u7533\\u8fbc\\u307f\\u30fb\\u306a\\u3051\\u308c\\u3070\\u76e3\\u8996\\uff09', 'T\\u1ea4T C\\u1ea2 C\\u1eecA H\\u00c0NG: ch\\u1ea1y ngay, c\\u1eeda h\\u00e0ng n\\u00e0o c\\u00f2n ch\\u1ed7 th\\u00ec \\u0111\\u0103ng k\\u00fd; h\\u1ebft ch\\u1ed7 th\\u00ec canh v\\u00e9 h\\u1ee7y'));\n    popupContinue(modeWatchMulti());\n  }\n  async function modeWaitMulti() { const __session = popupSession; \n    setStatus(L('13:00 \\u5f85\\u6a5f\\u4e2d\\uff08\\u5168\\u5e97\\u8217\\uff09', 'Ch\\u1edd 13:00 gi\\u1edd Nh\\u1eadt (t\\u1ea5t c\\u1ea3 c\\u1eeda h\\u00e0ng)'));\n    keepAwake();\n    if (!st.openAt) { st.openAt = nextOpenAt(); save(K_STATE, st); }\n    let pollN = 0, errN = 0, errLogAt = 0, beatAt = 0, started = false, found = null, wake = null, rr = 0;\n    while (st.active && st.mode === 'mwait') {\n      const left = msToOpen();\n      if (left < 60e3) { tsFill(TS_POOL); geoWarm(); rqWarmToken(); }\n      if (left > WATCH_FROM_SEC * 1000) {\n        const c = Math.ceil(left / 1000);\n        setStatus(L('\\u30b9\\u30bf\\u30fc\\u30c8\\u307e\\u3067 ', 'C\\u00f2n t\\u1edbi 13:00 ') + `${String(Math.floor(c / 3600)).padStart(2, '0')}:${String(Math.floor(c / 60) % 60).padStart(2, '0')}:${String(c % 60).padStart(2, '0')}`);\n        await popupAwait(sleep(Math.min(1000, left - WATCH_FROM_SEC * 1000)), __session);\n        continue;\n      }\n      if (left < -10 * 60e3) { st.mode = 'mwatch'; save(K_STATE, st); log(L('13:10 \\u307e\\u3067\\u65b0\\u3057\\u3044\\u67a0\\u306a\\u3057 \\u2192 \\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u67a0\\u306e\\u76e3\\u8996\\u306b\\u5207\\u66ff', 'Qu\\u00e1 13:10 ch\\u01b0a th\\u1ea5y m\\u1edf \\u2192 chuy\\u1ec3n sang canh v\\u00e9 h\\u1ee7y c\\u00e1c c\\u1eeda h\\u00e0ng')); return popupContinue(modeWatchMulti()); }\n      if (!started) { started = true; log(L('\\u5168\\u5e97\\u8217\\u306e\\u78ba\\u8a8d\\u3092\\u958b\\u59cb', 'B\\u1eaft \\u0111\\u1ea7u d\\u00f2 t\\u1ea5t c\\u1ea3 c\\u1eeda h\\u00e0ng')); }\n      if (Date.now() - beatAt > 10e3) { if (beatAt) log(L(`\\u78ba\\u8a8d\\u4e2d\\u2026 ${pollN}\\u56de\\uff08\\u30a8\\u30e9\\u30fc ${errN}\\u56de\\uff09`, `V\\u1eabn \\u0111ang d\\u00f2\\u2026 ${pollN} l\\u1ea7n (l\\u1ed7i ${errN} l\\u1ea7n)`)); beatAt = Date.now(); }\n      tsFill(TS_POOL);\n      setStatus(L('\\u65b0\\u3057\\u3044\\u67a0\\u3092\\u78ba\\u8a8d\\u4e2d\\u2026\\uff08\\u5168\\u5e97\\u8217\\uff09', '\\u0110ang d\\u00f2 khung m\\u1edbi\\u2026 (t\\u1ea5t c\\u1ea3 c\\u1eeda h\\u00e0ng)'));\n      // danh s\\u00e1ch vi\\u1ec7c d\\u00f2: m\\u1ed7i c\\u1eeda h\\u00e0ng 1 vi\\u1ec7c \"ng\\u00e0y m\\u1edbi\" (+1 vi\\u1ec7c \"khung c\\u1ee7a ng\\u00e0y ch\\u01b0a m\\u1edf\"), xoay v\\u00f2ng m\\u1ed7i POLL_MS 1 vi\\u1ec7c\n      const today = jstDateStr(jstNow()), jobs = [];\n      for (const sid of mLeft()) {\n        jobs.push({ sid, kind: 'dates' });\n        const un = (st.m[sid].unopened || []).filter((d) => d >= today);\n        if (un.length) jobs.push({ sid, kind: 'slots', d: un[un.length - 1] });\n      }\n      if (!jobs.length) return multiEnd(L('\\u5b8c\\u4e86', 'xong'));\n      if (pollInflight < POLL_MAX_INFLIGHT) {\n        const jb = jobs[rr++ % jobs.length];\n        pollInflight++; pollN++;\n        const hit = (dates) => { if (!found && dates.length) { found = { sid: jb.sid, dates }; if (wake) wake(); } };\n        (jb.kind === 'dates'\n          ? withStore(jb.sid, () => apiDates()).then((dates) => hit(dates.filter((d) => !st.m[jb.sid].known.includes(d))))\n          : withStore(jb.sid, () => apiSlots(jb.d)).then((list) => hit(list && list.some(slotFree) ? [jb.d] : []))\n        ).catch((e) => { if (__session !== popupSession) return; \n          errN++;\n          if (Date.now() - errLogAt > 5000) { errLogAt = Date.now(); log(tag(jb.sid) + L('\\u8aad\\u307f\\u8fbc\\u307f\\u30a8\\u30e9\\u30fc: ', 'l\\u1ed7i \\u0111\\u1ecdc: ') + e.message); }\n        }).finally(() => { pollInflight--; });\n      }\n      await popupAwait(new Promise((r) => { wake = r; setTimeout(r, POLL_MS); }), __session);\n      if (found && st.active && st.mode === 'mwait') {\n        let first = found; found = null;\n        st.tDetect = Date.now(); st.mode = 'mrun'; save(K_STATE, st);\n        log(tag(first.sid) + L('\\u65b0\\u3057\\u3044\\u67a0: ', 'M\\u1ede: ') + first.dates.map((d) => d.slice(5).replace('-', '/')).join(', '));\n        // 22/11: h\\u1ecfi nhanh c\\u1eeda h\\u00e0ng c\\u00f2n l\\u1ea1i (t\\u1ed1i \\u0111a MULTI_PEEK_MS) -> c\\u00f9ng m\\u1edf th\\u00ec c\\u1eeda h\\u00e0ng \\u00cdT ng\\u00e0y \\u0111\\u1eb7t (hi\\u1ebfm v\\u00e9, h\\u1ebft nhanh) g\\u1eedi tr\\u01b0\\u1edbc\n        const nDays = (sid) => ((st.m[sid] && st.m[sid].known) || []).length || 99;\n        const others = mLeft().filter((x) => x !== first.sid);\n        const peeked = {};\n        if (others.length) {\n          await popupAwait(Promise.race([\n            Promise.all(others.map((sid) => withStore(sid, () => apiDates())\n              .then((ds) => { const nw = ds.filter((d) => !st.m[sid].known.includes(d)); if (nw.length) peeked[sid] = nw; })\n              .catch(() => {}))),\n            sleep(MULTI_PEEK_MS)]), __session);\n          const better = Object.keys(peeked).map(Number).filter((sid) => nDays(sid) < nDays(first.sid)).sort((a, b) => nDays(a) - nDays(b))[0];\n          if (better) {\n            log(tag(better) + L('\\u3082\\u540c\\u6642\\u306b\\u958b\\u59cb \\u2192 \\u65e5\\u6570\\u304c\\u5c11\\u306a\\u3044\\uff08\\u67a0\\u304c\\u65e9\\u304f\\u57cb\\u307e\\u308b\\uff09\\u3053\\u3061\\u3089\\u3092\\u5148\\u306b', 'c\\u0169ng v\\u1eeba m\\u1edf \\u2192 c\\u1eeda h\\u00e0ng n\\u00e0y \\u00edt ng\\u00e0y h\\u01a1n (h\\u1ebft v\\u00e9 nhanh h\\u01a1n) n\\u00ean g\\u1eedi tr\\u01b0\\u1edbc'));\n            first = { sid: better, dates: peeked[better] };\n          }\n        }\n        const doneSid = new Set([first.sid]);\n        let r = await popupAwait(runStore(first.sid, first.dates, true, others.length ? MULTI_FIRST_POSTS : 0), __session);\n        // c\\u00e1c c\\u1eeda h\\u00e0ng c\\u00f2n l\\u1ea1i: th\\u1eed ngay (ng\\u00e0y m\\u1edbi n\\u1ebfu c\\u00f3, kh\\u00f4ng th\\u00ec m\\u1ecdi ng\\u00e0y c\\u00f2n m\\u1edf); \\u00edt ng\\u00e0y \\u0111\\u1eb7t tr\\u01b0\\u1edbc\n        for (const sid of mLeft().filter((x) => !doneSid.has(x)).sort((a, b) => nDays(a) - nDays(b))) {\n          if (!st.active || (r && r.fatal)) break;\n          let dates = [];\n          try { dates = await popupAwait(withStore(sid, () => apiDates()), __session); } catch (e) { if (e && e.cancelled) throw e;  log(tag(sid) + L('\\u8aad\\u307f\\u8fbc\\u307f\\u30a8\\u30e9\\u30fc: ', 'l\\u1ed7i \\u0111\\u1ecdc: ') + e.message); continue; }\n          const today2 = jstDateStr(jstNow());\n          const fresh = dates.filter((d) => !st.m[sid].known.includes(d)).concat((st.m[sid].unopened || []).filter((d) => d >= today2 && dates.includes(d)));\n          const use = [...new Set(fresh.length ? fresh : dates.filter((d) => d >= today2))];\n          if (!use.length) continue;\n          r = await popupAwait(runStore(sid, use, fresh.length > 0), __session);\n        }\n        if (!st.active) return;\n        if ((r && r.fatal) || !mLeft().length) return multiEnd(L('\\u5b8c\\u4e86', 'xong'));\n        st.mode = 'mwatch'; save(K_STATE, st);\n        log(L('\\u672a\\u53d6\\u5f97\\u306e\\u5e97\\u8217\\u3042\\u308a \\u2192 \\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u67a0\\u3092\\u76e3\\u8996\\u3057\\u307e\\u3059: ', 'C\\u00f2n c\\u1eeda h\\u00e0ng ch\\u01b0a c\\u00f3 v\\u00e9 \\u2192 canh v\\u00e9 h\\u1ee7y: ') + mLeft().map((x) => storeName(x) || x).join(', '));\n        return popupContinue(modeWatchMulti());\n      }\n    }\n  }\n  async function modeWatchMulti() { const __session = popupSession; \n    keepAwake(); geoWarm();\n    let n = 0, beatAt = Date.now();\n    const datesOf = {}, datesAt = {};\n    while (st.active && st.mode === 'mwatch') {\n      const t0 = Date.now(), today = jstDateStr(jstNow());\n      const left = mLeft();\n      if (!left.length) return multiEnd(L('\\u5b8c\\u4e86', 'xong'));\n      for (const sid of shuffle(left)) {\n        if (!st.active || st.mode !== 'mwatch') return;\n        if (!datesOf[sid] || Date.now() - (datesAt[sid] || 0) > 60e3) {\n          try { datesOf[sid] = await popupAwait(withStore(sid, () => apiDates()), __session); datesAt[sid] = Date.now(); } catch (e) { if (e && e.cancelled) throw e;  continue; }\n        }\n        const dates = (datesOf[sid] || []).filter((d) => d >= today);\n        const lists = await popupAwait(Promise.all(dates.map((d) => withStore(sid, () => apiSlots(d)))), __session);\n        const free = dates.filter((d, i) => lists[i] && withStore(sid, () => slotOrder(lists[i]).filter((t) => !(st.lost || []).includes(lostKey(d, t)))).length);\n        if (!free.length) continue;\n        log('\\ud83d\\udd14 ' + tag(sid) + L('\\u7a7a\\u304d\\u304c\\u51fa\\u307e\\u3057\\u305f: ', 'c\\u00f3 ch\\u1ed7 tr\\u1ed1ng: ') + free.map((d) => d.slice(5).replace('-', '/')).join(', '));\n        beep(1);\n        const r = await popupAwait(runStore(sid, free, false), __session);\n        if (!st.active) return;\n        if (r.fatal) return multiEnd(L('\\u505c\\u6b62', 'd\\u1eebng'));\n      }\n      n++;\n      setStatus(L(`\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u67a0\\u3092\\u76e3\\u8996\\u4e2d\\uff08\\u5168\\u5e97\\u8217\\uff09\\u2026 ${n}\\u56de`, `\\u0110ang canh v\\u00e9 h\\u1ee7y (t\\u1ea5t c\\u1ea3 c\\u1eeda h\\u00e0ng)\\u2026 \\u0111\\u00e3 d\\u00f2 ${n} l\\u1ea7n`));\n      if (Date.now() - beatAt > 60e3) { beatAt = Date.now(); log(L(`\\u76e3\\u8996\\u4e2d\\u2026 ${n}\\u56de \\u78ba\\u8a8d\\u30fb\\u7a7a\\u304d\\u306a\\u3057`, `V\\u1eabn \\u0111ang canh\\u2026 ${n} l\\u1ea7n d\\u00f2, ch\\u01b0a c\\u00f3 ch\\u1ed7`) + ' (' + mLeft().map((x) => (storeName(x) || String(x)).slice(0, 12)).join(', ') + ')'); }\n      await popupAwait(sleep(Math.max(300, WATCH_MS - (Date.now() - t0))), __session);\n    }\n  }\n\n  // m\\u00e1y ch\\u1ee7 l\\u1ed7i / treo 1 l\\u1ea7n th\\u00ec th\\u1eed l\\u1ea1i (t\\u1ed1i \\u0111a 3 l\\u1ea7n, c\\u00e1ch 1,5 gi\\u00e2y); ch\\u01b0a \\u0111\\u0103ng nh\\u1eadp / ch\\u01b0a ch\\u1ecdn c\\u1eeda h\\u00e0ng th\\u00ec b\\u00e1o ngay\n  async function datesRetry() { const __session = popupSession; \n    let err;\n    for (let k = 0; k < 3; k++) {\n      try { return await popupAwait(apiDates(), __session); } catch (e) { if (e && e.cancelled) throw e; \n        err = e;\n        if (!storeId() || /\\u30ed\\u30b0\\u30a4\\u30f3|\\u0111\\u0103ng nh\\u1eadp/.test(e.message)) break;\n        // 18/11 user th\\u1ea5y d\\u00f2ng \"L\\u1ed7i \\u0111\\u1ecdc danh s\\u00e1ch ng\\u00e0y\" t\\u01b0\\u1edfng BOT h\\u1ecfng (th\\u1eadt ra m\\u00e1y ch\\u1ee7 tr\\u1ea3 502 1 l\\u1ea7n, l\\u01b0\\u1ee3t sau \\u0111\\u1ecdc \\u0111\\u01b0\\u1ee3c) -> ghi r\\u00f5 l\\u00e0 BOT t\\u1ef1 th\\u1eed l\\u1ea1i\n        if (k < 2) { log((storeNow ? tag(storeNow) : '') + L(`\\u30b5\\u30fc\\u30d0\\u30fc\\u304c\\u4e00\\u6642\\u7684\\u306b\\u30a8\\u30e9\\u30fc\\uff08${e.message}\\uff09\\u2192 \\u81ea\\u52d5\\u3067\\u518d\\u8a66\\u884c ${k + 2}/3`, `m\\u00e1y ch\\u1ee7 tr\\u1ea3 l\\u1ed7i t\\u1ea1m th\\u1eddi (${e.message}) \\u2192 BOT t\\u1ef1 th\\u1eed l\\u1ea1i l\\u1ea7n ${k + 2}/3`)); await popupAwait(sleep(1500), __session); }\n      }\n    }\n    throw err;\n  }\n  async function startWaitImpl() { const __session = popupSession; \n    if (multiOn()) return startWaitMulti();\n    if (!isRegisterPage()) { log(L('\\u5e97\\u8217\\u3092\\u9078\\u3073\\u300c\\u6642\\u9593\\u5e2f\\u3092\\u9078\\u629e\\u300d\\u3067\\u6765\\u5e97\\u65e5\\u306e\\u753b\\u9762\\u3092\\u958b\\u3044\\u3066\\u304f\\u3060\\u3055\\u3044', 'H\\u00e3y ch\\u1ecdn c\\u1eeda h\\u00e0ng r\\u1ed3i b\\u1ea5m \\u6642\\u9593\\u5e2f\\u3092\\u9078\\u629e \\u0111\\u1ec3 m\\u1edf m\\u00e0n h\\u00ecnh ch\\u1ecdn ng\\u00e0y/khung gi\\u1edd')); return; }\n    let known = [];\n    try { known = await popupAwait(datesRetry(), __session); } catch (e) { if (e && e.cancelled) throw e;  log(L('\\u65e5\\u4ed8\\u3092\\u8aad\\u307f\\u8fbc\\u3081\\u307e\\u305b\\u3093: ', 'Kh\\u00f4ng \\u0111\\u1ecdc \\u0111\\u01b0\\u1ee3c danh s\\u00e1ch ng\\u00e0y: ') + e.message); return; }\n    // ng\\u00e0y \\u0111\\u00e3 n\\u1eb1m trong danh s\\u00e1ch m\\u00e0 M\\u1eccI khung c\\u00f2n \\u0111\\u00f3ng (capacity 0) = ch\\u01b0a m\\u1edf b\\u00e1n -> 13:00 canh c\\u1ea3 khung c\\u1ee7a c\\u00e1c ng\\u00e0y n\\u00e0y\n    const today0 = jstDateStr(jstNow()), cand = known.filter((d) => d >= today0);\n    const lists0 = await popupAwait(Promise.all(cand.map((d) => apiSlots(d))), __session);\n    const unopened = cand.filter((d, i) => lists0[i] && lists0[i].length && lists0[i].every((x) => x.isOpen === false || !x.capacity));\n    if (wantDays().length) {\n      log(L(`\\u6307\\u5b9a\\u65e5\\u306e\\u307f: ${wantText()}\\uff08\\u9806\\u756a\\u306f\\u30e9\\u30f3\\u30c0\\u30e0\\uff09`, `Ch\\u1ec9 ch\\u1ea1y NG\\u00c0Y CH\\u1ec8 \\u0110\\u1ecaNH: ${wantText()} (th\\u1ee9 t\\u1ef1 ng\\u1eabu nhi\\u00ean)`));\n      // m\\u1ecdi ng\\u00e0y ch\\u1ec9 \\u0111\\u1ecbnh \\u0111\\u00e3 m\\u1edf b\\u00e1n s\\u1eb5n -> 13:00 kh\\u00f4ng c\\u00f3 g\\u00ec m\\u1edbi \\u0111\\u1ec3 ch\\u1edd: canh v\\u00e9 h\\u1ee7y c\\u1ee7a c\\u00e1c ng\\u00e0y \\u0111\\u00f3 lu\\u00f4n\n      if (wantDays().every((w) => cand.some((d) => dayHit(d, w))) && !unopened.length) {\n        log(L('\\u6307\\u5b9a\\u65e5\\u306f\\u3059\\u3067\\u306b\\u53d7\\u4ed8\\u4e2d \\u2192 \\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u67a0\\u3092\\u76e3\\u8996\\u3057\\u307e\\u3059', 'C\\u00e1c ng\\u00e0y ch\\u1ec9 \\u0111\\u1ecbnh \\u0111\\u00e3 m\\u1edf b\\u00e1n s\\u1eb5n \\u2192 canh v\\u00e9 h\\u1ee7y c\\u1ee7a c\\u00e1c ng\\u00e0y \\u0111\\u00f3 lu\\u00f4n (kh\\u00f4ng c\\u1ea7n ch\\u1edd 13:00)'));\n        return startNowImpl();\n      }\n    }\n    Object.assign(st, { active: true, mode: 'wait', known, unopened, dates: [], fresh: false, tDetect: 0, reloads: 0, openAt: nextOpenAt() });\n    save(K_STATE, st);\n    if (storeName()) log(L('\\u5e97\\u8217: ', 'C\\u1eeda h\\u00e0ng: ') + storeName() + L(`\\uff08${slotTimes().length}\\u67a0\\uff09`, ` (${slotTimes().length} khung gi\\u1edd)`));\n    if (unopened.length) log(L(`\\u307e\\u3060\\u53d7\\u4ed8\\u524d\\u306e\\u65e5\\u4ed8: ${unopened.map((d) => d.slice(5).replace('-', '/')).join(', ')} \\u2192 13:00 \\u306b\\u67a0\\u304c\\u958b\\u3044\\u305f\\u3089\\u7533\\u8fbc\\u307f\\u307e\\u3059`,\n                               `Ng\\u00e0y \\u0111\\u00e3 c\\u00f3 nh\\u01b0ng khung CH\\u01afA m\\u1edf: ${unopened.map((d) => d.slice(5).replace('-', '/')).join(', ')} \\u2192 13:00 khung m\\u1edf l\\u00e0 \\u0111\\u0103ng k\\u00fd`));\n    const tomorrow = jstNow().getUTCHours() * 60 + jstNow().getUTCMinutes() >= OPEN_H * 60 + OPEN_M;\n    log(L(`13:00 \\u81ea\\u52d5\\u30b9\\u30bf\\u30fc\\u30c8\\uff1a\\u5f85\\u6a5f\\u958b\\u59cb\\uff08${tomorrow ? '\\u660e\\u65e5' : '\\u4eca\\u65e5'}\\u306e13:00\\u30fb\\u4eca\\u3042\\u308b\\u65e5\\u4ed8 ${known.length}\\u4ef6\\uff09`,\n          `B\\u1eaft \\u0111\\u1ea7u ch\\u1edd ng\\u00e0y m\\u1edbi l\\u00fac 13:00 ${tomorrow ? 'NG\\u00c0Y MAI' : 'h\\u00f4m nay'} (\\u0111ang c\\u00f3 ${known.length} ng\\u00e0y). Gi\\u1eef Safari m\\u1edf, m\\u00e0n h\\u00ecnh s\\u00e1ng`));\n    popupContinue(modeWait());\n  }\n  async function startNowImpl() { const __session = popupSession; \n    if (multiOn()) return startNowMulti();\n    if (!isRegisterPage()) { log(L('\\u5e97\\u8217\\u3092\\u9078\\u3073\\u300c\\u6642\\u9593\\u5e2f\\u3092\\u9078\\u629e\\u300d\\u3067\\u6765\\u5e97\\u65e5\\u306e\\u753b\\u9762\\u3092\\u958b\\u3044\\u3066\\u304f\\u3060\\u3055\\u3044', 'H\\u00e3y ch\\u1ecdn c\\u1eeda h\\u00e0ng r\\u1ed3i b\\u1ea5m \\u6642\\u9593\\u5e2f\\u3092\\u9078\\u629e \\u0111\\u1ec3 m\\u1edf m\\u00e0n h\\u00ecnh ch\\u1ecdn ng\\u00e0y/khung gi\\u1edd')); return; }\n    let dates = [];\n    try { dates = await popupAwait(datesRetry(), __session); } catch (e) { if (e && e.cancelled) throw e;  log(L('\\u65e5\\u4ed8\\u3092\\u8aad\\u307f\\u8fbc\\u3081\\u307e\\u305b\\u3093: ', 'Kh\\u00f4ng \\u0111\\u1ecdc \\u0111\\u01b0\\u1ee3c danh s\\u00e1ch ng\\u00e0y: ') + e.message); return; }\n    if (!dates.length && wantDays().length) {\n      log(L(`\\u6307\\u5b9a\\u65e5\\uff08${wantText()}\\uff09\\u306f\\u4e88\\u7d04\\u53ef\\u80fd\\u306a\\u65e5\\u4ed8\\u306b\\u3042\\u308a\\u307e\\u305b\\u3093\\uff08\\u53d7\\u4ed8\\u4e2d: ${lastAllDates.map((d) => d.slice(5).replace('-', '/')).join(', ') || '\\u306a\\u3057'}\\uff09`,\n            `Ng\\u00e0y ch\\u1ec9 \\u0111\\u1ecbnh (${wantText()}) kh\\u00f4ng c\\u00f3 trong c\\u00e1c ng\\u00e0y \\u0111ang m\\u1edf (\\u0111ang m\\u1edf: ${lastAllDates.map((d) => d.slice(5).replace('-', '/')).join(', ') || 'kh\\u00f4ng c\\u00f3'})`)); return;\n    }\n    if (!dates.length) { log(L('\\u7533\\u8fbc\\u3067\\u304d\\u308b\\u65e5\\u4ed8\\u304c\\u3042\\u308a\\u307e\\u305b\\u3093', 'Hi\\u1ec7n kh\\u00f4ng c\\u00f3 ng\\u00e0y n\\u00e0o \\u0111\\u1ec3 \\u0111\\u0103ng k\\u00fd')); return; }\n    if (wantDays().length) log(L(`\\u6307\\u5b9a\\u65e5\\u306e\\u307f: ${wantText()}\\uff08\\u9806\\u756a\\u306f\\u30e9\\u30f3\\u30c0\\u30e0\\uff09`, `Ch\\u1ec9 ch\\u1ea1y NG\\u00c0Y CH\\u1ec8 \\u0110\\u1ecaNH: ${wantText()} (th\\u1ee9 t\\u1ef1 ng\\u1eabu nhi\\u00ean)`));\n    Object.assign(st, { active: true, mode: 'run', dates, fresh: false, tDetect: 0, reloads: 0, openAt: 0, runAt: Date.now() });\n    save(K_STATE, st);\n    keepAwake();\n    log(L(`\\u3059\\u3050\\u5b9f\\u884c\\uff1a\\u958b\\u59cb\\uff08${dates.map((d) => d.slice(5)).join(', ')}\\uff09`, `Ch\\u1ea1y Ngay: \\u0111\\u0103ng k\\u00fd t\\u1eeb c\\u00e1c ng\\u00e0y \\u0111ang c\\u00f3 (${dates.map((d) => d.slice(5).replace('-', '/')).join(', ')})`));\n    popupContinue(modeRun());\n  }\n  let soft = null;                         // ch\\u1ebf \\u0111\\u1ed9 t\\u1ea5t c\\u1ea3 c\\u1eeda h\\u00e0ng: { won, fatal, msg } c\\u1ee7a c\\u1eeda h\\u00e0ng \\u0111ang ch\\u1ea1y\n  function finish(msg) {\n    if (soft) { soft.msg = msg; soft.ended = true; log((storeName() ? '[' + storeName().slice(0, 14) + '] ' : '') + msg); return; }\n    cancelPopupTasks();\n    st.active = false; st.mode = null; st.tDetect = 0; st.openAt = 0; save(K_STATE, st);\n    geoStop();\n    try { if (wakeLock) { wakeLock.release(); wakeLock = null; } } catch (e) {}\n    log(msg); setStatus(msg);\n  }\n  function stop() { const waiter = resultWaiter; resultWaiter = null; soft = null; storeNow = 0; finish(L('\\u505c\\u6b62\\u3057\\u307e\\u3057\\u305f', '\\u0110\\u00e3 d\\u1eebng')); if (waiter) waiter(null); }\n\n  function beep(n) {\n    try {\n      const a = new (window.AudioContext || window.webkitAudioContext)();\n      for (let i = 0; i < n; i++) { const o = a.createOscillator(); o.frequency.value = 880; o.connect(a.destination); o.start(a.currentTime + i * 0.5); o.stop(a.currentTime + i * 0.5 + 0.3); }\n    } catch (e) {}\n  }\n  // 17/11: trang \\u0111\\u1eb7t v\\u00e9 = /?store_id=N. Ch\\u1ebf \\u0111\\u1ed9 request ch\\u1ec9 c\\u1ea7n bi\\u1ebft c\\u1eeda h\\u00e0ng (\\u0111\\u00e3 nh\\u1edb l\\u1ea7n m\\u1edf tr\\u01b0\\u1edbc); ch\\u1ebf \\u0111\\u1ed9 b\\u1ea5m giao di\\u1ec7n ph\\u1ea3i \\u0111ang \\u1edf \\u0111\\u00fang trang\n  const onStorePage = () => location.pathname === '/' && /[?&]store_id=\\d+/.test(location.search);\n  const isRegisterPage = () => (useRq() ? storeId() > 0 : onStorePage());\n\n  // ================= B\\u1ea3ng \\u0111i\\u1ec1u khi\\u1ec3n =================\n  let logBuf = load(K_LOG, []);\n  function log(m) {\n    const n = jstNow();\n    const iso = n.toISOString();                   // gi\\u1edd Nh\\u1eadt: MM/DD HH:MM:SS.mmm\n    const line = `${iso.slice(5, 7)}/${iso.slice(8, 10)} ${iso.slice(11, 23)} ${m}`;\n    logBuf.unshift(line); logBuf = logBuf.slice(0, 300); save(K_LOG, logBuf);\n    const el = document.getElementById('pjlog'); if (el) el.textContent = logBuf.join('\\n');\n    const last = document.getElementById('pjlast'); if (last) last.textContent = m;\n  }\n  function setStatus(s) { const el = document.getElementById('pjst'); if (el) el.textContent = s; }\n\n  function buildUI() {\n    if (document.getElementById('pjbox')) return;\n    const ui = load(K_UI, { top: true, small: false });\n    const box = document.createElement('div');\n    box.id = 'pjbox';\n    box.innerHTML = `\n<style>\n#pjbox{position:fixed;left:8px;right:8px;z-index:2147483647;background:#0d1b32;color:#f2f2f2;border:1px solid #527198;\n  border-radius:16px;box-shadow:0 6px 24px #000c;padding:10px 12px;font:13px -apple-system,\"Hiragino Sans\",sans-serif}\n#pjbox.top{top:calc(env(safe-area-inset-top) + 6px)} #pjbox.bot{bottom:calc(env(safe-area-inset-bottom) + 70px)}\n#pjbox .hd{display:flex;align-items:center;gap:6px;font-weight:700}\n#pjbox .hd button.pj{padding:6px 7px;font-size:12px;white-space:nowrap;flex:none}\n#pjbox .hd b{flex:1}\n#pjbox .ttl{flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;justify-content:center}\n#pjbox .ver{font-size:10px;font-weight:600;color:#b7c8df;letter-spacing:.5px;margin-top:1px;line-height:1}\n#pjbox button.pj{border:1px solid #527198;background:#203a5d;color:#ffffff;border-radius:10px;padding:7px 10px;font-size:13px;font-weight:700;\n  text-shadow:none;box-shadow:none}\n#pjbox button.pj.main{background:linear-gradient(180deg,#e8f0fc,#ffffff);color:#10213b;border:0;box-shadow:0 2px 10px #ffffff40}\n#pjbox button.pj.on{background:#284c75;border-color:#ffffff;color:#ffffff}\n#pjbox .row{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px}\n#pjbox .desc{font-size:12px;color:#c2d1e5;margin-top:4px}\n#pjbox .st{font-size:12px;color:#ffffff;margin-top:4px;font-weight:700}\n#pjbox.small .body{display:none}\n#pjbox button,#pjbox input,#pjbox select{font-family:-apple-system,\"Hiragino Sans\",sans-serif}\n#pjlog{display:block;max-height:220px;overflow:auto;white-space:pre-wrap;font:11px ui-monospace,monospace;background:#10213b;color:#cfdeef;border:1px solid #385573;border-radius:8px;padding:6px;margin-top:6px}\n#pjbox a.pj{display:block;flex:1;text-align:center;text-decoration:none;border:1px solid #527198;background:#203a5d;color:#ffffff;\n  border-radius:10px;padding:8px 10px;font-size:13px;font-weight:700}\n#pjgrid{display:none;grid-template-columns:1fr 1fr 1fr;gap:5px;margin-top:6px}\n#pjgrid button{border:1px solid #3a3a44;border-radius:8px;padding:6px 2px;background:#162a46;color:#ffffff;font-size:12px}\n#pjgrid button.p{background:linear-gradient(180deg,#e8f0fc,#ffffff);color:#10213b;border-color:#ffffff;font-weight:700}\n#pjgrid button.x{background:#111;color:#666;text-decoration:line-through}\n</style>\n<div class=\"hd\">${ICON_TAG}<b class=\"ttl\">${TITLE_TAG}<span class=\"ver\">v${SYNOVA_VERSION}</span></b>\n  <button class=\"pj\" id=\"pjpos\">${L('\\u4e0a\\u4e0b', 'L\\u00ean/Xu\\u1ed1ng')}</button><button class=\"pj\" id=\"pjsmall\">${L('\\u96a0\\u3059', '\\u1ea8n')}</button></div>\n<div class=\"st\" id=\"pjst\"></div>\n<div class=\"body\">\n  <div class=\"desc\">${L('12:59:50\\u304b\\u3089\\u81ea\\u52d5\\u3067\\u7533\\u8fbc\\u307f\\uff08\\u65b0\\u3057\\u3044\\u65e5\\u4ed8 \\u2192 \\u512a\\u5148\\u306e\\u6642\\u9593 \\u2192 \\u62bd\\u9078\\u306b\\u53c2\\u52a0 \\u2192 \\u540c\\u610f\\uff09\\u3002\\u300c\\u3059\\u3050\\u5b9f\\u884c\\u300d= \\u4eca\\u3042\\u308b\\u65e5\\u4ed8\\u3067\\u4eca\\u3059\\u3050\\u7533\\u8fbc\\u307f\\u3001\\u6e80\\u5e2d\\u306a\\u3089\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u67a0\\u3092\\u76e3\\u8996\\u3057\\u3066\\u7a7a\\u304d\\u304c\\u51fa\\u305f\\u3089\\u7533\\u8fbc\\u307f\\u3002\\u5f85\\u6a5f\\u4e2d\\u306f Safari \\u3092\\u958b\\u3044\\u305f\\u307e\\u307e\\u753b\\u9762\\u3092\\u3064\\u3051\\u3066\\u304a\\u3044\\u3066\\u304f\\u3060\\u3055\\u3044',\n    'T\\u1eeb 12:59:50 (gi\\u1edd Nh\\u1eadt) t\\u1ef1 d\\u00f2 \\u2192 ch\\u1ecdn ng\\u00e0y m\\u1edbi \\u2192 khung \\u01b0u ti\\u00ean \\u2192 \\u62bd\\u9078\\u306b\\u53c2\\u52a0 \\u2192 \\u540c\\u610f. \"Ch\\u1ea1y Ngay\" = \\u0111\\u0103ng k\\u00fd ngay v\\u1edbi c\\u00e1c ng\\u00e0y \\u0111ang c\\u00f3, h\\u1ebft ch\\u1ed7 th\\u00ec t\\u1ef1 canh v\\u00e9 h\\u1ee7y, c\\u00f3 ch\\u1ed7 l\\u00e0 \\u0111\\u0103ng k\\u00fd. L\\u00fac ch\\u1edd: \\u0111\\u1ec3 Safari m\\u1edf \\u1edf trang n\\u00e0y, m\\u00e0n h\\u00ecnh s\\u00e1ng.')}</div>\n  <div class=\"row\"><select id=\"pjstore\" style=\"flex:1;min-width:0;box-sizing:border-box;background:#14243d;color:#f2f2f2;border:1px solid #527198;border-radius:10px;padding:8px 10px;font-size:13px;font-weight:700\"></select></div>\n  <div class=\"row\"><input id=\"pjdays\" type=\"text\" inputmode=\"text\" autocomplete=\"off\" autocapitalize=\"off\" autocorrect=\"off\" spellcheck=\"false\"\n    placeholder=\"${L('\\u6307\\u5b9a\\u65e5 \\u4f8b 11/20&11/21\\uff08\\u7a7a\\u6b04=\\u5168\\u65e5\\uff09', 'Ng\\u00e0y ch\\u1ec9 \\u0111\\u1ecbnh: 11/20&11/21 (tr\\u1ed1ng = m\\u1ecdi ng\\u00e0y)')}\"\n    style=\"flex:1;min-width:0;box-sizing:border-box;background:#14243d;color:#f2f2f2;border:1px solid #527198;border-radius:10px;padding:8px 10px;font-size:13px;-webkit-appearance:none\"></div>\n  <div class=\"row\">\n    <button class=\"pj main\" id=\"pjwait\">${L('13:00 \\u81ea\\u52d5\\u30b9\\u30bf\\u30fc\\u30c8', 'Ch\\u1edd ng\\u00e0y m\\u1edbi l\\u00fac 13:00')}</button>\n    <button class=\"pj main\" id=\"pjnow\">${L('\\u3059\\u3050\\u5b9f\\u884c', 'Ch\\u1ea1y Ngay')}</button>\n  </div>\n  <div class=\"row\">\n    <button class=\"pj\" id=\"pjstop\">${L('\\u505c\\u6b62', '\\u0110\\u00f3ng / D\\u1eebng')}</button>\n    <button class=\"pj\" id=\"pjlogb\">${L('\\u30ed\\u30b0\\u3092\\u898b\\u308b', 'Xem Log')}</button>\n    <button class=\"pj\" id=\"pjset\">${L('\\u6642\\u9593\\u306e\\u8a2d\\u5b9a', 'C\\u00e0i khung gi\\u1edd')}</button>\n    <button class=\"pj\" id=\"pjcap\">CapSolver</button>\n  </div>\n  <div class=\"desc\" id=\"pjlast\"></div>\n  <div id=\"pjgrid\"></div>\n  <div id=\"pjcapw\" style=\"display:none\">\n    <div class=\"desc\">${L((CAP_RELAY ? '\\u7a7a\\u6b04 = SYNOVA \\u5171\\u6709\\u30ad\\u30fc\\u3067\\u81ea\\u52d5\\u89e3\\u6c7a\\uff08\\u5165\\u529b\\u4e0d\\u8981\\uff09\\u3002' : '\\u7a7a\\u6b04 = \\u8a8d\\u8a3c\\uff08\\u30c1\\u30a7\\u30c3\\u30af\\uff09\\u3092\\u81ea\\u5206\\u3067\\u30bf\\u30c3\\u30d7\\u3002') + '\\u81ea\\u5206\\u306e CapSolver \\u30ad\\u30fc\\u3092\\u5165\\u308c\\u308b\\u3068\\u305d\\u3061\\u3089\\u3092\\u4f7f\\u7528\\uff081\\u56de \\u7d04$0.0012\\uff09', (CAP_RELAY ? '\\u0110\\u1ec3 tr\\u1ed1ng = BOT d\\u00f9ng key chung SYNOVA t\\u1ef1 gi\\u1ea3i (kh\\u00f4ng c\\u1ea7n nh\\u1eadp). ' : '\\u0110\\u1ec3 tr\\u1ed1ng = b\\u1ea1n ph\\u1ea3i t\\u1ef1 b\\u1ea5m \\u00f4 x\\u00e1c nh\\u1eadn Cloudflare. ') + 'Nh\\u1eadp key CapSolver ri\\u00eang th\\u00ec BOT d\\u00f9ng key ri\\u00eang (~$0.0012/l\\u01b0\\u1ee3t)')}</div>\n    <div class=\"row\"><input id=\"pjcapk\" type=\"text\" placeholder=\"CAP-...\" autocomplete=\"off\" autocapitalize=\"off\" autocorrect=\"off\" spellcheck=\"false\"></div>\n    <div class=\"row\">\n      <button class=\"pj main\" id=\"pjcaps\">${L('\\u4fdd\\u5b58', 'L\\u01b0u key')}</button>\n      <button class=\"pj\" id=\"pjcapb\">${L('\\u6b8b\\u9ad8', 'Xem s\\u1ed1 d\\u01b0')}</button>\n      <button class=\"pj\" id=\"pjcapx\">${L('\\u524a\\u9664', 'X\\u00f3a key')}</button>\n    </div>\n    <div class=\"row\"><a class=\"pj\" id=\"pjcapbuy\" href=\"https://dashboard.capsolver.com/dashboard/overview\" target=\"_blank\" rel=\"noopener\">\\ud83d\\udd17 ${L('CapSolver \\u3067\\u30ad\\u30fc\\u53d6\\u5f97\\u30fb\\u30c1\\u30e3\\u30fc\\u30b8', 'Mua / n\\u1ea1p ti\\u1ec1n key CapSolver')}</a></div>\n    <div class=\"desc\" id=\"pjcapst\"></div>\n  </div>\n  <div id=\"pjlogw\" style=\"display:none\"><div class=\"row\"><button class=\"pj\" id=\"pjclr\">${L('\\u30ed\\u30b0\\u6d88\\u53bb', 'X\\u00f3a log')}</button></div><div id=\"pjlog\"></div></div>\n</div>`;\n    document.body.appendChild(box);\n    const bub = synovaBubble('pjbub', () => { ui.hide = false; apply(); });\n    const apply = () => {\n      box.className = ui.top ? 'top' : 'bot';\n      box.style.display = ui.hide ? 'none' : '';\n      if (ui.hide) bub.show(ui.top, st.active); else bub.hide();\n      save(K_UI, ui);\n    };\n    apply();\n    const $ = (id) => document.getElementById(id);\n    $('pjpos').onclick = () => { ui.top = !ui.top; apply(); };\n    $('pjsmall').onclick = () => { ui.hide = true; apply(); };\n    setInterval(() => { if (ui.hide) bub.show(ui.top, st.active); }, 1000);\n    $('pjwait').onclick = () => { if (!st.active) { log(L('13:00 \\u81ea\\u52d5\\u30b9\\u30bf\\u30fc\\u30c8\\u3092\\u62bc\\u3057\\u307e\\u3057\\u305f', '\\u0110\\u00e3 b\\u1ea5m Ch\\u1edd 13:00')); startWait(); } else log(L('BOT \\u5b9f\\u884c\\u4e2d\\u3067\\u3059\\uff08\\u3084\\u308a\\u76f4\\u3059\\u5834\\u5408\\u306f\\u5148\\u306b\\u505c\\u6b62\\uff09', 'BOT \\u0111ang ch\\u1ea1y (mu\\u1ed1n ch\\u1ea1y l\\u1ea1i th\\u00ec b\\u1ea5m D\\u1eebng tr\\u01b0\\u1edbc)')); };\n    // Ch\\u1ea1y Ngay: b\\u1ea5m \\u0111\\u01b0\\u1ee3c c\\u1ea3 khi \\u0111ang ch\\u1edd 13:00 (b\\u1ecf ch\\u1edd, \\u0111\\u0103ng k\\u00fd lu\\u00f4n v\\u1edbi c\\u00e1c ng\\u00e0y \\u0111ang c\\u00f3)\n    $('pjnow').onclick = () => {\n      if (!st.active) { log(L('\\u3059\\u3050\\u5b9f\\u884c\\u3092\\u62bc\\u3057\\u307e\\u3057\\u305f', '\\u0110\\u00e3 b\\u1ea5m Ch\\u1ea1y Ngay')); startNow(); return; }\n      if (st.mode === 'mwait') { st.mode = 'mwatch'; save(K_STATE, st); log(L('\\u5f85\\u6a5f\\u3092\\u3084\\u3081\\u3066\\u4eca\\u3059\\u3050\\u5b9f\\u884c\\uff08\\u5168\\u5e97\\u8217\\uff09', 'B\\u1ecf ch\\u1edd 13:00 \\u2013 ch\\u1ea1y ngay (t\\u1ea5t c\\u1ea3 c\\u1eeda h\\u00e0ng)')); popupContinue(modeWatchMulti()); }\n      else if (st.mode === 'mwatch' || st.mode === 'mrun') log(L('\\u5168\\u5e97\\u8217\\u30e2\\u30fc\\u30c9\\u3067\\u5b9f\\u884c\\u4e2d\\u3067\\u3059', 'BOT \\u0111ang ch\\u1ea1y ch\\u1ebf \\u0111\\u1ed9 t\\u1ea5t c\\u1ea3 c\\u1eeda h\\u00e0ng'));\n      else if (st.mode === 'wait' || st.mode === 'init') { stop(); st.mode = null; save(K_STATE, st); log(L('\\u5f85\\u6a5f\\u3092\\u3084\\u3081\\u3066\\u4eca\\u3059\\u3050\\u5b9f\\u884c', 'B\\u1ecf ch\\u1edd 13:00 \\u2013 ch\\u1ea1y ngay')); startNow(); }\n      else if (st.mode === 'watch') log(L('\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u67a0\\u3092\\u76e3\\u8996\\u4e2d\\u3067\\u3059\\uff08\\u7a7a\\u304d\\u304c\\u51fa\\u305f\\u3089\\u81ea\\u52d5\\u3067\\u7533\\u8fbc\\uff09', 'BOT \\u0111ang canh v\\u00e9 h\\u1ee7y (c\\u00f3 ch\\u1ed7 tr\\u1ed1ng s\\u1ebd t\\u1ef1 \\u0111\\u0103ng k\\u00fd)'));\n      else log(L('BOT \\u5b9f\\u884c\\u4e2d\\u3067\\u3059\\uff08\\u3084\\u308a\\u76f4\\u3059\\u5834\\u5408\\u306f\\u5148\\u306b\\u505c\\u6b62\\uff09', 'BOT \\u0111ang ch\\u1ea1y (mu\\u1ed1n ch\\u1ea1y l\\u1ea1i th\\u00ec b\\u1ea5m D\\u1eebng tr\\u01b0\\u1edbc)'));\n    };\n    $('pjstop').onclick = () => { stop(); };\n    $('pjlogb').onclick = () => { const w = $('pjlogw'); w.style.display = w.style.display === 'block' ? 'none' : 'block'; $('pjlog').textContent = logBuf.join('\\n'); };\n    $('pjclr').onclick = () => { logBuf = []; save(K_LOG, logBuf); $('pjlog').textContent = ''; $('pjlast').textContent = ''; };\n    $('pjset').onclick = () => { const g = $('pjgrid'); const on = g.style.display !== 'grid'; g.style.display = on ? 'grid' : 'none'; $('pjset').classList.toggle('on', on); drawGrid(); };\n    // CapSolver: key ri\\u00eang l\\u01b0u tr\\u00ean m\\u00e1y (localStorage), ch\\u1ec9 g\\u1eedi t\\u1edbi api.capsolver.com; kh\\u00f4ng c\\u00f3 key ri\\u00eang -> key chung qua Worker\n    const mask = (k) => k.slice(0, 8) + '\\u2026' + k.slice(-4);\n    const capSt = (m) => { $('pjcapst').textContent = m; };\n    const capBtn = () => {\n      const k = capKey(), sh = !k && capShared();\n      $('pjcap').textContent = 'CapSolver ' + (k || sh ? '\\u2713' : '\\u2715');\n      $('pjcap').classList.toggle('on', !!(k || sh));\n      capSt(k ? L('\\u4f7f\\u7528\\u4e2d\\u306e\\u30ad\\u30fc: ', '\\u0110ang d\\u00f9ng key: ') + mask(k)\n        : sh ? L('SYNOVA \\u5171\\u6709\\u30ad\\u30fc\\u3092\\u4f7f\\u7528\\u4e2d\\uff08\\u5165\\u529b\\u4e0d\\u8981\\uff09\\u3002\\u81ea\\u5206\\u306e\\u30ad\\u30fc\\u3092\\u5165\\u308c\\u308b\\u3068\\u305d\\u3061\\u3089\\u3092\\u512a\\u5148', '\\u0110ang d\\u00f9ng key chung SYNOVA (kh\\u00f4ng c\\u1ea7n nh\\u1eadp). Nh\\u1eadp key ri\\u00eang th\\u00ec BOT d\\u00f9ng key ri\\u00eang')\n        : L('\\u30ad\\u30fc\\u306a\\u3057\\uff08\\u8a8d\\u8a3c\\u306f\\u624b\\u52d5\\u30bf\\u30c3\\u30d7\\uff09', 'Ch\\u01b0a c\\u00f3 key (t\\u1ef1 b\\u1ea5m \\u00f4 x\\u00e1c nh\\u1eadn)'));\n    };\n    async function capBalance() { const __session = popupSession; \n      const key = capKey();\n      if (!key) { capSt(capShared() ? L('\\u5171\\u6709\\u30ad\\u30fc\\u306e\\u6b8b\\u9ad8\\u306f\\u7ba1\\u7406\\u8005\\u304c\\u7ba1\\u7406\\u3057\\u3066\\u3044\\u307e\\u3059', 'S\\u1ed1 d\\u01b0 key chung do admin qu\\u1ea3n l\\u00fd') : L('\\u30ad\\u30fc\\u306a\\u3057', 'Ch\\u01b0a c\\u00f3 key')); return; }\n      capSt(L('\\u6b8b\\u9ad8\\u3092\\u78ba\\u8a8d\\u4e2d\\u2026', '\\u0110ang xem s\\u1ed1 d\\u01b0\\u2026'));\n      try {\n        const j = await popupAwait(capApi('getBalance', { clientKey: key }), __session);\n        const m = L(`\\u6b8b\\u9ad8 $${j.balance}\\uff08\\u7d04 ${Math.floor(j.balance / CAP_PRICE)} \\u56de\\uff09`, `S\\u1ed1 d\\u01b0 $${j.balance} (~${Math.floor(j.balance / CAP_PRICE)} l\\u01b0\\u1ee3t gi\\u1ea3i)`);\n        capSt(mask(key) + ' \\u00b7 ' + m); log('CapSolver ' + m);\n      } catch (e) { if (e && e.cancelled) throw e;  capSt(L('\\u30a8\\u30e9\\u30fc: ', 'L\\u1ed7i: ') + e.message); }\n    }\n    // \\u00f4 ch\\u1ecdn c\\u1eeda h\\u00e0ng: ch\\u1ecdn xong BOT m\\u1edf trang \\u0111\\u1eb7t v\\u00e9 c\\u1ee7a c\\u1eeda h\\u00e0ng \\u0111\\u00f3 (/?store_id=N)\n    const fillStores = () => {\n      const sel = $('pjstore'), sid = storeId();\n      sel.innerHTML = '';\n      const add = (v, t) => { const o = document.createElement('option'); o.value = String(v); o.textContent = t; sel.appendChild(o); };\n      if (!storesCache.length || !sid) add(0, storesCache.length ? L('\\u5e97\\u8217\\u3092\\u9078\\u629e\\u3057\\u3066\\u304f\\u3060\\u3055\\u3044', 'Ch\\u1ecdn c\\u1eeda h\\u00e0ng') : L('\\u5e97\\u8217\\u3092\\u9078\\u629e\\uff08\\u30ed\\u30b0\\u30a4\\u30f3\\u5f8c\\u306b\\u8868\\u793a\\uff09', 'Ch\\u1ecdn c\\u1eeda h\\u00e0ng (hi\\u1ec7n sau khi \\u0111\\u0103ng nh\\u1eadp)'));\n      for (const x of storesCache) add(x.id, x.name);\n      if (sid && !storesCache.some((x) => x.id === sid)) add(sid, 'Store ' + sid);\n      if (storesCache.length > 1) add('all', L('\\ud83c\\udfb2 \\u5168\\u5e97\\u8217\\uff08\\u7a7a\\u304d\\u304c\\u51fa\\u305f\\u5e97\\u8217\\u304b\\u3089\\u30fb\\u30ea\\u30af\\u30a8\\u30b9\\u30c8\\u65b9\\u5f0f\\uff09', '\\ud83c\\udfb2 T\\u1ea5t c\\u1ea3 c\\u1eeda h\\u00e0ng (c\\u1eeda h\\u00e0ng n\\u00e0o c\\u00f3 ch\\u1ed7 th\\u00ec \\u0111\\u0103ng k\\u00fd)'));\n      sel.value = multiOn() && storesCache.length > 1 ? 'all' : String(sid || 0);\n    };\n    fillStores();\n    // ng\\u00e0y ch\\u1ec9 \\u0111\\u1ecbnh: l\\u01b0u ngay khi g\\u00f5; r\\u1eddi \\u00f4 th\\u00ec ghi log cho bi\\u1ebft BOT hi\\u1ec3u th\\u1ebf n\\u00e0o\n    $('pjdays').value = String(load(K_DAYS, '') || '');\n    $('pjdays').oninput = () => save(K_DAYS, $('pjdays').value.trim());\n    $('pjdays').onchange = () => {\n      const raw = $('pjdays').value.trim();\n      save(K_DAYS, raw);\n      if (!raw) log(L('\\u6307\\u5b9a\\u65e5\\u306a\\u3057\\uff08\\u3059\\u3079\\u3066\\u306e\\u65e5\\uff09', 'B\\u1ecf ng\\u00e0y ch\\u1ec9 \\u0111\\u1ecbnh (ch\\u1ea1y m\\u1ecdi ng\\u00e0y)'));\n      else if (!wantDays().length) log(L('\\u6307\\u5b9a\\u65e5\\u306e\\u5f62\\u5f0f\\u304c\\u9055\\u3044\\u307e\\u3059\\uff08\\u4f8b 11/20&11/21\\uff09', 'Kh\\u00f4ng hi\\u1ec3u ng\\u00e0y ch\\u1ec9 \\u0111\\u1ecbnh \\u2013 h\\u00e3y ghi ki\\u1ec3u 11/20&11/21'));\n      else log(L(`\\u6307\\u5b9a\\u65e5: ${wantText()}\\uff08\\u9806\\u756a\\u306f\\u30e9\\u30f3\\u30c0\\u30e0\\uff09`, `Ng\\u00e0y ch\\u1ec9 \\u0111\\u1ecbnh: ${wantText()} (th\\u1ee9 t\\u1ef1 ng\\u1eabu nhi\\u00ean)`) + (st.active ? L('\\uff08\\u6b21\\u306e\\u78ba\\u8a8d\\u304b\\u3089\\u53cd\\u6620\\uff09', ' \\u2013 \\u00e1p d\\u1ee5ng t\\u1eeb l\\u01b0\\u1ee3t d\\u00f2 k\\u1ebf ti\\u1ebfp') : ''));\n    };\n    $('pjstore').onchange = () => {\n      if ($('pjstore').value === 'all') {\n        if (st.active) { log(L('\\u5b9f\\u884c\\u4e2d\\u306f\\u5e97\\u8217\\u3092\\u5909\\u66f4\\u3067\\u304d\\u307e\\u305b\\u3093\\uff08\\u5148\\u306b\\u505c\\u6b62\\uff09', 'BOT \\u0111ang ch\\u1ea1y \\u2013 b\\u1ea5m D\\u1eebng tr\\u01b0\\u1edbc r\\u1ed3i m\\u1edbi \\u0111\\u1ed5i c\\u1eeda h\\u00e0ng')); fillStores(); return; }\n        save(K_MULTI, true);\n        log(L('\\u5168\\u5e97\\u8217\\u30e2\\u30fc\\u30c9\\u3092\\u9078\\u629e\\uff08\\u6642\\u9593\\u306e\\u512a\\u5148\\u306f\\u5e97\\u8217\\u3054\\u3068\\u306b\\u8a2d\\u5b9a: \\u5148\\u306b\\u5404\\u5e97\\u8217\\u3092\\u9078\\u3093\\u3067\\u300c\\u6642\\u9593\\u306e\\u8a2d\\u5b9a\\u300d\\uff09', '\\u0110\\u00e3 ch\\u1ecdn T\\u1ea4T C\\u1ea2 C\\u1eecA H\\u00c0NG (\\u01b0u ti\\u00ean khung gi\\u1edd c\\u00e0i ri\\u00eang t\\u1eebng c\\u1eeda h\\u00e0ng: ch\\u1ecdn t\\u1eebng c\\u1eeda h\\u00e0ng \\u2192 C\\u00e0i khung gi\\u1edd, r\\u1ed3i m\\u1edbi ch\\u1ecdn m\\u1ee5c n\\u00e0y)'));\n        return;\n      }\n      const n = Number($('pjstore').value) || 0;\n      if (!n) return;\n      if (st.active) { log(L('\\u5b9f\\u884c\\u4e2d\\u306f\\u5e97\\u8217\\u3092\\u5909\\u66f4\\u3067\\u304d\\u307e\\u305b\\u3093\\uff08\\u5148\\u306b\\u505c\\u6b62\\uff09', 'BOT \\u0111ang ch\\u1ea1y \\u2013 b\\u1ea5m D\\u1eebng tr\\u01b0\\u1edbc r\\u1ed3i m\\u1edbi \\u0111\\u1ed5i c\\u1eeda h\\u00e0ng')); fillStores(); return; }\n      save(K_STORE, n); save(K_MULTI, false);\n      log(L('\\u5e97\\u8217\\u3092\\u9078\\u629e: ', '\\u0110\\u00e3 ch\\u1ecdn c\\u1eeda h\\u00e0ng: ') + (storeName(n) || n));\n      if (!(location.pathname === '/' && new URLSearchParams(location.search).get('store_id') === String(n))) location.href = '/?store_id=' + n;\n      else drawGrid();\n    };\n    if (getTok()) loadStores().then(() => { fillStores(); if ($('pjgrid').style.display === 'grid') drawGrid(); }).catch(() => {});\n    capBtn();\n    if (CAP_RELAY) { $('pjcap').style.display = 'none'; $('pjcapw').style.display = 'none'; }   // key chung: kh\\u00f4ng c\\u1ea7n khung nh\\u1eadp key\n    $('pjcap').onclick = () => {\n      const w = $('pjcapw'), on = w.style.display !== 'block';\n      w.style.display = on ? 'block' : 'none';\n      if (on) { $('pjcapk').value = String(load(K_CAP, '') || ''); capBtn(); }\n    };\n    $('pjcaps').onclick = () => {\n      const v = $('pjcapk').value.replace(/\\s+/g, '');\n      if (v && !/^CAP-[0-9A-F]{20,}$/i.test(v)) { capSt(L('\\u30ad\\u30fc\\u306e\\u5f62\\u5f0f\\u304c\\u9055\\u3044\\u307e\\u3059\\uff08CAP-\\u2026\\uff09', 'Key kh\\u00f4ng \\u0111\\u00fang d\\u1ea1ng (CAP-\\u2026)')); return; }\n      save(K_CAP, v); capErrUntil = 0; tsPool = []; capBtn();\n      if (v) capBalance();\n    };\n    $('pjcapb').onclick = capBalance;\n    $('pjcapx').onclick = () => { save(K_CAP, ''); $('pjcapk').value = ''; tsPool = []; capBtn(); };\n    $('pjlast').textContent = logBuf[0] ? logBuf[0].replace(/^\\S+ \\S+ /, '') : '';\n    setStatus(st.active ? (st.mode === 'wait' || st.mode === 'mwait' ? L('13:00 \\u5f85\\u6a5f\\u4e2d', 'Ch\\u1edd 13:00 gi\\u1edd Nh\\u1eadt') : st.mode === 'mwatch' || st.mode === 'mrun' ? L('\\u76e3\\u8996\\u4e2d\\uff08\\u5168\\u5e97\\u8217\\uff09\\u2026', '\\u0110ang canh (t\\u1ea5t c\\u1ea3 c\\u1eeda h\\u00e0ng)\\u2026') : st.mode === 'watch' ? L('\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u67a0\\u3092\\u76e3\\u8996\\u4e2d\\u2026', '\\u0110ang canh v\\u00e9 h\\u1ee7y\\u2026') : L('\\u7533\\u8fbc\\u4e2d\\u2026', '\\u0110ang \\u0111\\u0103ng k\\u00fd\\u2026')) : L('\\u505c\\u6b62\\u4e2d', '\\u0110ang t\\u1eaft'));\n  }\n\n  // B\\u1ea5m 1 l\\u1ea7n -> \\u512a\\u5148 N (s\\u1ed1 ti\\u1ebfp theo), l\\u1ea7n n\\u1eefa -> \\u9664\\u5916, l\\u1ea7n n\\u1eefa -> \\u901a\\u5e38\n  function drawGrid() {\n    const g = document.getElementById('pjgrid');\n    const prio = load(prioKey(), {});\n    g.innerHTML = '';\n    for (const t of slotTimes()) {\n      const b = document.createElement('button');\n      const v = prio[t];\n      b.textContent = `${t}  ${typeof v === 'number' ? L('\\u512a\\u5148', '\\u01afu ti\\u00ean ') + v : v === 'x' ? L('\\u9664\\u5916', 'B\\u1ecf') : L('\\u901a\\u5e38', 'Th\\u01b0\\u1eddng')}`;\n      if (typeof v === 'number') b.className = 'p'; else if (v === 'x') b.className = 'x';\n      b.onclick = () => {\n        const p = load(prioKey(), {});\n        if (p[t] == null) { const nums = Object.values(p).filter((x) => typeof x === 'number'); p[t] = (nums.length ? Math.max(...nums) : 0) + 1; }\n        else if (typeof p[t] === 'number') {\n          const n = p[t]; p[t] = 'x';\n          for (const k in p) if (typeof p[k] === 'number' && p[k] > n) p[k]--;    // d\\u1ed3n s\\u1ed1 \\u01b0u ti\\u00ean\n        } else delete p[t];\n        save(prioKey(), p); drawGrid();\n      };\n      g.appendChild(b);\n    }\n  }\n\n  function boot() {\n    if (st.active && !['wait','watch','run','mwait','mwatch','mrun'].includes(st.mode)) { st.active = false; st.mode = null; save(K_STATE, st); }\n    buildUI();\n    if (st.active && st.mode === 'mwait') popupContinue(modeWaitMulti());\n    else if (st.active && (st.mode === 'mwatch' || st.mode === 'mrun')) { st.mode = 'mwatch'; save(K_STATE, st); popupContinue(modeWatchMulti()); }\n    else if (st.active && st.mode === 'wait') popupContinue(modeWait());\n    else if (st.active && st.mode === 'watch') popupContinue(modeWatch());\n    else if (st.active && st.mode === 'run') {\n      if (Date.now() - (st.runAt || 0) > 10 * 60e3) finish(L('\\u524d\\u56de\\u306e\\u7533\\u8fbc\\u306f\\u9014\\u4e2d\\u3067\\u6b62\\u307e\\u3063\\u3066\\u3044\\u307e\\u3057\\u305f \\u2192 \\u30ea\\u30bb\\u30c3\\u30c8\\uff08\\u3082\\u3046\\u4e00\\u5ea6\\u62bc\\u3057\\u3066\\u304f\\u3060\\u3055\\u3044\\uff09', 'L\\u01b0\\u1ee3t \\u0111\\u0103ng k\\u00fd tr\\u01b0\\u1edbc b\\u1ecb d\\u1eebng gi\\u1eefa ch\\u1eebng \\u2192 \\u0111\\u00e3 \\u0111\\u1eb7t l\\u1ea1i, h\\u00e3y b\\u1ea5m ch\\u1ea1y l\\u1ea1i'));\n      else popupContinue(modeRun());\n    }\n  }\n  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);\n  else boot();\n})();\n\n// ===================== \\u30ab\\u30fc\\u30c8 (mellojoyjapan.com / mellojoyus.com) =====================\nif (!SYNOVA_DUP && /mellojoy(japan|us)\\.com$/.test(location.hostname)) {\n  const pjcRun = () => (function () {\n  'use strict';\n  if (!document.body) return;\n\n  const IS_US = /mellojoyus\\.com$/.test(location.hostname);\n  const SHOP = IS_US ? 'MellojoyUS' : 'MellojoyJapan';\n  const WATCH_FROM_SEC = 1;             // b\\u1eaft \\u0111\\u1ea7u qu\\u00e9t 1 gi\\u00e2y tr\\u01b0\\u1edbc gi\\u1edd m\\u1edf (11:59:59)\n  const POLL_MS = 300;                  // nh\\u1ecbp d\\u00f2 th\\u01b0\\u1eddng (t\\u00ednh t\\u1eeb l\\u00fac B\\u1eaeT \\u0110\\u1ea6U l\\u01b0\\u1ee3t tr\\u01b0\\u1edbc)\n  // H\\u00e0ng MelloJoy th\\u01b0\\u1eddng l\\u00ean l\\u00fac 12:00:07\\u201312:00:12 -> 11:59:59\\u201312:00:07 qu\\u00e9t nh\\u1ecbp th\\u01b0\\u1eddng POLL_MS (0,3s),\n  // 12:00:07\\u201312:00:12 qu\\u00e9t t\\u1ed1c \\u0111\\u1ed9 cao: c\\u1ee9 DENSE_MS (0,3s) g\\u1eedi 1 l\\u01b0\\u1ee3t KH\\u00d4NG ch\\u1edd l\\u01b0\\u1ee3t tr\\u01b0\\u1edbc tr\\u1ea3 l\\u1eddi (m\\u1ea1ng ch\\u1eadm v\\u1eabn gi\\u1eef ~3 l\\u01b0\\u1ee3t/gi\\u00e2y),\n  // sau 12:00:12 l\\u1ea1i nh\\u1ecbp th\\u01b0\\u1eddng. 0,1s \\u0111\\u00e3 th\\u1eed: b\\u1ecb Shopify ch\\u1eb7n c\\u1ea3 IP h\\u00e0ng ch\\u1ee5c ph\\u00fat (24/10).\n  // c\\u1ee9 DENSE_MS g\\u1eedi 1 l\\u01b0\\u1ee3t, kh\\u00f4ng ch\\u1edd l\\u01b0\\u1ee3t tr\\u01b0\\u1edbc (t\\u1ed1i \\u0111a MAX_INFLIGHT l\\u01b0\\u1ee3t c\\u00f9ng l\\u00fac); l\\u01b0\\u1ee3t n\\u00e0o th\\u1ea5y h\\u00e0ng tr\\u01b0\\u1edbc th\\u00ec th\\u00eam gi\\u1ecf.\n  const DENSE_MS = 300, DENSE_FROM_MS = 7000, DENSE_FOR_MS = 12000, MAX_INFLIGHT = 4;   // t\\u1ed1c \\u0111\\u1ed9 cao 12:00:07 \\u2192 12:00:12\n  // 429: ngh\\u1ec9 ng\\u1eafn r\\u1ed3i t\\u0103ng d\\u1ea7n 0,3 \\u2192 0,6 \\u2192 1,2 \\u2192 t\\u1ed1i \\u0111a 2 gi\\u00e2y; g\\u1eedi \\u0111\\u01b0\\u1ee3c l\\u1ea1i th\\u00ec v\\u1ec1 0. C\\u00f3 Retry-After th\\u00ec theo (\\u2264 2s)\n  const monitorDelay = (value, minimum) => {\n    const ms = Number(value);\n    return Number.isFinite(ms) && ms > 0 ? Math.min(30000, Math.max(minimum, Math.round(ms))) : 0;\n  };\n  const BACKOFF_MIN = 300, BACKOFF_MAX = 2000;\n  const GIVE_UP_MIN = 10;               // qu\\u00e1 gi\\u1edd m\\u1edf 10 ph\\u00fat kh\\u00f4ng th\\u1ea5y h\\u00e0ng th\\u00ec d\\u1eebng\n  // Mellojoy US KH\\u00d4NG b\\u00e1n gi\\u1edd c\\u1ed1 \\u0111\\u1ecbnh (m\\u1edf theo LIVE TikTok c\\u1ee7a k\\u00eanh US, user b\\u00e1o 29/10):\n  // b\\u1ea5m l\\u00e0 canh li\\u00ean t\\u1ee5c t\\u1edbi khi mua \\u0111\\u01b0\\u1ee3c / b\\u1ea5m D\\u1eebng, nh\\u1ecbp ch\\u1eadm h\\u01a1n \\u0111\\u1ec3 canh h\\u00e0ng gi\\u1edd li\\u1ec1n kh\\u00f4ng b\\u1ecb Shopify ch\\u1eb7n\n  // 0,5s/l\\u1ea7n l\\u00fac th\\u01b0\\u1eddng; shop v\\u1eeba thay \\u0111\\u1ed5i (\\u0111\\u0103ng m\\u00f3n m\\u1edbi, \\u0111\\u1ed5i t\\u1ed3n kho\\u2026) -> 0,3s trong 90 gi\\u00e2y v\\u00ec h\\u00e0ng th\\u01b0\\u1eddng l\\u00ean ngay sau \\u0111\\u00f3.\n  // B\\u1ecb 429 th\\u00ec t\\u1ef1 gi\\u00e3n nh\\u01b0 b\\u1ea3n Nh\\u1eadt (backoff).\n  const US_POLL_MS = 500, US_BURST_MS = 300, US_BURST_FOR = 90e3;\n  // 9/11 user b\\u00e1o US \"Shop ch\\u01b0a tr\\u1ea3 l\\u1eddi\" m\\u00e3i: th\\u1eadt ra shop tr\\u1ea3 429 + Retry-After 60 m\\u00e0 BOT ch\\u1ec9 ngh\\u1ec9 t\\u1ed1i \\u0111a 2 gi\\u00e2y n\\u00ean kh\\u00f4ng bao gi\\u1edd h\\u1ebft b\\u1ecb ch\\u1eb7n.\n  // US canh l\\u00e2u, kh\\u00f4ng c\\u1ea7n \\u0111ua t\\u1eebng gi\\u00e2y nh\\u01b0 12:00 JP -> ngh\\u1ec9 \\u0111\\u00fang th\\u1eddi gian shop y\\u00eau c\\u1ea7u, sau \\u0111\\u00f3 qu\\u00e9t ch\\u1eadm l\\u1ea1i r\\u1ed3i nhanh d\\u1ea7n khi \\u1ed5n \\u0111\\u1ecbnh.\n  const US_429_MAX = 90e3, US_POLL_MAX = 5000, US_OK_STEP = 20, K_US_BLOCK = 'pjc_us_block_v1';\n  let usPoll = US_POLL_MS, usOk = 0;\n  let usSig = '', usBurstUntil = 0;\n  // Gi\\u1edd m\\u1edf b\\u00e1n theo GI\\u1edc \\u0110I\\u1ec6N THO\\u1ea0I (gi\\u1edd Vi\\u1ec7t Nam). Nh\\u1eadt: 12:00 JST = gi\\u1edd m\\u00e1y c\\u1ee7a 03:00 UTC.\n  const pad = (n) => String(n).padStart(2, '0');\n  // M\\u1ecdi gi\\u1edd trong khung n\\u00e0y l\\u00e0 GI\\u1edc NH\\u1eacT (JST), kh\\u00f4ng ph\\u1ee5 thu\\u1ed9c m\\u00fai gi\\u1edd \\u0111i\\u1ec7n tho\\u1ea1i\n  const jpDefault = '12:00', usDefault = '07:30';\n  // 13/11 (h\\u1ecdc BOT \\u0111\\u1ed1i th\\u1ee7): \\u0111\\u1ebfm gi\\u1edd m\\u1edf theo GI\\u1edc M\\u00c1Y CH\\u1ee6 shop, kh\\u00f4ng theo \\u0111\\u1ed3ng h\\u1ed3 \\u0111i\\u1ec7n tho\\u1ea1i (l\\u1ec7ch 1\\u20132 gi\\u00e2y l\\u00e0 m\\u1ea5t l\\u1ee3i th\\u1ebf).\n  // srvOff = gi\\u1edd m\\u00e1y ch\\u1ee7 \\u2212 gi\\u1edd m\\u00e1y, \\u0111o b\\u1eb1ng header Date c\\u1ee7a /cart.js l\\u00fac 11:59:1x (xem syncClock)\n  let srvOff = 0;\n  const jstNow = () => new Date(Date.now() + srvOff + 9 * 3600e3);   // \\u0111\\u1ecdc b\\u1eb1ng getUTC* = gi\\u1edd JST\n  const K_CFG = 'pjc_cfg_v1', K_ST = 'pjc_state_v1', K_UI = 'pjc_ui_v1', K_LOG = 'pjc_log_v2';\n\n  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };\n  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };\n  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));\n  function msToOpen() {\n    const [h, m] = (cfg.open || '').split(':').map(Number);\n    const n = jstNow();\n    let t = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), h, m, 0) - n;\n    if (t < -GIVE_UP_MIN * 60e3) t += 86400e3;          // \\u0111\\u00e3 qua gi\\u1edd m\\u1edf h\\u00f4m nay -> ch\\u1edd ng\\u00e0y mai\n    return t;\n  }\n\n  // cfg.items: [{kw, qty}] x4 ; cfg.backup: {kw, qty} ; cfg.open: \"HH:MM\" gi\\u1edd Nh\\u1eadt (JST)\n  const cfg = load(K_CFG, { items: [{ kw: '', qty: 1 }, { kw: '', qty: 1 }, { kw: '', qty: 1 }, { kw: '', qty: 1 }], backup: { kw: '', qty: 1 } });\n  if (!cfg.openJst) { cfg.open = IS_US ? usDefault : jpDefault; cfg.openJst = true; }\n  // s\\u1ed1 \\u00f4 t\\u1eeb kh\\u00f3a: m\\u1eb7c \\u0111\\u1ecbnh 4, b\\u1ea5m \\uff0b th\\u00eam t\\u1edbi MAX_KW\n  const MAX_KW = 10;\n  while (cfg.items.length < MAX_KW) cfg.items.push({ kw: '', qty: 1 });\n  if (!cfg.kwCount) cfg.kwCount = Math.max(4, cfg.items.reduce((n, it, i) => (it.kw.trim() ? i + 1 : n), 0));\n  const st = load(K_ST, { active: false });\n  if (/\\/checkouts?\\b/.test(location.pathname) && st.active) { st.active = false; save(K_ST, st); }\n  const K_COAT = 'pjc_co_at_v1';             // l\\u00fac BOT m\\u1edf trang thanh to\\u00e1n (\\u0111\\u1ec3 nh\\u1eadn ra trang 429 ngay sau \\u0111\\u00f3)\n  if (IS_US && st.active && !st.now) { st.now = true; save(K_ST, st); }   // b\\u1ea3n c\\u0169 \\u0111ang ch\\u1edd gi\\u1edd US -> chuy\\u1ec3n sang canh li\\u00ean t\\u1ee5c\n\n  // ---------- Kh\\u1edbp t\\u1eeb kh\\u00f3a: c\\u00e1ch nhau b\\u1eb1ng d\\u1ea5u c\\u00e1ch = ph\\u1ea3i ch\\u1ee9a T\\u1ea4T C\\u1ea2 ----------\n  const norm = (s) => (s || '').normalize('NFKC').toLowerCase();\n  // Mellojoy US \\u0111\\u1eb7t t\\u00ean s\\u1ea3n ph\\u1ea9m b\\u1eb1ng ti\\u1ebfng Anh: g\\u00f5 t\\u00ean Nh\\u1eadt / Vi\\u1ec7t / Anh \\u0111\\u1ec1u nh\\u1eadn (\\u30c9\\u30fc\\u30ca\\u30c4 = donut = b\\u00e1nh v\\u00f2ng\\u2026)\n  const ALIAS = [\n    ['\\u30c9\\u30fc\\u30ca\\u30c4', 'donut', 'doughnut', 'b\\u00e1nh v\\u00f2ng'], ['\\u30d0\\u30bf\\u30fc', 'butter'], ['\\u30b9\\u30d5\\u30ec', 'souffle', 'souffl\\u00e9'],\n    ['\\u30df\\u30cb\\u30e9\\u30f3\\u30c9', 'mini land', 'miniland'], ['\\u30c1\\u30e7\\u30b3\\u30ec\\u30b3\\u30fc\\u30c9', '\\u30c1\\u30e7\\u30b3\\u30ec\\u30fc\\u30c8\\u30ec\\u30b3\\u30fc\\u30c9', 'chocolate record'],\n    ['\\u30c1\\u30e7\\u30b3', '\\u30c1\\u30e7\\u30b3\\u30ec\\u30fc\\u30c8', 'chocolate', 'choco', 's\\u00f4 c\\u00f4 la', 'socola'], ['\\u30e8\\u30fc\\u30b0\\u30eb\\u30c8', 'yogurt', 'yoghurt', 's\\u1eefa chua'],\n    ['\\u30b7\\u30e7\\u30fc\\u30c8\\u30b1\\u30fc\\u30ad', 'shortcake', 'short cake'], ['\\u3044\\u3061\\u3054', '\\u82fa', '\\u30a4\\u30c1\\u30b4', 'strawberry', 'd\\u00e2u'], ['\\u30df\\u30eb\\u30d5\\u30a3\\u30fc\\u30e6', 'mille-feuille', 'millefeuille', 'mille feuille'],\n    ['\\u30c8\\u30fc\\u30b9\\u30c8', 'toast'], ['\\u5bff\\u53f8', '\\u9ba8', '\\u3059\\u3057', 'sushi'], ['\\u30d7\\u30ea\\u30f3', 'pudding', 'purin'], ['\\u30e0\\u30fc\\u30b9', 'mousse'], ['\\u30af\\u30ea\\u30fc\\u30e0', 'cream', 'kem'],\n    ['\\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9', '\\u30d6\\u30e9\\u30a4\\u30f3\\u30c9', 'blind box', 'blindbox', 'h\\u1ed9p m\\u00f9'], ['\\u30b1\\u30fc\\u30ad', 'cake'], ['\\u62b9\\u8336', 'matcha'], ['\\u30ed\\u30fc\\u30eb', 'roll'],\n    ['\\u91ce\\u83dc', 'veg', 'vegetable', 'rau'], ['\\u30d5\\u30eb\\u30fc\\u30c4', 'fruit', 'tr\\u00e1i c\\u00e2y'], ['\\u30e1\\u30ed\\u30b8\\u30e7\\u30a4', 'mellojoy'], ['\\u30e1\\u30ed\\u30a4\\u30a2', '\\u30e1\\u30ed\\u30e4', 'melloya'],\n  ].map((g) => g.map(norm));\n  const aliasOf = (w) => ALIAS.find((g) => g.includes(w)) || [w];\n  const match = (title, kw) => { const t = norm(title); const g = ALIAS.find((x) => x.includes(norm(kw).trim())); if (g) return g.some((a) => t.includes(a)); const ws = norm(kw).split(/\\s+/).filter(Boolean); return ws.length > 0 && ws.every((w) => aliasOf(w).some((a) => t.includes(a))); };\n\n  // th\\u1ed1ng k\\u00ea cho log t\\u1eebng gi\\u00e2y\n  const stats = { req: 0, ok: 0, r429: 0, err: 0, lat: 0 };\n  let last429At = 0, lastErrAt = 0;           // l\\u1ea7n cu\\u1ed1i shop tr\\u1ea3 429 / request treo-l\\u1ed7i (\\u0111\\u1ec3 log ghi \\u0111\\u00fang nguy\\u00ean nh\\u00e2n)\n  // 17/11 log user + monitor: h\\u00e0ng l\\u00ean l\\u00fac 12:00:14 (tr\\u1ec5 h\\u01a1n m\\u1ecdi h\\u00f4m), BOT \\u0111\\u00e3 g\\u1eedi th\\u00eam gi\\u1ecf ~3/gi\\u00e2y + \\u0111\\u1ecdc danh s\\u00e1ch t\\u1eeb 12:00:02\n  // v\\u00e0o c\\u00e1c m\\u00f3n c\\u00f2n \\u1ea9n -> 429 l\\u00fac 12:00:10, r\\u1ed3i c\\u1ee9 ngh\\u1ec9 10s l\\u00e0 g\\u1eedi d\\u1ed3n l\\u1ea1i -> b\\u1ecb ch\\u1eb7n t\\u1edbi h\\u1ebft (trang c\\u0169ng hi\\u1ec7n Too Many Requests).\n  // Gi\\u1edd (JP): CH\\u01afA th\\u1ea5y shop m\\u1edf th\\u00ec g\\u1eedi th\\u01b0a (th\\u00eam gi\\u1ecf 1 l\\u1ea7n/gi\\u00e2y); th\\u1ea5y m\\u1edf (v\\u00e0o gi\\u1ecf / shop tr\\u1ea3 l\\u1eddi kh\\u00e1c \"ch\\u01b0a c\\u00f3 m\\u00f3n\") m\\u1edbi g\\u1eedi nhanh.\n  // B\\u1ecb 429: ngh\\u1ec9 3 \\u2192 6 \\u2192 12 \\u2192 24 \\u2192 48 \\u2192 60 gi\\u00e2y (ho\\u1eb7c l\\u00e2u h\\u01a1n n\\u1ebfu shop y\\u00eau c\\u1ea7u), sau khi ngh\\u1ec9 ch\\u1ec9 g\\u1eedi T\\u1eeaNG request m\\u1ed9t\n  // t\\u1edbi khi shop tr\\u1ea3 l\\u1eddi b\\u00ecnh th\\u01b0\\u1eddng 2 l\\u1ea7n li\\u1ec1n m\\u1edbi ch\\u1ea1y l\\u1ea1i t\\u1ed1c \\u0111\\u1ed9 th\\u01b0\\u1eddng.\n  let shopOpen = false, blk = 0, recover = false, okStreak = 0;\n  const PROBE_GAP = 700, RECOVER_GAP = 1500;     // d\\u00f2: ~1,4 l\\u1ea7n/gi\\u00e2y (0,5s: trang gi\\u1ea3 gi\\u1edbi h\\u1ea1n 15/10s b\\u1ecb 429 tr\\u01b0\\u1edbc khi h\\u00e0ng l\\u00ean), ch\\u1ec9 g\\u1eedi T\\u1eeaNG m\\u00e3 (c\\u1ea3 l\\u00f4 lu\\u00f4n b\\u1ecb t\\u1eeb ch\\u1ed1i khi c\\u00f3 m\\u00e3 h\\u00f4m \\u0111\\u00f3 kh\\u00f4ng ra)\n  function jpOk() { if (recover && ++okStreak >= 2) { recover = false; okStreak = 0; blk = Math.max(0, blk - 1); } }\n  // 18/11: ch\\u01b0a bi\\u1ebft shop cho bao nhi\\u00eau request -> m\\u1ed7i l\\u1ea7n b\\u1ecb 429 ghi BOT \\u0111\\u00e3 g\\u1eedi g\\u00ec trong 10 gi\\u00e2y tr\\u01b0\\u1edbc \\u0111\\u00f3 (\\u0111\\u1ec3 ch\\u1ec9nh nh\\u1ecbp theo s\\u1ed1 th\\u1eadt)\n  // 19/11: 3 log li\\u00ean ti\\u1ebfp (17, 18, 19/11) \\u0111\\u1ec1u b\\u1ecb ch\\u1eb7n khi t\\u1ed5ng request trong ~60 gi\\u00e2y ch\\u1ea1m kho\\u1ea3ng 30\n  // (17/11: 6 \\u0111o gi\\u1edd + ~32 ; 18/11: 6 + ~20 ; 19/11 ch\\u1ebf \\u0111\\u1ed9 Safe: 6 + ~24 r\\u1ed3i link th\\u1eb3ng ra trang 429; ~18 gi\\u00e2y sau g\\u1eedi l\\u1ea1i \\u0111\\u01b0\\u1ee3c\n  //  = \\u0111\\u00fang l\\u00fac 6 request \\u0111o gi\\u1edd l\\u00fac 11:59:10 h\\u1ebft h\\u1ea1n 60 gi\\u00e2y). => coi nh\\u01b0 shop cho ~30 request / 60 gi\\u00e2y / IP (SUY \\u0110O\\u00c1N t\\u1eeb log, ch\\u01b0a c\\u00f3 s\\u1ed1 ch\\u00ednh th\\u1ee9c).\n  // BOT t\\u1ef1 \\u0111\\u1ebfm M\\u1eccI request c\\u1ee7a m\\u00ecnh (\\u0111\\u1ecdc danh s\\u00e1ch, th\\u00eam gi\\u1ecf, \\u0111o gi\\u1edd, m\\u1edf trang) trong 60 gi\\u00e2y, nh\\u1edb c\\u1ea3 qua l\\u1ea7n chuy\\u1ec3n trang:\n  //   qu\\u00e9t danh s\\u00e1ch d\\u1eebng \\u1edf SCAN_BUDGET, d\\u00f2 th\\u00eam gi\\u1ecf m\\u00f9 d\\u1eebng \\u1edf PROBE_BUDGET -> lu\\u00f4n ch\\u1eeba ch\\u1ed7 cho l\\u1ec7nh th\\u00eam gi\\u1ecf th\\u1eadt + m\\u1edf thanh to\\u00e1n.\n  const K_REQ = 'pjc_req_v1', REQ_WIN = 60e3, SCAN_BUDGET = 21, PROBE_BUDGET = 23;\n  const reqLog = (load(K_REQ, []) || []).filter((r) => r && Date.now() - r.t < REQ_WIN && Date.now() >= r.t);\n  const reqNote = (k) => {\n    const now = Date.now();\n    reqLog.push({ t: now, k });\n    while (reqLog.length && now - reqLog[0].t > REQ_WIN) reqLog.shift();\n    if (!IS_US) save(K_REQ, reqLog);\n  };\n  const reqCount = (ms) => { const now = Date.now(), c = { add: 0, list: 0, nav: 0, other: 0, all: 0 }; for (const r of reqLog) if (now - r.t <= ms) { c[r.k] = (c[r.k] || 0) + 1; c.all++; } return c; };\n  // c\\u00f2n ph\\u1ea3i ch\\u1edd bao l\\u00e2u \\u0111\\u1ec3 s\\u1ed1 request trong 60 gi\\u00e2y g\\u1ea7n nh\\u1ea5t xu\\u1ed1ng d\\u01b0\\u1edbi limit (0 = g\\u1eedi \\u0111\\u01b0\\u1ee3c ngay)\n  const budgetWaitMs = (limit) => {\n    if (IS_US) return 0;\n    const now = Date.now(), ts = reqLog.filter((r) => now - r.t < REQ_WIN).map((r) => r.t);\n    return ts.length < limit ? 0 : Math.max(0, ts[ts.length - limit] + REQ_WIN - now + 60);\n  };\n  function jp429(ra) {\n    const now = Date.now();\n    okStreak = 0;\n    if (now < backoffUntil) return;                // nhi\\u1ec1u l\\u01b0\\u1ee3t c\\u00f9ng tr\\u1ea3 429 -> ch\\u1ec9 t\\u00ednh 1 l\\u1ea7n\n    blk = Math.min(6, blk + 1); recover = true;\n    // 19/11: shop ghi \"ch\\u1edd 135 gi\\u00e2y\" nh\\u01b0ng 18 gi\\u00e2y sau \\u0111\\u00e3 g\\u1eedi l\\u1ea1i \\u0111\\u01b0\\u1ee3c -> ngh\\u1ec9 theo c\\u1eeda s\\u1ed5 60 gi\\u00e2y c\\u1ee7a ch\\u00ednh BOT:\n    // ch\\u1edd t\\u1edbi khi s\\u1ed1 request c\\u1ee7a BOT trong 60 gi\\u00e2y g\\u1ea7n nh\\u1ea5t c\\u00f2n <= 14 (t\\u1ed1i thi\\u1ec3u 3 gi\\u00e2y, t\\u1ed1i \\u0111a 45 gi\\u00e2y), r\\u1ed3i g\\u1eedi T\\u1eeaNG request m\\u1ed9t\n    const w = Math.max((Number(ra) || 0) * 1000, 3000 * Math.min(4, blk), budgetWaitMs(15));\n    backoffUntil = now + w;\n    const c = reqCount(REQ_WIN);\n    log(L(`\\uff08\\u76f4\\u524d60\\u79d2\\u306e\\u9001\\u4fe1: \\u5408\\u8a08 ${c.all}\\u56de = \\u4e00\\u89a7 ${c.list}\\u30fb\\u30ab\\u30fc\\u30c8\\u8ffd\\u52a0 ${c.add}\\u30fb\\u30da\\u30fc\\u30b8\\u79fb\\u52d5 ${c.nav}\\u30fb\\u305d\\u306e\\u4ed6 ${c.other}${ra > 0 ? `\\uff0f\\u30b7\\u30e7\\u30c3\\u30d7\\u6307\\u5b9a\\u306e\\u5f85\\u3061\\u6642\\u9593 ${ra}\\u79d2` : ''}\\uff09`,\n          `   (60 gi\\u00e2y tr\\u01b0\\u1edbc \\u0111\\u00f3 BOT \\u0111\\u00e3 g\\u1eedi t\\u1ed5ng ${c.all} request: \\u0111\\u1ecdc danh s\\u00e1ch ${c.list}, th\\u00eam gi\\u1ecf ${c.add}, m\\u1edf trang ${c.nav}, kh\\u00e1c ${c.other}${ra > 0 ? `; shop ghi ch\\u1edd ${ra} gi\\u00e2y` : ''})`));\n    log(L(`\\u26d4 \\u30a2\\u30af\\u30bb\\u30b9\\u5236\\u9650 (429) \\u2192 ${Math.round(w / 1000)}\\u79d2 \\u4f11\\u3093\\u3067\\u304b\\u30891\\u4ef6\\u305a\\u3064\\u518d\\u958b\\uff08\\u540c\\u3058Wi-Fi\\u306e\\u8907\\u6570\\u7aef\\u672b/\\u30bf\\u30d6\\u30fbVPN\\u3092\\u907f\\u3051\\u3066\\u304f\\u3060\\u3055\\u3044\\uff09`,\n          `\\u26d4 Shop ch\\u1eb7n (429) \\u2192 ngh\\u1ec9 ${Math.round(w / 1000)} gi\\u00e2y r\\u1ed3i g\\u1eedi l\\u1ea1i T\\u1eeaNG request m\\u1ed9t (tr\\u00e1nh nhi\\u1ec1u m\\u00e1y/tab c\\u00f9ng Wi-Fi, VPN)`));\n  }\n  let lastFound = '', lastShelf = '', curDense = false, kwStat = [];\n  let lastScan = { sent: 0, ms: 0 };       // l\\u01b0\\u1ee3t qu\\u00e9t v\\u1eeba tr\\u1ea3 v\\u1ec1: g\\u1eedi l\\u00fac n\\u00e0o, m\\u00e1y ch\\u1ee7 tr\\u1ea3 sau bao l\\u00e2u\n  let lastOkAt = 0;                         // l\\u00fac shop tr\\u1ea3 products.json g\\u1ea7n nh\\u1ea5t (log 2/11: request treo -> b\\u1ea3ng KW \\u0111\\u1ee9ng h\\u00ecnh \"c\\u00f2n h\\u00e0ng\" m\\u1ea5y ph\\u00fat m\\u00e0 BOT kh\\u00f4ng qu\\u00e9t)\n  const SCAN_TIMEOUT = 4000;                // qu\\u00e1 4 gi\\u00e2y kh\\u00f4ng tr\\u1ea3 l\\u1eddi -> hu\\u1ef7, l\\u01b0\\u1ee3t sau g\\u1eedi l\\u1ea1i\n  async function getProducts() {\n    const t0 = performance.now(), sent = Date.now();\n    stats.req++; reqNote('list');\n    const ac = new AbortController(), tm = setTimeout(() => ac.abort(), SCAN_TIMEOUT);\n    let ps;\n    try {\n      let r;\n      try { r = await fetch(`/products.json?limit=250&_=${Date.now()}`, { cache: 'no-store', credentials: 'same-origin', signal: ac.signal }); }\n      catch (e) { stats.err++; lastErrAt = Date.now(); throw new Error(e.name === 'AbortError' ? L('\\u5fdc\\u7b54\\u306a\\u3057(4\\u79d2)', 'shop kh\\u00f4ng tr\\u1ea3 l\\u1eddi (4 gi\\u00e2y)') : e.message); }\n      stats.lat += performance.now() - t0;\n      lastScan = { sent, ms: Math.round(performance.now() - t0) };\n      if (r.status === 429) { stats.r429++; last429At = Date.now(); const e = new Error('429'); e.retryAfter = parseFloat(r.headers.get('Retry-After')) || 0; throw e; }\n      if (!r.ok) { stats.err++; lastErrAt = Date.now(); throw new Error('HTTP ' + r.status); }\n      try { ps = (await r.json()).products || []; } catch (e) { stats.err++; lastErrAt = Date.now(); throw new Error(e.name === 'AbortError' ? L('\\u5fdc\\u7b54\\u306a\\u3057(4\\u79d2)', 'shop kh\\u00f4ng tr\\u1ea3 l\\u1eddi (4 gi\\u00e2y)') : e.message); }\n    } finally { clearTimeout(tm); }\n    stats.ok++;\n    lastOkAt = Date.now();\n    if (ps.length) warmOps(ps);\n    if (IS_US) {\n      const sig = ps.map((p) => p.id + ':' + p.updated_at + ':' + (p.variants || []).map((v) => (v.available ? 1 : 0)).join('')).join('|');\n      if (usSig && sig !== usSig) {\n        if (Date.now() > usBurstUntil) log(L('\\u30b7\\u30e7\\u30c3\\u30d7\\u306b\\u5909\\u5316\\u3042\\u308a \\u2192 90\\u79d2\\u9593 \\u9ad8\\u901f\\u76e3\\u8996\\uff080.3\\u79d2\\uff09', 'Shop v\\u1eeba thay \\u0111\\u1ed5i \\u2192 qu\\u00e9t nhanh 0,3 gi\\u00e2y trong 90 gi\\u00e2y'));\n        usBurstUntil = Date.now() + US_BURST_FOR;\n      }\n      usSig = sig;\n    }\n    return ps;\n  }\n  const firstAvail = (p) => (p.variants || []).find((v) => v.available);\n\n  // gi\\u1edbi h\\u1ea1n m\\u1ed7i ng\\u01b0\\u1eddi ghi trong t\\u00ean (VD \"\\u30102 PER PERSON!!!\\u3011\", \"\\u304a\\u4e00\\u4eba\\u69d82\\u70b9\\u307e\\u3067\"): \\u0111\\u1eb7t \\u0111\\u00fang s\\u1ed1 \\u0111\\u00f3 ngay l\\u01b0\\u1ee3t \\u0111\\u1ea7u,\n  // kh\\u1ecfi b\\u1ecb shop t\\u1eeb ch\\u1ed1i r\\u1ed3i th\\u1eed l\\u1ea1i 6 -> 3 -> 2 (log 2/11: ch\\u1ecdn 3 c\\u00e1i m\\u00f3n \"2 PER PERSON\" m\\u1ea5t ~2 gi\\u00e2y m\\u1edbi v\\u00e0o gi\\u1ecf)\n  const perPerson = (t) => { const m = String(t || '').match(/(\\d+)\\s*per\\s*(?:person|customer)|\\u4e00\\u4eba\\u69d8?\\s*(\\d+)\\s*(?:\\u70b9|\\u500b|\\u3064|\\u7bb1)/i); return m ? +(m[1] || m[2]) : 0; };\n  const item = ({ p, v }, qty, prefix) => ({\n    id: v.id, qty: Math.min(qty, perPerson(p.title) || qty), title: prefix + p.title, name: p.title, handle: p.handle, size: v.title || '-', price: v.price,\n    image: (v.featured_image && v.featured_image.src) || (p.images && p.images[0] && p.images[0].src) || '',\n  });\n  // M\\u1ed7i \\u0111\\u01a1n ch\\u1ec9 l\\u1ea5y t\\u1ed1i \\u0111a MAX_PICK m\\u00e3: 10 m\\u00e3 \\u0111i\\u1ec1n s\\u1eb5n, m\\u00e3 n\\u00e0o L\\u00caN K\\u1ec6 (c\\u00f2n h\\u00e0ng) S\\u1edaM NH\\u1ea4T th\\u00ec l\\u1ea5y;\n  // c\\u00f9ng m\\u1ed9t l\\u01b0\\u1ee3t qu\\u00e9t c\\u00f3 nhi\\u1ec1u h\\u01a1n 4 m\\u00e3 c\\u00f2n h\\u00e0ng -> ch\\u1ecdn ng\\u1eabu nhi\\u00ean 4 (user y\\u00eau c\\u1ea7u 26/10)\n  const MAX_PICK = 4;\n  // 13/11 (h\\u1ecdc BOT \\u0111\\u1ed1i th\\u1ee7 v1.30.25): Mellojoy JP b\\u1ed5 sung h\\u00e0ng cho M\\u00d3N C\\u0168 -> m\\u00e3 s\\u1ea3n ph\\u1ea9m (variant) c\\u1ee7a m\\u1ed7i m\\u00e3 h\\u00e0ng gi\\u1eef nguy\\u00ean qua\n  // c\\u00e1c ng\\u00e0y, v\\u00e0 products.json v\\u1eabn li\\u1ec7t k\\u00ea m\\u00f3n \\u0111ang h\\u1ebft h\\u00e0ng. BOT nh\\u1edb variant theo t\\u1eeb kh\\u00f3a \\u1edf M\\u1eccI l\\u01b0\\u1ee3t \\u0111\\u1ecdc danh s\\u00e1ch (l\\u01b0u l\\u00e2u d\\u00e0i),\n  // 11:59:30 \\u0111\\u1ecdc tr\\u01b0\\u1edbc 1 l\\u1ea7n; 12:00:07 \\u2192 12:00:20 g\\u1eedi th\\u1eb3ng /cart/add.js t\\u1eebng m\\u00e3 (kh\\u00f4ng \\u0111\\u1ecdc danh s\\u00e1ch n\\u1eefa) \\u2013 xem preTick().\n  const K_VMAP = 'pjc_vmap_v1';\n  const vmap = load(K_VMAP, {});\n  let vmapDirty = false;\n  // 13/11: b\\u1ea3ng m\\u00e3 -> Variant ID \\u0111\\u00f3ng s\\u1eb5n l\\u00fac build (build.py: restock-monitor + BOT PC). Shop \\u1ea9n m\\u00f3n ngo\\u00e0i gi\\u1edd b\\u00e1n n\\u00ean kh\\u00e1ch m\\u1edbi c\\u00e0i\n  // kh\\u00f4ng t\\u1ef1 h\\u1ecdc \\u0111\\u01b0\\u1ee3c m\\u00e3 -> d\\u00f9ng b\\u1ea3ng n\\u00e0y. [{p: product id, t: t\\u00ean, h: handle, v: [variant id], pr: gi\\u00e1}], m\\u00f3n m\\u1edbi tr\\u01b0\\u1edbc.\n  const VSEED = IS_US ? [] : [{\"p\":10383969976560,\"t\":\"Mellojoy - \\u30e0\\u30fc\\u30b9\\u30af\\u30ea\\u30fc\\u30e0\\u2014\\u2014\\u30df\\u30c7\\u30a3\\u30a2\\u30e0\\u30b5\\u30a4\\u30ba(\\u4e2d\\u53f7)\\u30e1\\u30ed\\u30b8\\u30e7\\u30a4\\u30bf\\u30ed\\u828b\\u30b9\\u30d5\\u30ec\\u3010Z072-12\\u3011\\u3010 \\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093\\u3011\",\"h\":\"mellojoy-\\u30e0\\u30fc\\u30b9\\u30af\\u30ea\\u30fc\\u30e0-\\u30df\\u30c7\\u30a3\\u30a2\\u30e0\\u30b5\\u30a4\\u30ba\\u4e2d\\u53f7\\u30e1\\u30ed\\u30b8\\u30e7\\u30a4\\u30bf\\u30ed\\u828b\\u30b9\\u30d5\\u30ec-z072-12-\\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093-12\\u6b73\\u4ee5\\u4e0a\\u5bfe\\u8c61\",\"v\":[50755623289072],\"pr\":2399},{\"p\":10378248552688,\"t\":\"Mellojoy - \\u30af\\u30ea\\u30fc\\u30df\\u30fc\\u30af\\u30ea\\u30fc\\u30e0&\\u30e0\\u30fc\\u30b9\\u30af\\u30ea\\u30fc\\u30e0\\u2014\\u2014\\u30e1\\u30ed\\u30b8\\u30e7\\u30a4\\u30e2\\u30e1\\u30f3\\u30c9\\u30a6\\u30d5\\u3010Z087\\u3011\\u3010 \\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093\\u3011\",\"h\":\"mellojoy-\\u30af\\u30ea\\u30fc\\u30df\\u30fc\\u30af\\u30ea\\u30fc\\u30e0-\\u30e0\\u30fc\\u30b9\\u30af\\u30ea\\u30fc\\u30e0-\\u30e1\\u30ed\\u30b8\\u30e7\\u30a4\\u30e2\\u30e1\\u30f3\\u30c9\\u30a6\\u30d5-z087-\\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093-12\\u6b73\\u4ee5\\u4e0a\\u5bfe\\u8c61\",\"v\":[50731794399472],\"pr\":2399},{\"p\":10375055343856,\"t\":\"Mellojoy -\\u3082\\u3061\\u3082\\u3061\\u3082\\u3061-\\u30c9\\u30ab\\u30f3\\uff01\\u3084\\u304d\\u3044\\u3082\\u3010Z092-1\\u3011\\u3010\\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093\\u3011\",\"h\":\"mellojoy-\\u3082\\u3061\\u3082\\u3061\\u3082\\u3061-\\u30c9\\u30ab\\u30f3-\\u3084\\u304d\\u3044\\u3082-z092-1-\\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093-12\\u6b73\\u4ee5\\u4e0a\\u5bfe\\u8c61\",\"v\":[50702255358192],\"pr\":2899},{\"p\":10371616932080,\"t\":\"Mellojoy - \\u30e0\\u30fc\\u30b9\\u30af\\u30ea\\u30fc\\u30e0\\u2014\\u2014\\u30df\\u30c7\\u30a3\\u30a2\\u30e0\\u30b5\\u30a4\\u30ba(\\u4e2d\\u53f7)\\u30e1\\u30ed\\u30b8\\u30e7\\u30a4\\u30b7\\u30fc\\u30bd\\u30eb\\u30c8\\u30b9\\u30d5\\u30ec\\u3010Z072-11\\u3011\\u3010\\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093\\u3011\",\"h\":\"mellojoy-\\u30e0\\u30fc\\u30b9\\u30af\\u30ea\\u30fc\\u30e0-\\u30df\\u30c7\\u30a3\\u30a2\\u30e0\\u30b5\\u30a4\\u30ba\\u4e2d\\u53f7\\u30e1\\u30ed\\u30b8\\u30e7\\u30a4\\u30b7\\u30fc\\u30bd\\u30eb\\u30c8\\u30b9\\u30d5\\u30ec-z072-11-\\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093-12\\u6b73\\u4ee5\\u4e0a\\u5bfe\\u8c61\",\"v\":[50685848289520],\"pr\":2399},{\"p\":10369844969712,\"t\":\"Mellojoy - \\u30e0\\u30fc\\u30b9\\u30af\\u30ea\\u30fc\\u30e0&\\u3082\\u3061\\u3082\\u3061\\u3082\\u3061 - \\u30e1\\u30ed\\u30b8\\u30e7\\u30a4\\u30c1\\u30e7\\u30b3\\u30ec\\u30b3\\u30fc\\u30c9\\u3010Z089\\u3011\\u3010 \\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093\\u3011\",\"h\":\"mellojoy-\\u30e0\\u30fc\\u30b9\\u30af\\u30ea\\u30fc\\u30e0-\\u3082\\u3061\\u3082\\u3061\\u3082\\u3061-\\u30e1\\u30ed\\u30b8\\u30e7\\u30a4\\u30c1\\u30e7\\u30b3\\u30ec\\u30b3\\u30fc\\u30c9-z089-\\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093-\\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u3083-12\\u6b73\\u4ee5\\u4e0a\\u5bfe\\u8c61\",\"v\":[50667291476208],\"pr\":2799},{\"p\":10356075397360,\"t\":\"Mellojoy -\\u3082\\u3061\\u3082\\u3061\\u3082\\u3061-\\u30b9\\u30a6\\u30a9\\u30fc\\u30eb\\u30de\\u30a6\\u30b9\\u3010Z084-1\\u3011\\u3010 \\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093\\u3011\",\"h\":\"mellojoy-\\u3082\\u3061\\u3082\\u3061\\u3082\\u3061-\\u30b9\\u30a6\\u30a9\\u30fc\\u30eb\\u30de\\u30a6\\u30b9-z084-1-\\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u3083-12\\u6b73\\u4ee5\\u4e0a\\u5bfe\\u8c61\",\"v\":[50614508191984],\"pr\":2799},{\"p\":10350064206064,\"t\":\"Mellojoy -\\u3082\\u3061\\u3082\\u3061\\u3082\\u3061-\\u30e1\\u30ed\\u30b8\\u30e7\\u30a4\\u30d7\\u30ea\\u30f3\\u30b1\\u30fc\\u30ad\\u3010Z090-1\\u3011\\u3010 \\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093\\u3011\",\"h\":\"mellojoy-\\u3082\\u3061\\u3082\\u3061\\u3082\\u3061-\\u30e1\\u30ed\\u30b8\\u30e7\\u30a4\\u30d7\\u30ea\\u30f3\\u30b1\\u30fc\\u30ad-z090-1-\\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u3083-12\\u6b73\\u4ee5\\u4e0a\\u5bfe\\u8c61\",\"v\":[50592274153712],\"pr\":2399},{\"p\":10339901898992,\"t\":\"Mellojoy -\\u30e0\\u30fc\\u30b9\\u30af\\u30ea\\u30fc\\u30e0 - \\u30aa\\u30fc\\uff01\\u30c9\\u30fc\\u30ca\\u30c4\\u30fc\\u3010A041\\u3011\\u3010 \\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093\\u3011\\u3010 \\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u3083\\u3011\",\"h\":\"mellojoy-\\u30e0\\u30fc\\u30b9\\u30af\\u30ea\\u30fc\\u30e0-\\u30aa\\u30fc-\\u30c9\\u30fc\\u30ca\\u30c4\\u30fca041-\\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093-\\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u3083-12\\u6b73\\u4ee5\\u4e0a\\u5bfe\\u8c61\",\"v\":[50556280537328],\"pr\":2899},{\"p\":10318994374896,\"t\":\"Mellojoy- \\u30e0\\u30fc\\u30b9\\u30af\\u30ea\\u30fc\\u30e0-\\u30e1\\u30ed\\u30b8\\u30e7\\u30a4\\u3042\\u308f\\u3042\\u308f\\u30b3\\u30f3\\u30d3\\u3010Z081\\u3011\\u3010 \\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093\\u3011\",\"h\":\"mellojoy-\\u30e0\\u30fc\\u30b9\\u30af\\u30ea\\u30fc\\u30e0-\\u30e1\\u30ed\\u30b8\\u30e7\\u30a4\\u3042\\u308f\\u3042\\u308f\\u30b3\\u30f3\\u30d3-z081-\\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u3083-12\\u6b73\\u4ee5\\u4e0a\\u5bfe\\u8c61\",\"v\":[50522786627824],\"pr\":3698},{\"p\":10300452339952,\"t\":\"Mellojoy - \\u30af\\u30ea\\u30fc\\u30df\\u30fc\\u30af\\u30ea\\u30fc\\u30e0\\u2014\\u2014\\u30df\\u30c7\\u30a3\\u30a2\\u30e0\\u30b5\\u30a4\\u30ba(\\u4e2d\\u53f7)\\u30e1\\u30ed\\u30b8\\u30e7\\u30a4\\u30bf\\u30ed\\u828b\\u30b9\\u30d5\\u30ec\\u3010Z072-14\\u3011\\u3010 \\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093\\u3011\",\"h\":\"mellojoy-\\u30af\\u30ea\\u30fc\\u30df\\u30fc\\u30af\\u30ea\\u30fc\\u30e0-\\u30df\\u30c7\\u30a3\\u30a2\\u30e0\\u30b5\\u30a4\\u30ba\\u4e2d\\u53f7\\u30e1\\u30ed\\u30b8\\u30e7\\u30a4\\u30bf\\u30ed\\u828b\\u30b9\\u30d5\\u30ec-z072-14-\\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u3083-12\\u6b73\\u4ee5\\u4e0a\\u5bfe\\u8c61\",\"v\":[50483351519472],\"pr\":2399},{\"p\":10299658567920,\"t\":\"Mellojoy - \\u30af\\u30ea\\u30fc\\u30df\\u30fc\\u30af\\u30ea\\u30fc\\u30e0\\u2014\\u2014\\u30df\\u30c7\\u30a3\\u30a2\\u30e0\\u30b5\\u30a4\\u30ba(\\u4e2d\\u53f7)\\u30e1\\u30ed\\u30b8\\u30e7\\u30a4\\u30b7\\u30fc\\u30bd\\u30eb\\u30c8\\u30b9\\u30d5\\u30ec\\u3010Z072-9\\u3011\\u3010\\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093\\u3011\",\"h\":\"mellojoy-\\u30af\\u30ea\\u30fc\\u30df\\u30fc\\u30af\\u30ea\\u30fc\\u30e0-\\u30df\\u30c7\\u30a3\\u30a2\\u30e0\\u30b5\\u30a4\\u30ba\\u4e2d\\u53f7\\u30e1\\u30ed\\u30b8\\u30e7\\u30a4\\u30b7\\u30fc\\u30bd\\u30eb\\u30c8\\u30b9\\u30d5\\u30ec-z072-9-\\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u3083-12\\u6b73\\u4ee5\\u4e0a\\u5bfe\\u8c61\",\"v\":[50481458151664],\"pr\":2399},{\"p\":10294538698992,\"t\":\"Mellojoy -\\u3082\\u3061\\u3082\\u3061\\u3082\\u3061-\\u67f4\\u72ac\\u304a\\u3057\\u308a\\u3010Z076-2\\u3011\\u3010 \\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093\\u3011\",\"h\":\"mellojoy-\\u3082\\u3061\\u3082\\u3061\\u3082\\u3061-\\u67f4\\u72ac\\u304a\\u3057\\u308a-z076-2-\\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u3083-12\\u6b73\\u4ee5\\u4e0a\\u5bfe\\u8c61\",\"v\":[50473733161200],\"pr\":2399},{\"p\":10253757153520,\"t\":\"Mellojoy -\\u30e0\\u30fc\\u30b9\\u30af\\u30ea\\u30fc\\u30e0-\\u30a2\\u30a4\\u30b9\\u3010Z079\\u3011\\u3010 \\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093\\u3011\",\"h\":\"mellojoy-\\u30e0\\u30fc\\u30b9\\u30af\\u30ea\\u30fc\\u30e0-\\u7279\\u6fc3\\u725b\\u4e73\\u30a2\\u30a4\\u30b9-z079-\\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u3083-12\\u6b73\\u4ee5\\u4e0a\\u5bfe\\u8c61\",\"v\":[50408637661424,50408637694192],\"pr\":2599},{\"p\":10253458964720,\"t\":\"Mellojoy - \\u306d\\u3063\\u3068\\u308a\\u30e8\\u30fc\\u30b0\\u30eb\\u30c8&\\u30e0\\u30fc\\u30b9\\u30af\\u30ea\\u30fc\\u30e0- \\u30af\\u30ea\\u30fc\\u30e0\\u308f\\u3093\\u3010Z080\\u3011\\u3010 \\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093\\u3011\",\"h\":\"mellojoy-\\u306d\\u3063\\u3068\\u308a\\u30e8\\u30fc\\u30b0\\u30eb\\u30c8-\\u30e0\\u30fc\\u30b9\\u30af\\u30ea\\u30fc\\u30e0-\\u30af\\u30ea\\u30fc\\u30e0\\u308f\\u3093-z080-\\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u3083-12\\u6b73\\u4ee5\\u4e0a\\u5bfe\\u8c61\",\"v\":[50576204202224,50576204234992],\"pr\":2399},{\"p\":10253442941168,\"t\":\"Mellojoy - \\u30e0\\u30fc\\u30b9\\u30af\\u30ea\\u30fc\\u30e0 - \\u30e1\\u30ed\\u30b8\\u30e7\\u30a4\\u6975\\u307f\\u30fb\\u9ba8\\u3010A039\\u3011\\u3010 \\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093\\u3011\\u3010 \\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u3083\\u3011\",\"h\":\"mellojoy-\\u30e0\\u30fc\\u30b9\\u30af\\u30ea\\u30fc\\u30e0-\\u30e1\\u30ed\\u30b8\\u30e7\\u30a4\\u6975\\u307f-\\u9ba8-a039-\\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093-\\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u3083-12\\u6b73\\u4ee5\\u4e0a\\u5bfe\\u8c61\",\"v\":[50407719010544],\"pr\":2899},{\"p\":10221293273328,\"t\":\"Mellojoy - \\u30af\\u30ea\\u30fc\\u30df\\u30fc\\u30af\\u30ea\\u30fc\\u30e0\\u2014\\u2014\\u30df\\u30c7\\u30a3\\u30a2\\u30e0\\u30b5\\u30a4\\u30ba(\\u4e2d\\u53f7M)\\u30e1\\u30ed\\u30b8\\u30e7\\u30a4\\u62b9\\u8336\\u30b9\\u30d5\\u30ec\\u3010Z072-10\\u3011\\u3010 \\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u3083\\u3011\",\"h\":\"mellojoy-\\u30af\\u30ea\\u30fc\\u30df\\u30fc\\u30af\\u30ea\\u30fc\\u30e0-\\u30df\\u30c7\\u30a3\\u30a2\\u30e0\\u30b5\\u30a4\\u30ba\\u4e2d\\u53f7m\\u30e1\\u30ed\\u30b8\\u30e7\\u30a4\\u62b9\\u8336\\u30b9\\u30d5\\u30ec-z072-10-\\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u3083-12\\u6b73\\u4ee5\\u4e0a\\u5bfe\\u8c61\",\"v\":[50311162593520],\"pr\":2399},{\"p\":10213043077360,\"t\":\"Mellojoy - \\u306d\\u3063\\u3068\\u308a\\u30e8\\u30fc\\u30b0\\u30eb\\u30c8&\\u30e0\\u30fc\\u30b9\\u30af\\u30ea\\u30fc\\u30e0&\\u3082\\u3061\\u3082\\u3061\\u3082\\u3061 - \\u30e1\\u30ed\\u30a4\\u30a2\\u306e\\u66ae\\u3089\\u3057\\u306e\\u56f3\\u9451\\u3010A037\\u3011\\u3010 \\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093\\u3011\\u3010 \\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u3083\\u3011\",\"h\":\"mellojoy-\\u306d\\u3063\\u3068\\u308a\\u30e8\\u30fc\\u30b0\\u30eb\\u30c8-\\u30e0\\u30fc\\u30b9\\u30af\\u30ea\\u30fc\\u30e0-\\u3082\\u3061\\u3082\\u3061\\u3082\\u3061-\\u30e1\\u30ed\\u30a4\\u30a2\\u306e\\u66ae\\u3089\\u3057\\u306e\\u56f3\\u9451-a037-\\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093-\\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u3083-12\\u6b73\\u4ee5\\u4e0a\\u5bfe\\u8c61\",\"v\":[50271437521136],\"pr\":2699},{\"p\":10171964129520,\"t\":\"Mellojoy - \\u30e0\\u30fc\\u30b9\\u30af\\u30ea\\u30fc\\u30e0 - \\u3082\\u3053\\u3082\\u3053\\u5c71\\u306e\\u91ce\\u83dc\\uff06\\u30d5\\u30eb\\u30fc\\u30c4\\u30d1\\u30fc\\u30c6\\u30a3\\u30fc\\u3010A040\\u3011\\u3010 \\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093\\u3011\\u3010 \\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u3083\\u3011\",\"h\":\"mellojoy-\\u30e0\\u30fc\\u30b9\\u30af\\u30ea\\u30fc\\u30e0\\u3082\\u3053\\u3082\\u3053\\u5c71\\u306e\\u91ce\\u83dc-\\u30d5\\u30eb\\u30fc\\u30c4\\u30d1\\u30fc\\u30c6\\u30a3\\u30fc-a040-\\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093-\\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u3083-12\\u6b73\\u4ee5\\u4e0a\\u5bfe\\u8c61\",\"v\":[50159556395248],\"pr\":2799},{\"p\":10105395609840,\"t\":\"Mellojoy - \\u306d\\u3063\\u3068\\u308a\\u30e8\\u30fc\\u30b0\\u30eb\\u30c8&\\u3082\\u3061\\u3082\\u3061\\u3082\\u3061 - \\u7a7a\\u8272\\u306e\\u9bc9\\u7269\\u8a9e\\u3010A038\\u3011\\u3010 \\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093\\u3011\\u3010 \\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u3083\\u3011\",\"h\":\"mellojoy-\\u306d\\u3063\\u3068\\u308a\\u30e8\\u30fc\\u30b0\\u30eb\\u30c8-\\u7a7a\\u8272\\u306e\\u9bc9\\u7269\\u8a9e-a038-\\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093-\\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u3083-12\\u6b73\\u4ee5\\u4e0a\\u5bfe\\u8c61\",\"v\":[50041823101168],\"pr\":2599},{\"p\":10083557638384,\"t\":\"Mellojoy -\\u306d\\u3063\\u3068\\u308a\\u30e8\\u30fc\\u30b0\\u30eb\\u30c8&\\u30e0\\u30fc\\u30b9\\u30af\\u30ea\\u30fc\\u30e0&\\u3082\\u3061\\u3082\\u3061\\u3082\\u3061- \\u308f\\u3075\\u308f\\u8089\\u7403\\u30df\\u30eb\\u30af\\u30d1\\u30d5\\u3010Z078\\u3011\\u3010 \\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093\\u3011\",\"h\":\"mellojoy-\\u306d\\u3063\\u3068\\u308a\\u30e8\\u30fc\\u30b0\\u30eb\\u30c8-\\u30e0\\u30fc\\u30b9\\u30af\\u30ea\\u30fc\\u30e0-\\u3082\\u3061\\u3082\\u3061\\u3082\\u3061-\\u308f\\u3075\\u308f\\u8089\\u7403\\u30df\\u30eb\\u30af\\u30d1\\u30d5-z078-\\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u3083-12\\u6b73\\u4ee5\\u4e0a\\u5bfe\\u8c61\",\"v\":[50368876839152,50647964614896],\"pr\":2499},{\"p\":10079568593136,\"t\":\"Mellojoy - \\u30af\\u30ea\\u30fc\\u30df\\u30fc\\u30af\\u30ea\\u30fc\\u30e0\\u2014\\u2014\\u30df\\u30c7\\u30a3\\u30a2\\u30e0\\u30b5\\u30a4\\u30ba[\\u4e2d\\u53f7]\\u30e1\\u30ed\\u30b8\\u30e7\\u30a4\\u3044\\u3061\\u3054\\u30b9\\u30d5\\u30ec\\u3010Z072-8\\u3011\\u3010 \\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093\\u3011\",\"h\":\"mellojoy-\\u30af\\u30ea\\u30fc\\u30df\\u30fc\\u30af\\u30ea\\u30fc\\u30e0-\\u30df\\u30c7\\u30a3\\u30a2\\u30e0\\u30b5\\u30a4\\u30ba\\u4e2d\\u53f7\\u30e1\\u30ed\\u30b8\\u30e7\\u30a4\\u30c1\\u30e7\\u30b3\\u30ec\\u30fc\\u30c8\\u30b9\\u30d5\\u30ec-z072-8-\\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u3083-12\\u6b73\\u4ee5\\u4e0a\\u5bfe\\u8c61\",\"v\":[49956579901680],\"pr\":2399},{\"p\":10069766537456,\"t\":\"Mellojoy - \\u30af\\u30ea\\u30fc\\u30df\\u30fc\\u30af\\u30ea\\u30fc\\u30e0 - \\u30df\\u30c7\\u30a3\\u30a2\\u30e0\\u30b5\\u30a4\\u30ba(\\u4e2d\\u53f7)\\u30e1\\u30ed\\u30b8\\u30e7\\u30a4\\u30c1\\u30e7\\u30b3\\u30ec\\u30fc\\u30c8\\u30b9\\u30d5\\u30ec\\u3010Z072-7\\u3011\\u3010 \\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093\\u3011\",\"h\":\"mellojoy-\\u30e0\\u30fc\\u30b9\\u30af\\u30ea\\u30fc\\u30e0-\\u30df\\u30c7\\u30a3\\u30a2\\u30e0\\u30b5\\u30a4\\u30ba\\u4e2d\\u53f7m\\u30e1\\u30ed\\u30b8\\u30e7\\u30a4\\u8d05\\u6ca2\\u30b9\\u30d5\\u30ec-z072-7-\\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u3083-12\\u6b73\\u4ee5\\u4e0a\\u5bfe\\u8c61\",\"v\":[49875877036272],\"pr\":2399},{\"p\":10063453847792,\"t\":\"Mellojoy - \\u30e0\\u30fc\\u30b9\\u30af\\u30ea\\u30fc\\u30e0\\u2014\\u2014\\u30e9\\u30fc\\u30b8\\u30b5\\u30a4\\u30ba(L)\\u30e1\\u30ed\\u30b8\\u30e7\\u30a4\\u8d05\\u6ca2\\u30b9\\u30d5\\u30ec\\u3010Z001-10\\u3011\\u3010 \\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093\\u3011\",\"h\":\"mellojoy-\\u30e0\\u30fc\\u30b9\\u30af\\u30ea\\u30fc\\u30e0-\\u30df\\u30c7\\u30a3\\u30a2\\u30e0\\u30b5\\u30a4\\u30bal\\u30e1\\u30ed\\u30b8\\u30e7\\u30a4\\u8d05\\u6ca2\\u30b9\\u30d5\\u30ec-z001-10-\\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u3083-12\\u6b73\\u4ee5\\u4e0a\\u5bfe\\u8c61\",\"v\":[49855570411760],\"pr\":2599},{\"p\":10058762715376,\"t\":\"Mellojoy - \\u30e0\\u30fc\\u30b9\\u30af\\u30ea\\u30fc\\u30e0\\u2014\\u2014\\u30df\\u30c7\\u30a3\\u30a2\\u30e0\\u30b5\\u30a4\\u30ba(\\u4e2d\\u53f7M)\\u30e1\\u30ed\\u30b8\\u30e7\\u30a4\\u8d05\\u6ca2\\u30b9\\u30d5\\u30ec\\u3010Z072-2\\u3011\\u3010 \\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093\\u3011\",\"h\":\"mellojoy-gsbjhrdjhruy-12\\u6b73\\u4ee5\\u4e0a\\u5bfe\\u8c61\",\"v\":[49841091936496],\"pr\":2399},{\"p\":10055402062064,\"t\":\"Mellojoy - \\u30e0\\u30fc\\u30b9\\u30af\\u30ea\\u30fc\\u30e0 - \\u30e1\\u30ed\\u30b8\\u30e7\\u30a4\\u30c8\\u30fc\\u30b9\\u30c8\\u30b9\\u30c6\\u30a3\\u30c3\\u30af\\u3001\\u96c6\\u5408\\uff01\\u3010A036\\u3011\\u3010 \\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093\\u3011\\u3010 \\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u3083\\u3011\",\"h\":\"mellojoy-\\u30e0\\u30fc\\u30b9\\u30af\\u30ea\\u30fc\\u30e0-\\u30e1\\u30ed\\u30b8\\u30e7\\u30a4\\u30c8\\u30fc\\u30b9\\u30c8\\u30b9\\u30c6\\u30a3\\u30c3\\u30af-\\u96c6\\u5408-a036-\\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093-\\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u3083-12\\u6b73\\u4ee5\\u4e0a\\u5bfe\\u8c61\",\"v\":[49831452737776],\"pr\":2799},{\"p\":10038128869616,\"t\":\"Mellojoy  -\\u30e1\\u30ed\\u30b8\\u30e7\\u30a4\\u30d5\\u30eb\\u30fc\\u30c4\\u30de\\u30fc\\u30b1\\u30c3\\u30c8-\\u3010Z050\\u3011\\u3010 \\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093\\u3011\",\"h\":\"mellojoy-\\u30e1\\u30ed\\u30b8\\u30e7\\u30a4\\u30d5\\u30eb\\u30fc\\u30c4\\u30de\\u30fc\\u30b1\\u30c3\\u30c8-z050-\\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u3083-12\\u6b73\\u4ee5\\u4e0a\\u5bfe\\u8c61\",\"v\":[49780577435888],\"pr\":2899},{\"p\":10012374696176,\"t\":\"Mellojoy - \\u3082\\u3061\\u3082\\u3061\\u3082\\u3061 - \\u30c0\\u30d6\\u30eb\\u30d6\\u30ec\\u30c3\\u30c9\\u00b7\\u6975\\u539a\\u4ed5\\u7acb\\u3066 - \\u30b9\\u30ce\\u30fc\\u30af\\u30e9\\u30a6\\u30c9\\u3010Z060-1\\u3011\\u3010 \\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u3083\\u3011\",\"h\":\"mellojoy-\\u3082\\u3061\\u3082\\u3061\\u3082\\u3061-\\u30c0\\u30d6\\u30eb\\u30d6\\u30ec\\u30c3\\u30c9-\\u6975\\u539a\\u4ed5\\u7acb\\u3066-\\u30b9\\u30ce\\u30fc\\u30af\\u30e9\\u30a6\\u30c9-z060-1-\\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u3083-12\\u6b73\\u4ee5\\u4e0a\\u5bfe\\u8c61\",\"v\":[49686881304816],\"pr\":2499},{\"p\":9994691477744,\"t\":\"Mellojoy - \\u30af\\u30ea\\u30fc\\u30df\\u30fc\\u30af\\u30ea\\u30fc\\u30e0\\u2014\\u2014\\u30df\\u30c7\\u30a3\\u30a2\\u30e0\\u30b5\\u30a4\\u30ba(\\u4e2d\\u53f7M)\\u30e1\\u30ed\\u30b8\\u30e7\\u30a4\\u8d05\\u6ca2\\u30b9\\u30d5\\u30ec\\u3010Z072-5\\u3011\\u3010 \\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093\\u3011\",\"h\":\"mellojoy-\\u30af\\u30ea\\u30fc\\u30df\\u30fc\\u30af\\u30ea\\u30fc\\u30e0-\\u30df\\u30c7\\u30a3\\u30a2\\u30e0\\u30b5\\u30a4\\u30ba\\u4e2d\\u53f7\\u30e1\\u30ed\\u30b8\\u30e7\\u30a4\\u8d05\\u6ca2\\u30b9\\u30d5\\u30ec-z072-5-\\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u3083-12\\u6b73\\u4ee5\\u4e0a\\u5bfe\\u8c61\",\"v\":[49612062621936],\"pr\":2399},{\"p\":9976677761264,\"t\":\"Mellojoy - \\u3082\\u3061\\u3082\\u3061\\u3082\\u3061 - \\u30e1\\u30ed\\u30b8\\u30e7\\u30a4\\u30af\\u30ea\\u30fc\\u30e0\\u30df\\u30eb\\u30d5\\u30a3\\u30fc\\u30e6\\u3010Z056-2\\u3011\\u3010 \\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093\\u3011\",\"h\":\"mellojoy-\\u3082\\u3061\\u3082\\u3061\\u3082\\u3061-\\u30e1\\u30ed\\u30b8\\u30e7\\u30a4\\u30af\\u30ea\\u30fc\\u30e0\\u30df\\u30eb\\u30d5\\u30a3\\u30fc\\u30e6-z056-2-\\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u308312\\u6b73\\u4ee5\\u4e0a\\u5bfe\\u8c61\",\"v\":[49525062959344],\"pr\":2399},{\"p\":9975017767152,\"t\":\"Mellojoy - \\u30e0\\u30fc\\u30b9\\u30af\\u30ea\\u30fc\\u30e0 -\\u30c8\\u30fc\\u30b9\\u30c8\\u3064\\u307f\\u3064\\u307f\\u30b7\\u30ea\\u30fc\\u30ba\\u3010A034\\u3011\\u3010 \\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093\\u3011\\u3010 \\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u3083\\u3011\\u3010244g\\u3011\",\"h\":\"mellojoy-\\u30c8\\u30fc\\u30b9\\u30c8\\u3064\\u307f\\u3064\\u307f\\u30b7\\u30ea\\u30fc\\u30ba-a034-\\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093-\\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u3083-12\\u6b73\\u4ee5\\u4e0a\\u5bfe\\u8c61\",\"v\":[49517434765552],\"pr\":2899},{\"p\":9968786538736,\"t\":\"Mellojoy - \\u30e0\\u30fc\\u30b9\\u30af\\u30ea\\u30fc\\u30e0 - \\u30e1\\u30ed\\u30b8\\u30e7\\u30a4\\u30af\\u30ea\\u30fc\\u30e0\\u30df\\u30eb\\u30d5\\u30a3\\u30fc\\u30e6\\u3010Z056-1\\u3011\\u3010 \\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093\\u3011\",\"h\":\"mellojoy-\\u30e0\\u30fc\\u30b9\\u30af\\u30ea\\u30fc\\u30e0-\\u30e1\\u30ed\\u30b8\\u30e7\\u30a4\\u30af\\u30ea\\u30fc\\u30e0\\u30df\\u30eb\\u30d5\\u30a3\\u30fc\\u30e6\\u30fc-z056-1-\\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u308312\\u6b73\\u4ee5\\u4e0a\\u5bfe\\u8c61\",\"v\":[49494304981232],\"pr\":2399},{\"p\":9968730046704,\"t\":\"Mellojoy -\\u30e0\\u30fc\\u30b9\\u30af\\u30ea\\u30fc\\u30e0 - \\u30e1\\u30ed\\u30b8\\u30e7\\u30a4\\u3044\\u3061\\u3054\\u30b7\\u30e7\\u30fc\\u30c8\\u30b1\\u30fc\\u30ad\\u30db\\u30fc\\u30eb\\u3010Z048-10\\u3011\\u3010 \\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093\\u3011\",\"h\":\"mellojoy-\\u30e0\\u30fc\\u30b9\\u30af\\u30ea\\u30fc\\u30e0-\\u30e1\\u30ed\\u30b8\\u30e7\\u30a4\\u3044\\u3061\\u3054\\u30b7\\u30e7\\u30fc\\u30c8\\u30b1\\u30fc\\u30ad\\u30b9\\u30e9\\u30a4\\u30b9-z048-10-\\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u3083-12\\u6b73\\u4ee5\\u4e0a\\u5bfe\\u8c61\",\"v\":[49494150086896],\"pr\":2499},{\"p\":9966894317808,\"t\":\"Mellojoy - \\u30e0\\u30fc\\u30b9\\u30af\\u30ea\\u30fc\\u30e0 - \\u30e1\\u30ed\\u30b8\\u30e7\\u30a4\\u3044\\u3061\\u3054\\u30b7\\u30e7\\u30fc\\u30c8\\u30b1\\u30fc\\u30ad\\u30b9\\u30e9\\u30a4\\u30b9\\u3010Z048-8\\u3011\\u3010 \\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093\\u3011\",\"h\":\"mellojoy-\\u30e0\\u30fc\\u30b9\\u30af\\u30ea\\u30fc\\u30e0-\\u30e1\\u30ed\\u30b8\\u30e7\\u30a4\\u3044\\u3061\\u3054\\u30b7\\u30e7\\u30fc\\u30c8\\u30b1\\u30fc\\u30ad\\u30b9\\u30e9\\u30a4\\u30b9-z048-8-\\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u3083-12\\u6b73\\u4ee5\\u4e0a\\u5bfe\\u8c61\",\"v\":[49487400534256],\"pr\":2299},{\"p\":9966211105008,\"t\":\"Mellojoy - \\u30e0\\u30fc\\u30b9\\u30af\\u30ea\\u30fc\\u30e0 -\\u30d0\\u30bf\\u30fc\\u3010NEW\\u3011\\u3010Z002-1\\u3011\\u3010 \\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093\\u3011\",\"h\":\"mellojoy-\\u30e0\\u30fc\\u30b9\\u30af\\u30ea\\u30fc\\u30e0-\\u30d0\\u30bf\\u30fc-new-z002-1-\\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u3083-12\\u6b73\\u4ee5\\u4e0a\\u5bfe\\u8c61\",\"v\":[49484020515056],\"pr\":1599},{\"p\":9893447532784,\"t\":\"Mellojoy - \\u30e0\\u30fc\\u30b9\\u30af\\u30ea\\u30fc\\u30e0 - \\u306b\\u304e\\u306b\\u304e\\u304a\\u306b\\u304e\\u308a \\u3010A032\\u3011\\u3010 \\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093\\u3011\\u3010\\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u3083\\u3011\",\"h\":\"mellojoy-\\u306b\\u304e\\u306b\\u304e\\u304a\\u306b\\u304e\\u308a-a032-\\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093-\\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u3083\",\"v\":[49015389946096],\"pr\":2699},{\"p\":9846314402032,\"t\":\"Mellojoy -\\u3082\\u3061\\u3082\\u3061\\u3082\\u3061&\\u306d\\u3063\\u3068\\u308a\\u30e8\\u30fc\\u30b0\\u30eb\\u30c8- \\u30d4\\u30b6\\u306e\\u304a\\u5c4a\\u3051\\u3010A030\\u3011\\u3010 \\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093\\u3011\\u3010 \\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u3083\\u3011\",\"h\":\"mellojoy-\\u30d4\\u30b6\\u306e\\u304a\\u5c4a\\u3051-a030-\\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093-\\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u3083\",\"v\":[48818747506928],\"pr\":2699},{\"p\":9805375930608,\"t\":\"Mellojoy - \\u3071\\u3093\\u3071\\u3093\\u30d1\\u30f3\\u30b1\\u30fc\\u30ad- \\u30e1\\u30ed\\u30b8\\u30e7\\u30a4\\u5927\\u6e80\\u8db3\\u713c\\u304d\\u9905\\u3010Z053\\u3011\\u3010 \\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u3083\\u3011\",\"h\":\"z053-\\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093-\\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u3083-mellojoy-\\u30e1\\u30ed\\u30b8\\u30e7\\u30a4\\u5927\\u6e80\\u8db3\\u713c\\u304d\\u9905\",\"v\":[48674529444080],\"pr\":2499},{\"p\":9717612478704,\"t\":\"Mellojoy - \\u3082\\u3061\\u3082\\u3061\\u3082\\u3061 - \\u30e1\\u30ed\\u30b8\\u30e7\\u30a4\\u30af\\u30ea\\u30fc\\u30e0\\u307e\\u307f\\u308c\\u5927\\u798f\\u30b7\\u30ea\\u30fc\\u30ba\\u2014\\u2014\\u89e3\\u6d88\\u30b0\\u30c3\\u30ba \\u3010A026\\u3011\\u3010 \\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093\\u3011\\u3010 \\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u3083\\u3011\\u3010 264g \\u3011\",\"h\":\"a025-\\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093-\\u30d6\\u30e9\\u30a4\\u30f3\\u30c9\\u30dc\\u30c3\\u30af\\u30b9\\u306e\\u304a\\u3082\\u3061\\u3083-\\u30a2\\u30cb\\u30de\\u30eb\\u30b7\\u30ea\\u30fc\\u30ba-\\u526f\\u672c\",\"v\":[48247107584240],\"pr\":2399},{\"p\":9523683393776,\"t\":\"Mellojoy-\\u3082\\u3061\\u3082\\u3061\\u3082\\u3061 -\\u30d0\\u30bf\\u30fc\\u3010NEW\\u3011\\u3010Z002\\u3011\\u3010 \\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093\\u3011\",\"h\":\"mellojoy-12\\u6b73\\u4ee5\\u4e0a\\u5bfe\\u8c61\",\"v\":[47712223985904],\"pr\":1599},{\"p\":9523683229936,\"t\":\"Mellojoy - \\u30af\\u30ea\\u30fc\\u30df\\u30fc\\u30af\\u30ea\\u30fc\\u30e0- \\u8d05\\u6ca2\\u30b9\\u30d5\\u30ec\\u3010Z001\\u3011\\u3000\\u3010\\u8ff7\\u3046\\u306a\\u3089\\u3053\\u308c\\uff01  \\u521d\\u5fc3\\u8005\\u306b\\u304a\\u3059\\u3059\\u3081\\u3011\\u3010 \\u958b\\u5c01\\u5f8c\\u306e\\u30ad\\u30e3\\u30f3\\u30bb\\u30eb\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093\\u3011\",\"h\":\"mellojoy-\\u8d05\\u6ca2\\u30b9\\u30d5\\u30ec-12\\u6b73\\u4ee5\\u4e0a\\u5bfe\\u8c61\",\"v\":[47712222839024,48086199894256],\"pr\":2599}];\n  // t\\u1eeb kh\\u00f3a kh\\u1edbp nhi\\u1ec1u m\\u00f3n/lo\\u1ea1i (VD Z072 kh\\u1edbp Z072-2, Z072-9, Z072-11\\u2026): m\\u1ed7i l\\u01b0\\u1ee3t d\\u00f2 ch\\u1ecdn ng\\u1eabu nhi\\u00ean 1 variant; khi shop \\u0111\\u00e3 m\\u1edf\n  // (m\\u00e3 kh\\u00e1c v\\u00e0o gi\\u1ecf) th\\u00ec th\\u1eed L\\u1ea6N L\\u01af\\u1ee2T m\\u1ecdi variant (alts) t\\u1edbi khi v\\u00e0o 1 c\\u00e1i. Mu\\u1ed1n ch\\u1eafc \\u0111\\u00fang m\\u00f3n th\\u00ec g\\u00f5 m\\u00e3 \\u0111\\u1ee7, VD Z072-2.\n  function seedFor(kw) {\n    const all = VSEED.filter((x) => match(x.t, kw)).flatMap((x) => x.v.map((id) => ({ id, e: x }))).sort((a, b) => b.id - a.id);\n    const c = pickOne(all);\n    return c && { id: c.id, title: c.e.t, handle: c.e.h, price: c.e.pr, size: '-', image: '', alts: all.length > 1 ? all : null };\n  }\n  // 14/11 (nhi\\u1ec1u kh\\u00e1ch b\\u00e1o g\\u00f5 T\\u00caN kh\\u00f4ng v\\u00e0o gi\\u1ecf): t\\u00ean (VD \\u30e0\\u30fc\\u30b9\\u30af\\u30ea\\u30fc\\u30e0) kh\\u1edbp h\\u00e0ng ch\\u1ee5c m\\u00f3n c\\u0169 trong b\\u1ea3ng \\u0111\\u00f3ng s\\u1eb5n -> khung th\\u00eam gi\\u1ecf\n  // th\\u1eb3ng g\\u1eedi variant c\\u1ee7a m\\u00f3n C\\u0168 (shop t\\u1eeb ch\\u1ed1i), l\\u1ea1i kh\\u00f4ng \\u0111\\u1ecdc danh s\\u00e1ch cho t\\u1eeb kh\\u00f3a \\u0111\\u00f3 t\\u1edbi 12:00:25 -> m\\u00f3n m\\u1edbi kh\\u00f4ng bao gi\\u1edd v\\u00e0o.\n  // Gi\\u1edd ch\\u1ec9 M\\u00c3 H\\u00c0NG (A041, Z072-2\\u2026) d\\u00f9ng b\\u1ea3ng m\\u00e3 / m\\u00e3 \\u0111\\u00e3 h\\u1ecdc; T\\u00caN ch\\u1ec9 d\\u00f9ng m\\u00f3n th\\u1ea5y tr\\u00ean danh s\\u00e1ch SAU gi\\u1edd m\\u1edf (live).\n  const isCodeKw = (kw) => { const ws = norm(kw).split(/\\s+/).filter(Boolean); return ws.length > 0 && ws.every((w) => /^[a-z]{1,2}\\d{2,4}(-\\d+)?$/.test(w)); };\n  const live = {};\n  // t\\u00ean kh\\u1edbp \\u0111\\u00fang 1 m\\u00f3n c\\u00f3 1 lo\\u1ea1i trong b\\u1ea3ng \\u0111\\u00f3ng s\\u1eb5n -> m\\u00f3n \\u0111\\u00f3 (d\\u00f9ng nh\\u01b0 m\\u00e3); kh\\u1edbp 0 ho\\u1eb7c nhi\\u1ec1u -> null\n  function seedOne(kw) {\n    const ms = VSEED.filter((x) => match(x.t, kw));\n    if (ms.length !== 1 || ms[0].v.length !== 1) return null;\n    const e = ms[0];\n    return { id: e.v[0], title: e.t, handle: e.h, price: e.pr, size: '-', image: '' };\n  }\n  function learn(kw, p, v) {\n    if (IS_US || !p || !v || vidsOf(kw).length) return;\n    const k = norm(kw).trim(), o = vmap[k];\n    if (o && o.id === v.id) return;\n    vmap[k] = { id: v.id, title: p.title, handle: p.handle, price: v.price, size: v.title || '-',\n      image: (v.featured_image && v.featured_image.src) || (p.images && p.images[0] && p.images[0].src) || '', at: Date.now() };\n    vmapDirty = true;\n  }\n  // Tr\\u1ea3 danh s\\u00e1ch m\\u00f3n c\\u1ea7n th\\u00eam; d\\u00f9ng \\u4e88\\u5099 cho ph\\u1ea7n b\\u1ecb h\\u1ebft\n  function plan(products) {\n    let out = [];\n    const missing = [];\n    const wanted = cfg.items.slice(0, cfg.kwCount).filter((i) => i.kw.trim());\n    const stat = (ps, hit) => (hit ? 'in' : ps.length ? 'out' : 'none');\n    kwStat = [];\n    cfg.items.slice(0, cfg.kwCount).forEach((it, idx) => {\n      if (!it.kw.trim()) return;\n      // t\\u1eeb kho\\u00e1 l\\u00e0 M\\u00c3 VARIANT (s\\u1ed1): kh\\u1edbp \\u0111\\u00fang variant \\u0111\\u00f3, kh\\u00f4ng theo t\\u00ean.\n      // Nhi\\u1ec1u m\\u00e3 n\\u1ed1i b\\u1eb1ng & (VD 111&222&333): \\u00f4 n\\u00e0y ch\\u1ec9 l\\u1ea5y 1 m\\u00e3, ch\\u1ecdn NG\\u1eaaU NHI\\u00caN trong c\\u00e1c m\\u00e3 c\\u00f2n h\\u00e0ng (user y\\u00eau c\\u1ea7u 2/11)\n      const vids = vidsOf(it.kw);\n      const ps = vids.length ? products.filter((p) => (p.variants || []).some((v) => vids.includes(String(v.id)))) : products.filter((p) => match(p.title, it.kw));\n      const listed = vids.length ? ps.flatMap((p) => p.variants.filter((v) => vids.includes(String(v.id))).map((v) => ({ p, v }))) : [];\n      const hit = vids.length\n        ? pickOne(listed.filter((x) => x.v.available))\n        : ps.map((p) => ({ p, v: firstAvail(p) })).find((x) => x.v);\n      kwStat.push({ label: `KW${idx + 1}`, kw: it.kw, st: stat(ps, hit) });\n      if (hit) learn(it.kw, hit.p, hit.v);\n      if (hit) out.push(item(hit, it.qty, ''));\n      else {\n        // m\\u00f3n \\u0110\\u00c3 l\\u00ean trang nh\\u01b0ng products.json c\\u00f2n b\\u00e1o h\\u1ebft: nh\\u1edb variant c\\u1ee7a n\\u00f3 \\u0111\\u1ec3 b\\u1ea3n JP th\\u00eam gi\\u1ecf th\\u1eb3ng (products.json c\\u00f3 th\\u1ec3 tr\\u1ec5).\n        // T\\u1eeb kh\\u00f3a / m\\u00e3 s\\u1ea3n ph\\u1ea9m kh\\u1edbp nhi\\u1ec1u m\\u00f3n -> l\\u1ea5y m\\u00f3n \\u0111\\u0103ng M\\u1edaI NH\\u1ea4T (m\\u00f3n c\\u0169 \\u0111\\u00e3 b\\u00e1n h\\u1ebft th\\u01b0\\u1eddng v\\u1eabn c\\u00f2n tr\\u00ean trang)\n        const lx = pickOne(listed);\n        const np = vids.length ? lx && lx.p : ps.slice().sort((a, b) => String(b.published_at || b.created_at || '').localeCompare(String(a.published_at || a.created_at || '')))[0];\n        const nv = vids.length ? lx && lx.v : np && (np.variants || [])[0];\n        // dv: 1 m\\u00e3 (ng\\u1eabu nhi\\u00ean) CH\\u01afA l\\u00ean products.json -> th\\u00eam th\\u1eb3ng /cart/add.js\n        const dv = vids.length ? pickOne(vids.filter((id) => !listed.some((x) => String(x.v.id) === id))) || '' : '';\n        learn(it.kw, np, nv);\n        missing.push({ it, seen: ps.length > 0, p: np, v: nv, dv });\n      }\n      // t\\u1eeb kh\\u00f3a T\\u00caN, \\u0111\\u00e3 qua gi\\u1edd m\\u1edf: nh\\u1edb m\\u00f3n th\\u1ea5y tr\\u00ean danh s\\u00e1ch (c\\u00f2n h\\u00e0ng tr\\u01b0\\u1edbc, kh\\u00f4ng th\\u00ec m\\u00f3n \\u0111\\u0103ng m\\u1edbi nh\\u1ea5t) cho khung th\\u00eam gi\\u1ecf th\\u1eb3ng\n      if (!IS_US && !vids.length && !isCodeKw(it.kw) && !st.now && msToOpen() <= 0) {\n        const k = norm(it.kw).trim();\n        if (hit) { live[k] = { ...item(hit, it.qty, ''), avail: true }; shopOpen = true; }\n        else if (np && nv && !(live[k] && live[k].avail)) live[k] = { ...item({ p: np, v: nv }, it.qty, ''), avail: false };\n      }\n    });\n    if (cfg.backup.kw.trim()) {\n      const ps = products.filter((p) => match(p.title, cfg.backup.kw));\n      kwStat.push({ label: L('\\u4e88\\u5099', 'D\\u1ef1 ph\\u00f2ng'), kw: cfg.backup.kw, st: stat(ps, ps.find((p) => firstAvail(p))) });\n    }\n    if (vmapDirty) { vmapDirty = false; save(K_VMAP, vmap); }\n    let capped = [];\n    if (out.length > MAX_PICK) {\n      for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }\n      capped = out.slice(MAX_PICK);\n      out = out.slice(0, MAX_PICK);\n    }\n    if (missing.length && out.length < MAX_PICK && cfg.backup.kw.trim()) {\n      const ps = products.filter((p) => match(p.title, cfg.backup.kw));\n      const hit = ps.map((p) => ({ p, v: firstAvail(p) })).find((x) => x.v);\n      if (hit && !out.some((o) => o.id === hit.v.id)) out.push(item(hit, cfg.backup.qty, L('[\\u4e88\\u5099] ', '[D\\u1ef1 ph\\u00f2ng] ')));\n    }\n    return { out, missing, wanted, capped };\n  }\n\n  // L\\u01b0u t\\u00ean, link, \\u1ea3nh, size, gi\\u00e1, s\\u1ed1 l\\u01b0\\u1ee3ng \\u0111\\u1ec3 b\\u00e1o Discord khi thanh to\\u00e1n xong (kh\\u00f4ng t\\u1ed1n request)\n  function saveForWebhook(list) {\n    try {\n      const cur = IS_US ? 'USD' : 'JPY';\n      const fmt = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(Number(v));\n      const img = (u) => (!u ? '' : u.startsWith('//') ? 'https:' + u : u);\n      save('pjc_last', { shop: SHOP, site: location.hostname, at: Date.now(), items: list.map((x) => ({\n        title: x.name, url: location.origin + '/products/' + x.handle, image: img(x.image), size: x.size, price: fmt(x.price), qty: x.qty,\n      })) });\n      // trang thanh to\\u00e1n c\\u00f3 th\\u1ec3 n\\u1eb1m \\u1edf shopify.com (kh\\u00f4ng \\u0111\\u1ecdc \\u0111\\u01b0\\u1ee3c b\\u1ed9 nh\\u1edb c\\u1ee7a mellojoy) -> b\\u1ea3n g\\u1ed9p ch\\u00e9p sang kho chung\n      document.dispatchEvent(new CustomEvent('synova-mj-last', { detail: localStorage.getItem('pjc_last') || '' }));\n    } catch (e) {}\n  }\n\n  async function addAll(list) {\n    let r, err = '';\n    for (let k = 0; k < 6; k++) {                 // 429 / l\\u1ed7i m\\u1ea1ng / treo l\\u00fac th\\u00eam gi\\u1ecf: th\\u1eed l\\u1ea1i sau 0,3 gi\\u00e2y (t\\u1ed1i \\u0111a 6 l\\u1ea7n)\n      // Shopify \\u0111\\u00f4ng ng\\u01b0\\u1eddi c\\u00f3 th\\u1ec3 gi\\u1eef request r\\u1ea5t l\\u00e2u: qu\\u00e1 5 gi\\u00e2y l\\u00e0 hu\\u1ef7, g\\u1eedi l\\u1ea1i (tr\\u01b0\\u1edbc \\u0111\\u00e2y treo m\\u00e3i -> BOT \\u0111\\u1ee9ng im, user b\\u00e1o 30/10)\n      const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 5000);\n      try {\n        reqNote('add');\n        r = await fetch('/cart/add.js', {\n          method: 'POST', credentials: 'same-origin', signal: ac.signal,\n          headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },\n          body: JSON.stringify({ items: list.map((x) => ({ id: x.id, quantity: x.qty })) }),\n        });\n        err = '';\n      } catch (e) {\n        r = null;\n        err = e.name === 'AbortError' ? L('\\u5fdc\\u7b54\\u306a\\u3057(5\\u79d2)', 'kh\\u00f4ng ph\\u1ea3n h\\u1ed3i (5 gi\\u00e2y)') : e.message;\n      } finally {\n        clearTimeout(tm);\n      }\n      if (r && r.status !== 429) break;\n      // 19/11: JP b\\u1ecb 429 l\\u00fac th\\u00eam gi\\u1ecf -> g\\u1eedi l\\u1ea1i TH\\u01afA d\\u1ea7n (1,5 \\u2192 3 \\u2192 5 \\u2192 8 \\u2192 12 gi\\u00e2y) thay v\\u00ec 6 l\\u1ea7n li\\u1ec1n m\\u1ed7i 0,3 gi\\u00e2y (c\\u00e0ng g\\u1eedi c\\u00e0ng b\\u1ecb ch\\u1eb7n l\\u00e2u)\n      if (r && r.status === 429 && !IS_US) {\n        const w = [1500, 3000, 5000, 8000, 12000][Math.min(k, 4)];\n        log(L(`\\u26d4 \\u30ab\\u30fc\\u30c8\\u8ffd\\u52a0\\u304c\\u30a2\\u30af\\u30bb\\u30b9\\u5236\\u9650 (429) \\u2192 ${w / 1000}\\u79d2\\u5f8c\\u306b\\u518d\\u9001\\uff08${k + 1}/6\\uff09`, `\\u26d4 Th\\u00eam gi\\u1ecf b\\u1ecb shop ch\\u1eb7n (429) \\u2192 ${w / 1000} gi\\u00e2y n\\u1eefa g\\u1eedi l\\u1ea1i (l\\u1ea7n ${k + 1}/6)`));\n        await sleep(w);\n      } else await sleep(BACKOFF_MIN);\n    }\n    if (!r) return { ok: false, msg: err };\n    if (r.ok) { const j = await r.json().catch(() => ({})); return { ok: true, items: j.items || (j.id ? [j] : []) }; }\n    const j = await r.json().catch(() => ({}));\n    return { ok: false, msg: `${r.status} ${j.description || j.message || ''}` };\n  }\n  // Th\\u00eam c\\u1ea3 l\\u00f4 b\\u1ecb t\\u1eeb ch\\u1ed1i (1 m\\u00f3n h\\u1ebft / v\\u01b0\\u1ee3t gi\\u1edbi h\\u1ea1n) -> th\\u00eam l\\u1ebb t\\u1eebng m\\u00f3n\n  const SOLD_MSG = /sold out|out of stock|\\u58f2\\u308a\\u5207\\u308c|\\u5728\\u5eab\\u5207\\u308c/i;\n  // 13/11: Mellojoy JP x\\u00f3a m\\u00f3n khi b\\u00e1n xong -> add.js variant \\u0111\\u00f3 tr\\u1ea3 422 \\u300c\\u7570\\u306a\\u308b\\u30e2\\u30c7\\u30eb\\u3092\\u898b\\u3064\\u3051\\u308b\\u3053\\u3068\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093\\u300d (= ch\\u01b0a m\\u1edf l\\u1ea1i).\n  // Tr\\u01b0\\u1edbc \\u0111\\u00e2y ch\\u1ec9 nh\\u1eadn ch\\u1eef ti\\u1ebfng Anh -> t\\u01b0\\u1edfng l\\u1ed7i s\\u1ed1 l\\u01b0\\u1ee3ng, m\\u1ed7i l\\u01b0\\u1ee3t g\\u1eedi th\\u1eeba 2 add.js + 1 cart.js (d\\u1ec5 429 \\u0111\\u00fang 12:00:0x)\n  const NOTFOUND_MSG = /^404|not found|cannot find|\\u898b\\u3064\\u3051\\u308b\\u3053\\u3068\\u304c\\u3067\\u304d\\u307e\\u305b\\u3093|\\u898b\\u3064\\u304b\\u308a\\u307e\\u305b\\u3093|\\u7570\\u306a\\u308b\\u30e2\\u30c7\\u30eb/i;\n  // first: l\\u00f4 ch\\u1ec9 c\\u00f3 1 m\\u00f3n th\\u00ec l\\u01b0\\u1ee3t th\\u00eam c\\u1ea3 l\\u00f4 v\\u1eeba r\\u1ed3i CH\\u00cdNH L\\u00c0 l\\u01b0\\u1ee3t th\\u00eam l\\u1ebb -> d\\u00f9ng lu\\u00f4n k\\u1ebft qu\\u1ea3, kh\\u1ecfi g\\u1eedi l\\u1ea1i y h\\u1ec7t\n  async function addEach(list, first) {\n    let n = 0;\n    await Promise.all(list.map(async (x) => {          // nh\\u01b0 b\\u1ea3n PC: th\\u00eam l\\u1ebb t\\u1eebng m\\u00f3n C\\u00d9NG L\\u00daC, kh\\u00f4ng l\\u1ea7n l\\u01b0\\u1ee3t\n      const r = first || await addAll([x]);\n      if (r.ok) { n++; fillFromCart(x, r.items); return; }\n      // m\\u00e3 variant ch\\u01b0a l\\u00ean h\\u00e0ng / h\\u1ebft h\\u00e0ng: shop t\\u1eeb ch\\u1ed1i l\\u00e0 b\\u00ecnh th\\u01b0\\u1eddng. Ch\\u1ec9 b\\u1ecb v\\u01b0\\u1ee3t s\\u1ed1 l\\u01b0\\u1ee3ng (VD ch\\u1ecdn 3, shop cho 2) th\\u00ec th\\u1eed s\\u1ed1 nh\\u1ecf h\\u01a1n b\\u00ean d\\u01b0\\u1edbi\n      if (x.direct && (!r.msg || SOLD_MSG.test(r.msg) || NOTFOUND_MSG.test(r.msg))) { x.qty = 0; return; }\n      if (SOLD_MSG.test(r.msg)) { x.qty = 0; x.err = r.msg; return; }   // shop b\\u00e1o h\\u1ebft h\\u00e0ng: th\\u1eed s\\u1ed1 nh\\u1ecf h\\u01a1n c\\u0169ng v\\u00f4 \\u00edch\n      // kh\\u00f4ng \\u0111\\u1ee7 s\\u1ed1 l\\u01b0\\u1ee3ng (VD shop ch\\u1ec9 cho 3 m\\u00e0 \\u0111\\u1eb7t 12) -> th\\u1eed s\\u1ed1 shop b\\u00e1o trong l\\u1ed7i, r\\u1ed3i 6 -> 3 -> 2 -> 1\n      // (kh\\u00f4ng l\\u00f9i t\\u1eebng c\\u00e1i m\\u1ed9t: 12 -> 11 -> 10\\u2026 qu\\u00e1 ch\\u1eadm l\\u00fac \\u0111\\u00f4ng ng\\u01b0\\u1eddi)\n      let got = 0;\n      // s\\u1ed1 g\\u1ee3i \\u00fd ch\\u1ec9 l\\u1ea5y \\u1edf c\\u00e2u \"only 2\\u2026/ can add 2\\u2026\", kh\\u00f4ng l\\u1ea5y s\\u1ed1 trong T\\u00caN m\\u00f3n (VD \"Z089-2\", \"270g\")\n      const hint = [...r.msg.matchAll(/(?:only|can (?:only )?add|up to)\\D{0,16}?(\\d+)/gi)].map((m) => +m[1]).filter((q) => q >= 1 && q < x.qty);\n      const top = hint.length ? Math.max(...hint) : x.qty;          // shop b\\u00e1o \"ch\\u1ec9 \\u0111\\u01b0\\u1ee3c 3\" -> th\\u1eed 3 tr\\u01b0\\u1edbc\n      const tries = [...new Set([...(hint.length ? [top] : []), 6, 3, 2, 1].filter((q) => q < x.qty && q <= top))];\n      for (const q of tries) {\n        const rr = await addAll([{ ...x, qty: q }]);\n        if (rr.ok) { got = q; fillFromCart(x, rr.items); break; }   // m\\u00e3 variant th\\u1eb3ng: l\\u1ea5y t\\u00ean / gi\\u00e1 / \\u1ea3nh \\u0111\\u1ec3 b\\u00e1o Discord\n      }\n      if (got) { n++; x.qty = got; log(L(`\\u2192 ${got}\\u500b\\u3060\\u3051\\u8ffd\\u52a0\\u3067\\u304d\\u307e\\u3057\\u305f`, `\\u2192 ch\\u1ec9 th\\u00eam \\u0111\\u01b0\\u1ee3c ${got} c\\u00e1i`) + `: ${x.title.slice(0, 22)}`); }\n      else { x.qty = 0; x.err = r.msg; }\n    }));\n    return n;\n  }\n  // B\\u1ea3n PC 31/10 (mellojoyus, 172 task, 0 \\u0111\\u01a1n): shop tr\\u1ea3 422 \"Only 1 item was added to your cart due to availability\"\n  // = \\u0110\\u00c3 V\\u00c0O GI\\u1ece (\\u00edt h\\u01a1n s\\u1ed1 xin) m\\u00e0 bot t\\u01b0\\u1edfng h\\u1ecfng; l\\u01b0\\u1ee3t sau shop b\\u00e1o \"maximum quantity \\u2026 already in your cart\" -> l\\u1eb7p m\\u00e3i\n  // kh\\u00f4ng \\u0111i thanh to\\u00e1n. B\\u1ecb t\\u1eeb ch\\u1ed1i -> \\u0111\\u1ecdc /cart.js: m\\u00f3n n\\u00e0o \\u0111\\u00e3 n\\u1eb1m trong gi\\u1ecf th\\u00ec t\\u00ednh l\\u00e0 \\u0111\\u00e3 v\\u00e0o (v\\u1edbi s\\u1ed1 l\\u01b0\\u1ee3ng shop cho).\n  async function rescueFromCart(list) {\n    try {\n      reqNote('other');\n      const c = await (await fetch('/cart.js', { credentials: 'same-origin', cache: 'no-store' })).json();\n      let n = 0;\n      for (const x of list) {\n        const it = (c.items || []).find((i) => String(i.variant_id || i.id) === String(x.id));\n        if (!it || !it.quantity) continue;\n        if (it.quantity !== x.qty || x.err) log(L(`\\u2192 \\u30ab\\u30fc\\u30c8\\u306b\\u65e2\\u306b ${it.quantity}\\u500b\\u3042\\u308a`, `\\u2192 \\u0111\\u00e3 c\\u00f3 ${it.quantity} c\\u00e1i trong gi\\u1ecf`) + `: ${(it.product_title || x.title).slice(0, 22)}`);\n        x.qty = it.quantity; x.inCart = true; delete x.err; fillFromCart(x, [it]); n++;\n      }\n      return n;\n    } catch (e) { return 0; }\n  }\n  // m\\u00f3n th\\u00eam b\\u1eb1ng m\\u00e3 variant th\\u1eb3ng: l\\u1ea5y t\\u00ean / gi\\u00e1 / \\u1ea3nh t\\u1eeb c\\u00e2u tr\\u1ea3 l\\u1eddi c\\u1ee7a gi\\u1ecf \\u0111\\u1ec3 b\\u00e1o Discord\n  function fillFromCart(x, items) {\n    const it = (items || []).find((i) => String(i.variant_id || i.id) === String(x.id));\n    if (!it || !x.direct) return;\n    Object.assign(x, { title: it.product_title || x.title, name: it.product_title || x.name, handle: it.handle || '', size: it.variant_title || '-',\n      price: it.price != null ? it.price / 100 : x.price, image: it.image || '' });\n  }\n  // T\\u1eeb kho\\u00e1 l\\u00e0 M\\u00c3 VARIANT (s\\u1ed1) m\\u00e0 products.json ch\\u01b0a c\\u00f3 (ch\\u01b0a \\u0111\\u0103ng / b\\u1ecb \\u1ea9n): nh\\u01b0 b\\u1ea3n PC, POST th\\u1eb3ng /cart/add.js,\n  // shop nh\\u1eadn l\\u00e0 c\\u00f3 h\\u00e0ng. Th\\u1eed t\\u1ed1i \\u0111a 1 l\\u1ea7n / DIRECT_MS \\u0111\\u1ec3 kh\\u00f4ng b\\u1ecb Shopify ch\\u1eb7n v\\u00ec g\\u1eedi gi\\u1ecf qu\\u00e1 d\\u00e0y.\n  // 1 m\\u00e3 ho\\u1eb7c nhi\\u1ec1u m\\u00e3 n\\u1ed1i b\\u1eb1ng & (d\\u1ea5u ph\\u1ea9y / kho\\u1ea3ng tr\\u1eafng c\\u0169ng \\u0111\\u01b0\\u1ee3c) -> danh s\\u00e1ch m\\u00e3; c\\u00f3 ch\\u1eef th\\u00ec l\\u00e0 t\\u1eeb kh\\u00f3a th\\u01b0\\u1eddng -> []\n  const vidsOf = (kw) => { const a = String(kw || '').split(/[&,\\s]+/).filter(Boolean); return a.length && a.every((x) => /^\\d{8,}$/.test(x)) ? [...new Set(a)] : []; };\n  const pickOne = (a) => (a.length ? a[Math.floor(Math.random() * a.length)] : undefined);\n  // Mellojoy JP (b\\u00e1n \\u0111\\u00fang gi\\u1edd, ch\\u1ec9 canh ~10 ph\\u00fat): m\\u00e3 variant \\u0110\\u00c3 c\\u00f3 tr\\u00ean trang m\\u00e0 products.json c\\u00f2n b\\u00e1o h\\u1ebft h\\u00e0ng th\\u00ec V\\u1eaaN th\\u00eam th\\u1eb3ng\n  // -> products.json c\\u1ee7a Shopify c\\u00f3 th\\u1ec3 tr\\u1ec5 v\\u00e0i gi\\u00e2y so v\\u1edbi t\\u1ed3n kho th\\u1eadt, c\\u00f2n /cart/add.js tr\\u1ea3 l\\u1eddi theo t\\u1ed3n kho th\\u1eadt n\\u00ean v\\u00e0o gi\\u1ecf s\\u1edbm h\\u01a1n.\n  // 1 l\\u1ea7n / gi\\u00e2y; khung t\\u1ed1c \\u0111\\u1ed9 cao 12:00:07\\u201312:00:12 th\\u00ec 0,3 gi\\u00e2y. US canh h\\u00e0ng gi\\u1edd li\\u1ec1n -> kh\\u00f4ng l\\u00e0m (qu\\u00e1 nhi\\u1ec1u request gi\\u1ecf).\n  const DIRECT_MS = 1000, DIRECT_DENSE_MS = 300;   // 0,3s = nh\\u1ecbp qu\\u00e9t (user ch\\u1ecdn 2/11, bi\\u1ebft c\\u00f3 th\\u1ec3 b\\u1ecb 429)\n  let lastDirect = 0;\n  function directList(missing) {\n    // Variant ID ch\\u01b0a l\\u00ean trang (US + JP) ; JP: th\\u00eam c\\u1ea3 m\\u00f3n \\u0111\\u00e3 l\\u00ean trang m\\u00e0 c\\u00f2n b\\u00e1o h\\u1ebft (Variant ID, m\\u00e3 s\\u1ea3n ph\\u1ea9m hay t\\u1eeb kh\\u00f3a \\u0111\\u1ec1u \\u0111\\u01b0\\u1ee3c)\n    const ms = missing.filter((m) => m.dv || (!IS_US && m.v)).slice(0, MAX_PICK);\n    if (!ms.length || Date.now() - lastDirect < (curDense ? DIRECT_DENSE_MS : DIRECT_MS)) return [];\n    lastDirect = Date.now();\n    // JP c\\u00f3 c\\u1ea3 m\\u00e3 \\u0111\\u00e3 l\\u00ean trang (m.v) l\\u1eabn m\\u00e3 ch\\u01b0a l\\u00ean (m.dv) -> ch\\u1ecdn ng\\u1eabu nhi\\u00ean 1 trong 2 ; US ch\\u1ec9 th\\u00eam th\\u1eb3ng m\\u00e3 ch\\u01b0a l\\u00ean\n    return ms.map((m) => (!IS_US && m.v && !(m.dv && Math.random() < 0.5) ? { ...item({ p: m.p, v: m.v }, m.it.qty, ''), direct: true, kw: m.it.kw }\n      : { id: Number(m.dv), qty: m.it.qty, title: m.dv, name: m.dv, handle: '', size: '-', price: 0, image: '', direct: true, kw: m.it.kw }));\n  }\n\n\n  // ================= Thanh to\\u00e1n TH\\u1eba b\\u1eb1ng REQUEST (ch\\u00e9p t\\u1eeb b\\u1ea3n PC: shopify_rq_checkout.py) =================\n  // Kh\\u00f4ng c\\u1ea7n m\\u1edf trang checkout, kh\\u00f4ng c\\u1ea7n \\u0111\\u0103ng nh\\u1eadp shop (Mellojoy US cho mua ki\\u1ec3u kh\\u00e1ch; Mellojoy JP b\\u1eaft \\u0111\\u0103ng nh\\u1eadp):\n  //   1) GET /checkout?skip_shop_pay=true -> trang /checkouts/cn/<token>: \\u0111\\u1ecdc sessionToken, sourceToken, commitSha\\u2026\n  //   2) m\\u00e3 truy v\\u1ea5n GraphQL (Proposal / SubmitForCompletion / PollForReceipt) \\u0111\\u1ecdc t\\u1eeb file JS checkout tr\\u00ean cdn.shopify.com,\n  //      l\\u01b0u theo b\\u1ea3n build (commitSha); \\u0111\\u1ecdc S\\u1eb4N l\\u00fac b\\u1eaft \\u0111\\u1ea7u canh h\\u00e0ng (warmOps) \\u0111\\u1ec3 l\\u00fac c\\u00f3 h\\u00e0ng kh\\u1ecfi m\\u1ea5t v\\u00e0i gi\\u00e2y\n  //   3) Proposal v\\u1edbi \\u0111\\u1ecba ch\\u1ec9 trong khung -> ph\\u00ed ship r\\u1ebb nh\\u1ea5t ; 4) l\\u01b0u th\\u1ebb: POST checkout.pci.shopifyinc.com/sessions\n  //   5) SubmitForCompletion -> PollForReceipt: ProcessedReceipt = \\u0111\\u1eb7t xong / FailedReceipt = th\\u1ebb b\\u1ecb t\\u1eeb ch\\u1ed1i / ActionRequired = 3D Secure\n  // H\\u1ecfng TR\\u01af\\u1edaC l\\u00fac g\\u1eedi \\u0111\\u1eb7t h\\u00e0ng -> m\\u1edf trang checkout \\u0111\\u1ec3 b\\u1ea1n t\\u1ef1 tr\\u1ea3. \\u0110\\u00c3 g\\u1eedi \\u0111\\u1eb7t h\\u00e0ng th\\u00ec kh\\u00f4ng bao gi\\u1edd g\\u1eedi l\\u1ea1i (tr\\u00e1nh 2 \\u0111\\u01a1n).\n  const K_BUY = 'pjc_buy_v1';\n  const buy = () => load(K_BUY, {});\n  // \\u0111\\u00e3 \\u0111\\u0103ng nh\\u1eadp t\\u00e0i kho\\u1ea3n shop: Shopify ghi m\\u00e3 kh\\u00e1ch v\\u00e0o bi\\u1ebfn c\\u1ee7a trang (script ch\\u1ea1y trong trang n\\u00ean \\u0111\\u1ecdc \\u0111\\u01b0\\u1ee3c)\n  const loggedIn = () => {\n    try {\n      const m = window.ShopifyAnalytics && ShopifyAnalytics.meta;\n      if (m && ((m.page && m.page.customerId) || m.customerId)) return true;\n      if (window.__st && window.__st.cid) return true;\n    } catch (e) {}\n    return /\"customerId\":\\s*\\d+|customer_id[\"']?\\s*[:=]\\s*[\"']?\\d{5,}/.test(document.documentElement.innerHTML.slice(0, 300000));\n  };\n  const COUNTRY = IS_US ? 'US' : 'JP';\n  // n\\u01b0\\u1edbc giao h\\u00e0ng ch\\u1ecdn trong khung (Mellojoy US: US ho\\u1eb7c JP; Mellojoy JP: lu\\u00f4n JP)\n  const shipCountry = (b) => (IS_US && (b.country === 'JP' || b.country === 'US') ? b.country : COUNTRY);\n  const digits = (v) => String(v || '').replace(/\\D/g, '');\n  const hasCard = (b) => digits(b.cnum).length >= 12 && digits(b.cexp).length >= 4 && digits(b.ccvv).length >= 3;\n  const hasAddr = (b) => !!(b.last && b.first && b.email && b.phone && b.zip && b.zone && b.city && b.addr1);\n  // 2/11: Mellojoy US tr\\u1ea3 403 \"Request Forbidden\" cho trang checkout khi l\\u1ea5y b\\u1eb1ng request (m\\u1edf b\\u1eb1ng tr\\u00ecnh duy\\u1ec7t th\\u00ec v\\u1eabn v\\u00e0o \\u0111\\u01b0\\u1ee3c)\n  // -> shop ch\\u1eb7n ki\\u1ec3u thanh to\\u00e1n n\\u00e0y. \\u0110\\u00e3 b\\u1ecb ch\\u1eb7n th\\u00ec 12 gi\\u1edd kh\\u00f4ng th\\u1eed request n\\u1eefa: c\\u00f3 h\\u00e0ng l\\u00e0 m\\u1edf th\\u1eb3ng trang thanh to\\u00e1n,\n  // kh\\u1ecfi m\\u1ea5t ~0,5\\u20131 gi\\u00e2y cho 1 l\\u1ea7n th\\u1eed ch\\u1eafc ch\\u1eafn h\\u1ecfng. H\\u1ebft 12 gi\\u1edd t\\u1ef1 th\\u1eed l\\u1ea1i 1 l\\u1ea7n (shop c\\u00f3 th\\u1ec3 m\\u1edf l\\u1ea1i).\n  const K_RQB = 'pjc_rq_blocked_v1';\n  const rqBlocked = () => Date.now() - (load(K_RQB, {})[location.hostname] || 0) < 12 * 3600e3;\n  const markRqBlocked = () => { const m = load(K_RQB, {}); m[location.hostname] = Date.now(); save(K_RQB, m); };\n  class CoErr extends Error { constructor(m, o) { super(m); Object.assign(this, o || {}); } }\n  const decodeHtml = (x) => { const t = document.createElement('textarea'); t.innerHTML = x; return t.value; };\n  function meta(h, n) {\n    const m = h.match(new RegExp(`<meta name=\"serialized-${n}\" content=\"([^\"]*)\"`));\n    if (!m) return null;\n    const v = decodeHtml(m[1]);\n    try { return JSON.parse(v); } catch (e) { return v; }\n  }\n  const errShort = (ds) => (ds || []).slice(0, 3).map((e) => `${e.code}: ${e.localizedMessage || e.nonLocalizedMessage || ''}`.trim()).join(' | ') || '-';\n  const SOLD_RE = /OUT_OF_STOCK|INVENTORY|MERCHANDISE_NOT_AVAILABLE|NOT_ENOUGH_STOCK|SOLD_OUT|InventoryReservationFailure|MERCHANDISE_EXPECTATIONS_NOT_MET/i;\n  const isSold = (x) => SOLD_RE.test(typeof x === 'string' ? x : JSON.stringify(x || ''));\n  const OPS = ['Proposal', 'SubmitForCompletion', 'PollForReceipt'];\n  const K_OPS = 'pjc_ops_v1';\n  const uuid = () => (crypto.randomUUID ? crypto.randomUUID()\n    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));\n\n  // m\\u00e3 truy v\\u1ea5n theo b\\u1ea3n build: ch\\u1ec9 2/342 file JS ch\\u1ee9a -> t\\u1ea3i song song 16 file m\\u1ed9t l\\u00fac, \\u0111\\u1ee7 3 m\\u00e3 l\\u00e0 th\\u00f4i\n  async function getOps(html, commit) {\n    const cache = load(K_OPS, {});\n    if (commit && cache[commit] && OPS.every((k) => cache[commit][k])) return cache[commit];\n    const files = [...new Set(html.match(/\\/cdn\\/shopifycloud\\/checkout-web\\/assets\\/[A-Za-z0-9/._-]+\\.js/g) || [])];\n    const ops = {}, re = new RegExp(`id:\"([a-f0-9]{64})\",type:\"(?:query|mutation)\",name:\"(${OPS.join('|')})\"`, 'g');\n    let i = 0;\n    const worker = async () => {\n      while (i < files.length && !OPS.every((k) => ops[k])) {\n        const f = files[i++];\n        try { const t = await (await fetch('https://cdn.shopify.com' + f)).text(); for (const m of t.matchAll(re)) ops[m[2]] = m[1]; } catch (e) {}\n      }\n    };\n    await Promise.all(Array.from({ length: 16 }, worker));\n    if (!OPS.every((k) => ops[k])) throw new CoErr(L('\\u8cfc\\u5165\\u7528\\u306e\\u30b3\\u30fc\\u30c9\\u304c\\u898b\\u3064\\u304b\\u308a\\u307e\\u305b\\u3093', 'kh\\u00f4ng t\\u00ecm th\\u1ea5y m\\u00e3 truy v\\u1ea5n checkout'), { ui: true });\n    const keep = Object.entries(cache).slice(-3);\n    save(K_OPS, Object.fromEntries([...keep, [commit, ops]]));\n    return ops;\n  }\n  // \\u0110\\u1ecdc s\\u1eb5n m\\u00e3 truy v\\u1ea5n khi b\\u1eaft \\u0111\\u1ea7u canh: m\\u1edf checkout c\\u1ee7a 1 m\\u00f3n b\\u1ea5t k\\u1ef3 KH\\u00d4NG g\\u1eedi cookie (gi\\u1ecf c\\u1ee7a b\\u1ea1n kh\\u00f4ng b\\u1ecb \\u0111\\u1ee5ng)\n  let warmAt = 0;\n  async function warmOps(products) {\n    if (!IS_US || !hasCard(buy()) || rqBlocked() || Date.now() - warmAt < 30 * 60e3) return;\n    warmAt = Date.now();\n    try {\n      const v = products && products[0] && products[0].variants && products[0].variants[0];\n      if (!v) { warmAt = 0; return; }\n      const r = await fetch(`/cart/${v.id}:1?skip_shop_pay=true`, { credentials: 'omit', cache: 'no-store' });\n      if (r.status === 403) {\n        markRqBlocked();\n        log(L('\\u26a0\\ufe0f \\u30b7\\u30e7\\u30c3\\u30d7\\u304c\\u30ea\\u30af\\u30a8\\u30b9\\u30c8\\u8cfc\\u5165\\u3092\\u30d6\\u30ed\\u30c3\\u30af\\u4e2d\\uff08403\\uff09\\u2192 \\u5728\\u5eab\\u304c\\u51fa\\u305f\\u3089\\u8cfc\\u5165\\u753b\\u9762\\u3092\\u76f4\\u63a5\\u958b\\u304d\\u307e\\u3059', '\\u26a0\\ufe0f Shop \\u0111ang ch\\u1eb7n thanh to\\u00e1n b\\u1eb1ng request (403) \\u2192 c\\u00f3 h\\u00e0ng BOT m\\u1edf th\\u1eb3ng trang thanh to\\u00e1n'));\n        return;\n      }\n      const h = await r.text(), env = meta(h, 'environment') || {};\n      if (!env.commitSha) return;\n      const t0 = performance.now();\n      await getOps(h, env.commitSha);\n      log(L(`\\ud83d\\udcb3 \\u8cfc\\u5165\\u6e96\\u5099OK\\uff08\\u30d3\\u30eb\\u30c9 ${env.commitSha.slice(0, 7)}\\u30fb${Math.round(performance.now() - t0)}ms\\uff09`, `\\ud83d\\udcb3 \\u0110\\u00e3 chu\\u1ea9n b\\u1ecb thanh to\\u00e1n request (b\\u1ea3n build ${env.commitSha.slice(0, 7)}, ${Math.round(performance.now() - t0)}ms)`));\n    } catch (e) {}\n  }\n\n  async function rqCheckout() {\n    const b = buy();\n    const t0 = performance.now(), mark = {};\n    const tick = (k) => { mark[k] = Math.round(performance.now() - t0); };\n    // 1) m\\u1edf checkout\n    let r, html = '', url = '';\n    for (let k = 0; ; k++) {\n      try { r = await fetch('/checkout?skip_shop_pay=true', { credentials: 'include', cache: 'no-store' }); } catch (e) {\n        // chuy\\u1ec3n sang shopify.com (\\u0111\\u0103ng nh\\u1eadp) / shop.app -> kh\\u00e1c t\\u00ean mi\\u1ec1n, fetch b\\u00e1o l\\u1ed7i\n        throw new CoErr(L('\\u8cfc\\u5165\\u753b\\u9762\\u3092\\u958b\\u3051\\u307e\\u305b\\u3093\\uff08\\u30ed\\u30b0\\u30a4\\u30f3\\u304c\\u5fc5\\u8981\\u306a\\u5e97\\u8217\\uff09', 'kh\\u00f4ng m\\u1edf \\u0111\\u01b0\\u1ee3c checkout (shop b\\u1eaft \\u0111\\u0103ng nh\\u1eadp?)'), { ui: true });\n      }\n      url = r.url;\n      if (/\\/throttle|\\/queue/.test(url)) throw new CoErr(L('\\u9806\\u756a\\u5f85\\u3061', 'shop \\u0111ang cho x\\u1ebfp h\\u00e0ng ch\\u1edd'), { ui: true });\n      if ((r.status === 429 || r.status >= 500) && k < 8) { await sleep(800); continue; }\n      if (r.status === 403) { markRqBlocked(); throw new CoErr(L('\\u30b7\\u30e7\\u30c3\\u30d7\\u304c\\u30ea\\u30af\\u30a8\\u30b9\\u30c8\\u8cfc\\u5165\\u3092\\u30d6\\u30ed\\u30c3\\u30af\\uff08403\\uff09', 'shop ch\\u1eb7n thanh to\\u00e1n b\\u1eb1ng request (403)'), { ui: true }); }\n      if (r.status >= 400) throw new CoErr(`checkout HTTP ${r.status}`, { ui: true });\n      html = await r.text();\n      break;\n    }\n    if (!/\\/checkouts\\//.test(url)) throw new CoErr(/account|authentication|login/.test(url) ? L('\\u30ed\\u30b0\\u30a4\\u30f3\\u304c\\u5fc5\\u8981', 'shop b\\u1eaft \\u0111\\u0103ng nh\\u1eadp') : `checkout \\u2192 ${url.slice(0, 60)}`, { ui: true });\n    tick('trang');\n    const goc = new URL(url).origin;\n    const sessionToken = meta(html, 'sessionToken'), sourceToken = meta(html, 'sourceToken');\n    const sourceType = meta(html, 'sourceType') || 'cn';\n    const env = meta(html, 'environment') || {};\n    const commit = env.commitSha || '', deploy = env.deployStage || 'production';\n    const serverHandling = meta(html, 'serverHandling') || '', serverRender = meta(html, 'serverRender') || 'no';\n    if (!sessionToken || !sourceToken) throw new CoErr(L('\\u8cfc\\u5165\\u753b\\u9762\\u306e\\u8aad\\u307f\\u8fbc\\u307f\\u5931\\u6557', 'trang checkout kh\\u00f4ng c\\u00f3 sessionToken'), { ui: true });\n    const gq = meta(html, 'graphql') || {};\n    let cardsink = 'https://checkout.pci.shopifyinc.com/sessions', sig = meta(html, 'shopifyIdentificationSignature'), sess = null;\n    for (const v of Object.values(gq)) {\n      if (v && typeof v === 'object' && v.session && v.session.negotiate) sess = v.session;\n      if (v && typeof v === 'object' && v.cardsinkUrl) cardsink = v.cardsinkUrl;\n    }\n    if (!sess) throw new CoErr(L('\\u8cfc\\u5165\\u753b\\u9762\\u306e\\u8aad\\u307f\\u8fbc\\u307f\\u5931\\u6557', 'kh\\u00f4ng \\u0111\\u1ecdc \\u0111\\u01b0\\u1ee3c phi\\u00ean checkout'), { ui: true });\n    sig = sess.checkoutCardsinkCallerIdentificationSignature || sig;\n    let seller = {}, buyer = {}, queueToken = null, negErr = [];\n    const take = (neg) => {\n      const res = (neg || {}).result || {};\n      negErr = (neg || {}).errors || [];\n      if (res.queueToken) queueToken = res.queueToken;\n      if (res.__typename === 'Throttled') throw new CoErr(L('\\u9806\\u756a\\u5f85\\u3061', 'shop \\u0111ang cho x\\u1ebfp h\\u00e0ng ch\\u1edd'), { ui: true });\n      if (res.sellerProposal) seller = res.sellerProposal;\n      if (res.buyerProposal) buyer = res.buyerProposal;\n      return res;\n    };\n    take(sess.negotiate);\n    // 2) m\\u00e3 truy v\\u1ea5n  +  4) l\\u01b0u th\\u1ebb ch\\u1ea1y SONG SONG (kh\\u00f4ng ph\\u1ee5 thu\\u1ed9c nhau)\n    const vault = (async () => {\n      const d = digits(b.cexp), yy = d.length > 4 ? d.slice(-4) : d.slice(2, 4);\n      const cc = { number: digits(b.cnum), month: +d.slice(0, 2), year: +(yy.length === 4 ? yy : '20' + yy), verification_value: digits(b.ccvv), name: b.cname || `${b.first || ''} ${b.last || ''}`.trim() };\n      const rr = await fetch(cardsink, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(sig ? { 'Shopify-Identification-Signature': sig } : {}) },\n        body: JSON.stringify({ credit_card: cc, payment_session_scope: new URL(goc).host }) });\n      const j = await rr.json().catch(() => ({}));\n      if (rr.status >= 400 || !j.id) throw new CoErr(L(`\\u30ab\\u30fc\\u30c9\\u767b\\u9332\\u5931\\u6557 (HTTP ${rr.status})`, `l\\u01b0u th\\u1ebb h\\u1ecfng (HTTP ${rr.status})`) + (j.errors ? ': ' + JSON.stringify(j.errors).slice(0, 80) : ''), { ui: true });\n      return j.id;\n    })();\n    vault.catch(() => {});\n    const ops = await getOps(html, commit);\n    tick('ma');\n    const H = { Accept: 'application/json', 'Content-Type': 'application/json', 'Shopify-Checkout-Client': 'checkout-web/1.0',\n      'X-Checkout-One-Session-Token': sessionToken, 'X-Checkout-Web-Build-Id': commit, 'X-Checkout-Web-Deploy-Stage': deploy,\n      'X-Checkout-Web-Source-Id': sourceToken, 'X-Checkout-Web-Server-Handling': serverHandling, 'X-Checkout-Web-Server-Rendering': serverRender,\n      'Shopify-Checkout-Source': `id=\"${sourceToken}\", type=\"${sourceType}\"` };\n    async function gql(name, vars) {\n      for (let k = 0; k < 6; k++) {\n        const rr = await fetch(`${goc}/checkouts/internal/graphql/persisted?operationName=${name}`, { method: 'POST', credentials: 'include', headers: H,\n          body: JSON.stringify({ variables: vars, operationName: name, id: ops[name] }) });\n        if ([429, 502, 503, 504].includes(rr.status)) { await sleep(600 * (k + 1)); continue; }\n        let j;\n        try { j = await rr.json(); } catch (e) { throw new CoErr(`${name}: HTTP ${rr.status}`, { ui: true }); }\n        if (j.errors && !j.data) throw new CoErr(`${name}: ${JSON.stringify(j.errors).slice(0, 160)}`, { ui: true });\n        return j.data || {};\n      }\n      throw new CoErr(`${name}: ${L('\\u30a2\\u30af\\u30bb\\u30b9\\u5236\\u9650', 'shop ch\\u1eb7n t\\u1ed1c \\u0111\\u1ed9')}`, { ui: true });\n    }\n    const addr = () => {\n      if (hasAddr(b)) return { address1: b.addr1, address2: b.addr2 || '', city: b.city, countryCode: shipCountry(b), postalCode: b.zip,\n        firstName: b.first, lastName: b.last, zoneCode: b.zone, phone: b.phone, company: '' };\n      // khung tr\\u1ed1ng m\\u00e0 \\u0111\\u00e3 \\u0111\\u0103ng nh\\u1eadp shop -> \\u0111\\u1ecba ch\\u1ec9 \\u0111\\u00e3 l\\u01b0u trong t\\u00e0i kho\\u1ea3n\n      const a0 = (seller.availableDeliveryAddresses || [])[0];\n      if (a0) { const a = a0.address || a0; return Object.fromEntries(['address1', 'address2', 'city', 'countryCode', 'postalCode', 'firstName', 'lastName', 'zoneCode', 'phone', 'company'].map((k) => [k, a[k] || ''])); }\n      throw new CoErr(L('\\u914d\\u9001\\u5148\\u304c\\u672a\\u5165\\u529b', 'ch\\u01b0a nh\\u1eadp \\u0111\\u1ecba ch\\u1ec9 giao h\\u00e0ng'), { ui: true });\n    };\n    const cur = () => {\n      for (const ln of ((seller.merchandise || {}).merchandiseLines || [])) { const pr = (ln.merchandise || {}).price || {}; if (pr.currencyCode) return pr.currencyCode; }\n      return IS_US ? 'USD' : 'JPY';\n    };\n    const lines = () => {\n      const ds = ((buyer.merchandise || seller.merchandise || {}).merchandiseLines || []).map((ln) => {\n        const m = ln.merchandise || {};\n        return { stableId: ln.stableId,\n          merchandise: { productVariantReference: { id: m.id, variantId: m.variantId, properties: m.properties || [], sellingPlanId: null, sellingPlanDigest: null } },\n          quantity: { items: { value: (((ln.quantity || {}).items || {}).value) || 1 } }, expectedTotalPrice: { any: true }, lineComponentsSource: null, lineComponents: [] };\n      });\n      if (!ds.length) throw new CoErr(L('\\u30ab\\u30fc\\u30c8\\u304c\\u7a7a\\uff08\\u58f2\\u308a\\u5207\\u308c\\uff09', 'gi\\u1ecf trong checkout tr\\u1ed1ng (v\\u1eeba h\\u1ebft h\\u00e0ng)'), { sold: true });\n      return ds;\n    };\n    const input = (ship, pay) => {\n      const dc = addr(), tt = cur();\n      const inp = {\n        sessionInput: { sessionToken }, queueToken,\n        discounts: { lines: [], acceptUnexpectedDiscounts: true },\n        delivery: {\n          deliveryLines: [{\n            destination: ship ? { streetAddress: dc } : { partialStreetAddress: dc },\n            selectedDeliveryStrategy: ship ? { deliveryStrategyByHandle: { handle: ship.handle, customDeliveryRate: false }, options: {} }\n              : { deliveryStrategyMatchingConditions: { estimatedTimeInTransit: { any: true }, shipments: { any: true } }, options: {} },\n            targetMerchandiseLines: { any: true }, deliveryMethodTypes: ['SHIPPING'],\n            expectedTotalPrice: ship ? { value: ship.price } : { any: true }, destinationChanged: !ship,\n          }],\n          noDeliveryRequired: [], useProgressiveRates: false, prefetchShippingRatesStrategy: null, supportsSplitShipping: true,\n        },\n        deliveryExpectations: { deliveryExpectationLines: [] },\n        merchandise: { merchandiseLines: lines() },\n        payment: { totalAmount: { any: true }, paymentLines: pay || [], billingAddress: { streetAddress: dc } },\n        buyerIdentity: { customer: { presentmentCurrency: tt, countryCode: dc.countryCode }, ...(b.email ? { email: b.email, emailChanged: false } : {}),\n          phoneCountryCode: dc.countryCode, marketingConsent: [], shopPayOptInPhone: { countryCode: dc.countryCode }, rememberMe: false },\n        tip: { tipLines: [] },\n        taxes: { proposedAllocations: null, proposedTotalAmount: { value: { amount: '0', currencyCode: tt } }, proposedTotalIncludedAmount: null, proposedMixedStateTotalAmount: null, proposedExemptions: [] },\n        note: { message: null, customAttributes: [] }, localizationExtension: { fields: [] }, nonNegotiableTerms: null,\n        scriptFingerprint: seller.scriptFingerprint || null, optionalDuties: { buyerRefusesDuties: false },\n      };\n      if (inp.scriptFingerprint && typeof inp.scriptFingerprint === 'object') { const { __typename, ...rest } = inp.scriptFingerprint; inp.scriptFingerprint = rest; }\n      const tax = ((seller.tax || {}).totalTaxAmount || {}).value;\n      if (tax) inp.taxes.proposedTotalAmount = { value: { amount: tax.amount, currencyCode: tax.currencyCode } };\n      return inp;\n    };\n    async function proposal(ship, pay) {\n      for (let k = 0; k < 40; k++) {\n        const res = take(((await gql('Proposal', input(ship, pay))).session || {}).negotiate);\n        if (res.__typename !== 'NegotiationResultAvailable') throw new CoErr(`Proposal: ${res.__typename} ${errShort(negErr)}`, { ui: true, sold: isSold(negErr) });\n        const pend = ['delivery', 'tax', 'payment'].find((k2) => (seller[k2] || {}).__typename === 'PendingTerms');\n        if (!pend) return;\n        await sleep(Math.max(300, Math.min(2000, (seller[pend] || {}).pollDelay || 500)));\n      }\n      throw new CoErr(L('\\u9001\\u6599\\u30fb\\u7a0e\\u306e\\u8a08\\u7b97\\u5f85\\u3061\\u304c\\u9577\\u3059\\u304e\\u308b', 'ch\\u1edd t\\u00ednh ph\\u00ed ship / thu\\u1ebf qu\\u00e1 l\\u00e2u'), { ui: true });\n    }\n    // 3) Proposal 1: \\u0111\\u1ecba ch\\u1ec9 -> ph\\u00ed ship\n    await proposal();\n    tick('ship');\n    const dv = seller.delivery || {};\n    if (dv.__typename !== 'FilledDeliveryTerms') throw new CoErr(L('\\u9001\\u6599\\u3092\\u53d6\\u5f97\\u3067\\u304d\\u307e\\u305b\\u3093: ', 'shop ch\\u01b0a tr\\u1ea3 ph\\u00ed ship: ') + errShort(negErr), { ui: true, sold: isSold(negErr) });\n    let ship = null;\n    for (const ln of dv.deliveryLines || []) for (const s2 of ln.availableDeliveryStrategies || []) {\n      const g = (s2.amount || {}).value || { amount: '0', currencyCode: cur() };\n      if (!ship || +g.amount < +ship.price.amount) ship = { handle: s2.handle, price: { amount: g.amount, currencyCode: g.currencyCode }, title: s2.title || s2.handle };\n    }\n    if (!ship) throw new CoErr(L('\\u3053\\u306e\\u4f4f\\u6240\\u306b\\u914d\\u9001\\u3067\\u304d\\u307e\\u305b\\u3093', 'shop kh\\u00f4ng giao t\\u1edbi \\u0111\\u1ecba ch\\u1ec9 n\\u00e0y'), { ui: true });\n    const pmLine = ((seller.payment || {}).availablePaymentLines || []).find((ln) => (ln.paymentMethod || {}).__typename === 'PaymentProvider' && (ln.placements || []).includes('PAYMENT_METHOD'));\n    if (!pmLine) throw new CoErr(L('\\u30ab\\u30fc\\u30c9\\u6255\\u3044\\u304c\\u306a\\u3044\\u5e97\\u8217', 'shop kh\\u00f4ng c\\u00f3 thanh to\\u00e1n b\\u1eb1ng th\\u1ebb'), { ui: true });\n    const pmid = pmLine.paymentMethod.paymentMethodIdentifier;\n    const sessionId = await vault;\n    tick('the');\n    log(L(`\\ud83d\\ude9a ${ship.title} ${ship.price.amount} ${ship.price.currencyCode} \\u00b7 \\ud83d\\udcb3 ****${digits(b.cnum).slice(-4)}`, `\\ud83d\\ude9a Giao: ${ship.title} ${ship.price.amount} ${ship.price.currencyCode} \\u00b7 \\ud83d\\udcb3 th\\u1ebb ****${digits(b.cnum).slice(-4)}`));\n    const payLines = (total) => [{ paymentMethod: { directPaymentMethod: { paymentMethodIdentifier: pmid, sessionId, billingAddress: { streetAddress: addr() }, cardSource: null } },\n      amount: total ? { value: total } : { any: true }, dueAt: null }];\n    const totalNow = () => { for (const k of ['checkoutTotal', 'runningTotal', 'total']) { const v = (seller[k] || {}).value; if (v && v.amount != null) return { amount: v.amount, currencyCode: v.currencyCode }; } return null; };\n    // Proposal 2: \\u0111\\u00e3 ch\\u1ecdn ship + th\\u1ebb -> t\\u1ed5ng ti\\u1ec1n \\u0111\\u00fang\n    const calc = async () => {\n      await proposal(ship, payLines(null));\n      if (negErr.length && isSold(negErr)) throw new CoErr(L('\\u58f2\\u308a\\u5207\\u308c: ', 'H\\u1ebeT H\\u00c0NG trong checkout: ') + errShort(negErr), { sold: true });\n      return totalNow();\n    };\n    let total = await calc();\n    tick('tong');\n    log(L(`\\ud83e\\uddfe \\u5408\\u8a08 ${total ? total.amount + ' ' + total.currencyCode : '?'}`, `\\ud83e\\uddfe T\\u1ed5ng ti\\u1ec1n ${total ? total.amount + ' ' + total.currencyCode : '?'}`));\n    // 5) g\\u1eedi \\u0111\\u1eb7t h\\u00e0ng (c\\u00f9ng attemptToken: g\\u1eedi tr\\u00f9ng th\\u00ec shop tr\\u1ea3 SubmitAlreadyAccepted, kh\\u00f4ng th\\u00e0nh 2 \\u0111\\u01a1n)\n    let rid = null;\n    for (let k = 0; k < 4 && !rid; k++) {\n      const vars = { input: input(ship, payLines(total)), attemptToken: `${sourceToken}-${uuid().replace(/-/g, '').slice(0, 10)}`, metafields: [],\n        analytics: { requestUrl: url, pageId: uuid().toUpperCase() } };\n      let d;\n      try { d = await gql('SubmitForCompletion', vars); } catch (e) {\n        // kh\\u00f4ng bi\\u1ebft shop \\u0111\\u00e3 nh\\u1eadn hay ch\\u01b0a -> KH\\u00d4NG g\\u1eedi l\\u1ea1i, m\\u1edf trang \\u0111\\u1ec3 xem\n        return { tt: 'unknown', checkout: url, loi: e.message, mark };\n      }\n      const kq = d.submitForCompletion || {};\n      if (['SubmitSuccess', 'SubmitAlreadyAccepted', 'SubmittedForCompletion'].includes(kq.__typename)) { rid = (kq.receipt || {}).id; break; }\n      if (kq.__typename === 'Throttled') { await sleep(Math.max(500, kq.pollAfter || 1000)); k--; continue; }\n      if (kq.__typename === 'CheckpointDenied') throw new CoErr(L('\\u30dc\\u30c3\\u30c8\\u78ba\\u8a8d\\uff08\\u30ad\\u30e3\\u30d7\\u30c1\\u30e3\\uff09', 'shop b\\u1eaft ki\\u1ec3m tra bot (captcha)'), { ui: true });\n      const errs = kq.errors || [];\n      if (errs.some((e) => /PAYMENT_AMOUNT/.test(String(e.code || ''))) && k < 3) {   // t\\u1ed5ng ti\\u1ec1n v\\u1eeba \\u0111\\u1ed5i: shop CH\\u01afA t\\u1ea1o \\u0111\\u01a1n -> t\\u00ednh l\\u1ea1i, g\\u1eedi l\\u1ea1i\n        log(L('\\u5408\\u8a08\\u304c\\u5909\\u308f\\u3063\\u305f \\u2192 \\u518d\\u8a08\\u7b97\\u3057\\u3066\\u518d\\u9001', 'T\\u1ed5ng ti\\u1ec1n v\\u1eeba \\u0111\\u1ed5i \\u2192 t\\u00ednh l\\u1ea1i v\\u00e0 g\\u1eedi l\\u1ea1i'));\n        total = await calc(); continue;\n      }\n      throw new CoErr(`SubmitForCompletion ${kq.__typename}: ${errShort(errs)}`, { ui: true, sold: isSold(errs) });\n    }\n    tick('gui');\n    if (!rid) return { tt: 'unknown', checkout: url, mark };\n    log(L(`\\ud83e\\uddfe \\u6ce8\\u6587\\u9001\\u4fe1\\uff08\\u30c1\\u30a7\\u30c3\\u30af\\u30a2\\u30a6\\u30c8\\u304b\\u3089 ${mark.gui}ms\\uff09\\u2192 \\u7d50\\u679c\\u5f85\\u3061`, `\\ud83e\\uddfe \\u0110\\u00c3 G\\u1eecI \\u0110\\u1eb6T H\\u00c0NG (${mark.gui}ms t\\u1eeb l\\u00fac m\\u1edf checkout) \\u2192 ch\\u1edd k\\u1ebft qu\\u1ea3`));\n    for (let k = 0; k < 120; k++) {\n      let rc = {};\n      try { rc = (await gql('PollForReceipt', { receiptId: rid, sessionToken })).receipt || {}; } catch (e) { await sleep(1000); continue; }\n      if (rc.__typename === 'ProcessedReceipt') return { tt: 'ok', url: rc.orderStatusPageUrl || '', order: String(((rc.orderIdentity || {}).buyerIdentifier) || rc.id || ''), total, mark };\n      if (rc.__typename === 'FailedReceipt') { const pe = rc.processingError || {}; return { tt: 'fail', loi: `${pe.code || pe.__typename || 'FailedReceipt'} ${pe.messageUntranslated || ''}`.trim(), checkout: url, sold: isSold(pe), mark }; }\n      if (rc.__typename === 'ActionRequiredReceipt') return { tt: '3ds', url: ((rc.action || {}).url) || url, mark };\n      await sleep(Math.max(300, rc.pollDelay || 500));\n    }\n    return { tt: 'unknown', checkout: url, mark };\n  }\n\n  // C\\u00f3 h\\u00e0ng trong gi\\u1ecf -> tr\\u1ea3 b\\u1eb1ng request. H\\u1ecfng tr\\u01b0\\u1edbc khi g\\u1eedi \\u0111\\u1eb7t h\\u00e0ng -> m\\u1edf checkout cho b\\u1ea1n t\\u1ef1 tr\\u1ea3.\n  async function rqPay() {\n    setStatus(L('\\ud83d\\udcb3 \\u30ea\\u30af\\u30a8\\u30b9\\u30c8\\u3067\\u652f\\u6255\\u3044\\u4e2d\\u2026', '\\ud83d\\udcb3 \\u0110ang thanh to\\u00e1n b\\u1eb1ng request\\u2026'));\n    log(L('\\ud83d\\udcb3 \\u30ab\\u30fc\\u30c9\\u6255\\u3044\\uff08\\u30ea\\u30af\\u30a8\\u30b9\\u30c8\\uff09\\u958b\\u59cb', '\\ud83d\\udcb3 B\\u1eaft \\u0111\\u1ea7u thanh to\\u00e1n th\\u1ebb b\\u1eb1ng request'));\n    let k;\n    try { k = await rqCheckout(); } catch (e) {\n      if (e.sold) {\n        log(L('\\u58f2\\u308a\\u5207\\u308c \\u2192 \\u76e3\\u8996\\u3092\\u7d9a\\u3051\\u307e\\u3059: ', 'H\\u1ebft h\\u00e0ng trong l\\u00fac thanh to\\u00e1n \\u2192 qu\\u00e9t ti\\u1ebfp: ') + e.message);\n        reqNote('other');\n        try { await fetch('/cart/clear.js', { method: 'POST', credentials: 'same-origin' }); } catch (x) {}\n        await sleep(1500);                          // ngh\\u1ec9 ch\\u00fat cho products.json k\\u1ecbp c\\u1eadp nh\\u1eadt, kh\\u1ecfi v\\u00f2ng l\\u1eb7p d\\u1ed3n d\\u1eadp\n        st.active = true; save(K_ST, st); adding = false; run(); return;\n      }\n      log(L('\\u30ea\\u30af\\u30a8\\u30b9\\u30c8\\u652f\\u6255\\u3044\\u5931\\u6557 \\u2192 \\u8cfc\\u5165\\u753b\\u9762\\u3067\\u81ea\\u5206\\u3067\\u652f\\u6255\\u3063\\u3066\\u304f\\u3060\\u3055\\u3044: ', 'Thanh to\\u00e1n request h\\u1ecfng \\u2192 m\\u1edf trang thanh to\\u00e1n, b\\u1ea1n t\\u1ef1 tr\\u1ea3: ') + e.message);\n      // m\\u1edf trang thanh to\\u00e1n nh\\u01b0 \\u0111\\u01b0\\u1eddng th\\u01b0\\u1eddng: \\u0111\\u00e3 login Shop Pay th\\u00ec BOT v\\u1eabn t\\u1ef1 b\\u1ea5m \\u4eca\\u3059\\u3050\\u652f\\u6255\\u3046\n      save('pjc_autopay', { at: Date.now() });\n      location.href = '/checkout#synova-pay-' + Date.now(); return;\n    }\n    const tm = Object.entries(k.mark || {}).map(([a, v]) => `${a} ${v}ms`).join(' \\u00b7 ');\n    if (k.tt === 'ok') {\n      log(L(`\\u2705 \\u6ce8\\u6587\\u5b8c\\u4e86\\uff01 ${k.order} ${k.total ? k.total.amount + ' ' + k.total.currencyCode : ''}`, `\\u2705 \\u0110\\u1eb6T H\\u00c0NG TH\\u00c0NH C\\u00d4NG! M\\u00e3 \\u0111\\u01a1n ${k.order} ${k.total ? k.total.amount + ' ' + k.total.currencyCode : ''}`));\n      if (tm) log('\\u23f1 ' + tm);\n      let last = null;\n      try { last = JSON.parse(localStorage.getItem('pjc_last')); } catch (e) {}\n      synovaNotify((last && last.items && last.items.length ? last.items : [{ title: SHOP, url: location.origin }]).map((it) => ({\n        author: '\\u2705 Checkout Successful (request)', title: it.title, url: it.url, thumb: it.image, site: location.hostname,\n        fields: [['Size', it.size], ['\\u4fa1\\u683c', it.price], ['Quantity', it.qty], ['Order', k.order], ['Checkout Time', synovaSpeed(last && last.at)], ['Site', location.hostname, false]] })));\n      try { localStorage.removeItem('pjc_last'); } catch (e) {}\n      beep(); setStatus(L('\\u2705 \\u6ce8\\u6587\\u5b8c\\u4e86', '\\u2705 \\u0110\\u1eb7t h\\u00e0ng th\\u00e0nh c\\u00f4ng'));\n      // \\u0111\\u00e3 b\\u00e1o Discord \\u1edf \\u0111\\u00e2y -> \\u0111\\u00e1nh d\\u1ea5u \\u0111\\u1ec3 trang c\\u1ea3m \\u01a1n kh\\u00f4ng b\\u00e1o l\\u1ea7n 2\n      if (k.url) { try { localStorage.setItem('synova_sent_' + new URL(k.url, location.origin).pathname, '1'); } catch (e) {} location.href = k.url; }\n      return;\n    }\n    if (k.tt === '3ds') { log(L('\\ud83d\\udd10 3D\\u30bb\\u30ad\\u30e5\\u30a2 \\u2192 \\u753b\\u9762\\u3067\\u8a8d\\u8a3c\\u3057\\u3066\\u304f\\u3060\\u3055\\u3044', '\\ud83d\\udd10 Th\\u1ebb c\\u1ea7n 3D Secure \\u2192 x\\u00e1c th\\u1ef1c tr\\u00ean m\\u00e0n h\\u00ecnh')); location.href = k.url; return; }\n    if (k.tt === 'fail') { log(L('\\u274c \\u30ab\\u30fc\\u30c9\\u6c7a\\u6e08\\u5931\\u6557: ', '\\u274c Thanh to\\u00e1n b\\u1ecb t\\u1eeb ch\\u1ed1i: ') + k.loi); location.href = k.checkout; return; }\n    log(L('\\u6ce8\\u6587\\u9001\\u4fe1\\u6e08\\u307f\\u30fb\\u7d50\\u679c\\u4e0d\\u660e \\u2192 \\u753b\\u9762\\u3067\\u78ba\\u8a8d\\u3057\\u3066\\u304f\\u3060\\u3055\\u3044\\uff08\\u518d\\u9001\\u3057\\u307e\\u305b\\u3093\\uff09', '\\u0110\\u00e3 g\\u1eedi \\u0111\\u1eb7t h\\u00e0ng nh\\u01b0ng ch\\u01b0a c\\u00f3 k\\u1ebft qu\\u1ea3 \\u2192 m\\u1edf trang \\u0111\\u1ec3 xem (BOT kh\\u00f4ng g\\u1eedi l\\u1ea1i)') + (k.loi ? ': ' + k.loi : ''));\n    location.href = k.checkout;\n  }\n\n  // M\\u1edf s\\u1eb5n k\\u1ebft n\\u1ed1i t\\u1edbi m\\u00e1y ch\\u1ee7 \\u1ea3nh/checkout c\\u1ee7a Shopify \\u0111\\u1ec3 trang thanh to\\u00e1n t\\u1ea3i nhanh h\\u01a1n\n  function warmUp() {\n    for (const h of ['https://cdn.shopify.com', IS_US ? 'https://shop.app' : null].filter(Boolean)) {\n      if (document.querySelector(`link[rel=preconnect][href=\"${h}\"]`)) continue;\n      const l = document.createElement('link'); l.rel = 'preconnect'; l.href = h; l.crossOrigin = ''; document.head.appendChild(l);\n    }\n  }\n\n  let adding = false, inflight = 0, backoffUntil = 0, slowMode = false, hits429 = 0, denseMs = DENSE_MS, logged429 = false;\n  // Mellojoy JP (user ch\\u1ecdn 3/11, h\\u1ecdc BOT \\u0111\\u1ed1i th\\u1ee7): m\\u00f3n \\u0110\\u00c3 l\\u00ean products.json + c\\u00f2n h\\u00e0ng -> m\\u1edf th\\u1eb3ng link /cart/<vid>:<qty>,...\n  // = th\\u00eam gi\\u1ecf + sang thanh to\\u00e1n trong 1 l\\u01b0\\u1ee3t (b\\u1edbt 1 l\\u01b0\\u1ee3t ch\\u1edd m\\u00e1y ch\\u1ee7 l\\u00fac 12:00). M\\u00f3n th\\u00eam m\\u00f9 (variant ID ch\\u01b0a l\\u00ean web) v\\u1eabn qua\n  // /cart/add.js: m\\u00f3n ch\\u01b0a l\\u00ean / b\\u1ecb g\\u1ee1 m\\u00e0 m\\u1edf link th\\u00ec Shopify ra trang l\\u1ed7i \\u300c\\u30ea\\u30f3\\u30af\\u306f\\u3082\\u3046\\u5b58\\u5728\\u3057\\u3066\\u304a\\u308a\\u307e\\u305b\\u3093\\u300d.\n  // Link b\\u1ecb t\\u1eeb ch\\u1ed1i (v\\u1eeba h\\u1ebft / v\\u01b0\\u1ee3t s\\u1ed1 l\\u01b0\\u1ee3ng m\\u1ed7i \\u0111\\u01a1n) -> trang l\\u1ed7i \\u0111\\u00f3 t\\u1ef1 quay l\\u1ea1i, 10 ph\\u00fat d\\u00f9ng l\\u1ea1i c\\u00e1ch th\\u00eam gi\\u1ecf c\\u0169.\n  const K_PERMA = 'pjc_perma_v1', K_PERMA_OFF = 'pjc_perma_off_v1';\n  const permaOn = () => !IS_US && Date.now() - (load(K_PERMA_OFF, 0) || 0) > 10 * 60e3;\n\n  // x\\u1eed l\\u00fd 1 k\\u1ebft qu\\u1ea3 d\\u00f2: c\\u00f3 h\\u00e0ng -> th\\u00eam gi\\u1ecf -> sang thanh to\\u00e1n (ch\\u1ec9 1 l\\u01b0\\u1ee3t \\u0111\\u01b0\\u1ee3c l\\u00e0m vi\\u1ec7c n\\u00e0y)\n  async function handle(products) {\n    if (adding || !st.active) return;\n    let { out, missing, wanted, capped } = plan(products);\n    lastFound = `${wanted.length - missing.length}/${wanted.length}`;                       // c\\u00f2n h\\u00e0ng\n    lastShelf = `${wanted.length - missing.filter((m) => !m.seen).length}/${wanted.length}`;  // c\\u00f3 tr\\u00ean trang (k\\u1ec3 c\\u1ea3 Sold out)\n    if (!out.length) out = directList(missing);\n    if (!out.length) { setStatus(L(`\\u8a72\\u5f53\\u306a\\u3057\\uff08\\u63b2\\u8f09${lastShelf}\\u30fb\\u5728\\u5eab${lastFound}\\uff09`, `Ch\\u01b0a c\\u00f3 h\\u00e0ng (l\\u00ean k\\u1ec7 ${lastShelf} \\u00b7 c\\u00f2n h\\u00e0ng ${lastFound})`)); return; }\n    adding = true;\n    const scan = lastScan, tAdd = performance.now();\n    if (permaOn() && out.every((x) => !x.direct)) {\n      st.active = false; save(K_ST, st);\n      saveForWebhook(out);\n      save('pjc_autopay', null);                 // JP: b\\u1ea1n t\\u1ef1 b\\u1ea5m \\u4eca\\u3059\\u3050\\u652f\\u6255\\u3046\n      const purl = '/cart/' + out.map((x) => `${x.id}:${x.qty}`).join(',');\n      save(K_PERMA, { at: Date.now(), page: location.pathname + location.search, now: !!st.now, url: purl, n: 0 });\n      save(K_COAT, { at: Date.now(), n: 0, url: purl });\n      location.href = purl;   // chuy\\u1ec3n trang NGAY\n      const sentAt = new Date(scan.sent + 9 * 3600e3).toISOString().slice(11, 23);\n      log(L(`\\u5728\\u5eab\\u691c\\u51fa: ${sentAt} \\u306b\\u9001\\u3063\\u305f\\u30b9\\u30ad\\u30e3\\u30f3\\uff08\\u30b5\\u30fc\\u30d0\\u30fc\\u5fdc\\u7b54 ${scan.ms}ms\\uff09\\u2192 \\u76f4\\u884c\\u30ea\\u30f3\\u30af\\u3067\\u8cfc\\u5165\\u753b\\u9762\\u3078\\uff08\\u300c\\u4eca\\u3059\\u3050\\u652f\\u6255\\u3046\\u300d\\u306f\\u81ea\\u5206\\u3067\\u30bf\\u30c3\\u30d7\\uff09`,\n            `Th\\u1ea5y h\\u00e0ng \\u1edf l\\u01b0\\u1ee3t qu\\u00e9t g\\u1eedi l\\u00fac ${sentAt} (m\\u00e1y ch\\u1ee7 tr\\u1ea3 sau ${scan.ms}ms) \\u2192 m\\u1edf link th\\u1eb3ng v\\u00e0o thanh to\\u00e1n (b\\u1ea1n t\\u1ef1 b\\u1ea5m \\u4eca\\u3059\\u3050\\u652f\\u6255\\u3046)`));\n      log(L('\\u76f4\\u884c: ', 'Link th\\u1eb3ng: ') + out.map((x) => `${x.title.slice(0, 18)}\\u00d7${x.qty}`).join(', '));\n      if (capped.length) log(L(`\\u5728\\u5eab\\u3042\\u308a\\u304c${MAX_PICK}\\u30b3\\u30fc\\u30c9\\u8d85\\u3048 \\u2192 \\u30e9\\u30f3\\u30c0\\u30e0\\u306b${MAX_PICK}\\u500b\\u9078\\u629e\\u3001\\u9664\\u5916: `, `C\\u00f3 h\\u01a1n ${MAX_PICK} m\\u00e3 c\\u00f2n h\\u00e0ng \\u2192 ch\\u1ecdn ng\\u1eabu nhi\\u00ean ${MAX_PICK}, b\\u1ecf: `) + capped.map((x) => x.title.slice(0, 18)).join(', '));\n      beep();\n      return;\n    }\n    let n = 0;\n    try {\n      const r = await addAll(out);\n      n = out.length;\n      if (r.ok) out.forEach((x) => fillFromCart(x, r.items));\n      else {\n        // shop b\\u00e1o \\u0111\\u00e3 cho v\\u00e0o gi\\u1ecf \\u00edt h\\u01a1n s\\u1ed1 xin / \\u0111\\u00e3 t\\u1ed1i \\u0111a -> \\u0111\\u1ecdc gi\\u1ecf NGAY, kh\\u1ecfi th\\u1eed l\\u1ea1i 3 -> 2 -> 1 c\\u00e1i\n        if (/only \\d+ items? (was|were) added|already in your cart/i.test(r.msg)) await rescueFromCart(out);\n        const rest = out.filter((x) => !x.inCart);\n        if (rest.length) {\n          await addEach(rest, out.length === 1 ? r : null);\n          // \\u0111\\u1ecdc gi\\u1ecf l\\u1ea7n n\\u1eefa ch\\u1ec9 khi c\\u00f2n m\\u00f3n h\\u1ecfng m\\u00e0 KH\\u00d4NG ph\\u1ea3i do h\\u1ebft h\\u00e0ng (shop c\\u00f3 th\\u1ec3 \\u0111\\u00e3 cho v\\u00e0o 1 ph\\u1ea7n)\n          if (rest.some((x) => !x.qty && !SOLD_MSG.test(x.err || ''))) await rescueFromCart(rest);\n        }\n        for (const x of out) if (!x.qty && x.err && !x.direct) log(L('\\u8ffd\\u52a0\\u5931\\u6557: ', 'Th\\u00eam th\\u1ea5t b\\u1ea1i: ') + `${x.title.slice(0, 22)} (${x.err})`);\n        out = out.filter((x) => x.qty > 0);\n        n = out.length;\n      }\n    } catch (e) {\n      n = 0;\n      log(L('\\u30ab\\u30fc\\u30c8\\u8ffd\\u52a0\\u30a8\\u30e9\\u30fc: ', 'L\\u1ed7i th\\u00eam gi\\u1ecf: ') + e.message);\n    }\n    if (n > 0) {\n      st.active = false; save(K_ST, st);\n      saveForWebhook(out);\n      // T\\u1ef1 b\\u1ea5m thanh to\\u00e1n:\n      //   \\u00b7 \\u0110\\u00c3 \\u0110\\u0102NG NH\\u1eacP shop -> m\\u1edf checkout, shop c\\u00f3 s\\u1eb5n \\u0111\\u1ecba ch\\u1ec9 / th\\u1ebb (ho\\u1eb7c chuy\\u1ec3n sang Shop Pay) -> BOT b\\u1ea5m \\u4eca\\u3059\\u3050\\u652f\\u6255\\u3046\n      //   \\u00b7 CH\\u01afA \\u0111\\u0103ng nh\\u1eadp + khung \\u0111\\u00e3 nh\\u1eadp \\u0111\\u1ee7 \\u0111\\u1ecba ch\\u1ec9 + th\\u1ebb -> tr\\u1ea3 b\\u1eb1ng REQUEST ngay t\\u1ea1i trang n\\u00e0y (mua ki\\u1ec3u kh\\u00e1ch)\n      //   \\u00b7 CH\\u01afA \\u0111\\u0103ng nh\\u1eadp + khung ch\\u01b0a \\u0111\\u1ee7 -> m\\u1edf checkout; Shop Pay nh\\u1eadn ra m\\u00e1y (\\u0111\\u00e3 \\u0111\\u0103ng nh\\u1eadp Shop Pay) th\\u00ec BOT b\\u1ea5m \\u4eca\\u3059\\u3050\\u652f\\u6255\\u3046\n      const b0 = buy(), viaRq = IS_US && !loggedIn() && hasCard(b0) && hasAddr(b0) && !rqBlocked();   // JP: lu\\u00f4n m\\u1edf trang thanh to\\u00e1n (\\u0111\\u00e3 login)\n      // Mellojoy JP: user t\\u1ef1 b\\u1ea5m \\u4eca\\u3059\\u3050\\u652f\\u6255\\u3046 (y\\u00eau c\\u1ea7u 2/11) -> ch\\u1ec9 m\\u1edf trang thanh to\\u00e1n, KH\\u00d4NG \\u0111\\u00e1nh d\\u1ea5u t\\u1ef1 b\\u1ea5m\n      save('pjc_autopay', IS_US && !viaRq ? { at: Date.now() } : null);\n      log(!IS_US ? L('\\u30ab\\u30fc\\u30c8\\u306b\\u8ffd\\u52a0 \\u2192 \\u8cfc\\u5165\\u753b\\u9762\\u3092\\u958b\\u304d\\u307e\\u3059\\uff08\\u300c\\u4eca\\u3059\\u3050\\u652f\\u6255\\u3046\\u300d\\u306f\\u81ea\\u5206\\u3067\\u30bf\\u30c3\\u30d7\\uff09', '\\u0110\\u00e3 v\\u00e0o gi\\u1ecf \\u2192 m\\u1edf trang thanh to\\u00e1n (b\\u1ea1n t\\u1ef1 b\\u1ea5m \\u4eca\\u3059\\u3050\\u652f\\u6255\\u3046)')\n        : viaRq ? L('\\u672a\\u30ed\\u30b0\\u30a4\\u30f3 \\u2192 \\u5165\\u529b\\u3057\\u305f\\u914d\\u9001\\u5148\\u30fb\\u30ab\\u30fc\\u30c9\\u3067\\u30ea\\u30af\\u30a8\\u30b9\\u30c8\\u8cfc\\u5165', 'Ch\\u01b0a login shop \\u2192 tr\\u1ea3 b\\u1eb1ng request v\\u1edbi \\u0111\\u1ecba ch\\u1ec9 + th\\u1ebb trong khung')\n        : loggedIn() ? L('\\u30ed\\u30b0\\u30a4\\u30f3\\u6e08\\u307f \\u2192 \\u4fdd\\u5b58\\u6e08\\u307f\\u306e\\u60c5\\u5831\\u3067\\u8cfc\\u5165\\u753b\\u9762\\u306e\\u652f\\u6255\\u3044\\u30dc\\u30bf\\u30f3\\u3092\\u62bc\\u3057\\u307e\\u3059', '\\u0110\\u00e3 login shop \\u2192 m\\u1edf thanh to\\u00e1n, b\\u1ea5m \\u4eca\\u3059\\u3050\\u652f\\u6255\\u3046 b\\u1eb1ng th\\u00f4ng tin \\u0111\\u00e3 l\\u01b0u')\n        : L('\\u672a\\u30ed\\u30b0\\u30a4\\u30f3\\u30fb\\u5165\\u529b\\u4e0d\\u8db3 \\u2192 \\u8cfc\\u5165\\u753b\\u9762\\u3078\\uff08Shop Pay \\u30ed\\u30b0\\u30a4\\u30f3\\u6e08\\u307f\\u306a\\u3089\\u81ea\\u52d5\\u3067\\u652f\\u6255\\u3044\\uff09', 'Ch\\u01b0a login, khung ch\\u01b0a \\u0111\\u1ee7 \\u2192 m\\u1edf thanh to\\u00e1n (\\u0111\\u00e3 login Shop Pay th\\u00ec BOT t\\u1ef1 b\\u1ea5m)'));\n      if (!IS_US) { save(K_PERMA, null); save(K_COAT, { at: Date.now(), n: 0 }); }   // 19/11: trang thanh to\\u00e1n ra 429 -> BOT t\\u1ef1 m\\u1edf l\\u1ea1i (tr\\u01b0\\u1edbc ch\\u1ec9 ch\\u1ebf \\u0111\\u1ed9 Request m\\u1edbi c\\u00f3)\n      if (viaRq) rqPay(); else location.href = '/checkout' + (IS_US ? '#synova-pay-' + Date.now() : '');   // chuy\\u1ec3n trang NGAY\n      const addMs = Math.round(performance.now() - tAdd);\n      const sentAt = new Date(scan.sent + 9 * 3600e3).toISOString().slice(11, 23);\n      log(L(`\\u5728\\u5eab\\u691c\\u51fa: ${sentAt} \\u306b\\u9001\\u3063\\u305f\\u30b9\\u30ad\\u30e3\\u30f3\\uff08\\u30b5\\u30fc\\u30d0\\u30fc\\u5fdc\\u7b54 ${scan.ms}ms\\uff09\\u2192 \\u30ab\\u30fc\\u30c8\\u8ffd\\u52a0 ${addMs}ms`,\n            `Th\\u1ea5y h\\u00e0ng \\u1edf l\\u01b0\\u1ee3t qu\\u00e9t g\\u1eedi l\\u00fac ${sentAt} (m\\u00e1y ch\\u1ee7 tr\\u1ea3 sau ${scan.ms}ms) \\u2192 v\\u00e0o gi\\u1ecf m\\u1ea5t ${addMs}ms`));\n      log(L('\\u5728\\u5eab\\u3042\\u308a \\u2192 \\u30ab\\u30fc\\u30c8\\u306b\\u8ffd\\u52a0 \\u2192 \\u8cfc\\u5165\\u753b\\u9762\\u3078: ', 'C\\u00f3 h\\u00e0ng \\u2192 \\u0111\\u00e3 v\\u00e0o gi\\u1ecf \\u2192 sang thanh to\\u00e1n: ') + out.map((x) => `${x.title.slice(0, 18)}\\u00d7${x.qty}`).join(', '));\n      if (capped.length) log(L(`\\u5728\\u5eab\\u3042\\u308a\\u304c${MAX_PICK}\\u30b3\\u30fc\\u30c9\\u8d85\\u3048 \\u2192 \\u30e9\\u30f3\\u30c0\\u30e0\\u306b${MAX_PICK}\\u500b\\u9078\\u629e\\u3001\\u9664\\u5916: `, `C\\u00f3 h\\u01a1n ${MAX_PICK} m\\u00e3 c\\u00f2n h\\u00e0ng \\u2192 ch\\u1ecdn ng\\u1eabu nhi\\u00ean ${MAX_PICK}, b\\u1ecf: `) + capped.map((x) => x.title.slice(0, 18)).join(', '));\n      const skipped = missing.filter((m) => !out.some((x) => x.direct && x.kw === m.it.kw));\n      if (skipped.length) log(L('\\u30b9\\u30ad\\u30c3\\u30d7\\uff08\\u672a\\u63b2\\u8f09\\u30fb\\u58f2\\u308a\\u5207\\u308c\\uff09: ', 'B\\u1ecf qua (ch\\u01b0a l\\u00ean k\\u1ec7 / h\\u1ebft h\\u00e0ng): ') + skipped.map((m) => m.it.kw).join(', '));\n      beep();\n      return;\n    }\n    adding = false;                            // kh\\u00f4ng th\\u00eam \\u0111\\u01b0\\u1ee3c m\\u00f3n n\\u00e0o -> qu\\u00e9t ti\\u1ebfp\n    setStatus(L('\\u30ab\\u30fc\\u30c8\\u8ffd\\u52a0\\u3067\\u304d\\u305a \\u2192 \\u76e3\\u8996\\u3092\\u7d9a\\u3051\\u307e\\u3059', 'Kh\\u00f4ng th\\u00eam \\u0111\\u01b0\\u1ee3c v\\u00e0o gi\\u1ecf \\u2192 qu\\u00e9t ti\\u1ebfp'));\n  }\n\n  // ===== Th\\u00eam gi\\u1ecf th\\u1eb3ng ngay sau gi\\u1edd m\\u1edf (Mellojoy JP, n\\u00fat \\u300cTh\\u00eam gi\\u1ecf th\\u1eb3ng\\u300d b\\u1eadt) =====\n  // 12:00:07 \\u2192 12:00:20: c\\u1ee9 DENSE_MS g\\u1eedi /cart/add.js cho 1 m\\u00e3 (l\\u1ea7n l\\u01b0\\u1ee3t KW1, KW2\\u2026; t\\u1ed1i \\u0111a PRE_INFLIGHT l\\u01b0\\u1ee3t ch\\u1ed3ng nhau)\n  // = gi\\u1eef ~3 request/gi\\u00e2y nh\\u01b0 qu\\u00e9t th\\u01b0\\u1eddng (0,1s \\u0111\\u00e3 l\\u00e0m Shopify ch\\u1eb7n IP 24/10). V\\u00e0o \\u0111\\u01b0\\u1ee3c m\\u00f3n \\u0111\\u1ea7u -> g\\u1eedi th\\u00eam 1 v\\u00f2ng cho c\\u00e1c m\\u00e3 c\\u00f2n l\\u1ea1i\n  // -> m\\u1edf thanh to\\u00e1n. T\\u1edbi 12:00:20 ch\\u01b0a v\\u00e0o m\\u00f3n n\\u00e0o -> quay l\\u1ea1i \\u0111\\u1ecdc danh s\\u00e1ch nh\\u01b0 c\\u0169. M\\u00e3 ch\\u01b0a t\\u1eebng th\\u1ea5y tr\\u00ean danh s\\u00e1ch th\\u00ec b\\u1ecf qua.\n  const PRE_FROM_MS = 7000, PRE_FOR_MS = 20000, PRE_INFLIGHT = 3;   // 18/11 user: ch\\u1ebf \\u0111\\u1ed9 Request th\\u00eam gi\\u1ecf th\\u1eb3ng 12:00:07 \\u2192 12:00:20 (17/11: 05 \\u2192 20)\n  let preIdx = 0, preIn = 0, preShown = false, preEnded = false, prefetched = false;\n  const PRE_SCAN_MS = 1000;\n  let preScanAt = 0;\n  const preGot = [];\n  // 18/11 user: th\\u00eam gi\\u1ecf th\\u1eb3ng kh\\u00f4ng hi\\u1ec7u qu\\u1ea3 (2 h\\u00f4m li\\u1ec1n b\\u1ecb 429), b\\u1ea3n qu\\u00e9t danh s\\u00e1ch c\\u0169 t\\u1ed1t h\\u01a1n -> M\\u1eb6C \\u0110\\u1ecaNH T\\u1eaeT cho m\\u1ecdi ng\\u01b0\\u1eddi\n  // (k\\u1ec3 c\\u1ea3 ai \\u0111ang \\u0111\\u1ec3 m\\u1eb7c \\u0111\\u1ecbnh c\\u0169 ''); ai mu\\u1ed1n th\\u1eed th\\u00ec t\\u1ef1 ch\\u1ecdn 'on' trong b\\u1ea3ng.\n  const preOn = () => !IS_US && !st.now && cfg.pre === 'on';\n  const altRot = {};\n  function preList() {\n    const out = [];\n    cfg.items.slice(0, cfg.kwCount).forEach((it, idx) => {\n      if (!it.kw.trim()) return;\n      const vids = vidsOf(it.kw);\n      if (vids.length) { const id = pickOne(vids); out.push({ id: Number(id), qty: it.qty, title: id, name: id, handle: '', size: '-', price: 0, image: '', direct: true, kw: it.kw, label: `KW${idx + 1}` }); return; }\n      if (!isCodeKw(it.kw)) {                    // T\\u00caN: ch\\u1ec9 m\\u00f3n th\\u1ea5y tr\\u00ean danh s\\u00e1ch sau gi\\u1edd m\\u1edf (xem isCodeKw)\n        // 14/11 user: t\\u00ean ch\\u1ec9 kh\\u1edbp \\u0110\\u00daNG 1 m\\u00f3n / 1 lo\\u1ea1i trong b\\u1ea3ng \\u0111\\u00f3ng s\\u1eb5n (VD \\u30c1\\u30e7\\u30b3\\u30ec\\u30b3\\u30fc\\u30c9 = Z089) -> ch\\u1ea1y nh\\u01b0 m\\u00e3, g\\u1eedi t\\u1eeb 12:00:02.\n        // V\\u1eabn \\u0111\\u1ecdc danh s\\u00e1ch song song (avail:false): shop ra m\\u00f3n m\\u1edbi c\\u00f9ng t\\u00ean -> m\\u00f3n th\\u1ea5y tr\\u00ean danh s\\u00e1ch (c\\u00f2n h\\u00e0ng) \\u0111\\u01b0\\u1ee3c \\u01b0u ti\\u00ean.\n        const l = live[norm(it.kw).trim()], one = seedOne(it.kw);\n        const m = (l && l.avail) ? l : one ? { ...one, qty: Math.min(it.qty, perPerson(one.title) || it.qty), name: one.title, avail: false } : l;\n        if (m) out.push({ ...m, direct: true, kw: it.kw, label: `KW${idx + 1}` });\n        return;\n      }\n      const sd = seedFor(it.kw), vm = vmap[norm(it.kw).trim()];\n      // m\\u00e3 BOT t\\u1ef1 h\\u1ecdc (\\u0111\\u00e3 th\\u1ea5y tr\\u00ean trang) \\u01b0u ti\\u00ean; b\\u1ea3ng \\u0111\\u00f3ng s\\u1eb5n b\\u1ed5 sung c\\u00e1c lo\\u1ea1i kh\\u00e1c \\u0111\\u1ec3 th\\u1eed khi shop \\u0111\\u00e3 m\\u1edf\n      let m = vm ? { ...vm, alts: sd && sd.alts } : sd;\n      // nhi\\u1ec1u lo\\u1ea1i: m\\u1ed7i l\\u01b0\\u1ee3t XOAY V\\u00d2NG l\\u1ea7n l\\u01b0\\u1ee3t qua c\\u00e1c lo\\u1ea1i (tr\\u01b0\\u1edbc: ch\\u1ecdn ng\\u1eabu nhi\\u00ean -> c\\u00f3 th\\u1ec3 l\\u1eb7p lo\\u1ea1i c\\u0169, b\\u1ecf s\\u00f3t lo\\u1ea1i c\\u00f3 h\\u00e0ng)\n      if (m && m.alts && !vm) { const a = m.alts[(altRot[it.kw] = (altRot[it.kw] || 0) + 1) % m.alts.length]; m = { ...m, id: a.id, title: a.e.t, handle: a.e.h, price: a.e.pr }; }\n      if (m) out.push({ id: m.id, qty: Math.min(it.qty, perPerson(m.title) || it.qty), title: m.title, name: m.title, handle: m.handle, size: m.size, price: m.price, image: m.image, direct: true, kw: it.kw, label: `KW${idx + 1}`, alts: m.alts || null });\n    });\n    return out;\n  }\n  // 1 request th\\u00eam gi\\u1ecf, kh\\u00f4ng t\\u1ef1 th\\u1eed l\\u1ea1i (v\\u00f2ng preTick t\\u1ef1 g\\u1eedi l\\u01b0\\u1ee3t sau)\n  // 16/11 (nhi\\u1ec1u kh\\u00e1ch b\\u1ecb 429 k\\u00e9o d\\u00e0i v\\u00e0i ph\\u00fat): m\\u1ecdi /cart/add.js c\\u1ee7a khung th\\u00eam gi\\u1ecf th\\u1eb3ng c\\u00e1ch nhau \\u00edt nh\\u1ea5t ADD_GAP\n  // (~3 request/gi\\u00e2y, nh\\u01b0 qu\\u00e9t danh s\\u00e1ch b\\u1ea3n c\\u0169) \\u2014 tr\\u01b0\\u1edbc \\u0111\\u00e2y l\\u01b0\\u1ee3t th\\u01b0\\u1eddng + c\\u1ea3 l\\u00f4 + nhi\\u1ec1u lo\\u1ea1i ch\\u1ed3ng nhau c\\u00f3 l\\u00fac 10+ request/gi\\u00e2y\n  // 17/11: ch\\u01b0a th\\u1ea5y shop m\\u1edf -> PROBE_GAP (1 l\\u1ea7n/gi\\u00e2y); v\\u1eeba b\\u1ecb 429 -> RECOVER_GAP + t\\u1eebng request m\\u1ed9t (xem jp429)\n  const ADD_GAP = 330;\n  let lastAddAt = 0;\n  // 17/11: kho\\u1ea3ng c\\u00e1ch t\\u00ednh L\\u1ea0I m\\u1ed7i l\\u1ea7n ch\\u1edd -> shop v\\u1eeba m\\u1edf (shopOpen) th\\u00ec c\\u00e1c l\\u01b0\\u1ee3t \\u0111ang x\\u1ebfp h\\u00e0ng \\u0111i ngay theo nh\\u1ecbp nhanh,\n  // kh\\u00f4ng ph\\u1ea3i ch\\u1edd h\\u1ebft nh\\u1ecbp d\\u00f2 1 gi\\u00e2y \\u0111\\u00e3 h\\u1eb9n tr\\u01b0\\u1edbc (tr\\u01b0\\u1edbc \\u0111\\u00e2y 3 lo\\u1ea1i c\\u1ee7a Z072 x\\u1ebfp 1s/l\\u01b0\\u1ee3t -> m\\u1edf thanh to\\u00e1n tr\\u1ec5 th\\u00eam ~2s)\n  let gathering = false;                         // \\u0111ang gom m\\u00f3n c\\u00f2n l\\u1ea1i (shop \\u0111\\u00e3 m\\u1edf, ch\\u1ec9 ~1,5 gi\\u00e2y) -> 0,25s/l\\u1ea7n\n  const addGap = () => (IS_US ? ADD_GAP : recover ? RECOVER_GAP : gathering ? 250 : shopOpen ? ADD_GAP : PROBE_GAP);\n  async function addOne(x) {\n    for (;;) {\n      const w = lastAddAt + addGap() - Date.now();\n      if (w <= 0) break;\n      await sleep(Math.min(w, 50));\n    }\n    lastAddAt = Date.now(); reqNote('add');\n    const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 4000);\n    stats.req++;\n    try {\n      const r = await fetch('/cart/add.js', {\n        method: 'POST', credentials: 'same-origin', signal: ac.signal,\n        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },\n        body: JSON.stringify({ items: (Array.isArray(x) ? x : [x]).map((y) => ({ id: y.id, quantity: y.qty })) }),\n      });\n      const j = await r.json().catch(() => ({}));\n      if (r.status === 429) { stats.r429++; last429At = Date.now(); return { ok: false, s429: true, retryAfter: parseFloat(r.headers.get('Retry-After')) || 0, msg: '429' }; }\n      stats.ok++; lastOkAt = Date.now();\n      if (!IS_US) jpOk();\n      const msg = `${r.status} ${j.description || j.message || ''}`;\n      if (r.ok || !NOTFOUND_MSG.test(msg)) shopOpen = true;   // v\\u00e0o gi\\u1ecf / h\\u1ebft h\\u00e0ng / qu\\u00e1 s\\u1ed1 l\\u01b0\\u1ee3ng = m\\u00f3n \\u0111\\u00e3 m\\u1edf b\\u00e1n\n      if (r.ok) return { ok: true, items: j.items || (j.id ? [j] : []) };\n      return { ok: false, msg };\n    } catch (e) {\n      stats.err++; lastErrAt = Date.now();\n      return { ok: false, msg: e.name === 'AbortError' ? L('\\u5fdc\\u7b54\\u306a\\u3057(4\\u79d2)', 'kh\\u00f4ng ph\\u1ea3n h\\u1ed3i (4 gi\\u00e2y)') : e.message };\n    } finally { clearTimeout(tm); }\n  }\n  // 1 m\\u00e3 \\u0111\\u00e3 nh\\u1eadn: v\\u01b0\\u1ee3t s\\u1ed1 l\\u01b0\\u1ee3ng -> th\\u1eed s\\u1ed1 nh\\u1ecf h\\u01a1n / \\u0111\\u00e3 c\\u00f3 trong gi\\u1ecf -> \\u0111\\u1ecdc gi\\u1ecf (d\\u00f9ng l\\u1ea1i addEach / rescueFromCart)\n  async function preSettle(x, r) {\n    if (r.ok) { fillFromCart(x, r.items); return true; }\n    if (r.s429 || !r.msg || SOLD_MSG.test(r.msg) || NOTFOUND_MSG.test(r.msg)) return false;\n    if (/only \\d+ items? (was|were) added|already in your cart/i.test(r.msg)) return (await rescueFromCart([x])) > 0;\n    const y = { ...x, direct: false };\n    const n = await addEach([y], r);\n    if (n) { x.qty = y.qty; fillFromCart(x, []); return true; }\n    return (await rescueFromCart([x])) > 0;\n  }\n  // 14/11 user: g\\u1eedi t\\u1eebng m\\u00e3 xoay v\\u00f2ng -> 7 m\\u00e3 th\\u00ec m\\u1ed7i m\\u00e3 ~2 gi\\u00e2y m\\u1edbi \\u0111\\u01b0\\u1ee3c th\\u1eed 1 l\\u1ea7n (qu\\u00e1 ch\\u1eadm). Gi\\u1edd xen k\\u1ebd:\n  // l\\u01b0\\u1ee3t ch\\u1eb5n = C\\u1ea2 L\\u00d4 (t\\u1ed1i \\u0111a MAX_PICK m\\u00e3 ch\\u01b0a v\\u00e0o gi\\u1ecf) trong 1 request -> c\\u1ea3 \\u0111\\u1ee3t l\\u00ean k\\u1ec7 c\\u00f9ng l\\u00fac th\\u00ec v\\u00e0o h\\u1ebft ngay l\\u01b0\\u1ee3t \\u0111\\u1ea7u;\n  // l\\u01b0\\u1ee3t l\\u1ebb = 1 m\\u00e3 xoay v\\u00f2ng nh\\u01b0 c\\u0169 (shop t\\u1eeb ch\\u1ed1i c\\u1ea3 l\\u00f4 khi 1 m\\u00e3 ch\\u01b0a m\\u1edf / qu\\u00e1 s\\u1ed1 l\\u01b0\\u1ee3ng). S\\u1ed1 request/gi\\u00e2y gi\\u1eef nguy\\u00ean.\n  // M\\u00e3 \\u0111ang ch\\u1edd shop tr\\u1ea3 l\\u1eddi KH\\u00d4NG g\\u1eedi l\\u1ea1i: shop ch\\u1eadm (1,4s) th\\u00ec l\\u01b0\\u1ee3t ch\\u1ed3ng nhau \\u0111\\u1ec1u \\u0111\\u01b0\\u1ee3c nh\\u1eadn -> gi\\u1ecf \\u00d72 s\\u1ed1 l\\u01b0\\u1ee3ng (th\\u1eed 14/11)\n  let preN = 0;\n  const preBusy = new Set();\n  const ALT_PAR = 3;                             // m\\u00e3 nhi\\u1ec1u lo\\u1ea1i: th\\u1eed t\\u1ed1i \\u0111a 3 lo\\u1ea1i c\\u00f9ng l\\u00fac (16/11: 5 l\\u00e0m d\\u1ed3n request, d\\u1ec5 429)\n  // t\\u1eeb kh\\u00f3a T\\u00caN ch\\u01b0a v\\u00e0o gi\\u1ecf v\\u00e0 ch\\u01b0a c\\u00f3 trong v\\u00f2ng g\\u1eedi th\\u00eam (ch\\u01b0a th\\u1ea5y tr\\u00ean danh s\\u00e1ch)\n  const namesLeft = (rest) => cfg.items.slice(0, cfg.kwCount).map((it, idx) => ({ it, idx }))\n    .filter(({ it }) => it.kw.trim() && !vidsOf(it.kw).length && !isCodeKw(it.kw) && !preGot.some((g) => g.kw === it.kw) && !rest.some((o) => o.kw === it.kw));\n  // th\\u1eed nhi\\u1ec1u lo\\u1ea1i (variant) c\\u1ee7a 1 m\\u00e3 C\\u00d9NG L\\u00daC; l\\u1ee1 v\\u00e0o >1 lo\\u1ea1i th\\u00ec gi\\u1eef lo\\u1ea1i \\u0111\\u1ea7u, b\\u1ecf lo\\u1ea1i th\\u1eeba kh\\u1ecfi gi\\u1ecf (1 t\\u1eeb kh\\u00f3a = 1 lo\\u1ea1i)\n  async function addAlts(o, ids) {\n    const ys = ids.map((id) => {\n      const a = o.alts && o.alts.find((q) => q.id === id);\n      return { ...o, id, ...(a ? { title: a.e.t, name: a.e.t, handle: a.e.h, price: a.e.pr } : {}) };\n    });\n    const rs = await Promise.all(ys.map((y) => addOne(y)));\n    const ok = [];\n    for (let j = 0; j < ys.length; j++) if (await preSettle(ys[j], rs[j]).catch(() => false)) ok.push(ys[j]);\n    for (const y of ok.slice(1)) {\n      try {\n        reqNote('other');\n        await fetch('/cart/change.js', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },\n          body: JSON.stringify({ id: String(y.id), quantity: 0 }) });\n        log(L(`\\u540c\\u3058\\u30b3\\u30fc\\u30c9\\u306e\\u5225\\u30bf\\u30a4\\u30d7\\u3082\\u5165\\u3063\\u305f\\u305f\\u3081\\u524a\\u9664: ${y.title.slice(0, 18)}`, `L\\u1ee1 v\\u00e0o th\\u00eam 1 lo\\u1ea1i c\\u00f9ng m\\u00e3 \\u2192 \\u0111\\u00e3 b\\u1ecf kh\\u1ecfi gi\\u1ecf: ${y.title.slice(0, 18)}`));\n      } catch (e) {}\n    }\n    return { y: ok[0] || null, s429: rs.find((r) => r.s429) || null };\n  }\n  const nextAlts = (o) => [...new Set(Array.from({ length: Math.min(ALT_PAR, o.alts.length) }, () => o.alts[(altRot[o.kw] = (altRot[o.kw] || 0) + 1) % o.alts.length].id))];\n  async function preTick(list) {\n    const todo = list.filter((o) => !preGot.some((g) => g.kw === o.kw) && !preBusy.has(o.kw));\n    if (!todo.length) return;\n    const batch = !adding && (IS_US || shopOpen) && todo.length > 1 && preN++ % 2 === 0 ? todo.slice(0, MAX_PICK).map((o) => ({ ...o })) : null;\n    let x = batch && batch[0];\n    if (!x) {                                    // xoay v\\u00f2ng KW1, KW2\\u2026 b\\u1ecf qua m\\u00e3 \\u0111\\u00e3 v\\u00e0o gi\\u1ecf / \\u0111ang ch\\u1edd\n      for (let k = 0; k < list.length && !x; k++) { const o = list[preIdx++ % list.length]; if (todo.includes(o)) x = { ...o }; }\n    }\n    const mine = (batch || [x]).map((y) => y.kw);\n    mine.forEach((k) => preBusy.add(k));\n    const free = () => mine.forEach((k) => preBusy.delete(k));\n    preIn++;\n    const sent = Date.now();\n    try {\n      // m\\u00e3 nhi\\u1ec1u lo\\u1ea1i (VD Z072 = 9 lo\\u1ea1i): m\\u1ed7i l\\u01b0\\u1ee3t th\\u1eed ALT_PAR lo\\u1ea1i c\\u00f9ng l\\u00fac, xoay v\\u00f2ng (16/11: 1 lo\\u1ea1i/l\\u01b0\\u1ee3t qu\\u00e1 ch\\u1eadm)\n      let altY = null, r;\n      if (!batch && x.alts) { const a = await addAlts(x, nextAlts(x)); altY = a.y; r = a.s429 || { ok: !!altY }; }\n      else r = await addOne(batch || x);\n      if (r.s429) { jp429(r.retryAfter); denseMs = Math.min(600, denseMs + 100); return; }\n      hits429 = 0;\n      if (denseMs > DENSE_MS) denseMs = Math.max(DENSE_MS, denseMs - 10);\n      if (!st.active) return;\n      if (batch) {                               // c\\u1ea3 l\\u00f4: ch\\u1ec9 nh\\u1eadn khi shop nh\\u1eadn h\\u1ebft (l\\u1ed7i th\\u00ec kh\\u00f4ng bi\\u1ebft m\\u00e3 n\\u00e0o -> \\u0111\\u1ec3 l\\u01b0\\u1ee3t l\\u1ebb lo)\n        if (!r.ok) return;\n        for (const y of batch) fillFromCart(y, r.items);\n        preGot.push(...batch);\n      } else {\n        if (x.alts) { if (!altY) return; x = altY; }\n        else if (!(await preSettle(x, r))) return;\n        preGot.push(x);\n      }\n      free();\n      if (adding) return;                       // l\\u01b0\\u1ee3t kh\\u00e1c \\u0111\\u00e3 th\\u1eafng -> m\\u00f3n n\\u00e0y c\\u0169ng \\u0111\\u00e3 v\\u00e0o gi\\u1ecf, l\\u01b0\\u1ee3t th\\u1eafng s\\u1ebd gom v\\u00e0o \\u0111\\u01a1n\n      adding = true;\n      const sentAt = new Date(sent + 9 * 3600e3).toISOString().slice(11, 23);\n      const got = batch || [x];\n      log(L(`\\u4e88\\u544a\\u306e\\u54c1\\u304c\\u5165\\u308a\\u307e\\u3057\\u305f: ${sentAt} \\u9001\\u4fe1 ${got.map((y) => `[${y.label}] ${y.title.slice(0, 16)}\\u00d7${y.qty}`).join(', ')} \\u2192 \\u6b8b\\u308a\\u3092\\u3082\\u30461\\u5de1`,\n            `\\u0110\\u00e3 v\\u00e0o gi\\u1ecf (g\\u1eedi l\\u00fac ${sentAt}) ${got.map((y) => `[${y.label}] ${y.title.slice(0, 16)}\\u00d7${y.qty}`).join(', ')}${batch ? ' (c\\u1ea3 l\\u00f4 1 l\\u1ea7n)' : ''} \\u2192 g\\u1eedi th\\u00eam 1 v\\u00f2ng cho m\\u00e3 c\\u00f2n l\\u1ea1i`));\n      // th\\u00eam 1 v\\u00f2ng cho c\\u00e1c m\\u00e3 c\\u00f2n l\\u1ea1i (m\\u1ed7i m\\u00e3 1 l\\u1ea7n, c\\u00f9ng l\\u00fac), t\\u1ed5ng t\\u1ed1i \\u0111a MAX_PICK m\\u00e3 / \\u0111\\u01a1n\n      // m\\u00e3 \\u0111ang c\\u00f3 l\\u01b0\\u1ee3t ch\\u1edd tr\\u1ea3 l\\u1eddi (g\\u1eedi tr\\u01b0\\u1edbc gi\\u1edd m\\u1edf -> s\\u1ebd b\\u1ecb t\\u1eeb ch\\u1ed1i): \\u0111\\u1ee3i l\\u01b0\\u1ee3t \\u0111\\u00f3 xong r\\u1ed3i m\\u1edbi g\\u1eedi, kh\\u00f4ng g\\u1eedi ch\\u1ed3ng\n      const rest = list.filter((o) => o.kw !== x.kw && !preGot.some((g) => g.kw === o.kw)).slice(0, Math.max(0, MAX_PICK - preGot.length));\n      // 14/11 log user: v\\u00f2ng n\\u00e0y ch\\u1edd T\\u1ea4T C\\u1ea2 m\\u00e3 xong -> Z072 (8 lo\\u1ea1i, th\\u1eed l\\u1ea7n l\\u01b0\\u1ee3t, shop tr\\u1ea3 l\\u1eddi ~1,4s/l\\u1ea7n) gi\\u1eef c\\u1ea3 \\u0111\\u01a1n t\\u1edbi 12:00:13\n      // (m\\u00f3n \\u0111\\u1ea7u v\\u00e0o gi\\u1ecf l\\u00fac 06.7). Gi\\u1edd c\\u00f3 H\\u1ea0N: ~1,6 l\\u01b0\\u1ee3t tr\\u1ea3 l\\u1eddi c\\u1ee7a shop + 0,5s (1,2s\\u20133s), h\\u1ebft h\\u1ea1n l\\u00e0 m\\u1edf thanh to\\u00e1n ngay.\n      // M\\u00f3n shop nh\\u1eadn mu\\u1ed9n h\\u01a1n v\\u1eabn n\\u1eb1m trong gi\\u1ecf (trang thanh to\\u00e1n \\u0111\\u1ecdc gi\\u1ecf th\\u1eadt), ch\\u1ec9 kh\\u00f4ng c\\u00f3 trong tin Discord.\n      // 17/11 user: gi\\u1ea3m th\\u1eddi gian ch\\u1edd gom m\\u00f3n -> 1\\u20131,5 gi\\u00e2y (16/11 Z002 m\\u1edf tr\\u1ec5 m\\u00f3n \\u0111\\u1ea7u ~0,5s v\\u1eabn k\\u1ecbp)\n      const rtt = Date.now() - sent, grace = Math.min(1500, Math.max(1000, rtt + 500));\n      let late = false;\n      gathering = true;\n      // 18/11 log user: m\\u00f3n \\u0111\\u1ea7u v\\u00e0o 12:00:06.4, gom m\\u00f3n 1,5s (m\\u1ed7i m\\u00e3 l\\u1eb7p l\\u1ea1i, m\\u00e3 nhi\\u1ec1u lo\\u1ea1i 3 lo\\u1ea1i/l\\u01b0\\u1ee3t) r\\u1ed3i m\\u1edf thanh to\\u00e1n -> shop ch\\u1eb7n 429.\n      // Gi\\u1edd gom m\\u00f3n g\\u1eedi \\u00cdT NH\\u1ea4T c\\u00f3 th\\u1ec3: m\\u1ed7i m\\u00e3 c\\u00f2n l\\u1ea1i \\u0110\\u00daNG 1 l\\u1ea7n (1 lo\\u1ea1i), c\\u00f9ng l\\u00fac \\u0111\\u1ecdc danh s\\u00e1ch 1 l\\u1ea7n;\n      // m\\u00e3 n\\u00e0o l\\u01b0\\u1ee3t \\u0111\\u00f3 b\\u1ecb t\\u1eeb ch\\u1ed1i m\\u00e0 danh s\\u00e1ch b\\u00e1o \\u0110\\u00c3 l\\u00ean + c\\u00f2n h\\u00e0ng (m\\u1edf tr\\u1ec5 h\\u01a1n m\\u00f3n \\u0111\\u1ea7u) -> g\\u1eedi chung 1 request cu\\u1ed1i. T\\u1ed1i \\u0111a 3 + 1 + 1 request.\n      const listP = getProducts().then((ps) => { plan(ps); return ps; }).catch((e) => { if (e.message === '429') jp429(e.retryAfter); return null; });\n      const tryOne = async (y) => {\n        const r = await addOne(y);\n        if (r.s429) { jp429(r.retryAfter); return false; }\n        return preSettle(y, r).catch(() => false);\n      };\n      await Promise.race([sleep(grace).then(() => { late = true; }), (async () => {\n        await Promise.all(rest.map(async (o) => {\n          while (preBusy.has(o.kw) && !late) await sleep(40);\n          if (late || preGot.some((g) => g.kw === o.kw)) return;\n          preBusy.add(o.kw);\n          try { const y = { ...o }; if (await tryOne(y)) preGot.push(y); } finally { preBusy.delete(o.kw); }\n        }));\n        const ps = await listP;\n        if (late || !ps || Date.now() < backoffUntil) return;\n        // c\\u00f2n ch\\u1ed7 trong \\u0111\\u01a1n: m\\u00e3 (ho\\u1eb7c t\\u1eeb kh\\u00f3a t\\u00ean) ch\\u01b0a v\\u00e0o m\\u00e0 danh s\\u00e1ch c\\u00f3 m\\u00f3n c\\u00f2n h\\u00e0ng -> 1 request chung\n        const more = [];\n        cfg.items.slice(0, cfg.kwCount).forEach((it, idx) => {\n          if (!it.kw.trim() || preGot.length + more.length >= MAX_PICK || preGot.some((g) => g.kw === it.kw) || preBusy.has(it.kw)) return;\n          const hit = ps.filter((pp) => match(pp.title, it.kw)).map((pp) => ({ pp, v: (pp.variants || []).find((v) => v.available) })).filter((h) => h.v)\n            .sort((x1, x2) => String(x2.pp.published_at || '').localeCompare(String(x1.pp.published_at || '')))[0];\n          if (hit) more.push({ ...item({ p: hit.pp, v: hit.v }, Math.min(it.qty, perPerson(hit.pp.title) || it.qty), ''), direct: true, kw: it.kw, label: `KW${idx + 1}` });\n        });\n        if (!more.length) return;\n        more.forEach((y) => preBusy.add(y.kw));\n        try {\n          const r = await addOne(more.map((y) => ({ ...y })));\n          if (r.s429) jp429(r.retryAfter);\n          else if (r.ok) { for (const y of more) fillFromCart(y, r.items); preGot.push(...more); }\n        } finally { more.forEach((y) => preBusy.delete(y.kw)); }\n      })()]);\n      gathering = false;\n      if (late) log(L(`\\u6b8b\\u308a\\u306e\\u54c1\\u306f${(grace / 1000).toFixed(1)}\\u79d2\\u3067\\u6253\\u3061\\u5207\\u308a \\u2192 \\u8cfc\\u5165\\u753b\\u9762\\u3078`, `H\\u1ebft h\\u1ea1n ch\\u1edd ${(grace / 1000).toFixed(1)} gi\\u00e2y cho m\\u00e3 c\\u00f2n l\\u1ea1i \\u2192 m\\u1edf thanh to\\u00e1n lu\\u00f4n`));\n      if (preIn > 1 && !late) await sleep(150);           // l\\u01b0\\u1ee3t ch\\u1ed3ng nhau \\u0111ang ch\\u1edd tr\\u1ea3 l\\u1eddi: cho k\\u1ecbp ghi v\\u00e0o preGot (15/11: kh\\u00f4ng c\\u00f2n l\\u01b0\\u1ee3t n\\u00e0o th\\u00ec \\u0111i lu\\u00f4n)\n      const seen = new Set();\n      const out = preGot.filter((g) => (seen.has(String(g.id)) ? false : seen.add(String(g.id))));\n      st.active = false; save(K_ST, st);\n      saveForWebhook(out);\n      save('pjc_autopay', null);                 // JP: b\\u1ea1n t\\u1ef1 b\\u1ea5m \\u4eca\\u3059\\u3050\\u652f\\u6255\\u3046\n      save(K_COAT, { at: Date.now(), n: 0 });\n      location.href = '/checkout';\n      log(L('\\u30ab\\u30fc\\u30c8\\u306b\\u8ffd\\u52a0 \\u2192 \\u8cfc\\u5165\\u753b\\u9762\\u3092\\u958b\\u304d\\u307e\\u3059\\uff08\\u300c\\u4eca\\u3059\\u3050\\u652f\\u6255\\u3046\\u300d\\u306f\\u81ea\\u5206\\u3067\\u30bf\\u30c3\\u30d7\\uff09: ', '\\u0110\\u00e3 v\\u00e0o gi\\u1ecf \\u2192 m\\u1edf trang thanh to\\u00e1n (b\\u1ea1n t\\u1ef1 b\\u1ea5m \\u4eca\\u3059\\u3050\\u652f\\u6255\\u3046): ') + out.map((g) => `${g.title.slice(0, 18)}\\u00d7${g.qty}`).join(', '));\n      const miss = list.filter((o) => !out.some((g) => g.kw === o.kw));\n      if (miss.length) log(L('\\u5165\\u3089\\u306a\\u304b\\u3063\\u305f\\u4e88\\u544a\\u306e\\u54c1: ', 'M\\u00e3 ch\\u01b0a v\\u00e0o gi\\u1ecf (h\\u1ebft / ch\\u01b0a m\\u1edf): ') + miss.map((o) => o.kw).join(', '));\n      beep();\n    } finally { preIn--; free(); }\n  }\n\n  // onlyPlan: khung th\\u00eam gi\\u1ecf th\\u1eb3ng -> ch\\u1ec9 \\u0111\\u1ecdc danh s\\u00e1ch \\u0111\\u1ec3 nh\\u1edb m\\u00f3n cho t\\u1eeb kh\\u00f3a T\\u00caN (preTick lo th\\u00eam gi\\u1ecf, c\\u00f9ng 1 \\u0111\\u01a1n v\\u1edbi c\\u00e1c m\\u00e3)\n  async function scan(onlyPlan) {\n    inflight++;\n    try {\n      const ps = await getProducts();\n      hits429 = 0;                               // g\\u1eedi \\u0111\\u01b0\\u1ee3c l\\u1ea1i -> h\\u1ebft b\\u1ecb ch\\u1eb7n\n      if (!IS_US) jpOk();\n      if (IS_US && usPoll > US_POLL_MS && ++usOk >= US_OK_STEP) { usOk = 0; usPoll = Math.max(US_POLL_MS, usPoll - 500); }   // \\u1ed5n \\u0111\\u1ecbnh -> nhanh d\\u1ea7n\n      if (denseMs > DENSE_MS) denseMs = Math.max(DENSE_MS, denseMs - 10);   // h\\u1ebft b\\u1ecb ch\\u1eb7n -> nh\\u1ecbp qu\\u00e9t nhanh d\\u1ea7n v\\u1ec1 300ms\n      if (onlyPlan) plan(ps); else await handle(ps);\n    } catch (e) {\n      if (e.message === '429' && !IS_US) { jp429(e.retryAfter); denseMs = Math.min(600, denseMs + 100); setStatus(L('\\u5728\\u5eab\\u76e3\\u8996\\u4e2d\\u2026', '\\u0110ang canh h\\u00e0ng\\u2026')); }\n      else if (e.message === '429') {\n        const now = Date.now();\n        if (now >= backoffUntil) {               // nhi\\u1ec1u l\\u01b0\\u1ee3t c\\u00f9ng tr\\u1ea3 429 -> ch\\u1ec9 t\\u00ednh 1 l\\u1ea7n\n          hits429++;\n          let wait = Math.min(BACKOFF_MAX, BACKOFF_MIN * 2 ** (hits429 - 1));\n          if (e.retryAfter > 0) wait = Math.min(BACKOFF_MAX, Math.max(BACKOFF_MIN, e.retryAfter * 1000));\n          if (IS_US) {\n            if (e.retryAfter > 0) wait = Math.min(US_429_MAX, e.retryAfter * 1000);\n            usPoll = Math.min(US_POLL_MAX, usPoll * 2); usOk = 0;\n            lastOkAt = now + wait;               // \\u0111ang ngh\\u1ec9 theo y\\u00eau c\\u1ea7u c\\u1ee7a shop, kh\\u00f4ng ph\\u1ea3i shop im l\\u1eb7ng\n            save(K_US_BLOCK, now + wait);        // t\\u1ea3i l\\u1ea1i trang c\\u0169ng kh\\u00f4ng g\\u1eedi ti\\u1ebfp trong l\\u00fac \\u0111ang b\\u1ecb gi\\u1edbi h\\u1ea1n\n            log(L(`\\u26d4 \\u30b7\\u30e7\\u30c3\\u30d7\\u306e\\u30a2\\u30af\\u30bb\\u30b9\\u5236\\u9650 (429) \\u2192 ${Math.round(wait / 1000)}\\u79d2 \\u4f11\\u3093\\u3067\\u518d\\u958b\\uff08\\u78ba\\u8a8d\\u9593\\u9694 ${(usPoll / 1000).toFixed(1)}\\u79d2\\uff09`,\n                  `\\u26d4 Shop gi\\u1edbi h\\u1ea1n truy c\\u1eadp (429) \\u2192 ngh\\u1ec9 ${Math.round(wait / 1000)} gi\\u00e2y r\\u1ed3i canh ti\\u1ebfp (m\\u1ed7i ${(usPoll / 1000).toFixed(1)} gi\\u00e2y d\\u00f2 1 l\\u1ea7n)`));\n          }\n          backoffUntil = now + wait;\n          denseMs = Math.min(600, denseMs + 100);      // b\\u1ecb 429: gi\\u00e3n nh\\u1ecbp 300 \\u2192 400 \\u2192 \\u2026 \\u2192 600ms\n          setStatus(L('\\u5728\\u5eab\\u76e3\\u8996\\u4e2d\\u2026', '\\u0110ang canh h\\u00e0ng\\u2026'));\n        }\n      } else setStatus(L('\\u30a8\\u30e9\\u30fc: ', 'L\\u1ed7i: ') + e.message);\n    } finally {\n      inflight--;\n    }\n  }\n\n  // Header Date ch\\u1ec9 ch\\u00ednh x\\u00e1c t\\u1edbi gi\\u00e2y: m\\u1ed7i l\\u1ea7n \\u0111o cho 1 kho\\u1ea3ng [Date \\u2212 l\\u00fac nh\\u1eadn, Date + 1s \\u2212 l\\u00fac g\\u1eedi]; \\u0111o 6 l\\u1ea7n c\\u00e1ch 1,17s\n  // (l\\u1ec7ch pha so v\\u1edbi ranh gi\\u1edbi gi\\u00e2y) r\\u1ed3i l\\u1ea5y GIAO c\\u00e1c kho\\u1ea3ng -> sai s\\u1ed1 c\\u00f2n ~0,1\\u20130,3s. Kho\\u1ea3ng m\\u00e2u thu\\u1eabn / l\\u1ec7ch > 5s -> b\\u1ecf, d\\u00f9ng gi\\u1edd m\\u00e1y.\n  const SYNC_N = 6, SYNC_GAP = 1170, SYNC_MAX = 5000;\n  let syncState = 0;                         // 0 ch\\u01b0a \\u0111o, 1 \\u0111ang \\u0111o, 2 xong\n  const K_SRVOFF = 'pjc_srvoff_v1', SRVOFF_LIFE = 10 * 60e3;\n  async function syncClock() {\n    syncState = 1;\n    let lo = -Infinity, hi = Infinity, n = 0;\n    const nSync = msToOpen() > 75000 ? SYNC_N : 2;   // b\\u1eadt BOT s\\u00e1t gi\\u1edd: ch\\u1ec9 \\u0111o 2 l\\u1ea7n (\\u0111\\u1ee1 t\\u1ed1n request trong c\\u1eeda s\\u1ed5 60 gi\\u00e2y)\n    for (let i = 0; i < nSync && st.active; i++) {\n      if (i) await sleep(SYNC_GAP);\n      try {\n        const t0 = Date.now();\n      reqNote('other');\n        const r = await fetch('/cart.js', { credentials: 'same-origin', cache: 'no-store' });\n        const t1 = Date.now();\n        const d = Date.parse(r.headers.get('date') || '');\n        if (!d || t1 - t0 > 1500) continue;      // m\\u1ea1ng qu\\u00e1 ch\\u1eadm: l\\u1ea7n \\u0111o n\\u00e0y kh\\u00f4ng \\u0111\\u00e1ng tin\n        lo = Math.max(lo, d - t1); hi = Math.min(hi, d + 1000 - t0); n++;\n      } catch (e) {}\n    }\n    syncState = 2;\n    if (!n || lo > hi || Math.abs((lo + hi) / 2) > SYNC_MAX) { log(L('\\u30b5\\u30fc\\u30d0\\u30fc\\u6642\\u523b\\u3092\\u53d6\\u5f97\\u3067\\u304d\\u305a \\u2192 \\u7aef\\u672b\\u306e\\u6642\\u8a08\\u3067\\u5b9f\\u884c', 'Kh\\u00f4ng \\u0111o \\u0111\\u01b0\\u1ee3c gi\\u1edd m\\u00e1y ch\\u1ee7 \\u2192 d\\u00f9ng gi\\u1edd \\u0111i\\u1ec7n tho\\u1ea1i')); return; }\n    srvOff = Math.round((lo + hi) / 2);\n    save(K_SRVOFF, { off: srvOff, at: Date.now() });      // trang t\\u1ea3i l\\u1ea1i sau 11:59:48 (kh\\u00f4ng k\\u1ecbp \\u0111o l\\u1ea1i) v\\u1eabn d\\u00f9ng \\u0111\\u01b0\\u1ee3c\n    const sgn = srvOff >= 0 ? '+' : '';\n    log(L(`\\ud83d\\udd52 \\u30b5\\u30fc\\u30d0\\u30fc\\u6642\\u523b\\u306b\\u540c\\u671f: \\u7aef\\u672b\\u3068\\u306e\\u5dee ${sgn}${(srvOff / 1000).toFixed(2)}\\u79d2\\uff08\\u8aa4\\u5dee\\u00b1${((hi - lo) / 2000).toFixed(2)}\\u79d2\\uff09`,\n          `\\ud83d\\udd52 \\u0110\\u00e3 \\u0111\\u1ed3ng b\\u1ed9 gi\\u1edd m\\u00e1y ch\\u1ee7: l\\u1ec7ch so v\\u1edbi \\u0111i\\u1ec7n tho\\u1ea1i ${sgn}${(srvOff / 1000).toFixed(2)} gi\\u00e2y (sai s\\u1ed1 \\u00b1${((hi - lo) / 2000).toFixed(2)} gi\\u00e2y)`));\n  }\n\n  let ticker = null;\n  function startTicker() {\n    if (ticker) return;\n    const t0 = Date.now();\n    let prev = { ...stats }, sec = 0;\n    ticker = setInterval(() => {\n      if (!st.active) { clearInterval(ticker); ticker = null; return; }\n      sec++;\n      const blocked = IS_US ? backoffUntil - Date.now() : 0;\n      if (blocked > 0) setStatus(L(`\\u30a2\\u30af\\u30bb\\u30b9\\u5236\\u9650\\u4e2d (429)\\u2026 \\u3042\\u3068 ${Math.ceil(blocked / 1000)}\\u79d2`, `Shop \\u0111ang gi\\u1edbi h\\u1ea1n (429), c\\u00f2n ${Math.ceil(blocked / 1000)} gi\\u00e2y n\\u1eefa canh ti\\u1ebfp`));\n      const d = { req: stats.req - prev.req, ok: stats.ok - prev.ok, r429: stats.r429 - prev.r429, err: stats.err - prev.err, lat: stats.lat - prev.lat };\n      if (sec > 60 && sec % (IS_US ? 60 : 10)) return;       // sau 60 gi\\u00e2y: 10 gi\\u00e2y ghi 1 d\\u00f2ng (US canh l\\u00e2u: 1 ph\\u00fat)\n      prev = { ...stats };\n      // m\\u1ed7i gi\\u00e2y: 1 d\\u00f2ng cho t\\u1eebng t\\u1eeb kh\\u00f3a. Ghi ng\\u01b0\\u1ee3c (KW cu\\u1ed1i tr\\u01b0\\u1edbc) \\u0111\\u1ec3 log m\\u1edbi-\\u1edf-tr\\u00ean hi\\u1ec7n KW1 tr\\u00ean c\\u00f9ng\n      const ST = { in: L('\\u5728\\u5eab\\u3042\\u308a\\u2705', 'c\\u00f2n h\\u00e0ng \\u2705'), out: L('\\u58f2\\u308a\\u5207\\u308c', 'h\\u1ebft h\\u00e0ng'), none: L('\\u672a\\u63b2\\u8f09', 'ch\\u01b0a l\\u00ean k\\u1ec7'), pre: L('\\u76f4\\u63a5\\u30ab\\u30fc\\u30c8\\u3078\\u9001\\u4fe1\\u4e2d', '\\u0111ang th\\u00eam gi\\u1ecf th\\u1eb3ng') };\n      if (d.err && !d.ok) log(L('\\u30cd\\u30c3\\u30c8\\u30ef\\u30fc\\u30af\\u30a8\\u30e9\\u30fc', 'l\\u1ed7i m\\u1ea1ng'));\n      const wait = Date.now() - lastOkAt;\n      if (blocked > 0 || (IS_US && d.r429 && !d.ok)) { /* \\u0111\\u00e3 ghi d\\u00f2ng \\u26d4 l\\u00fac b\\u1ecb gi\\u1edbi h\\u1ea1n */ }\n      // 16/11 log kh\\u00e1ch: ch\\u1ec9 ghi \"Shop ch\\u01b0a tr\\u1ea3 l\\u1eddi\" -> kh\\u00f4ng bi\\u1ebft l\\u00e0 shop CH\\u1eb6N (429) hay request TREO. Gi\\u1edd ghi r\\u00f5 nguy\\u00ean nh\\u00e2n\n      else if (!IS_US && backoffUntil - Date.now() > 2500) { if (Math.ceil((backoffUntil - Date.now()) / 1000) % 5 === 0) log(L(`\\u26d4 \\u30a2\\u30af\\u30bb\\u30b9\\u5236\\u9650 (429) \\u2192 \\u4f11\\u6b62\\u4e2d \\u3042\\u3068${Math.ceil((backoffUntil - Date.now()) / 1000)}\\u79d2`, `\\u26d4 Shop ch\\u1eb7n (429) \\u2192 \\u0111ang ngh\\u1ec9, c\\u00f2n ${Math.ceil((backoffUntil - Date.now()) / 1000)} gi\\u00e2y n\\u1eefa g\\u1eedi l\\u1ea1i`)); }\n      else if (wait > 2500 && Date.now() - last429At < 5000) log(L(`\\u26d4 \\u30a2\\u30af\\u30bb\\u30b9\\u5236\\u9650 (429) ${Math.round(wait / 1000)}\\u79d2 \\u2192 \\u9593\\u9694\\u3092\\u7a7a\\u3051\\u3066\\u518d\\u9001\\uff08\\u540c\\u3058Wi-Fi\\u3067\\u8907\\u6570\\u7aef\\u672b/\\u30bf\\u30d6\\u30fbVPN\\u304c\\u539f\\u56e0\\u306e\\u3053\\u3068\\u304c\\u591a\\u3044\\uff09`,\n        `\\u26d4 Shop ch\\u1eb7n t\\u1ea1m (429) ${Math.round(wait / 1000)} gi\\u00e2y \\u2192 gi\\u00e3n nh\\u1ecbp, g\\u1eedi l\\u1ea1i (hay do nhi\\u1ec1u m\\u00e1y/tab c\\u00f9ng Wi-Fi ho\\u1eb7c VPN)`));\n      else if (wait > 2500 && Date.now() - lastErrAt < 6000) log(L(`\\u23f3 \\u30b7\\u30e7\\u30c3\\u30d7\\u5fdc\\u7b54\\u306a\\u3057\\uff084\\u79d2\\u8d85\\u30fb\\u901a\\u4fe1\\u30a8\\u30e9\\u30fc\\uff09${Math.round(wait / 1000)}\\u79d2 \\u2192 \\u518d\\u9001\\u4e2d`,\n        `\\u23f3 Shop treo kh\\u00f4ng tr\\u1ea3 l\\u1eddi (qu\\u00e1 4 gi\\u00e2y / l\\u1ed7i m\\u1ea1ng) ${Math.round(wait / 1000)} gi\\u00e2y \\u2192 \\u0111ang g\\u1eedi l\\u1ea1i`));\n      else if (wait > 2500) log(L(`\\u23f3 \\u30b7\\u30e7\\u30c3\\u30d7\\u5fdc\\u7b54\\u306a\\u3057 ${Math.round(wait / 1000)}\\u79d2\\uff08\\u518d\\u9001\\u4e2d\\uff09`, `\\u23f3 Shop ch\\u01b0a tr\\u1ea3 l\\u1eddi ${Math.round(wait / 1000)} gi\\u00e2y (\\u0111ang g\\u1eedi l\\u1ea1i)`));\n      else for (const k of [...kwStat].reverse()) log(`[${k.label}] ${k.kw} \\u00b7 ${ST[k.st]}`);\n      if (adding) log(L('\\u5728\\u5eab\\u3042\\u308a \\u2192 \\u30ab\\u30fc\\u30c8\\u306b\\u8ffd\\u52a0\\u4e2d\\u2026', 'C\\u00f3 h\\u00e0ng \\u2192 \\u0111ang th\\u00eam v\\u00e0o gi\\u1ecf\\u2026'));\n    }, 1000);\n  }\n\n  let runGen = 0;\n  async function run() {\n    warmUp();\n    adding = false; inflight = 0; slowMode = false; hits429 = 0; denseMs = DENSE_MS; logged429 = false;\n    shopOpen = false; blk = 0; recover = false; okStreak = 0;\n    kwStat = []; lastOkAt = Date.now();\n    if (IS_US) {\n      usPoll = US_POLL_MS; usOk = 0;\n      const until = Number(load(K_US_BLOCK, 0)) || 0;\n      if (until > Date.now() && until - Date.now() <= US_429_MAX) { backoffUntil = until; usPoll = US_POLL_MS * 2; }\n    }\n    const gen = ++runGen;                       // b\\u1ea5m D\\u1eebng -> B\\u1eaft \\u0111\\u1ea7u l\\u1ea1i: v\\u00f2ng c\\u0169 (c\\u00f3 th\\u1ec3 \\u0111ang ch\\u1edd shop) t\\u1ef1 tho\\u00e1t, kh\\u00f4ng ch\\u1ea1y 2 v\\u00f2ng\n    let denseShown = false, opened = false;\n    preIdx = 0; preIn = 0; preShown = false; preEnded = false; prefetched = false; preGot.length = 0;\n    for (const k of Object.keys(live)) delete live[k];\n    syncState = 0; srvOff = 0; preScanAt = 0;\n    { const so = load(K_SRVOFF, null); if (so && Date.now() - so.at < SRVOFF_LIFE) srvOff = so.off; }\n    while (st.active && gen === runGen) {\n      const t0 = Date.now();\n      const left = st.now ? -1 : msToOpen();\n      // 11:59:10 \\u2192 ~11:59:17: \\u0111o gi\\u1edd m\\u00e1y ch\\u1ee7 (6 request /cart.js) tr\\u01b0\\u1edbc khi \\u0111\\u1ecdc tr\\u01b0\\u1edbc danh s\\u00e1ch\n      // 19/11: \\u0111o l\\u00fac 11:58:20 \\u2192 11:58:27 (tr\\u01b0\\u1edbc: 11:59:10) \\u0111\\u1ec3 t\\u1edbi 12:00 c\\u00e1c request \\u0111o gi\\u1edd \\u0111\\u00e3 ra kh\\u1ecfi c\\u1eeda s\\u1ed5 60 gi\\u00e2y c\\u1ee7a shop\n      if (!IS_US && !st.now && syncState === 0 && left <= 100000 && left > 12000) syncClock();\n      // 11:59:30: \\u0111\\u1ecdc tr\\u01b0\\u1edbc danh s\\u00e1ch 1 l\\u1ea7n -> nh\\u1edb m\\u00e3 s\\u1ea3n ph\\u1ea9m c\\u1ee7a t\\u1eebng t\\u1eeb kh\\u00f3a cho ch\\u1ebf \\u0111\\u1ed9 th\\u00eam gi\\u1ecf th\\u1eb3ng\n      if (preOn() && !prefetched && left <= 30000 && left > PRE_FROM_MS) {\n        prefetched = true;\n        const prep = () => {\n          const pl = preList(), n = pl.length;\n          log(L(`\\u4e88\\u544a\\u306e\\u54c1\\u306e\\u6e96\\u5099: ${n}\\u4ef6\\uff0812:00:07\\u304b\\u3089\\u76f4\\u63a5\\u30ab\\u30fc\\u30c8\\u3078\\uff09`, `Chu\\u1ea9n b\\u1ecb th\\u00eam gi\\u1ecf th\\u1eb3ng: ${n} m\\u00e3 (t\\u1eeb 12:00:07)`));\n          const no = cfg.items.slice(0, cfg.kwCount).filter((it) => it.kw.trim() && !pl.some((o) => o.kw === it.kw)).map((it) => it.kw);\n          if (no.length) log(L(`\\u26a0 \\u5546\\u54c1ID\\u4e0d\\u660e \\u2192 \\u4e00\\u89a7\\u30921\\u79d2\\u3054\\u3068\\u306b\\u78ba\\u8a8d: ${no.join(', ')}`, `\\u26a0 Ch\\u01b0a bi\\u1ebft Variant ID \\u2192 d\\u00f2 danh s\\u00e1ch song song 1 gi\\u00e2y/l\\u1ea7n: ${no.join(', ')}`));\n        };\n        getProducts().then((ps) => { plan(ps); prep(); }).catch(prep);\n      }\n      if (preOn() && !preEnded && left <= -PRE_FROM_MS && !adding) {\n        const list = left > -PRE_FOR_MS ? preList() : [];\n        if (list.length) {\n          if (!preShown) {\n            preShown = true; startTicker();\n            log(L(`\\u4e88\\u544a\\u306e\\u54c1\\u3092\\u76f4\\u63a5\\u30ab\\u30fc\\u30c8\\u3078\\u9001\\u4fe1\\u4e2d\\uff08${list.length}\\u4ef6\\u30fb\\u5b9a\\u523b+7\\u79d2\\u301c+20\\u79d2\\uff09`, `\\u0110ang th\\u00eam gi\\u1ecf th\\u1eb3ng ${list.length} m\\u00e3 (12:00:07 \\u2192 12:00:20)`));\n            kwStat = list.map((o) => ({ label: o.label, kw: o.kw, st: 'pre' }));\n          }\n          if (Date.now() >= backoffUntil && preIn < (recover ? 1 : shopOpen ? PRE_INFLIGHT : 2) && !(recover && inflight) && (shopOpen || budgetWaitMs(PROBE_BUDGET) <= 0)) preTick(list);\n          // t\\u1eeb kh\\u00f3a CH\\u01afA bi\\u1ebft Variant ID (m\\u00e3 m\\u1edbi tinh): song song \\u0111\\u1ecdc danh s\\u00e1ch 1 gi\\u00e2y/l\\u1ea7n -> th\\u1ea5y h\\u00e0ng l\\u00e0 th\\u00eam gi\\u1ecf, \\u0111\\u1ed3ng th\\u1eddi h\\u1ecdc m\\u00e3\n          if (Date.now() >= backoffUntil && !inflight && !(recover && preIn) && budgetWaitMs(SCAN_BUDGET) <= 0 && Date.now() - preScanAt >= (recover ? RECOVER_GAP : PRE_SCAN_MS) &&\n              cfg.items.slice(0, cfg.kwCount).some((it) => it.kw.trim() && !preGot.some((g) => g.kw === it.kw) &&\n                (!list.some((o) => o.kw === it.kw) || list.some((o) => o.kw === it.kw && o.avail === false)))) { preScanAt = Date.now(); scan(true); }\n          await sleep(Math.max(denseMs, cfg.monitorDelay || 0));\n          continue;\n        }\n        if (preShown && !preEnded) log(L('\\u5b9a\\u523b+20\\u79d2\\u307e\\u3067\\u5165\\u3089\\u305a \\u2192 \\u4e00\\u89a7\\u3067\\u63a2\\u3057\\u307e\\u3059', 'T\\u1edbi 12:00:20 ch\\u01b0a v\\u00e0o gi\\u1ecf \\u2192 quay l\\u1ea1i qu\\u00e9t danh s\\u00e1ch'));\n        preEnded = true;\n      }\n      if (opened && !st.now && left > WATCH_FROM_SEC * 1000) { finish(L(`${GIVE_UP_MIN}\\u5206\\u904e\\u304e\\u3066\\u3082\\u58f2\\u308a\\u5207\\u308c \\u2192 \\u505c\\u6b62`, `Qu\\u00e1 ${GIVE_UP_MIN} ph\\u00fat v\\u1eabn h\\u1ebft h\\u00e0ng \\u2013 d\\u1eebng`)); return; }\n      if (left <= WATCH_FROM_SEC * 1000) opened = true;\n      if (left > WATCH_FROM_SEC * 1000) {\n        const s = Math.ceil(left / 1000);\n        setStatus(L(`${cfg.open}\\uff08\\u65e5\\u672c\\u6642\\u9593\\uff09\\u307e\\u3067: `, `C\\u00f2n t\\u1edbi ${cfg.open} gi\\u1edd Nh\\u1eadt: `) + `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`);\n        await sleep(Math.min(1000, left - WATCH_FROM_SEC * 1000));\n        continue;\n      }\n      if (!st.now && left < -GIVE_UP_MIN * 60e3) { finish(L(`${GIVE_UP_MIN}\\u5206\\u904e\\u304e\\u3066\\u3082\\u58f2\\u308a\\u5207\\u308c \\u2192 \\u505c\\u6b62`, `Qu\\u00e1 ${GIVE_UP_MIN} ph\\u00fat v\\u1eabn h\\u1ebft h\\u00e0ng \\u2013 d\\u1eebng`)); return; }\n      startTicker();\n      if (adding || Date.now() < backoffUntil) { await sleep(40); continue; }\n      // 19/11: JP kh\\u00f4ng c\\u00f2n \"qu\\u00e9t t\\u1ed1c \\u0111\\u1ed9 cao\" (4 l\\u01b0\\u1ee3t ch\\u1ed3ng / 0,3 gi\\u00e2y = ~24 request trong 8 gi\\u00e2y -> ch\\u1ea1m ng\\u01b0\\u1ee1ng shop \\u0111\\u00fang l\\u00fac m\\u1edf link thanh to\\u00e1n)\n      const dense = IS_US && !st.now && !slowMode && left <= -DENSE_FROM_MS && left > -DENSE_FOR_MS;\n      curDense = dense;\n      if (dense) {\n        if (!denseShown) { denseShown = true; log(L('\\u9ad8\\u901f\\u30b9\\u30ad\\u30e3\\u30f3\\u958b\\u59cb', 'B\\u1eaft \\u0111\\u1ea7u qu\\u00e9t t\\u1ed1c \\u0111\\u1ed9 cao')); }\n        if (inflight < (recover ? 1 : MAX_INFLIGHT)) scan();      // kh\\u00f4ng await: c\\u00e1c l\\u01b0\\u1ee3t ch\\u1ed3ng l\\u00ean nhau (v\\u1eeba b\\u1ecb 429: t\\u1eebng l\\u01b0\\u1ee3t m\\u1ed9t)\n        await sleep(Math.max(denseMs, cfg.monitorDelay || 0));\n      } else if (IS_US) {\n        // US canh li\\u00ean t\\u1ee5c: g\\u1eedi theo nh\\u1ecbp, KH\\u00d4NG ch\\u1edd l\\u01b0\\u1ee3t tr\\u01b0\\u1edbc tr\\u1ea3 l\\u1eddi (t\\u1ed1i \\u0111a 2 l\\u01b0\\u1ee3t c\\u00f9ng l\\u00fac)\n        // -> 1 request b\\u1ecb shop gi\\u1eef l\\u00e2u kh\\u00f4ng l\\u00e0m BOT \\u0111\\u1ee9ng im (log 2/11: c\\u00f2n h\\u00e0ng m\\u00e0 kh\\u00f4ng th\\u00eam gi\\u1ecf m\\u1ea5y ph\\u00fat)\n        if (inflight < 2) scan();\n        // \\u0111ang ch\\u1eadm l\\u1ea1i sau 429 th\\u00ec kh\\u00f4ng b\\u1eadt qu\\u00e9t nhanh\n        await sleep(Math.max(Date.now() < usBurstUntil && usPoll <= US_POLL_MS ? US_BURST_MS : usPoll, cfg.monitorDelay || 0) + Math.random() * 60);\n      } else {\n        // JP: qu\\u00e9t theo ng\\u00e2n s\\u00e1ch 60 gi\\u00e2y. H\\u1eb9n gi\\u1edd: 11:59:59 \\u2192 12:00:04 m\\u1ed7i 1 gi\\u00e2y, 12:00:05 \\u2192 12:00:15 m\\u1ed7i 0,7 gi\\u00e2y (h\\u00e0ng hay l\\u00ean l\\u00fac n\\u00e0y),\n        // sau \\u0111\\u00f3 1 gi\\u00e2y; h\\u1ebft SCAN_BUDGET th\\u00ec ch\\u1edd request c\\u0169 h\\u1ebft h\\u1ea1n (~2,8 gi\\u00e2y/l\\u01b0\\u1ee3t). Lu\\u00f4n ch\\u1eeba ~9 request cho th\\u00eam gi\\u1ecf + m\\u1edf thanh to\\u00e1n.\n        const bw = budgetWaitMs(SCAN_BUDGET);\n        if (bw > 0) { setStatus(L('\\u30a2\\u30af\\u30bb\\u30b9\\u5236\\u9650\\u3092\\u907f\\u3051\\u308b\\u305f\\u3081\\u9593\\u9694\\u3092\\u8abf\\u6574\\u4e2d\\u2026', '\\u0110ang gi\\u1eef nh\\u1ecbp \\u0111\\u1ec3 shop kh\\u00f4ng ch\\u1eb7n (429)\\u2026')); await sleep(Math.min(bw, 400)); continue; }\n        await scan();\n        const gap = recover ? RECOVER_GAP : (cfg.monitorDelay || 1000);\n        await sleep(Math.max(0, Math.max(gap, cfg.monitorDelay || 0) + Math.random() * 60 - (Date.now() - t0)));\n      }\n    }\n  }\n\n  function start(now) {\n    readCfg();\n    if (!cfg.items.slice(0, cfg.kwCount).some((i) => i.kw.trim())) { log(L('\\u30ad\\u30fc\\u30ef\\u30fc\\u30c9\\u3092\\u5165\\u529b\\u3057\\u3066\\u304f\\u3060\\u3055\\u3044', 'H\\u00e3y nh\\u1eadp t\\u1eeb kh\\u00f3a')); return; }\n    if (!now && !/^\\d{1,2}:\\d{2}$/.test(cfg.open || '')) { log(L('\\u8ca9\\u58f2\\u958b\\u59cb\\u6642\\u523b\\u3092\\u5165\\u529b\\u3057\\u3066\\u304f\\u3060\\u3055\\u3044', 'H\\u00e3y nh\\u1eadp gi\\u1edd m\\u1edf b\\u00e1n')); return; }\n    st.active = true; st.now = !!now; save(K_ST, st); keepAwake();\n    log(IS_US ? L(`${SHOP}: \\u76e3\\u8996\\u30b9\\u30bf\\u30fc\\u30c8\\uff08\\u5728\\u5eab\\u304c\\u51fa\\u308b\\u307e\\u3067\\u7d9a\\u3051\\u307e\\u3059\\uff09`, `${SHOP}: b\\u1eaft \\u0111\\u1ea7u canh h\\u00e0ng li\\u00ean t\\u1ee5c (t\\u1edbi khi c\\u00f3 h\\u00e0ng)`) : now ? L(`${SHOP}: \\u4eca\\u3059\\u3050\\u76e3\\u8996`, `${SHOP}: canh h\\u00e0ng ngay`) : L(`${SHOP}: ${cfg.open}\\uff08\\u65e5\\u672c\\u6642\\u9593\\uff09\\u307e\\u3067\\u5f85\\u6a5f`, `${SHOP}: ch\\u1edd t\\u1edbi ${cfg.open} gi\\u1edd Nh\\u1eadt`)); run();\n  }\n  function finish(m) { if(IS_GR8){runGeneration++;starting=false;gr8Clear();} st.active = false; save(K_ST, st); log(m); setStatus(m); }\n  let wakeLock = null;\n  async function keepAwake() {\n    try { if (st.active && !wakeLock && navigator.wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (e) {}\n  }\n  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') keepAwake(); });\n  function beep() { try { const a = new (window.AudioContext || window.webkitAudioContext)(); const o = a.createOscillator(); o.frequency.value = 880; o.connect(a.destination); o.start(); o.stop(a.currentTime + 0.4); } catch (e) {} }\n\n  // ---------- B\\u1ea3ng \\u0111i\\u1ec1u khi\\u1ec3n ----------\n  // Log m\\u1edbi n\\u1eb1m TR\\u00caN C\\u00d9NG, ch\\u1ec9 gi\\u1eef LOG_MAX d\\u00f2ng m\\u1edbi nh\\u1ea5t (d\\u00f2ng c\\u0169 t\\u1ef1 x\\u00f3a). 4/11 th\\u00e0nh vi\\u00ean t\\u01b0\\u1edfng log \"d\\u1eebng\" \\u1edf 1500 d\\u00f2ng\n  // v\\u00ec con s\\u1ed1 \\u0111\\u1ee9ng y\\u00ean -> hi\\u1ec7n th\\u00eam gi\\u1edd c\\u1ee7a d\\u00f2ng m\\u1edbi nh\\u1ea5t. L\\u01b0u localStorage t\\u1ed1i \\u0111a 1 l\\u1ea7n / gi\\u00e2y (tr\\u01b0\\u1edbc: m\\u1ed7i d\\u00f2ng ghi l\\u1ea1i\n  // c\\u1ea3 1500 d\\u00f2ng, iPhone gi\\u1eadt l\\u00fac \\u0111\\u00f4ng); khung log \\u0111ang \\u0111\\u00f3ng th\\u00ec kh\\u00f4ng v\\u1ebd l\\u1ea1i. R\\u1eddi trang th\\u00ec l\\u01b0u ngay (pagehide).\n  const LOG_MAX = 1500;\n  let logBuf = load(K_LOG, []), logSaveT = 0, logLast = '';\n  const logFlush = () => { if (logSaveT) { clearTimeout(logSaveT); logSaveT = 0; } save(K_LOG, logBuf); };\n  window.addEventListener('pagehide', logFlush);\n  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') logFlush(); });\n  const logCount = () => L(`${logBuf.length}\\u884c${logBuf.length >= LOG_MAX ? '\\uff08\\u6700\\u65b0\\u5206\\u306e\\u307f\\u4fdd\\u6301\\uff09' : ''}${logLast ? ' \\u00b7 \\u6700\\u65b0 ' + logLast : ''}`,\n    `${logBuf.length} d\\u00f2ng${logBuf.length >= LOG_MAX ? ' (ch\\u1ec9 gi\\u1eef d\\u00f2ng m\\u1edbi nh\\u1ea5t)' : ''}${logLast ? ' \\u00b7 m\\u1edbi nh\\u1ea5t ' + logLast : ''}`);\n  function log(m) {\n    const iso = jstNow().toISOString();            // gi\\u1edd Nh\\u1eadt: MM/DD HH:MM:SS.mmm\n    logBuf.unshift(`${iso.slice(5, 7)}/${iso.slice(8, 10)} ${iso.slice(11, 23)} ${m}`);\n    if (logBuf.length > LOG_MAX) logBuf.length = LOG_MAX;\n    logLast = iso.slice(11, 19);\n    if (!logSaveT) logSaveT = setTimeout(logFlush, 1000);\n    const el = document.getElementById('pjclog'); if (el && el.getClientRects().length) el.textContent = logBuf.join('\\n');\n    const n = document.getElementById('pjclogn'); if (n) n.textContent = logCount();\n  }\n  function setStatus(s) { const el = document.getElementById('pjcst'); if (el) el.textContent = s; }\n  function readCfg() {\n    for (let i = 0; i < MAX_KW; i++) {\n      cfg.items[i].kw = document.getElementById('pjck' + i).value.trim();\n      cfg.items[i].qty = +document.getElementById('pjcq' + i).value;\n    }\n    cfg.backup.kw = document.getElementById('pjckb').value.trim();\n    cfg.backup.qty = +document.getElementById('pjcqb').value;\n    cfg.open = document.getElementById('pjcopen').value;\n    cfg.monitorDelay = monitorDelay(document.getElementById('pjcmonitor').value, POLL_MS);\n    document.getElementById('pjcmonitor').value = cfg.monitorDelay || '';\n    cfg.payPick = document.getElementById('pjcpay').value;\n    cfg.pre = document.getElementById('pjcpre').value === 'on' ? 'on' : 'off';\n    save(K_CFG, cfg);\n  }\n\n  const ui = load(K_UI, { top: true, small: false });\n  const box = document.createElement('div');\n  box.id = 'pjcbox';\n  const goLabel = () => IS_US ? L('\\u76e3\\u8996\\u30b9\\u30bf\\u30fc\\u30c8\\uff08\\u8ca9\\u58f2\\u6642\\u523b\\u30d5\\u30ea\\u30fc\\uff09', 'B\\u1eadt canh h\\u00e0ng li\\u00ean t\\u1ee5c') : (cfg.open ? L(`${cfg.open} \\u306b\\u4e88\\u7d04\\u30fb\\u81ea\\u52d5\\u30b9\\u30bf\\u30fc\\u30c8`, `H\\u1eb9n \\u0111\\u1ebfn ${cfg.open} T\\u1ef1 B\\u1eadt`) : L('\\u8ca9\\u58f2\\u958b\\u59cb\\u6642\\u523b\\u3092\\u5165\\u529b\\u3057\\u3066\\u304f\\u3060\\u3055\\u3044', 'H\\u00e3y nh\\u1eadp gi\\u1edd m\\u1edf b\\u00e1n'));\n  const MAX_QTY = IS_US ? 12 : 3;           // s\\u1ed1 l\\u01b0\\u1ee3ng m\\u1ed7i m\\u00e3: US 1\\u201312 (user \\u0111\\u1ed5i 2/11), JP 1\\u20133 (Mellojoy JP gi\\u1edbi h\\u1ea1n 3/m\\u00f3n)\n  const qtySel = (id) => `<select id=\"${id}\">${Array.from({ length: MAX_QTY }, (_, i) => `<option>${i + 1}</option>`).join('')}</select>`;\n  const fi = (id, ph, extra) => `<input id=\"pjcb_${id}\" placeholder=\"${ph}\" ${extra || ''}>`;\n  const ZONES = { US: [[\"AL\", \"Alabama\"], [\"AK\", \"Alaska\"], [\"AZ\", \"Arizona\"], [\"AR\", \"Arkansas\"], [\"CA\", \"California\"], [\"CO\", \"Colorado\"], [\"CT\", \"Connecticut\"], [\"DE\", \"Delaware\"], [\"DC\", \"District of Columbia\"], [\"FL\", \"Florida\"], [\"GA\", \"Georgia\"], [\"HI\", \"Hawaii\"], [\"ID\", \"Idaho\"], [\"IL\", \"Illinois\"], [\"IN\", \"Indiana\"], [\"IA\", \"Iowa\"], [\"KS\", \"Kansas\"], [\"KY\", \"Kentucky\"], [\"LA\", \"Louisiana\"], [\"ME\", \"Maine\"], [\"MD\", \"Maryland\"], [\"MA\", \"Massachusetts\"], [\"MI\", \"Michigan\"], [\"MN\", \"Minnesota\"], [\"MS\", \"Mississippi\"], [\"MO\", \"Missouri\"], [\"MT\", \"Montana\"], [\"NE\", \"Nebraska\"], [\"NV\", \"Nevada\"], [\"NH\", \"New Hampshire\"], [\"NJ\", \"New Jersey\"], [\"NM\", \"New Mexico\"], [\"NY\", \"New York\"], [\"NC\", \"North Carolina\"], [\"ND\", \"North Dakota\"], [\"OH\", \"Ohio\"], [\"OK\", \"Oklahoma\"], [\"OR\", \"Oregon\"], [\"PA\", \"Pennsylvania\"], [\"RI\", \"Rhode Island\"], [\"SC\", \"South Carolina\"], [\"SD\", \"South Dakota\"], [\"TN\", \"Tennessee\"], [\"TX\", \"Texas\"], [\"UT\", \"Utah\"], [\"VT\", \"Vermont\"], [\"VA\", \"Virginia\"], [\"WA\", \"Washington\"], [\"WV\", \"West Virginia\"], [\"WI\", \"Wisconsin\"], [\"WY\", \"Wyoming\"]],\n    JP: [[\"JP-01\", \"\\u5317\\u6d77\\u9053\"], [\"JP-02\", \"\\u9752\\u68ee\\u770c\"], [\"JP-03\", \"\\u5ca9\\u624b\\u770c\"], [\"JP-04\", \"\\u5bae\\u57ce\\u770c\"], [\"JP-05\", \"\\u79cb\\u7530\\u770c\"], [\"JP-06\", \"\\u5c71\\u5f62\\u770c\"], [\"JP-07\", \"\\u798f\\u5cf6\\u770c\"], [\"JP-08\", \"\\u8328\\u57ce\\u770c\"], [\"JP-09\", \"\\u6803\\u6728\\u770c\"], [\"JP-10\", \"\\u7fa4\\u99ac\\u770c\"], [\"JP-11\", \"\\u57fc\\u7389\\u770c\"], [\"JP-12\", \"\\u5343\\u8449\\u770c\"], [\"JP-13\", \"\\u6771\\u4eac\\u90fd\"], [\"JP-14\", \"\\u795e\\u5948\\u5ddd\\u770c\"], [\"JP-15\", \"\\u65b0\\u6f5f\\u770c\"], [\"JP-16\", \"\\u5bcc\\u5c71\\u770c\"], [\"JP-17\", \"\\u77f3\\u5ddd\\u770c\"], [\"JP-18\", \"\\u798f\\u4e95\\u770c\"], [\"JP-19\", \"\\u5c71\\u68a8\\u770c\"], [\"JP-20\", \"\\u9577\\u91ce\\u770c\"], [\"JP-21\", \"\\u5c90\\u961c\\u770c\"], [\"JP-22\", \"\\u9759\\u5ca1\\u770c\"], [\"JP-23\", \"\\u611b\\u77e5\\u770c\"], [\"JP-24\", \"\\u4e09\\u91cd\\u770c\"], [\"JP-25\", \"\\u6ecb\\u8cc0\\u770c\"], [\"JP-26\", \"\\u4eac\\u90fd\\u5e9c\"], [\"JP-27\", \"\\u5927\\u962a\\u5e9c\"], [\"JP-28\", \"\\u5175\\u5eab\\u770c\"], [\"JP-29\", \"\\u5948\\u826f\\u770c\"], [\"JP-30\", \"\\u548c\\u6b4c\\u5c71\\u770c\"], [\"JP-31\", \"\\u9ce5\\u53d6\\u770c\"], [\"JP-32\", \"\\u5cf6\\u6839\\u770c\"], [\"JP-33\", \"\\u5ca1\\u5c71\\u770c\"], [\"JP-34\", \"\\u5e83\\u5cf6\\u770c\"], [\"JP-35\", \"\\u5c71\\u53e3\\u770c\"], [\"JP-36\", \"\\u5fb3\\u5cf6\\u770c\"], [\"JP-37\", \"\\u9999\\u5ddd\\u770c\"], [\"JP-38\", \"\\u611b\\u5a9b\\u770c\"], [\"JP-39\", \"\\u9ad8\\u77e5\\u770c\"], [\"JP-40\", \"\\u798f\\u5ca1\\u770c\"], [\"JP-41\", \"\\u4f50\\u8cc0\\u770c\"], [\"JP-42\", \"\\u9577\\u5d0e\\u770c\"], [\"JP-43\", \"\\u718a\\u672c\\u770c\"], [\"JP-44\", \"\\u5927\\u5206\\u770c\"], [\"JP-45\", \"\\u5bae\\u5d0e\\u770c\"], [\"JP-46\", \"\\u9e7f\\u5150\\u5cf6\\u770c\"], [\"JP-47\", \"\\u6c96\\u7e04\\u770c\"]] };\n  box.innerHTML = `\n<style>\n#pjcbox{position:fixed;left:8px;right:8px;z-index:2147483647;background:#0d1b32;color:#f2f2f2;border:1px solid #3d3322;border-radius:16px;\n  box-shadow:0 6px 24px #000c;padding:10px 12px;font:13px -apple-system,\"Hiragino Sans\",sans-serif}\n#pjcbox.top{top:calc(env(safe-area-inset-top) + 6px)} #pjcbox.bot{bottom:calc(env(safe-area-inset-bottom) + 10px)}\n#pjcbox .hd{display:flex;gap:6px;align-items:center;font-weight:700} #pjcbox .hd b{flex:1}\n#pjcbox .hd button{padding:6px 7px;font-size:12px;white-space:nowrap;flex:none}\n#pjcbox .ttl{flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;justify-content:center}\n#pjcbox .ver{font-size:10px;font-weight:600;color:#a89a7a;letter-spacing:.5px;margin-top:1px;line-height:1}\n#pjcbox button{border:1px solid #4a3f28;background:#24232b;color:#f3c76a;border-radius:10px;padding:7px 10px;font-size:13px;font-weight:700;\n  text-shadow:none;box-shadow:none}\n#pjcbox .btns button{white-space:nowrap}\n#pjcbox .btns{flex-wrap:wrap}\n#pjcbox .btns button{flex:1}\n#pjcbox .btns button.main{flex:1 1 100%}\n#pjcbox button.main{flex:1;font-size:14px;padding:9px 10px;background:linear-gradient(180deg,#f6cf6b,#ffffff);color:#1d1405;border:0;box-shadow:0 2px 10px #ffffff40}\n#pjcbox .r{display:flex;gap:6px;margin-top:6px;align-items:center}\n#pjcbox input{flex:1;min-width:0;font-size:16px;padding:6px 8px;border:1px solid #33302a;border-radius:8px;background:#17171d;color:#fff}\n#pjcbox input::placeholder{color:#6f6f7a}\n#pjcbox input:focus,#pjcbox select:focus{outline:none;border-color:#ffffff;box-shadow:0 0 0 2px #ffffff40}\n#pjcbox select{-webkit-appearance:none;appearance:none;font-size:16px;padding:6px 24px 6px 10px;border-radius:8px;background:#17171d url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23e9b95a' stroke-width='2' fill='none'/%3E%3C/svg%3E\") no-repeat right 8px center;color:#fff;border:1px solid #33302a;font-weight:700}\n#pjcbox input[type=time]{flex:0 0 auto;width:110px;color-scheme:dark}\n#pjcbox .lb{width:34px;font-size:11px;color:#e9b95a;font-weight:700}\n#pjcbox .desc{font-size:12px;color:#a8a8b3;margin-top:4px} #pjcbox .st{font-size:12px;color:#e9b95a;font-weight:700;margin-top:3px}\n#pjcbox.small .body{display:none}\n#pjcbox .body{max-height:calc(100vh - 160px);overflow-y:auto;-webkit-overflow-scrolling:touch}\n#pjcbox button:disabled{opacity:.35}\n#pjcbox button,#pjcbox input,#pjcbox select{font-family:-apple-system,\"Hiragino Sans\",sans-serif}\n#pjclog{display:block;max-height:220px;overflow:auto;white-space:pre-wrap;font:11px ui-monospace,monospace;background:#16161c;color:#9fe39f;border:1px solid #2a2a33;border-radius:8px;padding:6px;margin-top:6px}\n#pjcbox .sec{border:1px solid #2a2a33;border-radius:10px;padding:8px;margin-top:6px} #pjcbox .sec b{color:#e9b95a;font-size:12px}\n#pjcbox .sec select{flex:0 0 auto;max-width:45%}\n</style>\n<div class=\"hd\">${ICON_TAG}<b class=\"ttl\">${TITLE_TAG}<span class=\"ver\">v${SYNOVA_VERSION}</span></b><button id=\"pjcpos\">${L('\\u4e0a\\u4e0b', 'L\\u00ean/Xu\\u1ed1ng')}</button><button id=\"pjcsmall\">${L('\\u96a0\\u3059', '\\u1ea8n')}</button></div>\n<div class=\"st\" id=\"pjcst\">${st.active ? L('\\u5f85\\u6a5f\\u4e2d', '\\u0110ang ch\\u1edd') : L('\\u505c\\u6b62\\u4e2d', '\\u0110ang t\\u1eaft')}</div>\n<div class=\"body\">\n  <div class=\"desc\">${IS_US\n    ? L('Mellojoy US : \\u8ca9\\u58f2\\u6642\\u523b\\u306f\\u6c7a\\u307e\\u3063\\u3066\\u3044\\u307e\\u305b\\u3093\\uff08TikTok LIVE \\u4e2d\\u30fb\\u671d 7:30\\u301c \\u65e5\\u672c\\u6642\\u9593\\uff09\\u3002\\u5148\\u306b Safari \\u3067\\u30b7\\u30e7\\u30c3\\u30d7\\u304b Shop Pay \\u306b\\u30ed\\u30b0\\u30a4\\u30f3\\uff08\\u4f4f\\u6240\\u30fb\\u30ab\\u30fc\\u30c9\\u4fdd\\u5b58\\u6e08\\u307f\\uff09\\u2192 \\u30d0\\u30ea\\u30a2\\u30f3\\u30c8ID\\uff08\\u6700\\u901f\\uff09\\u307e\\u305f\\u306f\\u30ad\\u30fc\\u30ef\\u30fc\\u30c9\\uff0b\\u500b\\u6570 \\u2192\\u300c\\u76e3\\u8996\\u30b9\\u30bf\\u30fc\\u30c8\\u300d\\u3002\\u5728\\u5eab\\u304c\\u51fa\\u305f\\u3089\\u8cfc\\u5165\\u753b\\u9762\\u3092\\u958b\\u304d\\u3001\\u81ea\\u52d5\\u3067\\u300c\\u4eca\\u3059\\u3050\\u652f\\u6255\\u3046\\u300d\\u3092\\u62bc\\u3057\\u307e\\u3059\\u3002Safari \\u306f\\u958b\\u3044\\u305f\\u307e\\u307e\\u30fb\\u753b\\u9762\\u306f\\u3064\\u3051\\u305f\\u307e\\u307e\\u306b\\u3002',\n        'Mellojoy US : b\\u00e1n gi\\u1edd kh\\u00f4ng c\\u1ed1 \\u0111\\u1ecbnh (theo LIVE TikTok, t\\u1eeb 7:30 s\\u00e1ng gi\\u1edd Nh\\u1eadt). Login shop ho\\u1eb7c Shop Pay tr\\u01b0\\u1edbc tr\\u00ean Safari (\\u0111\\u00e3 l\\u01b0u \\u0111\\u1ecba ch\\u1ec9 + th\\u1ebb) \\u2192 nh\\u1eadp Variant ID (nhanh nh\\u1ea5t) ho\\u1eb7c t\\u1eeb kh\\u00f3a + s\\u1ed1 l\\u01b0\\u1ee3ng \\u2192 b\\u1ea5m \"B\\u1eadt canh h\\u00e0ng li\\u00ean t\\u1ee5c\". C\\u00f3 h\\u00e0ng BOT m\\u1edf trang thanh to\\u00e1n v\\u00e0 t\\u1ef1 b\\u1ea5m \\u4eca\\u3059\\u3050\\u652f\\u6255\\u3046. Gi\\u1eef Safari m\\u1edf v\\u00e0 m\\u00e0n h\\u00ecnh s\\u00e1ng.')\n    : L('Mellojoy JP : \\u30b7\\u30e7\\u30c3\\u30d7\\u3078\\u306e\\u30ed\\u30b0\\u30a4\\u30f3\\u5fc5\\u9808\\uff08\\u4fdd\\u5b58\\u6e08\\u307f\\u306e\\u4f4f\\u6240\\u30fb\\u30ab\\u30fc\\u30c9\\u3067\\u652f\\u6255\\u3044\\uff09\\u3002\\u5546\\u54c1\\u30b3\\u30fc\\u30c9\\uff08\\u4f8b A026\\uff09\\u30fb\\u5546\\u54c1\\u540d\\u30fb\\u30d0\\u30ea\\u30a2\\u30f3\\u30c8ID \\u3068\\u500b\\u6570\\u3092\\u5165\\u529b\\u3002\\u63b2\\u8f09\\u6e08\\u307f\\u306e\\u5546\\u54c1\\uff08\\u58f2\\u308a\\u5207\\u308c\\u8868\\u793a\\u4e2d\\u3082\\uff09\\u306f\\u8ca9\\u58f2\\u958b\\u59cb\\u3068\\u540c\\u6642\\u306b\\u76f4\\u63a5\\u30ab\\u30fc\\u30c8\\u3078\\u8ffd\\u52a0\\u3057\\u307e\\u3059\\u3002\\u5728\\u5eab\\u304c\\u51fa\\u305f\\u3089\\u30ab\\u30fc\\u30c8\\u306b\\u5165\\u308c\\u3066\\u8cfc\\u5165\\u753b\\u9762\\u3092\\u958b\\u304d\\u307e\\u3059\\uff08\\u300c\\u4eca\\u3059\\u3050\\u652f\\u6255\\u3046\\u300d\\u306f\\u81ea\\u5206\\u3067\\u30bf\\u30c3\\u30d7\\uff09\\u3002', 'Mellojoy JP : b\\u1eaft bu\\u1ed9c login shop (tr\\u1ea3 b\\u1eb1ng \\u0111\\u1ecba ch\\u1ec9, th\\u1ebb \\u0111\\u00e3 l\\u01b0u trong t\\u00e0i kho\\u1ea3n). Nh\\u1eadp m\\u00e3 s\\u1ea3n ph\\u1ea9m (VD A026), t\\u00ean m\\u00f3n ho\\u1eb7c Variant ID + s\\u1ed1 l\\u01b0\\u1ee3ng. M\\u00f3n \\u0111\\u00e3 l\\u00ean trang (k\\u1ec3 c\\u1ea3 \\u0111ang b\\u00e1o h\\u1ebft h\\u00e0ng) BOT th\\u00eam th\\u1eb3ng v\\u00e0o gi\\u1ecf ngay l\\u00fac m\\u1edf b\\u00e1n. C\\u00f3 h\\u00e0ng BOT th\\u00eam gi\\u1ecf v\\u00e0 m\\u1edf trang thanh to\\u00e1n, b\\u1ea1n t\\u1ef1 b\\u1ea5m \\u4eca\\u3059\\u3050\\u652f\\u6255\\u3046.')}</div>\n  <div class=\"r\"${IS_US ? ' style=\"display:none\"' : ''}><span class=\"lb\">\\u23f0</span><input type=\"time\" id=\"pjcopen\"><span class=\"desc\" style=\"margin:0\">${L('\\u8ca9\\u58f2\\u958b\\u59cb\\uff08\\u65e5\\u672c\\u6642\\u9593\\uff09\\u30fb\\u521d\\u671f\\u5024', 'Gi\\u1edd m\\u1edf b\\u00e1n (gi\\u1edd Nh\\u1eadt) \\u00b7 m\\u1eb7c \\u0111\\u1ecbnh')} ${IS_US ? usDefault : jpDefault}</span></div>\n  <div class=\"r\"><span class=\"lb\">監視間隔</span><input id=\"pjcmonitor\" type=\"number\" min=\"300\" max=\"30000\" step=\"100\" placeholder=\"自動\"><span class=\"desc\">ms（1000 = 1秒）</span></div>\n  ${Array.from({ length: MAX_KW }, (_, i) => i).map((i) => `<div class=\"r kwrow\" id=\"pjcr${i}\"><span class=\"lb\">KW${i + 1}</span><input id=\"pjck${i}\" placeholder=\"${L('\\u4f8b: 42727888976830 / 111&222&333 / A026 / \\u30c9\\u30fc\\u30ca\\u30c4', 'VD: 42727888976830 / 111&222&333 / A026 / \\u30c9\\u30fc\\u30ca\\u30c4')}\">${qtySel('pjcq' + i)}</div>`).join('')}\n  <div class=\"r\"><button id=\"pjcadd\">\\uff0b ${L('\\u30ad\\u30fc\\u30ef\\u30fc\\u30c9\\u8ffd\\u52a0', 'Th\\u00eam t\\u1eeb kh\\u00f3a')}</button><button id=\"pjcdel\">\\uff0d</button><span class=\"desc\" id=\"pjccnt\" style=\"margin:0\"></span></div>\n  <div class=\"r\"><span class=\"lb\">${L('\\u4e88\\u5099', 'D\\u1ef1 ph\\u00f2ng')}</span><input id=\"pjckb\" placeholder=\"${L('\\u58f2\\u308a\\u5207\\u308c\\u6642\\u306b\\u4ee3\\u308f\\u308a\\u306b\\u8cb7\\u3046', 'Mua thay khi m\\u00f3n tr\\u00ean h\\u1ebft h\\u00e0ng')}\">${qtySel('pjcqb')}</div>\n  <div class=\"r\"${IS_US ? ' style=\"display:none\"' : ''}><span class=\"lb\" style=\"width:auto\">${L('\\u5b9a\\u523b\\u76f4\\u5f8c', 'Ngay gi\\u1edd m\\u1edf')}</span><select id=\"pjcpre\" style=\"flex:1;max-width:none\">\n    <option value=\"off\">${L('Safe\\uff08\\u30a8\\u30e9\\u30fc\\u5c11\\u30fb\\u5b89\\u5168\\uff09', 'Safe ( \\u00edt l\\u1ed7i an to\\u00e0n )')}</option>\n    <option value=\"on\">${L('Request\\uff08429\\u306b\\u306a\\u308a\\u3084\\u3059\\u3044\\uff09', 'Request ( D\\u1ec5 b\\u1ecb 429 )')}</option>\n  </select></div>\n  <div class=\"r\"${IS_US ? ' style=\"display:none\"' : ''}><span class=\"lb\" style=\"width:auto\">${L('\\u652f\\u6255\\u3044', 'Thanh to\\u00e1n')}</span><select id=\"pjcpay\" style=\"flex:1;max-width:none\">\n    <option value=\"\">${L('\\u9078\\u3070\\u306a\\u3044\\uff08\\u81ea\\u5206\\u3067\\u9078\\u3076\\uff09', 'Kh\\u00f4ng ch\\u1ecdn (t\\u1ef1 ch\\u1ecdn)')}</option>\n    <option value=\"applepay\">ApplePay</option>\n    <option value=\"googlepay\">GooglePay</option>\n    <option value=\"credit\">${L('\\u30af\\u30ec\\u30b8\\u30c3\\u30c8\\u30ab\\u30fc\\u30c9', 'Th\\u1ebb t\\u00edn d\\u1ee5ng')}</option>\n  </select></div>\n  <div class=\"desc\"${IS_US ? ' style=\"display:none\"' : ''}>${L('\\u8cfc\\u5165\\u753b\\u9762\\u3067\\u3053\\u306e\\u652f\\u6255\\u3044\\u65b9\\u6cd5\\u3092\\u81ea\\u52d5\\u3067\\u9078\\u3073\\u307e\\u3059\\u3002\\u300c\\u4eca\\u3059\\u3050\\u652f\\u6255\\u3046\\u300d\\u306f\\u3054\\u81ea\\u5206\\u3067\\u62bc\\u3057\\u3066\\u304f\\u3060\\u3055\\u3044',\n    'Trang thanh to\\u00e1n s\\u1ebd t\\u1ef1 ch\\u1ecdn c\\u00e1ch n\\u00e0y. N\\u00fat \\u4eca\\u3059\\u3050\\u652f\\u6255\\u3046 b\\u1ea1n v\\u1eabn t\\u1ef1 b\\u1ea5m.')}</div>\n  <!-- Mellojoy JP b\\u1eaft bu\\u1ed9c login shop -> tr\\u1ea3 b\\u1eb1ng \\u0111\\u1ecba ch\\u1ec9 / th\\u1ebb \\u0111\\u00e3 l\\u01b0u trong t\\u00e0i kho\\u1ea3n, khung n\\u00e0y v\\u00f4 d\\u1ee5ng -> \\u1ea9n (user y\\u00eau c\\u1ea7u 2/11) -->\n  <div class=\"r\"${IS_US ? '' : ' style=\"display:none\"'}><button id=\"pjcbuyb\" style=\"flex:1\">\\u2699\\ufe0f ${L('\\u914d\\u9001\\u5148\\u30fb\\u30ab\\u30fc\\u30c9\\uff08\\u30ea\\u30af\\u30a8\\u30b9\\u30c8\\u8cfc\\u5165\\uff09', 'Th\\u00f4ng tin giao h\\u00e0ng & thanh to\\u00e1n')}</button></div>\n  <div class=\"sec\" id=\"pjcbuy\" style=\"display:none\">\n    <b>${L('\\u914d\\u9001\\u5148', '\\u0110\\u1ecba ch\\u1ec9 nh\\u1eadn h\\u00e0ng')}</b>\n    <div class=\"r\"${IS_US ? '' : ' style=\"display:none\"'}><span class=\"lb\">${L('\\u56fd', 'N\\u01b0\\u1edbc')}</span><select id=\"pjcb_country\" style=\"flex:1;max-width:none\"><option value=\"US\">United States</option><option value=\"JP\">${L('\\u65e5\\u672c', 'Nh\\u1eadt B\\u1ea3n (JP)')}</option></select></div>\n    <div class=\"r\">${fi('last', IS_US ? L('\\u59d3 (Last name)', 'H\\u1ecd (Last name)') : L('\\u59d3', 'H\\u1ecd (\\u59d3)'))}${fi('first', IS_US ? L('\\u540d (First name)', 'T\\u00ean (First name)') : L('\\u540d', 'T\\u00ean (\\u540d)'))}</div>\n    <div class=\"r\">${fi('email', 'Email', 'type=\"email\" autocomplete=\"email\"')}</div>\n    <div class=\"r\">${fi('phone', IS_US ? L('\\u96fb\\u8a71\\u756a\\u53f7', '\\u0110i\\u1ec7n tho\\u1ea1i (VD 2125551234)') : L('\\u643a\\u5e2f\\u96fb\\u8a71\\uff08\\u4f8b 09012345678\\uff09', '\\u0110i\\u1ec7n tho\\u1ea1i (VD 09012345678)'), 'type=\"tel\" inputmode=\"tel\"')}</div>\n    <div class=\"r\">${fi('zip', IS_US ? 'ZIP code' : L('\\u90f5\\u4fbf\\u756a\\u53f7', 'M\\u00e3 b\\u01b0u \\u0111i\\u1ec7n (\\u3012)'), 'inputmode=\"numeric\"')}<select id=\"pjcb_zone\"></select></div>\n    <div class=\"r\">${fi('city', IS_US ? 'City' : L('\\u5e02\\u533a\\u753a\\u6751', 'Qu\\u1eadn / th\\u00e0nh ph\\u1ed1 (\\u5e02\\u533a\\u753a\\u6751)'))}</div>\n    <div class=\"r\">${fi('addr1', IS_US ? 'Address' : L('\\u4f4f\\u6240\\uff08\\u756a\\u5730\\uff09', '\\u0110\\u1ecba ch\\u1ec9 (\\u756a\\u5730)'))}</div>\n    <div class=\"r\">${fi('addr2', IS_US ? L('Apt / Suite\\uff08\\u4efb\\u610f\\uff09', 'Apt / Suite (kh\\u00f4ng b\\u1eaft bu\\u1ed9c)') : L('\\u5efa\\u7269\\u540d\\u30fb\\u90e8\\u5c4b\\u756a\\u53f7\\uff08\\u4efb\\u610f\\uff09', 'T\\u00f2a nh\\u00e0, ph\\u00f2ng (kh\\u00f4ng b\\u1eaft bu\\u1ed9c)'))}</div>\n    <b style=\"display:block;margin-top:8px\">${L('\\u652f\\u6255\\u3044\\u65b9\\u6cd5', 'C\\u00e1ch thanh to\\u00e1n')}</b>\n    <div class=\"r\"><div style=\"flex:1;font-size:16px;font-weight:700;padding:6px 10px;border:1px solid #33302a;border-radius:8px;background:#17171d;color:#fff\">${L('\\u30af\\u30ec\\u30b8\\u30c3\\u30c8\\u30ab\\u30fc\\u30c9', 'Th\\u1ebb t\\u00edn d\\u1ee5ng')}</div></div>\n    <div class=\"r\">${fi('cnum', L('\\u30ab\\u30fc\\u30c9\\u756a\\u53f7', 'S\\u1ed1 th\\u1ebb'), 'inputmode=\"numeric\" autocomplete=\"off\"')}</div>\n    <div class=\"r\">${fi('cexp', 'MM/YY', 'inputmode=\"numeric\" maxlength=\"5\" autocomplete=\"off\"')}${fi('ccvv', 'CVV', 'inputmode=\"numeric\" autocomplete=\"off\"')}</div>\n    <div class=\"r\">${fi('cname', L('\\u30ab\\u30fc\\u30c9\\u540d\\u7fa9\\uff08\\u4f8b TARO YAMADA\\uff09', 'T\\u00ean tr\\u00ean th\\u1ebb (VD TARO YAMADA)'), 'autocomplete=\"off\"')}</div>\n    <div class=\"r\"><button id=\"pjcb_cclr\">${L('\\u30ab\\u30fc\\u30c9\\u60c5\\u5831\\u3092\\u6d88\\u53bb', 'X\\u00f3a th\\u00f4ng tin th\\u1ebb')}</button></div>\n    <div class=\"desc\" id=\"pjcb_msg\"></div>\n  </div>\n  <div class=\"r btns ${SYNOVA_LANG}\"><button class=\"main\" id=\"pjcgo\">${goLabel()}</button><button id=\"pjcnow\"${IS_US ? ' style=\"display:none\"' : ''}>${L('\\u3059\\u3050\\u5b9f\\u884c', 'Ch\\u1ea1y Ngay')}</button><button id=\"pjcstop\">${L('\\u505c\\u6b62', 'D\\u1eebng')}</button><button id=\"pjclogb\">${L('\\u30ed\\u30b0\\u3092\\u898b\\u308b', 'Xem Log')}</button></div>\n  <div id=\"pjclogw\" style=\"display:none\"><div class=\"r\"><button id=\"pjcclr\">${L('\\u30ed\\u30b0\\u6d88\\u53bb', 'X\\u00f3a log')}</button><button id=\"pjccopy\">${L('\\u30ed\\u30b0\\u3092\\u30b3\\u30d4\\u30fc', 'Sao ch\\u00e9p log')}</button><span class=\"desc\" id=\"pjclogn\" style=\"margin:0\"></span></div><div id=\"pjclog\"></div></div>\n</div>`;\n  document.body.appendChild(box);\n  const bub = synovaBubble('pjcbub', () => { ui.hide = false; apply(); });\n  const apply = () => {\n    box.className = ui.top ? 'top' : 'bot';\n    box.style.display = ui.hide ? 'none' : '';\n    if (ui.hide) bub.show(ui.top, st.active); else bub.hide();\n    save(K_UI, ui);\n  };\n  apply();\n  const $ = (id) => document.getElementById(id);\n  for (let i = 0; i < MAX_KW; i++) { $('pjck' + i).value = cfg.items[i].kw; $('pjcq' + i).value = String(Math.min(MAX_QTY, cfg.items[i].qty || 1)); }   // c\\u00e0i c\\u0169 l\\u1edbn h\\u01a1n -> c\\u1eaft v\\u1ec1 MAX_QTY\n  const showRows = () => {\n    for (let i = 0; i < MAX_KW; i++) $('pjcr' + i).style.display = i < cfg.kwCount ? '' : 'none';\n    $('pjccnt').textContent = `${cfg.kwCount}/${MAX_KW}`;\n    $('pjcadd').disabled = cfg.kwCount >= MAX_KW;\n    $('pjcdel').disabled = cfg.kwCount <= 1;\n  };\n  showRows();\n  $('pjcadd').onclick = () => { if (cfg.kwCount < MAX_KW) { cfg.kwCount++; save(K_CFG, cfg); showRows(); $('pjck' + (cfg.kwCount - 1)).focus(); } };\n  $('pjcdel').onclick = () => {\n    if (cfg.kwCount <= 1) return;\n    cfg.kwCount--;                                       // b\\u1edbt \\u00f4 cu\\u1ed1i v\\u00e0 xo\\u00e1 n\\u1ed9i dung c\\u1ee7a n\\u00f3\n    $('pjck' + cfg.kwCount).value = ''; $('pjcq' + cfg.kwCount).value = '1';\n    readCfg(); showRows();\n  };\n  $('pjckb').value = cfg.backup.kw; $('pjcqb').value = String(Math.min(MAX_QTY, cfg.backup.qty || 1));\n  // T\\u1ef1 tr\\u1ea3 ti\\u1ec1n LU\\u00d4N B\\u1eacT (user y\\u00eau c\\u1ea7u 2/11: b\\u1ecf n\\u00fat b\\u1eadt/t\\u1eaft v\\u00e0 c\\u00e1c d\\u00f2ng gi\\u1ea3i th\\u00edch).\n  // ---------- Th\\u00f4ng tin giao h\\u00e0ng + th\\u1ebb (thanh to\\u00e1n b\\u1eb1ng request) ----------\n  const BUY_KEYS = ['country', 'last', 'first', 'email', 'phone', 'zip', 'zone', 'city', 'addr1', 'addr2', 'cnum', 'cexp', 'ccvv', 'cname'];\n  const buyMsg = () => {\n    const b2 = buy(), miss = [];\n    if (!hasAddr(b2)) miss.push(L('\\u914d\\u9001\\u5148', '\\u0111\\u1ecba ch\\u1ec9'));\n    if (!hasCard(b2)) miss.push(L('\\u30ab\\u30fc\\u30c9', 'th\\u1ebb'));\n    $('pjcb_msg').textContent = miss.length ? L('\\u672a\\u5165\\u529b: ', 'C\\u00f2n thi\\u1ebfu: ') + miss.join(', ')\n      : L(`\\u2705 \\u5165\\u529bOK \\u00b7 \\u30ab\\u30fc\\u30c9 ****${digits(b2.cnum).slice(-4)}`, `\\u2705 \\u0110\\u1ee7 th\\u00f4ng tin \\u00b7 th\\u1ebb ****${digits(b2.cnum).slice(-4)}`);\n  };\n  // N\\u01b0\\u1edbc giao h\\u00e0ng (Mellojoy US ch\\u1ecdn \\u0111\\u01b0\\u1ee3c US / JP; Mellojoy JP lu\\u00f4n JP) -> \\u00f4 State / T\\u1ec9nh \\u0111\\u1ed5i danh s\\u00e1ch theo n\\u01b0\\u1edbc\n  const fillZones = (c) => {\n    const z = $('pjcb_zone'), keep = z.value;\n    z.innerHTML = `<option value=\"\">${c === 'US' ? 'State' : L('\\u90fd\\u9053\\u5e9c\\u770c', 'T\\u1ec9nh')}</option>` + ZONES[c].map(([k, n]) => `<option value=\"${k}\">${n}</option>`).join('');\n    z.value = ZONES[c].some(([k]) => k === keep) ? keep : '';\n  };\n  { const b2 = buy(); $('pjcb_country').value = shipCountry(b2); fillZones($('pjcb_country').value); for (const k of BUY_KEYS) $('pjcb_' + k).value = k === 'country' ? shipCountry(b2) : b2[k] || ''; }\n  $('pjcb_country').addEventListener('change', () => fillZones($('pjcb_country').value));\n  const readBuy = () => { const b2 = {}; for (const k of BUY_KEYS) b2[k] = $('pjcb_' + k).value.trim(); save(K_BUY, b2); buyMsg(); };\n  // H\\u1ea1n th\\u1ebb: b\\u00e0n ph\\u00edm s\\u1ed1 c\\u1ee7a iPhone kh\\u00f4ng c\\u00f3 d\\u1ea5u \"/\" -> g\\u00f5 0330 t\\u1ef1 th\\u00e0nh 03/30 (xo\\u00e1 th\\u00ec b\\u1ecf lu\\u00f4n d\\u1ea5u /)\n  $('pjcb_cexp').addEventListener('input', (e) => {\n    const el = $('pjcb_cexp'), d = digits(el.value).slice(0, 4);\n    const del = e.inputType && e.inputType.startsWith('delete');\n    el.value = d.length > 2 || (d.length === 2 && !del) ? d.slice(0, 2) + '/' + d.slice(2) : d;\n  });\n  for (const k of BUY_KEYS) { $('pjcb_' + k).addEventListener('change', readBuy); $('pjcb_' + k).addEventListener('input', readBuy); }\n  $('pjcbuyb').onclick = () => { const w = $('pjcbuy'); w.style.display = w.style.display === 'block' ? 'none' : 'block'; };\n  $('pjcb_cclr').onclick = () => { for (const k of ['cnum', 'cexp', 'ccvv', 'cname']) $('pjcb_' + k).value = ''; readBuy(); };\n  buyMsg();\n  $('pjcopen').value = cfg.open || '';\n  cfg.monitorDelay = monitorDelay(cfg.monitorDelay, POLL_MS);\n  $('pjcmonitor').value = cfg.monitorDelay || '';\n  $('pjcpay').value = cfg.payPick || '';\n  $('pjcpre').value = cfg.pre === 'on' ? 'on' : 'off';\n  // \\u0110\\u1ed5i ch\\u1eef n\\u00fat ngay khi g\\u00f5 gi\\u1edd (KH\\u00d4NG \\u0111\\u1ed5i l\\u00fac 'change': change b\\u1eafn khi \\u00f4 m\\u1ea5t focus, t\\u1ee9c l\\u00e0\n  // gi\\u1eefa l\\u00fac ch\\u1ea1m v\\u00e0 nh\\u1ea3 ng\\u00f3n tay tr\\u00ean n\\u00fat -> Safari b\\u1ecf m\\u1ea5t c\\u00fa b\\u1ea5m)\n  if (!IS_US) $('pjcopen').addEventListener('input', () => { const t = $('pjcopen').value ? L(`${$('pjcopen').value} \\u306b\\u4e88\\u7d04\\u30fb\\u81ea\\u52d5\\u30b9\\u30bf\\u30fc\\u30c8`, `H\\u1eb9n \\u0111\\u1ebfn ${$('pjcopen').value} T\\u1ef1 B\\u1eadt`) : L('\\u8ca9\\u58f2\\u958b\\u59cb\\u6642\\u523b\\u3092\\u5165\\u529b\\u3057\\u3066\\u304f\\u3060\\u3055\\u3044', 'H\\u00e3y nh\\u1eadp gi\\u1edd m\\u1edf b\\u00e1n'); if ($('pjcgo').textContent !== t) $('pjcgo').textContent = t; });\n  box.querySelectorAll('input,select').forEach((e) => e.addEventListener('change', readCfg));\n  $('pjcpos').onclick = () => { ui.top = !ui.top; apply(); };\n  $('pjcsmall').onclick = () => { ui.hide = true; apply(); };\n  setInterval(() => { if (ui.hide) bub.show(ui.top, st.active); }, 1000);\n  $('pjcgo').onclick = () => { if (!st.active) start(IS_US); };   // US: canh li\\u00ean t\\u1ee5c, kh\\u00f4ng ch\\u1edd gi\\u1edd\n  $('pjcnow').onclick = () => {\n    if (!st.active) { start(true); return; }\n    if (!st.now) { readCfg(); st.now = true; save(K_ST, st); log(L(`${SHOP}: \\u5f85\\u6a5f\\u3092\\u3084\\u3081\\u3066\\u4eca\\u3059\\u3050\\u76e3\\u8996`, `${SHOP}: b\\u1ecf ch\\u1edd gi\\u1edd \\u2013 canh h\\u00e0ng ngay`)); }\n  };\n  $('pjcstop').onclick = () => finish(L('\\u505c\\u6b62\\u3057\\u307e\\u3057\\u305f', '\\u0110\\u00e3 d\\u1eebng'));\n  $('pjclogb').onclick = () => {\n    const w = $('pjclogw'); w.style.display = w.style.display === 'block' ? 'none' : 'block';\n    $('pjclog').textContent = logBuf.join('\\n'); $('pjclogn').textContent = logCount();\n  };\n  $('pjccopy').onclick = () => {\n    const txt = logBuf.join('\\n'), b = $('pjccopy'), ok = () => { b.textContent = L('\\u30b3\\u30d4\\u30fc\\u6e08\\u307f \\u2713', '\\u0110\\u00e3 ch\\u00e9p \\u2713'); setTimeout(() => { b.textContent = L('\\u30ed\\u30b0\\u3092\\u30b3\\u30d4\\u30fc', 'Sao ch\\u00e9p log'); }, 1500); };\n    const old = () => { const t = document.createElement('textarea'); t.value = txt; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;top:0;opacity:0';\n      document.body.appendChild(t); t.select(); t.setSelectionRange(0, txt.length); try { document.execCommand('copy'); ok(); } catch (e) {} t.remove(); };\n    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, old); else old();\n  };\n  $('pjcclr').onclick = () => { logBuf = []; logFlush(); $('pjclog').textContent = ''; $('pjclogn').textContent = L('0\\u884c', '0 d\\u00f2ng'); };\n\n  // 19/11: m\\u1ed7i l\\u1ea7n trang shop \\u0111\\u01b0\\u1ee3c t\\u1ea3i = 1 request t\\u00ednh v\\u00e0o c\\u1eeda s\\u1ed5 60 gi\\u00e2y\n  if (!IS_US) reqNote('nav');\n  const is429 = () => /too many requests/i.test((document.title || '') + ' ' + ((document.body && document.body.innerText) || '').slice(0, 400));\n  // \\u0111\\u1ebfm ng\\u01b0\\u1ee3c r\\u1ed3i m\\u1edf l\\u1ea1i url (trang tr\\u1eafng \\u300cToo Many Requests\\u300d): ch\\u1edd theo c\\u1eeda s\\u1ed5 60 gi\\u00e2y c\\u1ee7a BOT, t\\u1ed1i thi\\u1ec3u min gi\\u00e2y\n  const reopen429 = (url, min, msg) => {\n    let left = Math.ceil(Math.min(45000, Math.max(min * 1000, budgetWaitMs(15))) / 1000);\n    log(msg(left));\n    const tk = setInterval(() => {\n      left--;\n      setStatus(L(`\\u30a2\\u30af\\u30bb\\u30b9\\u5236\\u9650\\u4e2d (429)\\u2026 \\u3042\\u3068${left}\\u79d2\\u3067\\u81ea\\u52d5\\u7684\\u306b\\u958b\\u304d\\u76f4\\u3057\\u307e\\u3059\\uff08\\u64cd\\u4f5c\\u4e0d\\u8981\\uff09`, `Shop \\u0111ang ch\\u1eb7n (429)\\u2026 ${left} gi\\u00e2y n\\u1eefa BOT t\\u1ef1 m\\u1edf l\\u1ea1i (kh\\u00f4ng c\\u1ea7n b\\u1ea5m g\\u00ec)`));\n      if (left <= 0) { clearInterval(tk); location.replace(url); }\n    }, 1000);\n  };\n\n  // link th\\u1eb3ng /cart/<vid>:<qty>:\n  //  - trang tr\\u1eafng \\u300cToo Many Requests\\u300d (19/11 log user: BOT hi\\u1ec3u nh\\u1ea7m l\\u00e0 \"link b\\u1ecb t\\u1eeb ch\\u1ed1i\" r\\u1ed3i quay v\\u1ec1 qu\\u00e9t d\\u1ed3n -> b\\u1ecb ch\\u1eb7n ti\\u1ebfp)\n  //    -> ch\\u1edd r\\u1ed3i m\\u1edf L\\u1ea0I \\u0111\\u00fang link \\u0111\\u00f3, t\\u1ed1i \\u0111a 4 l\\u1ea7n (4 \\u2192 8 \\u2192 15 \\u2192 30 gi\\u00e2y, ho\\u1eb7c l\\u00e2u h\\u01a1n n\\u1ebfu c\\u1eeda s\\u1ed5 60 gi\\u00e2y ch\\u01b0a tr\\u1ed1ng)\n  //  - trang l\\u1ed7i th\\u1eadt c\\u1ee7a Shopify (v\\u1eeba h\\u1ebft / v\\u01b0\\u1ee3t s\\u1ed1 l\\u01b0\\u1ee3ng) -> quay l\\u1ea1i trang c\\u0169, canh ti\\u1ebfp b\\u1eb1ng c\\u00e1ch th\\u00eam gi\\u1ecf c\\u0169\n  {\n    const pm = load(K_PERMA, null);\n    if (pm && /^\\/cart\\/\\d+:\\d+/.test(location.pathname)) {\n      if (is429() && (pm.n || 0) < 4 && Date.now() - pm.at < 4 * 60e3) {\n        const n = pm.n || 0;\n        save(K_PERMA, { ...pm, n: n + 1 });\n        reopen429(pm.url || location.pathname, [4, 8, 15, 30][n], (sec) => L(`\\u26d4 \\u8cfc\\u5165\\u30ea\\u30f3\\u30af\\u304c\\u30a2\\u30af\\u30bb\\u30b9\\u5236\\u9650 (429) \\u2192 ${sec}\\u79d2\\u5f8c\\u306b\\u540c\\u3058\\u30ea\\u30f3\\u30af\\u3092\\u958b\\u304d\\u76f4\\u3057\\u307e\\u3059\\uff08${n + 1}/4\\u30fb\\u64cd\\u4f5c\\u4e0d\\u8981\\uff09`,\n          `\\u26d4 Link thanh to\\u00e1n b\\u1ecb shop ch\\u1eb7n (429) \\u2192 ${sec} gi\\u00e2y n\\u1eefa BOT t\\u1ef1 m\\u1edf l\\u1ea1i \\u0111\\u00fang link \\u0111\\u00f3 (l\\u1ea7n ${n + 1}/4, kh\\u00f4ng c\\u1ea7n b\\u1ea5m g\\u00ec)`));\n        return;\n      }\n      save(K_PERMA, null);\n      if (Date.now() - pm.at < 5 * 60e3) {\n        if (!is429()) save(K_PERMA_OFF, Date.now());\n        save(K_COAT, null);\n        st.active = true; st.now = pm.now; save(K_ST, st);\n        log(is429() ? L('\\u8cfc\\u5165\\u30ea\\u30f3\\u30af\\u304c\\u958b\\u3051\\u307e\\u305b\\u3093\\uff08429 \\u304c\\u7d9a\\u3044\\u3066\\u3044\\u307e\\u3059\\uff09\\u2192 \\u5143\\u306e\\u30da\\u30fc\\u30b8\\u306b\\u623b\\u308a\\u3001\\u9593\\u9694\\u3092\\u7a7a\\u3051\\u3066\\u76e3\\u8996\\u3092\\u7d9a\\u3051\\u307e\\u3059', 'Link thanh to\\u00e1n v\\u1eabn b\\u1ecb ch\\u1eb7n (429) \\u2192 quay l\\u1ea1i trang c\\u0169, gi\\u1eef nh\\u1ecbp ch\\u1eadm v\\u00e0 canh ti\\u1ebfp')\n          : L('\\u76f4\\u884c\\u30ea\\u30f3\\u30af\\u304c\\u4f7f\\u3048\\u307e\\u305b\\u3093\\uff08\\u58f2\\u308a\\u5207\\u308c\\u30fb\\u500b\\u6570\\u5236\\u9650\\uff09\\u2192 \\u5143\\u306e\\u30da\\u30fc\\u30b8\\u306b\\u623b\\u308a\\u3001\\u30ab\\u30fc\\u30c8\\u8ffd\\u52a0\\u65b9\\u5f0f\\u3067\\u76e3\\u8996\\u3092\\u7d9a\\u3051\\u307e\\u3059',\n              'Link th\\u1eb3ng b\\u1ecb t\\u1eeb ch\\u1ed1i (v\\u1eeba h\\u1ebft / v\\u01b0\\u1ee3t s\\u1ed1 l\\u01b0\\u1ee3ng) \\u2192 quay l\\u1ea1i trang c\\u0169, canh ti\\u1ebfp b\\u1eb1ng c\\u00e1ch th\\u00eam gi\\u1ecf'));\n        location.replace(pm.page || '/');\n        return;\n      }\n    }\n  }\n\n  // BOT v\\u1eeba m\\u1edf thanh to\\u00e1n m\\u00e0 shop tr\\u1ea3 trang \\u300cToo Many Requests\\u300d -> kh\\u00f4ng \\u0111\\u1ee9ng im: t\\u1ef1 m\\u1edf l\\u1ea1i (m\\u00f3n \\u0111\\u00e3 th\\u00eam gi\\u1ecf th\\u00ec V\\u1eaaN n\\u1eb1m trong gi\\u1ecf).\n  // T\\u1ed1i \\u0111a 5 l\\u1ea7n: 5 \\u2192 10 \\u2192 20 \\u2192 30 \\u2192 45 gi\\u00e2y (ho\\u1eb7c l\\u00e2u h\\u01a1n n\\u1ebfu c\\u1eeda s\\u1ed5 60 gi\\u00e2y c\\u1ee7a BOT ch\\u01b0a tr\\u1ed1ng). Kh\\u00f4ng ch\\u1ea1y l\\u1ea1i BOT trong l\\u00fac n\\u00e0y.\n  {\n    const co = load(K_COAT, null);\n    if (!IS_US && co && Date.now() - co.at < 10 * 60e3 && !st.active && is429()) {\n      const waits = [5, 10, 20, 30, 45];\n      if (co.n < waits.length) {\n        save(K_COAT, { ...co, n: co.n + 1 });\n        reopen429(co.url || '/checkout', waits[co.n], (sec) => L(`\\u26d4 \\u8cfc\\u5165\\u753b\\u9762\\u304c\\u30a2\\u30af\\u30bb\\u30b9\\u5236\\u9650 (429) \\u2192 ${sec}\\u79d2\\u5f8c\\u306b\\u81ea\\u52d5\\u3067\\u958b\\u304d\\u76f4\\u3057\\u307e\\u3059\\uff08${co.n + 1}/${waits.length}\\u30fbBOT\\u3092\\u518d\\u5b9f\\u884c\\u3057\\u306a\\u3044\\u3067\\u304f\\u3060\\u3055\\u3044\\uff09`,\n          `\\u26d4 Trang thanh to\\u00e1n b\\u1ecb shop ch\\u1eb7n (429) \\u2192 ${sec} gi\\u00e2y n\\u1eefa BOT t\\u1ef1 m\\u1edf l\\u1ea1i (l\\u1ea7n ${co.n + 1}/${waits.length}; \\u0111\\u1eebng b\\u1ea5m ch\\u1ea1y l\\u1ea1i BOT)`));\n        return;\n      }\n      save(K_COAT, null);\n      log(L('\\u8cfc\\u5165\\u753b\\u9762\\u304c\\u958b\\u3051\\u307e\\u305b\\u3093\\uff08429 \\u304c\\u7d9a\\u3044\\u3066\\u3044\\u307e\\u3059\\uff09\\u3002\\u6570\\u5206\\u5f8c\\u306b\\u300c\\u30ab\\u30fc\\u30c8\\u3092\\u898b\\u308b\\u300d\\u304b\\u3089\\u9032\\u3093\\u3067\\u304f\\u3060\\u3055\\u3044', 'V\\u1eabn ch\\u01b0a m\\u1edf \\u0111\\u01b0\\u1ee3c thanh to\\u00e1n (429 k\\u00e9o d\\u00e0i). V\\u00e0i ph\\u00fat n\\u1eefa h\\u00e3y t\\u1ef1 m\\u1edf gi\\u1ecf h\\u00e0ng \\u2192 thanh to\\u00e1n, m\\u00f3n v\\u1eabn c\\u00f2n trong gi\\u1ecf'));\n    }\n  }\n\n  if (st.active) run();\n})();;\n  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pjcRun); else pjcRun();\n}\n\n// ===================== \\u81ea\\u52d5\\u3067\\u652f\\u6255\\u3046 (Shopify checkout / Shop Pay) =====================\n// Ch\\u1ec9 ch\\u1ea1y khi trang thanh to\\u00e1n n\\u00e0y do BOT v\\u1eeba m\\u1edf (\\u2264 10 ph\\u00fat); t\\u1ef1 m\\u1edf trang thanh to\\u00e1n th\\u00ec kh\\u00f4ng b\\u1ea5m.\n// T\\u1ed0C \\u0110\\u1ed8 T\\u1ed0I \\u0110A (user y\\u00eau c\\u1ea7u 2/11, b\\u1ecf \\u0111\\u1ebfm 3 gi\\u00e2y + n\\u00fat H\\u1ee6Y): d\\u00f2 n\\u00fat m\\u1ed7i 50ms, n\\u00fat v\\u1eeba b\\u1ea5m \\u0111\\u01b0\\u1ee3c l\\u00e0 b\\u1ea5m NGAY.\n// L\\u1ea7n b\\u1ea5m ch\\u01b0a qua (shop c\\u00f2n t\\u00ednh ph\\u00ed ship / b\\u00e1o l\\u1ed7i) -> 4 gi\\u00e2y sau n\\u00fat v\\u1eabn b\\u1ea5m \\u0111\\u01b0\\u1ee3c th\\u00ec b\\u1ea5m l\\u1ea1i, t\\u1ed1i \\u0111a 3 l\\u1ea7n.\n// Th\\u1ea5y khung 3D Secure th\\u00ec th\\u00f4i, \\u0111\\u1ec3 ng\\u01b0\\u1eddi d\\u00f9ng t\\u1ef1 x\\u00e1c th\\u1ef1c.\nfunction synovaAutoPay(done) {\n  if (window.__synovaPay) return;            // m\\u1ed7i trang ch\\u1ec9 1 b\\u1ed9 t\\u1ef1 b\\u1ea5m (tr\\u00e1nh b\\u1ea5m 2 l\\u1ea7n)\n  window.__synovaPay = true;\n  const clog = (m) => {\n    try {\n      const b = JSON.parse(localStorage.getItem('pjc_log_v2') || '[]'), iso = new Date(Date.now() + 9 * 3600e3).toISOString();\n      b.unshift(`${iso.slice(5, 7)}/${iso.slice(8, 10)} ${iso.slice(11, 23)} ${m}`); localStorage.setItem('pjc_log_v2', JSON.stringify(b.slice(0, 1500)));\n    } catch (e) {}\n  };\n  const PAY_RE = /^(\\u4eca\\u3059\\u3050\\u652f\\u6255\\u3046|\\u6ce8\\u6587\\u3092\\u78ba\\u5b9a\\u3059\\u308b|\\u6ce8\\u6587\\u3092\\u5b8c\\u4e86\\u3059\\u308b|\\u652f\\u6255\\u3046|Pay now|Complete order|Place order|Pay)$/i;\n  const visible = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };\n  const findPay = () => {\n    const b = document.getElementById('checkout-pay-button');\n    if (b && visible(b)) return b;\n    return [...document.querySelectorAll('button[type=submit],button')].find((x) => PAY_RE.test((x.innerText || '').trim()) && visible(x));\n  };\n  const busy = (b) => b.disabled || b.getAttribute('aria-disabled') === 'true' || b.getAttribute('aria-busy') === 'true';\n  const in3ds = () => [...document.querySelectorAll('iframe')].some((f) => /3ds|challenge|authenticat|acs/i.test((f.src || '') + (f.name || '') + (f.title || '')) && visible(f));\n  let clicks = 0, lastClick = 0, bar = null;\n  const showBar = (txt) => {                // b\\u0103ng b\\u00e1o tr\\u1ea1ng th\\u00e1i (kh\\u00f4ng c\\u00f3 n\\u00fat)\n    if (!document.body) return;\n    if (!bar) {\n      bar = document.createElement('div');\n      bar.style.cssText = 'position:fixed;left:8px;right:8px;bottom:calc(env(safe-area-inset-bottom) + 10px);z-index:2147483647;background:#0d1b32;color:#f3c76a;' +\n        'border:1px solid #ffffff;border-radius:12px;padding:10px 12px;font:600 14px -apple-system,sans-serif;box-shadow:0 6px 24px #000c';\n      document.body.appendChild(bar);\n    }\n    if (bar.textContent !== txt) bar.textContent = txt;\n  };\n  const t0 = Date.now();\n  const timer = setInterval(() => {\n    if (/thank[-_]you|\\/orders\\//i.test(location.pathname)) { done(); return clearInterval(timer); }\n    if (Date.now() - t0 > 3 * 60e3 || clicks >= 3 && Date.now() - lastClick > 4000) { done(); clearInterval(timer); if (bar) showBar(L('\\ud83e\\udd16 \\u81ea\\u52d5\\u652f\\u6255\\u3044\\u7d42\\u4e86 \\u2192 \\u753b\\u9762\\u3092\\u78ba\\u8a8d\\u3057\\u3066\\u304f\\u3060\\u3055\\u3044', '\\ud83e\\udd16 H\\u1ebft l\\u01b0\\u1ee3t t\\u1ef1 b\\u1ea5m \\u2192 h\\u00e3y xem m\\u00e0n h\\u00ecnh')); return; }\n    if (in3ds()) { showBar(L('\\ud83d\\udd10 3D\\u30bb\\u30ad\\u30e5\\u30a2: \\u81ea\\u5206\\u3067\\u8a8d\\u8a3c\\u3057\\u3066\\u304f\\u3060\\u3055\\u3044', '\\ud83d\\udd10 3D Secure: b\\u1ea1n t\\u1ef1 x\\u00e1c th\\u1ef1c')); return; }\n    if (clicks >= 3 || (clicks && Date.now() - lastClick < 4000)) return;\n    const b = findPay();\n    if (!b || busy(b)) { if (!clicks) showBar(L('\\ud83e\\udd16 \\u652f\\u6255\\u3044\\u30dc\\u30bf\\u30f3\\u5f85\\u3061\\u2026', '\\ud83e\\udd16 Ch\\u1edd n\\u00fat thanh to\\u00e1n\\u2026')); return; }\n    clicks++; lastClick = Date.now();\n    b.click();\n    const ms = Date.now() - t0;\n    clog(L(`\\u81ea\\u52d5\\u652f\\u6255\\u3044: \\u300c${(b.innerText || '').trim()}\\u300d\\u3092\\u30bf\\u30c3\\u30d7 (${clicks}/3\\u30fb\\u753b\\u9762\\u8868\\u793a\\u304b\\u3089 ${ms}ms)`, `T\\u1ef1 b\\u1ea5m thanh to\\u00e1n: \\u0111\\u00e3 b\\u1ea5m \"${(b.innerText || '').trim()}\" (${clicks}/3 \\u00b7 ${ms}ms sau khi m\\u1edf trang)`));\n    showBar(L(`\\ud83e\\udd16 \\u652f\\u6255\\u3044\\u30dc\\u30bf\\u30f3\\u3092\\u30bf\\u30c3\\u30d7\\u3057\\u307e\\u3057\\u305f (${clicks}/3)`, `\\ud83e\\udd16 \\u0110\\u00e3 b\\u1ea5m thanh to\\u00e1n (${clicks}/3)`));\n  }, 50);\n}\n// trang checkout c\\u1ee7a shop: d\\u1ea5u pjc_autopay do khung BOT ghi (c\\u00f9ng t\\u00ean mi\\u1ec1n)\nif (!SYNOVA_DUP && /mellojoy(japan|us)\\.com$/.test(location.hostname) && /\\/checkouts?\\b/.test(location.pathname)) (function () {\n  let flag = null;\n  try { flag = JSON.parse(localStorage.getItem('pjc_autopay')); } catch (e) {}\n  if (!flag || Date.now() - flag.at > 10 * 60e3) return;\n  synovaAutoPay(() => { try { localStorage.removeItem('pjc_autopay'); } catch (e) {} });\n})();\n// Shop Pay (shop.app): \\u0111\\u00e3 \\u0111\\u0103ng nh\\u1eadp Shop Pay -> trang c\\u00f3 s\\u1eb5n \\u0111\\u1ecba ch\\u1ec9 + th\\u1ebb (\"Visa \\u00b7\\u00b7\\u00b7\\u00b7 4423\") -> b\\u1ea5m \\u4eca\\u3059\\u3050\\u652f\\u6255\\u3046.\n// shop.app l\\u00e0 t\\u00ean mi\\u1ec1n kh\\u00e1c, kh\\u00f4ng \\u0111\\u1ecdc \\u0111\\u01b0\\u1ee3c localStorage c\\u1ee7a shop -> BOT m\\u1edf checkout k\\u00e8m \"#synova-pay-<gi\\u1edd>\" (ph\\u1ea7n # \\u0111\\u01b0\\u1ee3c gi\\u1eef\n// qua c\\u00e1c l\\u1ea7n chuy\\u1ec3n trang). \\u0110\\u1ecdc ngay l\\u00fac trang m\\u1edbi m\\u1edf r\\u1ed3i c\\u1ea5t v\\u00e0o sessionStorage (trang c\\u00f3 th\\u1ec3 xo\\u00e1 ph\\u1ea7n # sau \\u0111\\u00f3).\nif (!SYNOVA_DUP && /(^|\\.)shop\\.app$/.test(location.hostname)) (function () {\n  let ts = 0;\n  const m = location.hash.match(/synova-pay-(\\d+)/);\n  try { if (m) sessionStorage.setItem('synova_pay', m[1]); ts = +(m ? m[1] : sessionStorage.getItem('synova_pay') || 0); } catch (e) { ts = m ? +m[1] : 0; }\n  if (!ts || Date.now() - ts > 10 * 60e3) return;\n  synovaAutoPay(() => { try { sessionStorage.removeItem('synova_pay'); } catch (e) {} });\n})();\n\n// ===================== \\u652f\\u6255\\u3044\\u65b9\\u6cd5\\u3092\\u81ea\\u52d5\\u3067\\u9078\\u3076 (Mellojoy JP checkout) =====================\n// 9/11 user y\\u00eau c\\u1ea7u: ch\\u1ecdn s\\u1eb5n c\\u00e1ch thanh to\\u00e1n \\u0111\\u00e3 c\\u00e0i. CH\\u1ec8 ch\\u1ecdn \\u00f4, kh\\u00f4ng bao gi\\u1edd b\\u1ea5m \\u4eca\\u3059\\u3050\\u652f\\u6255\\u3046.\n// Ng\\u01b0\\u1eddi d\\u00f9ng \\u0111\\u00e3 \\u0111\\u1ee5ng v\\u00e0o ph\\u1ea7n thanh to\\u00e1n / \\u0111ang g\\u00f5 th\\u1ebb / \\u0111\\u00e3 b\\u1ea5m tr\\u1ea3 ti\\u1ec1n -> BOT th\\u00f4i h\\u1eb3n, kh\\u00f4ng ch\\u1ecdn \\u0111\\u00e8.\nif (!SYNOVA_DUP && /mellojoyjapan\\.com$/.test(location.hostname) && /\\/checkouts?\\b/.test(location.pathname)) (function () {\n  let pick = '';\n  try { pick = (JSON.parse(localStorage.getItem('pjc_cfg_v1')) || {}).payPick || ''; } catch (e) {}\n  const KINDS = {\n    applepay: { name: 'ApplePay', re: /^apple ?pay(?![\\p{L}\\p{N}])/u },\n    googlepay: { name: 'GooglePay', re: /^google ?pay(?![\\p{L}\\p{N}])/u },\n    credit: { name: L('\\u30af\\u30ec\\u30b8\\u30c3\\u30c8\\u30ab\\u30fc\\u30c9', 'Th\\u1ebb t\\u00edn d\\u1ee5ng'), re: /^(\\u30af\\u30ec\\u30b8\\u30c3\\u30c8 ?\\u30ab\\u30fc\\u30c9(\\u6c7a\\u6e08|\\u6255\\u3044)?|\\u30af\\u30ec\\u30b8\\u30c3\\u30c8(\\u6c7a\\u6e08|\\u6255\\u3044)?|credit ?cards?)(?![\\p{L}\\p{N}])/u },\n  };\n  if (!KINDS[pick]) return;\n  const NOT_USABLE = /\\u4ee5\\u5916|\\u4e0d\\u53ef|\\u505c\\u6b62|\\u4f11\\u6b62|\\u5229\\u7528(\\u3067\\u304d|\\u3044\\u305f\\u3060\\u3051)\\u307e\\u305b\\u3093|\\u4f7f\\u3048\\u307e\\u305b\\u3093|\\u9078\\u629e\\u3067\\u304d\\u307e\\u305b\\u3093|\\u6e96\\u5099\\u4e2d|\\u30e1\\u30f3\\u30c6\\u30ca\\u30f3\\u30b9|unavailable|not ?available/i;\n  const K_STOP = 'pjc_paypick_stop:' + location.pathname;     // \\u0111\\u00e3 t\\u1ef1 ch\\u1ecdn / \\u0111\\u00e3 b\\u1ea5m tr\\u1ea3 ti\\u1ec1n \\u1edf checkout n\\u00e0y: t\\u1ea3i l\\u1ea1i trang c\\u0169ng kh\\u00f4ng ch\\u1ecdn \\u0111\\u00e8\n  const stopped = () => { try { return !!sessionStorage.getItem(K_STOP); } catch (e) { return false; } };\n  const markStop = () => { try { sessionStorage.setItem(K_STOP, '1'); } catch (e) {} };\n  if (stopped()) return;\n  const clean = (x) => String(x || '').normalize('NFKC').toLowerCase().replace(/\\s+/g, ' ').trim();\n  const label = (r) => clean((r.labels && r.labels[0] && r.labels[0].innerText) || (r.closest('label') || {}).innerText || r.getAttribute('aria-label') || (r.closest('li,div,fieldset') || {}).innerText);\n  const is = (k, r) => { const t = label(r); return k.re.test(t) && !NOT_USABLE.test(t); };\n  const radios = () => [...document.querySelectorAll('input[type=radio]')].filter((r) => Object.values(KINDS).some((k) => is(k, r)));\n  const kindOf = (r) => Object.values(KINDS).find((k) => is(k, r));\n  const payArea = () => { const r = radios()[0]; return r && (r.closest('[id*=\"payment\" i],[class*=\"payment\" i],[data-payment],fieldset,section') || null); };\n  const clog = (m) => {\n    try {\n      const b = JSON.parse(localStorage.getItem('pjc_log_v2') || '[]'), iso = new Date(Date.now() + 9 * 3600e3).toISOString();\n      b.unshift(`${iso.slice(5, 7)}/${iso.slice(8, 10)} ${iso.slice(11, 23)} ${m}`); localStorage.setItem('pjc_log_v2', JSON.stringify(b.slice(0, 1500)));\n    } catch (e) {}\n  };\n  let bar = null, barT = 0;\n  const say = (m) => {                        // b\\u0103ng \\u1edf TR\\u00caN, kh\\u00f4ng che n\\u00fat tr\\u1ea3 ti\\u1ec1n, kh\\u00f4ng ch\\u1eb7n b\\u1ea5m\n    clog(m);\n    if (!document.body) return;\n    if (!bar) {\n      bar = document.createElement('div');\n      bar.style.cssText = 'position:fixed;left:8px;right:8px;top:calc(env(safe-area-inset-top) + 8px);z-index:2147483647;pointer-events:none;background:#0d1b32;color:#f3c76a;' +\n        'border:1px solid #ffffff;border-radius:12px;padding:9px 12px;font:600 13px -apple-system,sans-serif;box-shadow:0 6px 24px #000c';\n      document.body.appendChild(bar);\n    }\n    bar.textContent = '\\ud83e\\udd16 ' + m; bar.style.display = '';\n    clearTimeout(barT); barT = setTimeout(() => { if (bar) bar.style.display = 'none'; }, 6000);\n  };\n  let timer = 0, over = false;\n  const end = (m, keep) => { if (over) return; over = true; clearInterval(timer); if (keep) markStop(); if (m) say(m); };\n  const CHECK = L('\\u4eca\\u9078\\u3070\\u308c\\u3066\\u3044\\u308b\\u65b9\\u6cd5\\u3092\\u78ba\\u304b\\u3081\\u3066\\u304f\\u3060\\u3055\\u3044', 'H\\u00e3y xem l\\u1ea1i c\\u00e1ch thanh to\\u00e1n \\u0111ang ch\\u1ecdn');\n\n  // ch\\u1ec9 t\\u00ednh thao t\\u00e1c TH\\u1eacT c\\u1ee7a ng\\u01b0\\u1eddi d\\u00f9ng (radio.click() c\\u1ee7a BOT c\\u00f3 isTrusted = false)\n  const touched = (e) => {\n    if (!e.isTrusted || over) return;\n    const t = e.target, area = payArea();\n    if (t && t.closest && t.closest('#checkout-pay-button,button[type=submit]') && e.type === 'click') return end('', true);\n    if (t && t.matches && t.matches('input[type=radio]') && kindOf(t)) return end(L('\\u652f\\u6255\\u3044\\u65b9\\u6cd5\\u306f\\u3054\\u81ea\\u5206\\u3067\\u9078\\u3073\\u307e\\u3057\\u305f', 'B\\u1ea1n \\u0111\\u00e3 t\\u1ef1 ch\\u1ecdn c\\u00e1ch thanh to\\u00e1n \\u2013 BOT kh\\u00f4ng ch\\u1ecdn n\\u1eefa'), true);\n    if (area && t && area.contains(t)) end(L('\\u652f\\u6255\\u3044\\u65b9\\u6cd5\\u306e\\u6b04\\u3092\\u64cd\\u4f5c\\u3057\\u305f\\u306e\\u3067\\u81ea\\u52d5\\u3067\\u306f\\u9078\\u3073\\u307e\\u305b\\u3093\\u3002', 'B\\u1ea1n \\u0111ang thao t\\u00e1c \\u1edf ph\\u1ea7n thanh to\\u00e1n n\\u00ean BOT kh\\u00f4ng t\\u1ef1 ch\\u1ecdn. ') + CHECK, true);\n  };\n  for (const ev of ['pointerdown', 'click', 'keydown']) document.addEventListener(ev, touched, true);\n\n  const t0 = Date.now();\n  let seenAt = 0, clicks = 0, lastClick = 0, target = KINDS[pick], swapped = false;\n  const tick = () => {\n    if (/thank[-_]you|\\/processing|\\/orders\\//i.test(location.pathname)) return end('');\n    if (Date.now() - t0 > 3 * 60e3) return end('');\n    // \\u0111ang g\\u00f5 s\\u1ed1 th\\u1ebb (\\u00f4 th\\u1ebb l\\u00e0 iframe) -> kh\\u00f4ng \\u0111\\u1ed5i \\u00f4, k\\u1ebbo m\\u1ea5t ch\\u1eef \\u0111ang g\\u00f5\n    const a = document.activeElement;\n    if (a && a.tagName === 'IFRAME' && (payArea() || {contains: () => false}).contains(a)) return end(L('\\u30ab\\u30fc\\u30c9\\u5165\\u529b\\u4e2d\\u306a\\u306e\\u3067\\u81ea\\u52d5\\u3067\\u306f\\u9078\\u3073\\u307e\\u305b\\u3093\\u3002', 'B\\u1ea1n \\u0111ang nh\\u1eadp th\\u1ebb n\\u00ean BOT kh\\u00f4ng t\\u1ef1 ch\\u1ecdn. ') + CHECK, true);\n    const all = radios();\n    if (!all.length) return;\n    if (!seenAt) seenAt = Date.now();\n    if (Date.now() - seenAt > 20e3) return end(L(`\\u300c${target.name}\\u300d\\u3092\\u9078\\u3079\\u307e\\u305b\\u3093\\u3067\\u3057\\u305f\\u3002\\u3054\\u81ea\\u5206\\u3067\\u9078\\u3093\\u3067\\u304f\\u3060\\u3055\\u3044`, `Kh\\u00f4ng ch\\u1ecdn \\u0111\\u01b0\\u1ee3c ${target.name} \\u2013 b\\u1ea1n h\\u00e3y t\\u1ef1 ch\\u1ecdn`));\n    let found = all.filter((r) => is(target, r));\n    if (found.length > 1) return end(L(`\\u300c${target.name}\\u300d\\u304c${found.length}\\u500b\\u3042\\u308b\\u306e\\u3067\\u81ea\\u52d5\\u3067\\u306f\\u9078\\u3073\\u307e\\u305b\\u3093`, `C\\u00f3 ${found.length} \\u00f4 ${target.name} n\\u00ean BOT kh\\u00f4ng t\\u1ef1 ch\\u1ecdn \\u2013 b\\u1ea1n h\\u00e3y t\\u1ef1 ch\\u1ecdn`));\n    if (!found.length) {\n      // danh s\\u00e1ch c\\u00f3 th\\u1ec3 c\\u00f2n \\u0111ang hi\\u1ec7n d\\u1ea7n -> ch\\u1edd 1,5 gi\\u00e2y r\\u1ed3i m\\u1edbi k\\u1ebft lu\\u1eadn shop kh\\u00f4ng c\\u00f3 c\\u00e1ch n\\u00e0y. Ch\\u1ecdn th\\u1ebb th\\u00ec kh\\u00f4ng \\u0111\\u1ed5i sang c\\u00e1ch kh\\u00e1c\n      if (Date.now() - seenAt < 1500) return;\n      if (pick === 'credit') return end(L('\\u30af\\u30ec\\u30b8\\u30c3\\u30c8\\u30ab\\u30fc\\u30c9\\u304c\\u898b\\u3064\\u304b\\u308a\\u307e\\u305b\\u3093\\u3002\\u3054\\u81ea\\u5206\\u3067\\u9078\\u3093\\u3067\\u304f\\u3060\\u3055\\u3044', 'Kh\\u00f4ng th\\u1ea5y \\u00f4 Th\\u1ebb t\\u00edn d\\u1ee5ng \\u2013 b\\u1ea1n h\\u00e3y t\\u1ef1 ch\\u1ecdn'));\n      const on = all.find((r) => r.checked);\n      if (on) return end(L(`\\u300c${KINDS[pick].name}\\u300d\\u304c\\u7121\\u3044\\u306e\\u3067\\u3001\\u9078\\u3070\\u308c\\u3066\\u3044\\u308b\\u300c${kindOf(on).name}\\u300d\\u306e\\u307e\\u307e\\u3067\\u3059`, `Shop kh\\u00f4ng c\\u00f3 ${KINDS[pick].name} \\u2013 gi\\u1eef nguy\\u00ean ${kindOf(on).name} \\u0111ang ch\\u1ecdn`));\n      const alt = ['applepay', 'googlepay', 'credit'].map((k) => KINDS[k]).find((k) => all.some((r) => is(k, r)));\n      if (!alt) return;\n      target = alt; swapped = true;\n      found = all.filter((r) => is(target, r));\n      if (found.length !== 1) return end(L('\\u81ea\\u52d5\\u3067\\u306f\\u9078\\u3079\\u307e\\u305b\\u3093\\u3002\\u3054\\u81ea\\u5206\\u3067\\u9078\\u3093\\u3067\\u304f\\u3060\\u3055\\u3044', 'BOT kh\\u00f4ng ch\\u1ecdn \\u0111\\u01b0\\u1ee3c \\u2013 b\\u1ea1n h\\u00e3y t\\u1ef1 ch\\u1ecdn'));\n    }\n    const r = found[0];\n    if (r.checked) return end(swapped ? L(`\\u300c${KINDS[pick].name}\\u300d\\u304c\\u7121\\u3044\\u306e\\u3067\\u300c${target.name}\\u300d\\u3092\\u9078\\u3073\\u307e\\u3057\\u305f\\uff08\\u78ba\\u8a8d\\u3057\\u3066\\u304f\\u3060\\u3055\\u3044\\uff09`, `Shop kh\\u00f4ng c\\u00f3 ${KINDS[pick].name} \\u2192 \\u0111\\u00e3 ch\\u1ecdn ${target.name} (h\\u00e3y xem l\\u1ea1i)`)\n      : clicks ? L(`\\u652f\\u6255\\u3044\\u65b9\\u6cd5\\u3092\\u300c${target.name}\\u300d\\u306b\\u3057\\u307e\\u3057\\u305f \\u2192 \\u300c\\u4eca\\u3059\\u3050\\u652f\\u6255\\u3046\\u300d\\u3092\\u62bc\\u3057\\u3066\\u304f\\u3060\\u3055\\u3044`, `\\u0110\\u00e3 ch\\u1ecdn ${target.name} \\u2192 b\\u1ea1n b\\u1ea5m \\u4eca\\u3059\\u3050\\u652f\\u6255\\u3046`)\n               : L(`\\u652f\\u6255\\u3044\\u65b9\\u6cd5\\u306f\\u300c${target.name}\\u300d\\u3067\\u3059 \\u2192 \\u300c\\u4eca\\u3059\\u3050\\u652f\\u6255\\u3046\\u300d\\u3092\\u62bc\\u3057\\u3066\\u304f\\u3060\\u3055\\u3044`, `\\u0110ang ch\\u1ecdn s\\u1eb5n ${target.name} \\u2192 b\\u1ea1n b\\u1ea5m \\u4eca\\u3059\\u3050\\u652f\\u6255\\u3046`));\n    if (r.disabled || r.closest('[inert],[aria-disabled=\"true\"]')) return;        // ch\\u01b0a b\\u1ea5m \\u0111\\u01b0\\u1ee3c -> ch\\u1edd\n    if (clicks >= 3 || Date.now() - lastClick < 1500) return;\n    clicks++; lastClick = Date.now();\n    r.click();\n    setTimeout(tick, 60);                     // th\\u1ea5y \\u0111\\u00e3 ch\\u1ecdn l\\u00e0 b\\u00e1o ngay, kh\\u00f4ng ch\\u1edd nh\\u1ecbp sau\n  };\n  timer = setInterval(tick, 100);\n})();\n\n// ===================== \\u8cfc\\u5165\\u5b8c\\u4e86 (Shopify thank-you) \\u2192 Discord =====================\n// Trang c\\u1ea3m \\u01a1n c\\u1ee7a Shopify: /checkouts/.../thank-you (ho\\u1eb7c /thank_you, /orders/...). Checkout l\\u00e0 SPA n\\u00ean\n// URL c\\u00f3 th\\u1ec3 \\u0111\\u1ed5i m\\u00e0 kh\\u00f4ng t\\u1ea3i l\\u1ea1i trang -> ki\\u1ec3m tra m\\u1ed7i gi\\u00e2y.\nif (!SYNOVA_DUP && /mellojoy(japan|us)\\.com$|(^|\\.)shop\\.app$/.test(location.hostname) && /\\/checkouts?\\b|shop\\.app$/.test(location.hostname + location.pathname)) (function () {\n  const isThanks = () => /thank[-_]you|\\/orders\\/[0-9a-z]{16,}/i.test(location.pathname);\n  const shop = /mellojoyus/.test(location.hostname) ? 'MellojoyUS' : /mellojoyjapan/.test(location.hostname) ? 'MellojoyJapan' : 'Mellojoy';\n  let tries = 0;\n  const timer = setInterval(() => {\n    if (++tries > 1800) return clearInterval(timer);            // t\\u1ed1i \\u0111a 30 ph\\u00fat\n    if (!isThanks() || !document.body) return;\n    const text = document.body.innerText || '';\n    if (!/\\u3042\\u308a\\u304c\\u3068\\u3046|Thank you|\\u6ce8\\u6587|order/i.test(text) && tries % 15) return;   // ch\\u1edd trang hi\\u1ec7n ch\\u1eef (t\\u1ed1i \\u0111a ~15s)\n    const orderNo = synovaOrderNo(text) || synovaOrderNo(document.title);\n    if (!orderNo && tries < 12) return;          // m\\u00e3 \\u0111\\u01a1n th\\u01b0\\u1eddng hi\\u1ec7n sau v\\u00e0i gi\\u00e2y\n    clearInterval(timer);\n    const key = 'synova_sent_' + location.pathname;\n    try { if (localStorage.getItem(key)) return; localStorage.setItem(key, '1'); } catch (e) {}\n    let sent = [];\n    try { sent = JSON.parse(document.documentElement.getAttribute('data-synova-sent') || '[]'); } catch (e) {}\n    if (orderNo && sent.includes(orderNo)) return;   // \\u0111\\u01a1n n\\u00e0y \\u0111\\u00e3 b\\u00e1o \\u1edf trang kh\\u00e1c (VD shopify.com)\n    let last = null;\n    try { last = JSON.parse(localStorage.getItem('pjc_last')); } catch (e) {}\n    const fresh = last && Date.now() - last.at < 3 * 3600e3 && last.items && last.items.length;\n    const page = fresh ? [] : synovaPageItems();\n    const items = fresh ? last.items : page;\n    const site = fresh ? last.site : location.hostname;\n    if (items.length) {\n      synovaNotify(items.map((it) => ({\n        author: '\\u2705 Checkout Successful', title: it.title, url: it.url || location.origin, thumb: it.image || synovaPageImg(it.title), site,\n        fields: [['Size', it.size], ['\\u4fa1\\u683c', it.price], ['Quantity', it.qty], ['Checkout Time', fresh ? synovaSpeed(last.at) : ''], ['Site', site, false]],\n      })));\n    } else {\n      // kh\\u00f4ng bi\\u1ebft m\\u00f3n (trang ch\\u01b0a hi\\u1ec7n danh s\\u00e1ch m\\u00f3n): kh\\u00f4ng c\\u00f3 chi ti\\u1ebft, \\u1ea3nh = logo SYNOVAJOY\n      synovaNotify([{ author: '\\u2705 Checkout Successful', title: shop, url: location.origin, thumb: '', fields: [['Site', location.hostname, false]] }]);\n    }\n    // b\\u00e1o cho ph\\u1ea7n Shop BOT ghi v\\u00e0o kho chung -> trang shopify.com c\\u1ee7a C\\u00d9NG \\u0111\\u01a1n kh\\u00f4ng b\\u00e1o l\\u1ea7n 2\n    if (orderNo) document.dispatchEvent(new CustomEvent('synova-order-sent', { detail: orderNo }));\n    try { localStorage.removeItem('pjc_last'); } catch (e) {}\n  }, 1000);\n})();\n";
    var inject = function () {
      var ok = false;
      try {
        var s = document.createElement('script');
        s.textContent = MJ_CODE + '\n;document.documentElement.setAttribute("data-synova-mj", "1");';
        (document.head || document.documentElement).appendChild(s);
        s.remove();
        ok = document.documentElement.getAttribute('data-synova-mj') === '1';
      } catch (e) {}
      if (!ok) { try { (0, eval)(MJ_CODE); } catch (e) {} }   // trang chan chen ma (CSP) -> chay ngay tai day
    };
    // document-start rat som: co the chua co the <html> -> cho the <html> xuat hien roi moi chen
    if (document.documentElement) inject();
    else new MutationObserver(function (m, o) { if (document.documentElement) { o.disconnect(); inject(); } }).observe(document, { childList: true });
  }
  // ---- BOT Shop: nhu ban rieng (document-end) ----
  var runShop = function () {
    if (location.hostname === "www.dot-st.com") return;

// (kh\u00f4ng c\u00f3 @noframes: \u00f4 s\u1ed1 th\u1ebb c\u1ee7a Shopify n\u1eb1m trong khung checkout.pci.shopifyinc.com -> script ph\u1ea3i ch\u1ea1y trong khung \u0111\u00f3)

// ===================== Ng\u00f4n ng\u1eef (build.py t\u1ea1o 2 b\u1ea3n: ja / vi) =====================
const SYNOVA_LANG = 'ja';
const L = (ja, vi) => (SYNOVA_LANG === 'vi' ? vi : ja);
// C\u00e0i c\u1ea3 b\u1ea3n Nh\u1eadt l\u1eabn b\u1ea3n Vi\u1ec7t -> ch\u1ec9 b\u1ea3n ch\u1ea1y tr\u01b0\u1edbc ho\u1ea1t \u0111\u1ed9ng
const SYNOVA_DUP = !!window.__synovashop;
window.__synovashop = true;

// ===================== Discord webhook (gi\u1ed1ng BOT Mellojoy) =====================
const SYNOVA_WEBHOOK = ''; // Author's fixed notification destination disabled.
const SYNOVA_LOGO_B64 = '';
const SYNOVA_NAME = 'うずら BOT';
const UZURA_RELEASE = '2.1.85.11035';
const SYNOVA_VERSION = '1.9.8';
const SYNOVA_ICON = UZURA_SHOP_PANEL_ICON;
const SYNOVA_TITLE = '';
const ICON_TAG = `<img src="${SYNOVA_ICON}" alt="" style="width:40px;height:40px;flex:none;mix-blend-mode:screen">`;
const TITLE_TAG = `<span style="font:900 20px/1.3 -apple-system,sans-serif;color:#ffffff">うずら BOT</span>`;

const HOOK_RE = /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/;
// g\u1eedi t\u1edbi webhook SYNOVAJOY (d\u00f9ng chung v\u1edbi BOT Mellojoy) + webhook ri\u00eang ng\u01b0\u1eddi d\u00f9ng t\u1ef1 nh\u1eadp (extra)
// \u1ea2nh trong webhook: ch\u1ec9 g\u1eedi URL http(s) \u0111\u1ea7y \u0111\u1ee7 (URL sai l\u00e0m Discord t\u1eeb ch\u1ed1i c\u1ea3 tin), kh\u00f4ng c\u00f3 \u1ea3nh th\u00ec d\u00f9ng logo
function synovaThumb(u) {
  try {
    const s = String(u || '').trim();
    if (!s || /^(data|blob):/i.test(s)) return '';
    const x = new URL(s, location.origin);
    return /^https?:$/.test(x.protocol) ? x.href : '';
  } catch (e) { return ''; }
}
// \u1ea3nh s\u1ea3n ph\u1ea9m tr\u00ean trang c\u1ea3m \u01a1n (khi kh\u00f4ng bi\u1ebft m\u00f3n \u0111\u00e3 mua): b\u1ecf logo v\u00e0 \u1ea3nh \u1edf \u0111\u1ea7u trang
function synovaPageImg() {
  const excluded = /logo|icon|staticmap|carrier|shipping|delivery|payment|visa|mastercard|sagawa|yamato|fedex|dhl/i;
  for (const img of document.querySelectorAll('img')) {
    const url = synovaThumb(img.currentSrc || img.src);
    if (!url || img.closest('header,footer,nav,[role=banner]')) continue;
    const {hostname, pathname} = new URL(url);
    const shopifyImage = hostname === 'cdn.shopify.com' && pathname.startsWith('/s/files/');
    if (!shopifyImage && !/^\/cdn\/shop\/(?:files|products)\//i.test(pathname)) continue;
    if (excluded.test([pathname, img.alt, img.className].join(' '))) continue;
    for (let row = img.parentElement, depth = 0; row && depth < 7; row = row.parentElement, depth++) {
      if (row.querySelectorAll('img').length !== 1) break;
      const text = (row.innerText || '').normalize('NFKC');
      if (/(?:¥|\$|€|£)\s*\d|\d\s*円/.test(text) &&
          /(?:数量|quantity|qty)\s*[:×x]?\s*[1-9]\d*|^\s*[1-9]\d{0,2}\s*$/im.test(text)) return url;
    }
  }
  return '';
}
function synovaNotify(embeds, extra, priv, callback, dedupeKey) {
  const order = (priv || []).find(([name]) => name === '注文番号')?.[1];
  const requestId = callback ? Date.now().toString(36) + Math.random().toString(36).slice(2) : '';
  if (callback) {
    let timer;
    const done = event => {
      let result; try { result = JSON.parse(event.detail); } catch { return; }
      if (result.requestId !== requestId) return;
      clearTimeout(timer); window.removeEventListener('uzura-notification-status', done);
      callback(result.status, result.message || '');
    };
    window.addEventListener('uzura-notification-status', done);
    timer = setTimeout(() => { window.removeEventListener('uzura-notification-status', done); callback('error', '通知結果を確認できませんでした'); }, 16000);
  }
  window.dispatchEvent(new CustomEvent('uzura-purchase-success', {detail:JSON.stringify({embeds, order, requestId, dedupeKey})}));
}
function findOrderNo(text) {
  const m = (text || '').match(/(?:\u3054\u6ce8\u6587\u756a\u53f7|\u6ce8\u6587\u756a\u53f7|\u78ba\u8a8d\u756a\u53f7|\u6ce8\u6587\s*[#\uff03]|Order\s*(?:number|No\.?)?\s*[#\uff03]?|Confirmation\s*(?:number)?\s*[#\uff03]?)\s*[:\uff1a#\uff03]?\s*([A-Z0-9][A-Z0-9-]{3,})/i);
  return m ? m[1] : '';
}
function synovaPost(hookUrl, embeds) {
  try {
    const hasLogo = SYNOVA_LOGO_B64.length > 100;
    const icon = hasLogo ? 'attachment://logo.png' : undefined;
    const payload = {
      username: SYNOVA_NAME,
      embeds: embeds.slice(0, 10).map((e) => ({
        author: { name: e.author, icon_url: icon },
        title: (e.title || '').slice(0, 250),
        url: e.url || undefined,
        color: e.color || 0x2ecc71,
        thumbnail: synovaThumb(e.thumb) ? { url: synovaThumb(e.thumb) } : (icon ? { url: icon } : undefined),
        fields: (e.fields || []).filter((f) => f[1] != null && f[1] !== '').map(([name, value, inline]) => ({ name, value: String(value).slice(0, 1000), inline: inline !== false })),
        footer: { text: `${SYNOVA_NAME} \u00b7 ${e.site || location.hostname}`, icon_url: icon },
        timestamp: new Date().toISOString(),
      })),
    };
    const fd = new FormData();
    if (hasLogo) {
      const bin = atob(SYNOVA_LOGO_B64), u8 = new Uint8Array(bin.length);
      for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);
      fd.append('files[0]', new Blob([u8], { type: 'image/png' }), 'logo.png');
      payload.attachments = [{ id: 0, filename: 'logo.png' }];
    }
    fd.append('payload_json', JSON.stringify(payload));
    fetch(hookUrl, { method: 'POST', mode: 'no-cors', body: fd, keepalive: true }).catch(() => {});
  } catch (e) {}
}

function synovaBubble(id, onShow) {
  let b = document.getElementById(id);
  if (!b) {
    const host = document.createElement('div');
    host.id = id + 'h';
    host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;top:0;left:0;width:0;height:0';
    const root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
    b = document.createElement('div');
    b.id = id;
    b.style.cssText = 'position:fixed;right:10px;z-index:2147483647;width:52px;height:52px;border-radius:50%;background:#0d1b32;' +
      'border:2px solid #ffffff;box-shadow:0 4px 16px #000c;display:none;align-items:center;justify-content:center;cursor:pointer';
    b.innerHTML = `<img src="${SYNOVA_ICON}" alt="" style="width:40px;height:40px;mix-blend-mode:screen;pointer-events:none">` +
      '<span style="position:absolute;right:1px;top:1px;width:12px;height:12px;border-radius:50%;border:2px solid #0d1b32"></span>';
    b.onclick = onShow;
    root.appendChild(b);
    document.body.appendChild(host);
  }
  return {
    show(top, active) {
      b.style.top = top ? 'calc(env(safe-area-inset-top) + 60px)' : 'auto';
      b.style.bottom = top ? 'auto' : 'calc(env(safe-area-inset-bottom) + 90px)';
      b.lastChild.style.background = active ? '#2ecc71' : '#777';
      b.style.display = 'flex';
    },
    hide() { b.style.display = 'none'; },
  };
}

const HOST = location.hostname;
const IS_VALLAD_OLD = /^(?:www\.)?valladstudio\.com$/i.test(HOST);
const IS_PCI = HOST === 'checkout.pci.shopifyinc.com';
const IN_FRAME = window.top !== window;
const IS_PAL = /^(?:checkout\.)?jp\.palaceskateboards\.com$/.test(HOST);
const IS_PAL_STORE = HOST === 'jp.palaceskateboards.com';
const IS_SUP = /(^|\.)supreme\.com$/.test(HOST);
const IS_HM = /(^|\.)humanmade\.jp$/.test(HOST);
const IS_BUF = /(^|\.)buffering\.jp$/.test(HOST);
const IS_VANS = /(^|\.)vans\.co\.jp$/.test(HOST);
const IS_FEI = /(^|\.)feiler\.jp$/.test(HOST);
const FEI_ORDER = IS_FEI && /^\/shop\/order\//i.test(location.pathname);
const IS_BASE = !IS_FEI && !IS_VANS && !IS_PAL && !IS_SUP && !IS_HM && !IS_BUF && (/^(?:www\.)?everyonetokyo\.com$/.test(HOST) ||
  !!document.querySelector('form.cot-itemOrder-form, [data-endpoint*="/load_items/"], img[src*="baseec-img-mng.akamaized.net"], link[href*="thebase.in"], script[src*="thebase.in"]'));
const BASE_OR_VANS = IS_BASE || IS_VANS;
// Shop Shopify b\u1ea5t k\u1ef3: nh\u1eadn ra b\u1eb1ng d\u1ea5u v\u1ebft trong HTML (kh\u00f4ng d\u00f9ng window.Shopify: Userscripts c\u00f3 th\u1ec3 ch\u1ea1y script \u1edf
// "content world" kh\u00f4ng th\u1ea5y bi\u1ebfn c\u1ee7a trang). Mellojoy c\u00f3 BOT ri\u00eang -> b\u1ecf qua.
const IS_SHOPAPP = /(^|\.)shop\.app$/.test(HOST);
const IS_SHOPCOM = /(^|\.)shop\.com$/.test(HOST);     // ch\u1ee3 c\u1ee7a Shop (trang ch\u1ee7 shop.app chuy\u1ec3n sang) \u2013 kh\u00f4ng ph\u1ea3i shop
const IS_GEN = !UZURA_PENDING_HOSTS.includes(HOST.replace(/^www\./, '')) && !IS_PAL && !IS_SUP && !IS_HM && !IS_BUF && !BASE_OR_VANS && !IS_FEI && !IS_PCI && !IS_SHOPAPP && !IS_SHOPCOM && !/mellojoy/i.test(HOST) && !/\.global-e\.com$/.test(HOST) &&
  (!!UZURA_CURRENT || !!document.querySelector('script#shopify-features, meta[name="shopify-checkout-api-token"], meta[name="shopify-digital-wallet"], ' +
    'link[href*="cdn.shopify.com"], script[src*="cdn.shopify.com"], script[src*="/cdn/shop/"], link[href*="/cdn/shop/"]'));
const IS_SHOPIFY = IS_PAL || IS_SUP || IS_GEN;
const SHOP_ROOT = IS_GEN ? uzuraLocaleRoot(location.pathname) : '/';
const shopPath = path => SHOP_ROOT + String(path).replace(/^\//, '');
// trang thanh to\u00e1n KOMOJU (\u9280\u884c\u632f\u8fbc / \u30b3\u30f3\u30d3\u30cb\u6c7a\u6e08 c\u1ee7a nhi\u1ec1u shop Shopify chuy\u1ec3n sang \u0111\u00e2y sau khi b\u1ea5m \u4eca\u3059\u3050\u652f\u6255\u3046)
const IS_KOMOJU = /(^|\.)komoju\.com$/.test(HOST);
// kho GM c\u1ee7a Userscripts d\u00f9ng chung cho M\u1eccI trang script ch\u1ea1y -> shop ghi t\u00ean katakana / \u0111i\u1ec7n tho\u1ea1i / m\u00f3n \u0111ang mua,
// trang KOMOJU \u0111\u1ecdc ra (localStorage c\u1ee7a shop th\u00ec komoju.com kh\u00f4ng \u0111\u1ecdc \u0111\u01b0\u1ee3c). Kh\u00f4ng c\u00f3 GM (tr\u00ecnh qu\u1ea3n l\u00fd kh\u00e1c) -> b\u1ecf qua.
const GMS = (typeof GM !== 'undefined' && GM && GM.setValue && GM.getValue) ? GM : null;
const gmSet = (k, v) => { try { if (GMS) GMS.setValue(k, JSON.stringify(v)).catch(() => {}); } catch (e) {} };
const gmGet = async (k) => { try { if (!GMS) return null; const v = await GMS.getValue(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } };
const komojuInfo = (b) => ({ klast: b.klast || '', kfirst: b.kfirst || '', phone: b.phone || '', kstore: b.kstore || 'seven',
  last: b.last || '', first: b.first || '', email: b.email || '', uwh: b.uwh || '', at: Date.now() });
const KSTORES = [['seven', '\u30bb\u30d6\u30f3-\u30a4\u30ec\u30d6\u30f3', /\u30bb\u30d6\u30f3|7-?eleven/i], ['lawson', '\u30ed\u30fc\u30bd\u30f3', /\u30ed\u30fc\u30bd\u30f3|lawson/i], ['family', '\u30d5\u30a1\u30df\u30ea\u30fc\u30de\u30fc\u30c8', /\u30d5\u30a1\u30df\u30ea\u30fc\u30de\u30fc\u30c8|familymart/i],
  ['ministop', '\u30df\u30cb\u30b9\u30c8\u30c3\u30d7', /\u30df\u30cb\u30b9\u30c8\u30c3\u30d7|ministop/i], ['daily', '\u30c7\u30a4\u30ea\u30fc\u30e4\u30de\u30b6\u30ad', /\u30c7\u30a4\u30ea\u30fc|daily/i], ['seico', '\u30bb\u30a4\u30b3\u30fc\u30de\u30fc\u30c8', /\u30bb\u30a4\u30b3\u30fc\u30de\u30fc\u30c8|seicomart/i]];
const SITE_KEY = IS_PAL ? 'pal' : IS_SUP ? 'sup' : IS_HM ? 'hm' : IS_BUF ? 'buf' : IS_VANS ? 'vans' : IS_FEI ? 'fei' : IS_BASE ? 'base' : 'shp';
const SHOP = IS_PAL ? 'PALACE JP' : IS_SUP ? 'Supreme JP' : IS_HM ? 'HUMAN MADE' : IS_BUF ? 'Buffer' : IS_VANS ? 'Vans JP' : IS_FEI ? 'FEILER' : UZURA_CURRENT?.name || HOST.replace(/^www\./, '');
const ON_CHECKOUT = /\/checkouts?\b|\/checkout\//i.test(location.pathname);
const K_CART = 'sxb_cart_snap';             // gi\u1ecf h\u00e0ng l\u00fac v\u00e0o trang thanh to\u00e1n (\u0111\u01a1n kh\u00f4ng qua BOT v\u1eabn c\u00f3 \u1ea3nh + t\u00ean m\u00f3n)
const K_LAST = 'sxb_last';
if (IS_PAL && ON_CHECKOUT) gmGet('uzura_palace_last').then(v => { if(v && Date.now()-v.at<3*3600e3) localStorage.setItem(K_LAST,JSON.stringify(v)); });                  // m\u00f3n v\u1eeba th\u00eam gi\u1ecf -> b\u00e1o Discord khi thanh to\u00e1n xong
// th\u00f4ng tin giao h\u00e0ng / th\u1ebb / c\u00e1ch thanh to\u00e1n c\u1ee7a t\u1eebng shop (ch\u1ec9 l\u01b0u tr\u00ean m\u00e1y n\u00e0y)
const K_BUY = 'sxb_' + SITE_KEY + '_buy';
const PAYS = {
  card: ['\u30af\u30ec\u30b8\u30c3\u30c8\u30ab\u30fc\u30c9', 'Th\u1ebb t\u00edn d\u1ee5ng', /^basic-creditCards$|\u30af\u30ec\u30b8\u30c3\u30c8|credit/i],
  cod: ['\u4ee3\u91d1\u5f15\u63db', '\u4ee3\u91d1\u5f15\u63db (tr\u1ea3 khi nh\u1eadn)', /\u4ee3\u91d1\u5f15\u63db|\u4ee3\u5f15|cash on delivery|\bcod\b|paymentOnDelivery/i],
  konbini: ['\u30b3\u30f3\u30d3\u30cb\u6c7a\u6e08', '\u30b3\u30f3\u30d3\u30cb\u6c7a\u6e08 (konbini)', /\u30b3\u30f3\u30d3\u30cb|konbini|convenience/i],
  bank: ['\u9280\u884c\u632f\u8fbc', '\u9280\u884c\u632f\u8fbc (chuy\u1ec3n kho\u1ea3n)', /\u9280\u884c\u632f\u8fbc|\u632f\u8fbc|bank/i],
};
// webhook ri\u00eang + c\u00e1ch thanh to\u00e1n v\u1eeba d\u00f9ng (\u0111\u1ecdc l\u00fac b\u00e1o Discord)
function emailUsed() {
  try { const u = JSON.parse(localStorage.getItem('sxb_pay_used')); if (u && u.email && Date.now() - u.at < 3 * 3600e3) return u.email; } catch (e) {}
  return (buyInfo().email || '').trim();
}
const buyInfo = () => { try { return JSON.parse(localStorage.getItem(K_BUY)) || {}; } catch (e) { return {}; } };
function payUsed() {
  try { const u = JSON.parse(localStorage.getItem('sxb_pay_used')); if (u && Date.now() - u.at < 3 * 3600e3) return u.label; } catch (e) {}
  const b = buyInfo(); return PAYS[b.pay || 'card'] ? PAYS[b.pay || 'card'][0] : '';
}
const orderFresh = (v) => !!(v && v.items && v.items.length && Date.now() - v.at < 3 * 3600e3);
const cartSnap = () => { try { const v = JSON.parse(localStorage.getItem(K_CART)); return orderFresh(v) ? v : null; } catch (e) { return null; } };
// M\u00f3n c\u1ee7a \u0111\u01a1n: \u01b0u ti\u00ean m\u00f3n BOT v\u1eeba th\u00eam gi\u1ecf, kh\u00f4ng c\u00f3 th\u00ec l\u1ea5y gi\u1ecf h\u00e0ng \u0111\u00e3 l\u01b0u \u1edf trang thanh to\u00e1n; m\u00f3n thi\u1ebfu \u1ea3nh l\u1ea5y \u1ea3nh t\u1eeb gi\u1ecf \u0111\u00e3 l\u01b0u
function orderSource(last) {
  const snap = cartSnap();
  if (!orderFresh(last)) return snap;
  if (!snap) return last;
  return { ...last, items: last.items.map((it) => {
    if (it.image) return it;
    const m = snap.items.find((x) => x.url === it.url || x.title === it.title);
    return m ? { ...it, image: m.image } : it;
  }) };
}
// l\u01b0u gi\u1ecf h\u00e0ng hi\u1ec7n t\u1ea1i (Shopify /cart.js); \u0111\u01a1n \u0111\u1eb7t xong gi\u1ecf r\u1ed7ng -> gi\u1eef b\u1ea3n \u0111\u00e3 l\u01b0u
async function saveCartSnap() {
  try {
    const r = await fetch(shopPath('cart.js'), { credentials: 'same-origin', headers: { accept: 'application/json' } });
    if (!r.ok) return false;
    const c = await r.json();
    if (!c || !c.items || !c.items.length) return false;
    localStorage.setItem(K_CART, JSON.stringify({ site: HOST, at: Date.now(), items: c.items.map((x) => ({
      title: x.product_title || x.title || '', url: new URL(x.url || '/', location.origin).href, image: synovaThumb(x.image || (x.featured_image && x.featured_image.url)),
      size: x.variant_title || '-', price: IS_GEN && c.currency ? new Intl.NumberFormat('ja-JP', { style: 'currency', currency: c.currency }).format((x.final_price != null ? x.final_price : x.price || 0) / 100) : '\u00a5' + Math.round((x.final_price != null ? x.final_price : x.price || 0) / 100).toLocaleString('ja-JP'), qty: x.quantity })) }));
    return true;
  } catch (e) { return false; }
}
const orderEmbeds = (last) => {
  const src = orderSource(last);
  const shopName = pageShopName() || SHOP;
  const siteLabel = /(^|\.)shopify\.com$/.test(HOST) ? shopName + " (" + HOST + ")" : HOST;
  return src
    ? src.items.map((it) => ({ author: '\u2705 Checkout Successful', title: it.title, url: it.url, thumb: it.image || synovaPageImg(), site: src.site,
      fields: [['Size', it.size], ['\u4fa1\u683c', it.price], ['Quantity', it.qty], ['\u652f\u6255\u3044\u65b9\u6cd5', payUsed()], ['Site', src.site, false]] }))
    : [{ author: '\u2705 Checkout Successful', title: shopName, url: location.origin, thumb: synovaPageImg(), fields: [['\u652f\u6255\u3044\u65b9\u6cd5', payUsed()], ['Site', siteLabel, false]] }];
};
function pageShopName() {
  if (!/(^|\.)shopify\.com$/.test(HOST)) return '';
  const parts = (document.title || '').split(/\s[-\u2013|\u30fb]\s/).map((x) => x.trim()).filter(Boolean);
  return parts.find((x) => !/thank|\u3042\u308a\u304c\u3068\u3046|\u6ce8\u6587|order|checkout|\u30c1\u30a7\u30c3\u30af\u30a2\u30a6\u30c8|confirm|\u78ba\u8a8d/i.test(x)) || '';
}
const PREFS = ['\u5317\u6d77\u9053', '\u9752\u68ee\u770c', '\u5ca9\u624b\u770c', '\u5bae\u57ce\u770c', '\u79cb\u7530\u770c', '\u5c71\u5f62\u770c', '\u798f\u5cf6\u770c', '\u8328\u57ce\u770c', '\u6803\u6728\u770c', '\u7fa4\u99ac\u770c', '\u57fc\u7389\u770c', '\u5343\u8449\u770c', '\u6771\u4eac\u90fd', '\u795e\u5948\u5ddd\u770c',
  '\u65b0\u6f5f\u770c', '\u5bcc\u5c71\u770c', '\u77f3\u5ddd\u770c', '\u798f\u4e95\u770c', '\u5c71\u68a8\u770c', '\u9577\u91ce\u770c', '\u5c90\u961c\u770c', '\u9759\u5ca1\u770c', '\u611b\u77e5\u770c', '\u4e09\u91cd\u770c', '\u6ecb\u8cc0\u770c', '\u4eac\u90fd\u5e9c', '\u5927\u962a\u5e9c', '\u5175\u5eab\u770c', '\u5948\u826f\u770c',
  '\u548c\u6b4c\u5c71\u770c', '\u9ce5\u53d6\u770c', '\u5cf6\u6839\u770c', '\u5ca1\u5c71\u770c', '\u5e83\u5cf6\u770c', '\u5c71\u53e3\u770c', '\u5fb3\u5cf6\u770c', '\u9999\u5ddd\u770c', '\u611b\u5a9b\u770c', '\u9ad8\u77e5\u770c', '\u798f\u5ca1\u770c', '\u4f50\u8cc0\u770c', '\u9577\u5d0e\u770c', '\u718a\u672c\u770c', '\u5927\u5206\u770c',
  '\u5bae\u5d0e\u770c', '\u9e7f\u5150\u5cf6\u770c', '\u6c96\u7e04\u770c'];

// ===================== Khung BOT (m\u1ecdi trang, tr\u1eeb trang thanh to\u00e1n) =====================
async function feiPref(c, current = () => true) {
  const zip = String((c && c.zip) || '').replace(/\D/g, '');
  if (!c || c.pref || zip.length !== 7) return (c && c.pref) || '';
  if (!current()) return '';
  try {
    const r = await fetch('/shop/search/lookupzipjson.aspx?zip=' + zip.slice(0, 3) + '-' + zip.slice(3) + '&charset=shift_jis', { credentials: 'same-origin' });
    if (!current()) return '';
    const names = [...new Set(Object.values(JSON.parse(new TextDecoder('shift_jis').decode(await r.arrayBuffer()))).map((x) => x.pref))];
    if (!current()) return '';
    const i = names.length === 1 ? PREFS.indexOf(names[0]) : -1;
    if (i >= 0) {
      c.pref = String(i + 1);
      try { const o = JSON.parse(localStorage.getItem(K_BUY)) || {}; o.pref = c.pref; localStorage.setItem(K_BUY, JSON.stringify(o)); } catch (e) {}
    }
  } catch (e) {}
  return c.pref || '';
}
if (!SYNOVA_DUP && !IN_FRAME && !IS_PCI && !ON_CHECKOUT && !FEI_ORDER && (IS_PAL_STORE || IS_SUP || IS_HM || IS_BUF || BASE_OR_VANS || IS_FEI || IS_GEN)) (function sxbMain() {
  'use strict';
  if (!document.body) { setTimeout(sxbMain, 200); return; }   // v\u00e0i shop d\u1ef1ng trang ch\u1eadm: ch\u01b0a c\u00f3 <body> th\u00ec ch\u1edd

  const WATCH_FROM_SEC = 2;           // b\u1eaft \u0111\u1ea7u qu\u00e9t 2 gi\u00e2y tr\u01b0\u1edbc gi\u1edd m\u1edf (10:59:58)
  // quanh gi\u1edd m\u1edf (-2s \u2192 +30s): c\u1ee9 FAST_MS g\u1eedi 1 l\u01b0\u1ee3t, KH\u00d4NG ch\u1edd l\u01b0\u1ee3t tr\u01b0\u1edbc tr\u1ea3 l\u1eddi (t\u1ed1i \u0111a MAX_INFLIGHT l\u01b0\u1ee3t c\u00f9ng l\u00fac)
  // -> m\u1ea1ng ch\u1eadm (danh s\u00e1ch Supreme ~1MB m\u1ea5t 0,7\u20134 gi\u00e2y) v\u1eabn c\u00f3 k\u1ebft qu\u1ea3 m\u1edbi m\u1ed7i ~0,35 gi\u00e2y. B\u1ecb 429 th\u00ec t\u1ef1 gi\u00e3n.
  const FAST_MS = 200, MAX_INFLIGHT = 5;      // gi\u1edd m\u1edf b\u00e1n: 0,2 gi\u00e2y/l\u01b0\u1ee3t, t\u1ed1i \u0111a 5 l\u01b0\u1ee3t c\u00f9ng l\u00fac
  const NOW_MS = 300, NOW_INFLIGHT = 4;       // "Ch\u1ea1y Ngay" / canh l\u00e2u: 0,3 gi\u00e2y/l\u01b0\u1ee3t, 4 l\u01b0\u1ee3t c\u00f9ng l\u00fac (tr\u01b0\u1edbc: 0,8 gi\u00e2y, ch\u1edd l\u01b0\u1ee3t tr\u01b0\u1edbc xong)
  const FAST_FOR_MS = 30000;
  const minMonitorDelay = IS_PAL || IS_GEN || BASE_OR_VANS ? 1500 : FAST_MS;
  // b\u1ecb 429: nh\u1ecbp t\u1ef1 gi\u00e3n (\u00d71,6 m\u1ed7i l\u1ea7n, t\u1ed1i \u0111a \u00d78), qu\u00e9t \u0111\u01b0\u1ee3c l\u1ea1i th\u00ec nhanh d\u1ea7n v\u1ec1 nh\u1ecbp g\u1ed1c
  let pace = 1;
  const BACKOFF_MIN = 1000, BACKOFF_MAX = 8000;   // 429: ngh\u1ec9 1 \u2192 2 \u2192 4 \u2192 8 gi\u00e2y
  const GIVE_UP_MIN = 15;             // h\u1eb9n gi\u1edd: qu\u00e1 gi\u1edd m\u1edf 15 ph\u00fat ch\u01b0a c\u00f3 h\u00e0ng th\u00ec d\u1eebng
  const MAX_KW = 6, MAX_QTY = 3;
  const K = 'sxb_' + SITE_KEY;
  const K_CFG = K + '_cfg', K_ST = K + '_st', K_UI = K + '_ui', K_LOG = K + '_log';

  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const pad = (n) => String(n).padStart(2, '0');
  const jstNow = () => new Date(Date.now() + 9 * 3600e3);

  // cfg.items: [{kw, color, size, qty}] ; cfg.open: "HH:MM" gi\u1edd Nh\u1eadt ; cfg.grid: link danh s\u00e1ch SFCC
  const cfg = load(K_CFG, { items: [], open: IS_VALLAD_OLD ? '20:00' : '11:00', kwCount: 3 });
  while (cfg.items.length < MAX_KW) cfg.items.push({ kw: '', color: '', size: '', qty: 1 });
  const st = load(K_ST, { active: false });

  function msToOpen() {
    const [h, m] = (cfg.open || '').split(':').map(Number);
    const n = jstNow();
    let t = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), h, m, 0) - n;
    if (t < -GIVE_UP_MIN * 60e3) t += 86400e3;
    return t;
  }

  // ---------- Kh\u1edbp t\u1eeb kh\u00f3a / size ----------
  const norm = (s) => (s || '').normalize('NFKC').toLowerCase();
  // b\u1ecf \u00ae\u2122\u00a9 v\u00e0 d\u1ea5u c\u00e2u: "Faux Fur WINDSTOPPER\u00ae Vest" -> "faux fur windstopper vest"
  const words = (s) => norm(s).replace(/[\u00ae\u2122\u00a9]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  // sai/thi\u1ebfu 1 k\u00fd t\u1ef1 v\u1edbi ch\u1eef d\u00e0i \u2265 5 v\u1eabn nh\u1eadn (windstoper, polatec\u2026)
  function near(a, b) {
    if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0, j = 0, diff = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++diff > 1) return false;
      if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
    }
    return diff + (a.length - i) + (b.length - j) <= 1;
  }
  // T\u1eeb kh\u00f3a: c\u00e1ch nhau d\u1ea5u c\u00e1ch = ph\u1ea3i c\u00f3 T\u1ea4T C\u1ea2 c\u00e1c ch\u1eef, th\u1ee9 t\u1ef1 n\u00e0o c\u0169ng \u0111\u01b0\u1ee3c, vi\u1ebft t\u1eaft / thi\u1ebfu \u00ae / hoa th\u01b0\u1eddng \u0111\u1ec1u \u0111\u01b0\u1ee3c.
  //   "faux fur" -> Faux Fur WINDSTOPPER\u00ae Vest ; "polartec jacket" -> Spellout Embroidered Polartec\u00ae Jacket
  //   "tshirt" kh\u1edbp "T-Shirt" (b\u1ecf d\u1ea5u c\u00e1ch / g\u1ea1ch n\u1ed1i khi so) ; ch\u1eef \u2265 5 k\u00fd t\u1ef1 sai 1 k\u00fd t\u1ef1 v\u1eabn kh\u1edbp
  function match(text, kw) {
    const t = words(text), flat = t.replace(/ /g, ''), tw = t.split(' ');
    const ws = words(kw).split(' ').filter(Boolean);
    return ws.length > 0 && ws.every((w) => t.includes(w) || flat.includes(w) || (w.length >= 5 && tw.some((x) => near(x, w))));
  }
  // \u00f4 M\u00e0u: "black" kh\u1edbp Black ; "black,white" = \u01b0u ti\u00ean theo th\u1ee9 t\u1ef1 ; tr\u1ed1ng = m\u00e0u n\u00e0o c\u0169ng \u0111\u01b0\u1ee3c
  const wantColors = (s) => (s || '').split(BASE_OR_VANS ? /[&＆,、/|]/ : /[,\u3001/|]/).map((x) => words(x)).filter(Boolean);
  const colorOk = (val, want) => { const v = words(val); return v === want || v.includes(want) || v.replace(/ /g, '').includes(want.replace(/ /g, '')); };
  const RANDOM = ['', 'random', 'any', '\u30e9\u30f3\u30c0\u30e0', '*', 'all', 'free'];
  const SZ = { '2xlarge':'xxlarge', 'onesize':'onesize', 'os':'onesize', xs: 'xsmall', s: 'small', m: 'medium', l: 'large', xl: 'xlarge', xxl: 'xxlarge', '2xl': 'xxlarge', xxxl: 'xxxlarge', '3xl': 'xxxlarge' };
  const sz = (s) => norm(s).replace(/[\s\-_.]/g, '');
  // "M" kh\u1edbp "Medium" (Supreme) v\u00e0 "2(M)" (HUMAN MADE / Buffer); "2" kh\u1edbp "2(M)"
  function sizeOk(val, want) {
    if (BASE_OR_VANS) {
      const request = norm(want).trim().match(/^(?:(us|jp)\s*)?(\d+(?:\.\d+)?)(?:\s*(cm))?$/);
      if (request) {
        const label = norm(val).trim();
        const unit = request[1];
        if (unit === 'us' && request[3]) return false;
        const numeric = unit === 'us'
          ? label.match(/\bus\s*(\d+(?:\.\d+)?)(?![\w.])/)
          : label.match(/\bjp\s*(\d+(?:\.\d+)?)(?![\w.])/) ||
            label.match(/\b(\d+(?:\.\d+)?)\s*cm\b/);
        if (numeric) return Number(numeric[1]) === Number(request[2]);
        const bare = label.match(/^(\d+(?:\.\d+)?)$/);
        if (bare) return unit !== 'us' && Number(bare[1]) === Number(request[2]);
        if (unit || request[3] || /\d\.\d/.test(label)) return false;
      }
    }
    const v = sz(val), w = sz(want);
    if (!w || v === w || (SZ[v] || v) === (SZ[w] || w)) return true;
    const inner = (v.match(/\(([^)]+)\)/) || [])[1];
    if (inner && (inner === w || (SZ[inner] && SZ[inner] === SZ[w]))) return true;
    return v.split('(')[0] === w;
  }
  // \u00f4 Size: "M,L" = \u01b0u ti\u00ean theo th\u1ee9 t\u1ef1 ; tr\u1ed1ng / random = size n\u00e0o c\u00f2n c\u0169ng \u0111\u01b0\u1ee3c
  const wantSizes = (s) => { const p = (s || '').split(BASE_OR_VANS ? /[&＆,、/|]/ : /[,\u3001/|]/).map((x) => x.trim()).filter(Boolean); return p.length && !p.some((x) => RANDOM.includes(sz(x))) ? p : null; };
  function pickSize(opts, want) {             // opts: [{size, ok}] -> ch\u1ecdn 1 c\u00e1i c\u00f2n h\u00e0ng
    const avail = opts.filter((o) => o.ok);
    if (!avail.length) return null;
    const ws = wantSizes(want);
    if (!ws) return avail[Math.floor(Math.random() * avail.length)];
    const matches = (option, size) => sizeOk(option.size, size) ||
      (BASE_OR_VANS && option.label && sizeOk(option.label, size));
    if (BASE_OR_VANS && /[&＆]/.test(want)) return rnd(avail.filter(x => ws.some(w => matches(x, w)))) || null;
    for (const w of ws) { const o = avail.find((x) => matches(x, w)); if (o) return o; }
    return null;
  }

  // ---------- Th\u1ed1ng k\u00ea / tr\u1ea1ng th\u00e1i ----------
  const stats = { req: 0, ok: 0, r429: 0, err: 0 };
  let kwStat = [], adding = false, backoffUntil = 0, hits429 = 0, cfHits = 0;
  function retryAfterSeconds(response) {
    const value = (response.headers.get('Retry-After') || '').trim();
    if (/^\d+$/.test(value)) return Number(value);
    const date = Date.parse(value);
    return Number.isFinite(date) ? Math.max(0, (date - Date.now()) / 1000) : 0;
  }
  class Http429 extends Error { constructor(ra) { super('429'); this.retryAfter = ra; } }
  class Blocked extends Error { constructor(m) { super(m); this.blocked = true; } }

  async function get(url, opt) {
    stats.req++;
    const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 8000);
    try {
      const r = await fetch(url, { cache: 'no-store', credentials: 'same-origin', signal: ac.signal, ...(opt || {}) });
      if (r.status === 429) { stats.r429++; throw new Http429(retryAfterSeconds(r)); }
      if (/queue-it\.net/.test(r.url)) throw new Blocked('Queue-it');
      const t = await r.text();
      if ((r.status === 403 || r.status === 503) && /Just a moment|cf-chl|challenge-platform|Access denied/i.test(t)) throw new Blocked('Cloudflare ' + r.status);
      stats.ok++;
      return { status: r.status, text: t };
    } catch (e) {
      if (!(e instanceof Http429) && !(e instanceof Blocked)) stats.err++;
      throw e.name === 'AbortError' ? new Error(L('\u5fdc\u7b54\u306a\u3057(8\u79d2)', 'kh\u00f4ng ph\u1ea3n h\u1ed3i (8 gi\u00e2y)')) : e;
    } finally { clearTimeout(tm); }
  }

  // ===================== Supreme (Shopify) =====================
  // /products.json, /products/x.js b\u1ecb ch\u1eb7n (403) -> \u0111\u1ecdc JSON n\u1eb1m s\u1eb5n trong HTML:
  //   /collections/all  : <script id="products-json"> (m\u1ecdi m\u00f3n, ~1MB)
  //   /products/<handle>: <script id="product-<handle>-json"> (1 m\u00f3n, ~65KB) -> d\u00f2 nhanh m\u00f3n \u0111\u00e3 kh\u1edbp t\u1eeb kh\u00f3a
  const sup = {
    focus: [], round: 0,
    cut(html, id) {
      const a = html.indexOf(`id="${id}">`);
      if (a < 0) return null;
      const s = a + id.length + 6, e = html.indexOf('</script>', s);
      try { return JSON.parse(html.slice(s, e)); } catch (x) { return null; }
    },
    conv(p) {
      return {
        key: p.handle, name: p.title + (p.color ? ' - ' + p.color : ''), text: p.title + ' ' + (p.color || ''), color: p.color || '',
        url: location.origin + '/products/' + p.handle, image: (p.image || '').replace(/^\/\//, 'https://'),
        limit: p.product_order_limit || 0,
        variants: (p.variants || []).map((v) => ({ id: v.id, size: v.title || v.option1 || '-', ok: !!v.available, price: v.price })),
      };
    },
    async list() {
      this.round++;
      // m\u00f3n \u0111\u00e3 kh\u1edbp t\u1eeb kh\u00f3a: 2/3 l\u01b0\u1ee3t ch\u1ec9 t\u1ea3i trang m\u00f3n \u0111\u00f3 (nh\u1eb9 ~15 l\u1ea7n), 1/3 l\u01b0\u1ee3t t\u1ea3i c\u1ea3 danh s\u00e1ch \u0111\u1ec3 th\u1ea5y m\u00f3n m\u1edbi
      if (this.focus.length && this.round % 3) {
        const rs = await Promise.all(this.focus.slice(0, 4).map(async (h) => {
          const r = await get('/products/' + h);
          const p = this.cut(r.text, `product-${h}-json`);
          return p ? this.conv(p) : null;
        }));
        return { products: rs.filter(Boolean), partial: true };
      }
      const r = await get('/collections/all');
      const j = this.cut(r.text, 'products-json');
      if (!j) throw new Error(L('\u5546\u54c1\u30ea\u30b9\u30c8\u3092\u8aad\u3081\u307e\u305b\u3093', 'kh\u00f4ng \u0111\u1ecdc \u0111\u01b0\u1ee3c danh s\u00e1ch SP'));
      return { products: (j.products || []).map((p) => this.conv(p)), partial: false };
    },
    setFocus(keys) { this.focus = keys; },
    async variant(p, want) {
      const o = pickSize(p.variants, want);
      return o ? { id: o.id, size: o.size, price: '\u00a5' + Math.round(o.price / 100).toLocaleString('ja-JP') } : null;
    },
    async add(items) {
      const body = (list) => JSON.stringify({ items: list.map((x) => ({ id: x.id, quantity: x.qty })) });
      const post = (list) => fetch(shopPath('cart/add.js'), { method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: body(list) });
      let r = await post(items);
      if (r.ok) return items;
      const ok = [];
      for (const x of items) {                    // c\u1ea3 l\u00f4 b\u1ecb t\u1eeb ch\u1ed1i (1 m\u00f3n h\u1ebft / qu\u00e1 gi\u1edbi h\u1ea1n) -> th\u00eam l\u1ebb, gi\u1ea3m c\u00f2n 1 c\u00e1i
        for (const q of [...new Set([x.qty, 1])]) {
          r = await post([{ ...x, qty: q }]);
          if (r.ok) { ok.push({ ...x, qty: q }); break; }
          if (q === 1) { const j = await r.json().catch(() => ({})); log(L('\u8ffd\u52a0\u5931\u6557: ', 'Th\u00eam th\u1ea5t b\u1ea1i: ') + x.name.slice(0, 24) + ' ' + (j.description || r.status)); }
        }
      }
      return ok;
    },
    // gi\u1ecf ch\u1ec9 c\u00f2n \u0111\u00fang c\u00e1c m\u00f3n BOT v\u1eeba th\u00eam (\u0111\u00fang s\u1ed1 l\u01b0\u1ee3ng): m\u00f3n kh\u00e1c -> 0, m\u00f3n c\u1ee7a BOT b\u1ecb c\u1ed9ng d\u1ed3n -> v\u1ec1 \u0111\u00fang s\u1ed1
    async prune(ok) {
      const want = new Map(ok.map((x) => [String(x.id), x.qty]));
      const c = await (await fetch(shopPath('cart.js'), { cache: 'no-store', credentials: 'same-origin', headers: { Accept: 'application/json' } })).json();
      const upd = {}, extra = [];
      for (const it of c.items || []) {
        const w = want.get(String(it.variant_id));
        if (w == null) { upd[it.key] = 0; extra.push(it.product_title || it.title); } else if (it.quantity > w) upd[it.key] = w;
      }
      if (Object.keys(upd).length) {
        await fetch(shopPath('cart/update.js'), { method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ updates: upd }) });
      }
      return extra;
    },
    async clearAll() {
      const c = await (await fetch(shopPath('cart.js'), { cache: 'no-store', credentials: 'same-origin', headers: { Accept: 'application/json' } })).json();
      if (!(c.items || []).length) return 0;
      await fetch(shopPath('cart/clear.js'), { method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json' } });
      return c.items.length;
    },
    checkout: '/checkout',
  };

  // ===================== Shop Shopify kh\u00e1c (t\u1ef1 nh\u1eadn) =====================
  // /products.json (250 m\u00f3n m\u1edbi nh\u1ea5t). M\u00f3n \u0111\u00e3 kh\u1edbp t\u1eeb kh\u00f3a: /products/<handle>.js (nh\u1eb9) 2/3 s\u1ed1 l\u01b0\u1ee3t.
  // Shop ch\u1eb7n products.json (VD 403 nh\u01b0 Supreme) -> \u0111\u1ecdc <script id="products-json"> trong /collections/all n\u1ebfu theme c\u00f3.
  const shopifyScope = (() => {
    if (!IS_GEN) return {};
    const path = location.pathname.slice(SHOP_ROOT.length - 1);
    if (HOST === 'jp.stussy.com' && path === '/') return { collection: 'new-arrivals' };
    const product = /^\/(?:collections\/[^/]+\/)?products\/([^/]+)\/?$/i.exec(path);
    const collection = /^\/collections\/([^/]+)\/?$/i.exec(path);
    const decode = (value) => {
      try { return decodeURIComponent(value); } catch { return value; }
    };
    if (product) return { handle: decode(product[1]) };
    return { collection: collection ? decode(collection[1]) : UZURA_CURRENT?.collection };
  })();
  const shopifyCatalogPath = shopPath(shopifyScope.collection
    ? 'collections/' + encodeURIComponent(shopifyScope.collection) + '/products.json'
    : 'products.json');
  const shopifyProductPath = handle => shopPath('products/' + encodeURIComponent(handle) + '.js');


 const IS_GR8 = /^(?:www\.)?gr8\.jp$/.test(HOST);
 function decodeGr8Product(source) {
  const marker=/window\.__remixContext\s*=\s*/g.exec(source);
  if(!marker)throw Error('GR8の商品データがHTMLにありません');
  const raw=source.slice(marker.index+marker[0].length);let depth=0,quote=false,escape=false,end=-1;
  for(let i=0;i<raw.length;i++){const c=raw[i];if(quote){if(escape)escape=false;else if(c.charCodeAt(0)===92)escape=true;else if(c==='"')quote=false;}else if(c==='"')quote=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0){end=i+1;break;}}
  if(end<0)throw Error('GR8の商品データが途中で切れています');
  const data=JSON.parse(raw.slice(0,end));
  const route=Object.values(data.state?.loaderData||{}).find(x=>x?.productData?.productByHandle);
  const product=route?.productData?.productByHandle;
  if(!product?.handle||!Array.isArray(product.variants?.nodes))throw Error('GR8の商品ページを開いてください');
  return product;
 }
 let gr8DataCache=null,gr8ReadPending=null;
 async function gr8ProductData(){
  const path=location.pathname;
  const handle=/^\/products\/([^/]+)\/?$/.exec(path)?.[1];
  if(!handle)throw new Blocked('GR8の商品ページを直接開いて再読み込みしてください。トップ・一覧ページでは開始できません');
  if(gr8DataCache?.path===path&&Date.now()-gr8DataCache.at<5000)return gr8DataCache.product;
  if(gr8ReadPending?.path===path)return gr8ReadPending.promise;
  const promise=(async()=>{
   // Read the current URL rather than stale data left by client-side navigation.
   const r=await get(path,{headers:{Accept:'text/html'}});
   if(r.status!==200)throw new Blocked('GR8の商品ページ取得 HTTP '+r.status);
   const product=decodeGr8Product(r.text);
   if(product.handle!==decodeURIComponent(handle))throw new Blocked('取得した商品が開いているページと一致しません');
   if(location.pathname!==path)throw new Blocked('取得中に商品ページが変わったため停止しました');
   gr8DataCache={path,at:Date.now(),product};return product;
  })();
  gr8ReadPending={path,promise};try{return await promise;}finally{if(gr8ReadPending?.promise===promise)gr8ReadPending=null;}
 }
 // GR8: keep the existing panel; traverse official product pages in this tab.
 const GR8_QUEUE='uzura_gr8_queue_v1',GR8_LOCK='uzura_gr8_lock_v1';
 let gr8Running=false;
 function gr8Queue(){try{return JSON.parse(sessionStorage.getItem(GR8_QUEUE)||'null');}catch{return null;}}
 function gr8Store(q){sessionStorage.setItem(GR8_QUEUE,JSON.stringify(q));}
 function gr8Clear(){
  const q=gr8Queue(),lock=load(GR8_LOCK,null);
  if(q&&lock?.id===q.id)localStorage.removeItem(GR8_LOCK);
  sessionStorage.removeItem(GR8_QUEUE);
 }
 function gr8Own(q){
  const lock=load(GR8_LOCK,null);
  if(!st.active||gr8Queue()?.id!==q.id||lock?.id!==q.id) return false;
  save(GR8_LOCK,{id:q.id,at:Date.now()});return true;
 }
 function decodeGr8Context(source){
  const marker=/window\.__remixContext\s*=\s*/g.exec(source);
  if(!marker)throw Error('GR8のページデータが見つかりません');
  const raw=source.slice(marker.index+marker[0].length);let depth=0,quote=false,escape=false;
  for(let i=0;i<raw.length;i++){
   const c=raw[i];if(quote){if(escape)escape=false;else if(c.charCodeAt(0)===92)escape=true;else if(c==='"')quote=false;}
   else if(c==='"')quote=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0)return JSON.parse(raw.slice(0,i+1));
  }
  throw Error('GR8のページデータが不完全です');
 }
 async function gr8ReadPage(path){
  const r=await get(path,{headers:{Accept:'text/html'}});
  if(r.status!==200)throw Error('GR8ページ取得 HTTP '+r.status);
  return decodeGr8Context(r.text).state?.loaderData||{};
 }
 function gr8Products(data,path){
  const productRoute=Object.values(data).find(x=>x?.productData?.productByHandle);
  if(/^\/products\//.test(path)){
   const p=productRoute?.productData.productByHandle;
   if(!p||p.handle!==decodeURIComponent(path.split('/')[2]))throw Error('GR8の商品ページを確認できません');return [p];
  }
  const collectionRoute=Object.values(data).find(x=>x?.collectionData?.collection);
  const c=collectionRoute?.collectionData.collection;
  if(!c||c.handle!==decodeURIComponent(path.split('/')[2])||!Array.isArray(c.products?.nodes))throw Error('GR8の一覧データを確認できません');
  return c.products.nodes;
 }
 function gr8Pick(products,rows){
  const queue=[],seen=new Set();
  for(const row of rows){
   const kw=row.kw.trim();if(!kw)continue;
   if(Number(row.qty)!==1)throw Error('GR8は各商品の個数を1に設定してください');
   const numeric=/^\d+$/.test(kw);
   if(!numeric&&!row.size.trim())throw Error('GR8はサイズを指定するか、サイズ別IDを入力してください');
   let choices=[];
   for(const p of products){
    if(!numeric&&!match(p.title+' '+p.handle,kw))continue;
    if(!numeric&&row.color.trim()&&!wantColors(row.color).some(c=>colorOk(p.title+' '+(p.description||''),c)))continue;
    const variants=(p.variants?.nodes||[]).filter(v=>numeric?v.id?.split('/').pop()===kw:true);
    const wants=wantSizes(row.size);
    const v=numeric?variants[0]:wants?.map(w=>variants.find(v=>v.selectedOptions?.some(o=>/size|サイズ/i.test(o.name)&&sz(o.value)===sz(w)))).find(Boolean);
    if(v)choices.push({handle:p.handle,id:v.id.split('/').pop(),size:v.selectedOptions?.find(o=>/size|サイズ/i.test(o.name))?.value,name:p.title,qty:1});
   }
   if(choices.length!==1)throw Error('「'+kw+'」に一致する商品・サイズが'+choices.length+'件です。サイズ別IDで指定してください');
   const item=choices[0];
   if(!item.size||!/^\d+$/.test(item.id)||!/^[a-zA-Z0-9_-]+$/.test(item.handle))throw Error('商品の形式が未対応です');
   if(seen.has(item.handle))throw Error('同じ商品は1行だけ指定してください');
   seen.add(item.handle);queue.push(item);
  }
  if(!queue.length)throw Error('対象商品を入力してください');return queue;
 }
 function gr8CartDelta(before,after,item){
  const expected={...before,[item.id]:(before[item.id]||0)+1};
  const keys=new Set([...Object.keys(expected),...Object.keys(after)]);
  return [...keys].every(k=>(expected[k]||0)===(after[k]||0));
 }
 async function gr8Cart(env){
  const id=localStorage.getItem('shopifyCartId');if(!id)return {};
  const domain=new URL(env.SHOPIFY_STORE_DOMAIN);
  if(domain.protocol!=='https:'||domain.hostname!=='gr8888inc.myshopify.com'||!env.STOREFRONT_API_TOKEN)throw Error('GR8のカート確認先を確認できません');
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),10000);
  try{
   // Public Storefront token supplied by this shop. This request only reads cart lines.
   const r=await fetch(domain.origin+'/api/2024-10/graphql.json',{method:'POST',signal:abort.signal,headers:{'Content-Type':'application/json','X-Shopify-Storefront-Access-Token':env.STOREFRONT_API_TOKEN},body:JSON.stringify({query:'query UzuraCartCheck($id: ID!) { cart(id:$id) { lines(first:250) { pageInfo { hasNextPage } nodes { quantity merchandise { ... on ProductVariant { id } } } } } }',variables:{id}})});
   if(!r.ok)throw Error('カート確認 HTTP '+r.status);
   const j=await r.json(),lines=j.data?.cart?.lines;
   if(j.errors?.length||!lines||lines.pageInfo?.hasNextPage)throw Error('カート内容を確認できません');
   const result={};for(const line of lines.nodes){const vid=line.merchandise?.id?.split('/').pop();if(!vid||!Number.isInteger(line.quantity))throw Error('カート形式が未対応です');result[vid]=(result[vid]||0)+line.quantity;}return result;
  }finally{clearTimeout(timer);}
 }
 async function gr8Start(now){
  if(starting||gr8Running)return;starting=true;const epoch=++runGeneration;
  try{
   const lock=load(GR8_LOCK,null);if(lock&&Date.now()-lock.at<30000)throw Error('別タブでGR8を実行中です。先に停止してください');
   gr8Clear();
   const path=location.pathname;
   if(!/^\/(products|collections)\/[^/]+\/?$/.test(path))throw Error('GR8の商品一覧または商品ページで開始してください');
   const data=await gr8ReadPage(path);if(location.pathname!==path)throw Error('ページが変わったため開始を中止しました');
   if(!starting||epoch!==runGeneration)return;
   const items=gr8Pick(gr8Products(data,path),cfg.items.slice(0,cfg.kwCount));
   const q={id:String(Date.now())+'-'+Math.random().toString(36).slice(2),created:Date.now(),source:path,items,index:0,stage:'ready',done:[],skipped:[],started:0};
   gr8Store(q);save(GR8_LOCK,{id:q.id,at:Date.now()});
   st.active=true;st.now=!!now;st.boughtAt=0;save(K_ST,st);keepAwake();
   log('GR8: '+items.length+'商品をKW順に実行します（各1点・決済は手動）');
   gr8Run();
  }catch(e){if(epoch===runGeneration)finish('GR8: '+e.message);}finally{if(epoch===runGeneration)starting=false;}
 }
 async function gr8Run(){
  if(gr8Running)return;gr8Running=true;let q;
  try{
   q=gr8Queue();if(!q)throw Error('一覧ページから改めて開始してください');
   if(Date.now()-q.created>24*3600e3||q.stage==='clicked')throw Error('前回の追加結果が不明です。公式カートを手動で確認してください');
   if(!gr8Own(q))throw Error('別タブでの実行または停止を検出しました');
   if(location.pathname!==q.source&&location.pathname!=='/products/'+q.items[q.index]?.handle)throw Error('実行対象と異なるページに移動したため停止しました');
   while(gr8Own(q)&&!st.now&&msToOpen()>0){setStatus(cfg.open+'（日本時間）まで待機中・GR8 '+q.items.length+'商品');await sleep(500);}
   if(!gr8Own(q))return;
   if(!q.started){q.started=Date.now();gr8Store(q);}
   if(Date.now()-q.started>15*60e3)throw Error('15分経過したため停止しました');
   if(q.index>=q.items.length)return;
   const item=q.items[q.index],path='/products/'+item.handle;
   if(location.pathname!==path){log('GR8: '+(q.index+1)+'/'+q.items.length+' '+item.name+' ['+item.size+'] を開きます');gr8Store(q);location.assign(path);return;}
   // Wait for official controls to hydrate; never replace disabled release buttons.
   const vis=e=>!!e?.getClientRects().length;
   const label=e=>(e?.textContent||'').trim();
   let box;
   for(let i=0;i<40&&gr8Own(q);i++){box=[...document.querySelectorAll('.optionBox button[aria-haspopup="listbox"]')].find(vis);if([...document.querySelectorAll('button.cart-btn')].some(vis))break;await sleep(250);}
   if(!gr8Own(q))return;
   const data=await gr8ReadPage(path);if(!gr8Own(q))return;
   const p=gr8Products(data,path)[0],v=p.variants.nodes.find(v=>v.id.split('/').pop()===item.id);
   if(!v||v.selectedOptions?.find(o=>/size|サイズ/i.test(o.name))?.value!==item.size)throw Error('指定商品・サイズが一致しません');
   const single=p.variants.nodes.length===1&&p.variants.nodes[0].id.split('/').pop()===item.id;
   const sizeConfirmed=()=>box?label(box)===item.size:single;
   // Existing cart items must advance even when this product's sale button is disabled.
   await sleep(1500);if(!gr8Own(q))return;
   const env=data.root?.ENV;if(!env)throw Error('公式カート情報を読み込めません');
   let before=await gr8Cart(env);if(!gr8Own(q))return;
   if((before[item.id]||0)>=1){log('GR8: '+item.name+' ['+item.size+'] はカート内にあるため追加を省略');q.done.push(item);return gr8Next(q);}
   if(v.availableForSale!==true){log('GR8: '+item.name+' ['+item.size+'] 売り切れのためスキップ');q.skipped.push(item);return gr8Next(q);}
   if(!box&&!single)throw Error('公式のサイズ欄を確認できません');
   if(box&&label(box)!==item.size){box.click();await sleep(250);if(!gr8Own(q))return;const opt=[...document.querySelectorAll('[role="option"]')].find(e=>vis(e)&&label(e)===item.size);if(!opt)throw Error('指定サイズを選択できません');opt.click();await sleep(250);}
   if(!gr8Own(q))return;if(!sizeConfirmed())throw Error('選択したサイズを確認できません');
   const button=[...document.querySelectorAll('button.cart-btn')].find(e=>vis(e)&&!e.disabled&&/カートに(?:追加|入れる)|add to cart/i.test(label(e)));
   if(!button){
    setStatus('GR8: '+item.name+' の公式販売開始を待機中');log('GR8: 公式ボタン待機中（30秒後に再確認）');
    for(let i=0;i<60&&gr8Own(q);i++)await sleep(500);
    if(gr8Own(q))location.reload();return;
   }
   // Refresh the comparison immediately before pressing the official button.
   before=await gr8Cart(env);if(!gr8Own(q))return;
   if((before[item.id]||0)>=1){log('GR8: '+item.name+' ['+item.size+'] はカート内にあるため追加を省略');q.done.push(item);return gr8Next(q);}
   if(button.disabled||!button.isConnected||location.pathname!==path||!sizeConfirmed())throw Error('追加直前に公式画面が変わりました');
   q.stage='clicked';gr8Store(q);log('GR8: '+item.name+' ['+item.size+'] を1点追加中');button.click();
   for(let i=0;i<8&&gr8Own(q);i++){
    await sleep(1500);if(!gr8Own(q))return;
    const after=await gr8Cart(env);if(!gr8Own(q))return;
    if(gr8CartDelta(before,after,item)){log('GR8: カート追加を確認 '+item.name+' ['+item.size+']');q.done.push(item);return gr8Next(q);}
   }
   if(!gr8Own(q))return;
   throw Error('追加結果を確認できません。再送せず、公式カートを手動で確認してください');
  }catch(e){if(!q||gr8Queue()?.id===q.id)finish('GR8: '+e.message);}finally{gr8Running=false;}
 }
 function gr8Next(q){
  if(!gr8Own(q))return;q.index++;q.stage='ready';gr8Store(q);
  if(q.index===q.items.length){finish('GR8: '+q.done.length+'商品をカート確認済み・売り切れ'+q.skipped.length+'商品。内容を確認して手動で決済してください');location.assign('/cart');return;}
  location.assign('/products/'+q.items[q.index].handle);
 }

 async function gr8Add(items) {
  if(items.length!==1 || Number(items[0].qty)!==1) throw new Blocked('GR8は開いている商品の1サイズ・1点に設定してください');
  const epoch=runGeneration,p=await gr8ProductData(),v=p.variants.nodes.find(x=>x.id.split('/').pop()===String(items[0].id));
  if(!v)throw new Blocked('開いている商品に指定IDがありません');
  if(v.selectedOptions.length!==1||!/size|サイズ/i.test(v.selectedOptions[0].name))throw new Blocked('この商品の選択形式は未対応です');
  const current=()=>st.active&&epoch===runGeneration;
  const vis=e=>!!e&&!!e.getClientRects().length;
  const label=e=>(e.textContent||'').trim();
  const size=v.selectedOptions[0].value;
  const box=[...document.querySelectorAll('.optionBox button[aria-haspopup="listbox"]')].find(vis);
  if(!box)throw new Blocked('公式のサイズ選択欄が見つかりません');
  if(label(box)!==size){
   box.click();await sleep(200);if(!current())return [];
   const opt=[...document.querySelectorAll('[role="option"]')].find(e=>vis(e)&&label(e)===size);
   if(!opt)throw new Blocked('指定サイズを選択できません');opt.click();await sleep(200);if(!current())return [];
  }
  if(label(box)!==size)throw new Blocked('サイズ選択結果を確認できません');
  const button=[...document.querySelectorAll('button.cart-btn')].find(e=>vis(e)&&!e.disabled&&/カートに(?:追加|入れる)|add to cart/i.test(label(e)));
  if(!button){log('GR8: 販売開始・公式のカート追加ボタンを待機中');return [];}
  if(!current())return [];
  finish('GR8: 指定サイズ '+size+' の追加ボタンを1回押します。結果は公式カートで確認してください');
  button.click();return [];
 }

  const gen = {
    focus: [], round: 0, mode: 'json', currency: '', ready: null,
    async readCart() {
      const r = await get(shopPath('cart.js'), { headers: { Accept: 'application/json' } });
      if (r.status === 403) throw new Blocked('この店舗のカートへのアクセスが拒否されました');
      if (r.status !== 200) throw new Error('カート情報を取得できません: HTTP ' + r.status);
      let cart;
      try { cart = JSON.parse(r.text); } catch { throw new Error('カートが標準Shopify形式ではありません'); }
      if (!cart || !Array.isArray(cart.items) || !/^[A-Z]{3}$/.test(cart.currency || '')) throw new Error('カート形式・通貨を確認できません');
      this.currency = cart.currency;
      return cart;
    },
    ensureReady() {
      if(IS_GR8){ this.currency="JPY"; return Promise.resolve(); }
      if (!this.ready) this.ready = this.readCart().catch(e => { this.ready = null; throw e; });
      return this.ready;
    },
    conv(p, cents) {
      const opts = (p.options || []).map(o => typeof o === 'string' ? o : o.name || '');
      const ci = opts.findIndex(o => /colou?r|カラー|色/i.test(o));
      const si = opts.findIndex(o => /size|サイズ|寸/i.test(o));
      const im = p.images?.[0]?.src || p.images?.[0] || p.featured_image || p.image?.src || p.image || '';
      if (!p.handle || !p.title || !Array.isArray(p.variants)) throw new Error('商品の形式を確認できません');
      return {
        key: p.handle, name: p.title, text: [p.title, p.product_type, p.vendor, ...(Array.isArray(p.tags) ? p.tags : String(p.tags || '').split(','))].filter(Boolean).join(' '),
        url: location.origin + shopPath('products/' + encodeURIComponent(p.handle)), image: String(im).replace(/^\/\//, 'https://'), limit: 0,
        variants: p.variants.map(v => {
          if (!/^\d+$/.test(String(v.id)) || typeof v.available !== 'boolean') throw new Error('商品のID・在庫形式が未対応です');
          const o = Array.isArray(v.options) ? v.options : [v.option1, v.option2, v.option3];
          const size = si >= 0 ? o[si] : ci >= 0 ? o.filter((x, i) => i !== ci && x).join(' / ') : v.title;
          return { id: v.id, ok: v.available, color: ci >= 0 ? o[ci] || '' : '', size: size || '-', price: cents ? Number(v.price) / 100 : parseFloat(v.price) };
        }),
      };
    },
    async list() {
      if(IS_GR8){
       const p=await gr8ProductData(); this.currency='JPY';
       return {partial:false,products:[{key:p.handle,name:p.title,text:p.title+' '+p.description,url:location.href,image:p.featuredImage?.url||'',limit:1,
        variants:p.variants.nodes.map(v=>({id:v.id.split('/').pop(),ok:v.availableForSale===true,color:'',size:v.selectedOptions.map(o=>o.value).join(' / '),price:Number(v.price.amount)}))}]};
      }

      await this.ensureReady();
      this.round++;
      const { handle: currentProduct, collection } = shopifyScope;
      if (currentProduct || (!collection && this.focus.length && this.round % 3)) {
        const products = [];
        for (const handle of currentProduct ? [currentProduct] : this.focus.slice(0, 4)) {
          const r = await get(shopifyProductPath(handle), { headers: { Accept: 'application/json' } });
          if (r.status === 403) throw new Blocked('商品情報へのアクセスが拒否されました');
          if (r.status === 404) continue;
          if (r.status !== 200) throw new Error('商品情報 HTTP ' + r.status);
          products.push(this.conv(JSON.parse(r.text), true));
        }
        return { products, partial: true };
      }
      if (this.mode === 'json') {
        const r = await get(shopifyCatalogPath + '?limit=250&_=' + Date.now(), { headers: { Accept: 'application/json' } });
        if (collection && r.status === 404) throw new Error('指定のコレクションの商品一覧を取得できません（HTTP 404）');
        if (r.status === 403) throw new Blocked('商品一覧へのアクセスが拒否されました');
        if (r.status === 200) {
          let j; try { j = JSON.parse(r.text); } catch { throw new Error('商品一覧がJSONではありません'); }
          if (!Array.isArray(j.products)) throw new Error('商品一覧の形式が未対応です');
          return { products: j.products.map(p => this.conv(p, false)), partial: false };
        }
        if (r.status !== 404) throw new Error('商品一覧 HTTP ' + r.status);
        this.mode = 'html';
      }
      const r = await get(shopPath('collections/all'));
      if (r.status === 403) throw new Blocked('商品一覧へのアクセスが拒否されました');
      const m = /<script\b[^>]*\bid=["']products-json["'][^>]*>([\s\S]*?)<\/script>/i.exec(r.text);
      if (!m) throw new Error('この店舗の商品一覧は未対応です。商品番号を手動で確認してください');
      const j = JSON.parse(m[1]);
      if (!Array.isArray(j.products)) throw new Error('商品一覧の形式が未対応です');
      return { products: j.products.map(p => this.conv(p, true)), partial: false };
    },
    setFocus(keys) { this.focus = keys; },
    async variant(p, want, kw, wantColor) {
      let vs = p.variants;
      const wc = wantColors(wantColor);
      if (wc.length) {
        if (vs.some(v => v.color)) {
          let f = [];
          for (const w of wc) { f = vs.filter(v => colorOk(v.color, w)); if (f.some(v => v.ok)) break; }
          vs = f;
        } else if (!wc.some(w => colorOk(p.text, w))) return null;
      }
      const o = pickSize(vs, want);
      if (!o) return null;
      const price = Number.isFinite(o.price) && this.currency ? new Intl.NumberFormat('ja-JP', { style: 'currency', currency: this.currency }).format(o.price) : '価格未確認';
      return { id: o.id, size: [o.color, o.size].filter(x => x && x !== '-').join(' / ') || '-', price };
    },
    async add(items) {
      if(IS_GR8)return gr8Add(items);
      await this.ensureReady();
      if (!items.length || !items.every(x => /^\d+$/.test(String(x.id)) && Number.isInteger(Number(x.qty)) && Number(x.qty) > 0)) throw new Error('商品ID・数量を確認してください');
      let r; try { r = await fetch(shopPath('cart/add.js'), { method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ items: items.map(x => ({ id: x.id, quantity: Number(x.qty) })) }) }); } catch { throw new Blocked('通信結果が不明です。再実行せずカートを手動で確認してください'); }
      if (r.status === 403) throw new Blocked('カートへのアクセスが拒否されました');
      if (r.status === 429) throw new Http429(retryAfterSeconds(r));
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        try { await this.confirmCart([]); }
        catch { throw new Blocked('カート追加の結果を確認できません。再実行せずカートを手動で確認してください'); }
        throw new Error('カート追加失敗: ' + (j.description || j.message || r.status));
      }
      let j; try { j = await r.json(); } catch { throw new Blocked('追加結果を確認できません。再実行せずカートを手動で確認してください'); }
      const added = Array.isArray(j.items) ? j.items : [j];
      if (!items.every(x => added.some(a => String(a.id || a.variant_id) === String(x.id) && Number(a.quantity) === Number(x.qty)))) throw new Blocked('追加された商品・数量を確認できません。カートを手動で確認してください');
      return items;
    },
    async confirmCart(items) {
      const cart = await this.readCart();
      const wanted = new Map(items.map(item => [String(item.id), Number(item.qty)]));
      if (cart.items.length !== wanted.size || cart.items.some(item => {
        const id = String(item.variant_id ?? item.id);
        if (wanted.get(id) !== Number(item.quantity)) return true;
        wanted.delete(id);
        return false;
      })) throw new Error('カートの商品・数量が指定と一致しません。カートを手動で確認してください');
    },
    async clearAll() {
      if(IS_GR8)return 0;
      await this.ensureReady();
      const count = await sup.clearAll();
      await this.confirmCart([]);
      return count;
    },
    checkout: shopPath('checkout'),
  };

  // ===================== HUMAN MADE / Buffer (Salesforce Commerce Cloud) =====================
  const SITE_ID = IS_HM ? 'HUMANMADE' : IS_VANS ? 'vns-jp' : 'BUFFER';
  const C = `/on/demandware.store/Sites-${SITE_ID}-Site/ja_JP`;
  const sfcc = {
    focus: [], round: 0, info: {},
    gridUrl() {
      const u = cfg.grid || (IS_VANS ? `${C}/Search-UpdateGrid?srule=new-arrival&q=` : `${C}/Search-UpdateGrid?cgid=all`);
      return u.replace(/([?&])(start|sz)=\d+/g, '$1').replace(/[?&]+$/, '') + (u.includes('?') ? '&' : '?') + 'start=0&sz=48';
    },
    async list() {
      this.round++;
      if (this.focus.length && this.round % 3) return { products: this.focus.map((k) => this.info[k]).filter(Boolean), partial: true };
      const r = await get(this.gridUrl(), { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
      if (IS_VANS && r.status === 404 && !cfg.grid) return { products: [], partial: false };
      if (r.status >= 400) throw new Error('HTTP ' + r.status);
      const d = new DOMParser().parseFromString(r.text, 'text/html');
      const out = [];
      for (const el of d.querySelectorAll('.product[data-pid]')) {
        const tile = el.querySelector('.product-tile') || el;
        let name = '';
        try { name = JSON.parse(tile.getAttribute('data-gtm') || '{}').name || ''; } catch (e) {}
        if (!name) name = (el.querySelector('.pdp-link a, .product-name, img[alt]') || {}).textContent || (el.querySelector('img[alt]') || {}).alt || '';
        const a = el.querySelector('a[href]');
        const img = el.querySelector('img[src], source[srcset]');
        const so = el.querySelector('.sold-out-overlay');
        const p = {
          key: el.getAttribute('data-pid'), name: name.trim(), text: name,
          url: a ? new URL(a.getAttribute('href'), location.origin).href : location.origin,
          image: img ? (img.getAttribute('src') || (img.getAttribute('srcset') || '').split(' ')[0]) : '',
          soldOut: !!(so && !so.classList.contains('d-none')),
        };
        this.info[p.key] = p;
        out.push(p);
      }
      if (!out.length) throw new Error(L('\u5546\u54c1\u30ea\u30b9\u30c8\u304c\u7a7a\u3067\u3059\uff08\u4e00\u89a7\u30da\u30fc\u30b8\u3092\u958b\u3044\u3066\u304b\u3089\u958b\u59cb\uff09', 'danh s\u00e1ch tr\u1ed1ng (m\u1edf trang danh s\u00e1ch SP r\u1ed3i m\u1edbi B\u1eadt)'));
      return { products: out, partial: false };
    },
    setFocus(keys) { this.focus = keys; },
    async pv(master, color, size) {
      let q = `pid=${encodeURIComponent(master)}&quantity=1`;
      if (color) q += `&dwvar_${master}_color=${encodeURIComponent(color)}`;
      if (size) q += `&dwvar_${master}_size=${encodeURIComponent(size)}`;
      const r = await get(`${C}/Product-Variation?${q}`, { headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' } });
      let j;
      try { j = JSON.parse(r.text); } catch (e) { throw new Error(L('\u5728\u5eabAPI\u306e\u5fdc\u7b54\u304c\u4e0d\u6b63', 'API kho tr\u1ea3 kh\u00f4ng ph\u1ea3i JSON')); }
      return j;
    },
    attr: {},
    // Product-Variation: ch\u1ecdn m\u00e0u (\u00f4 M\u00e0u / ch\u1eef trong t\u1eeb kh\u00f3a / m\u00e0u \u0111ang ch\u1ecdn) + size c\u00f2n h\u00e0ng -> m\u00e3 bi\u1ebfn th\u1ec3.
    // L\u1ea7n \u0111\u1ea7u h\u1ecfi 2 l\u1ea7n (danh s\u00e1ch m\u00e0u/size, r\u1ed3i bi\u1ebfn th\u1ec3); c\u00e1c l\u01b0\u1ee3t sau nh\u1edb danh s\u00e1ch n\u00ean h\u1ecfi th\u1eb3ng bi\u1ebfn th\u1ec3 = 1 l\u1ea7n.
    async variant(p, want, kw, wantColor) {
      let attrs = this.attr[p.key];
      if (!attrs) {
        const pr = (await this.pv(p.key)).product || {};
        if (pr.LotteryExclusive) { p.lottery = true; return null; }
        attrs = {};
        for (const a of pr.variationAttributes || []) attrs[a.id] = a.values || [];
        this.attr[p.key] = attrs;
      }
      const colors = (attrs.color || []).filter((v) => v.selectable !== false);
      const kwn = words(kw), wc = wantColors(wantColor);
      let color;
      if (wc.length) {                               // \u00f4 M\u00e0u: theo th\u1ee9 t\u1ef1 \u01b0u ti\u00ean, kh\u00f4ng c\u00f3 m\u00e0u n\u00e0o kh\u1edbp -> b\u1ecf m\u00f3n n\u00e0y
        for (const w of wc) { const c = colors.find((v) => colorOk(v.displayValue || v.value, w) || colorOk(v.value, w)); if (c) { color = c.value; break; } }
        if (!color && (attrs.color || []).length) return null;
      } else color = (colors.find((v) => kwn.includes(words(v.displayValue || v.value))) || colors.find((v) => v.selected) || colors[0] || {}).value;
      const sizeList = (a) => (a.size || []).map((v) => ({ size: IS_VANS ? v.displayValue || v.value : v.value, value: v.value, label: v.displayValue || v.value, ok: v.selectable !== false }));
      let sizes = sizeList(attrs), size = '';
      // size \u0111o\u00e1n tr\u01b0\u1edbc theo l\u1ea7n h\u1ecfi g\u1ea7n nh\u1ea5t (k\u1ec3 c\u1ea3 size \u0111ang h\u1ebft: c\u00f3 th\u1ec3 v\u1eeba c\u00f3 l\u1ea1i)
      if (sizes.length) { const o = pickSize(sizes, want) || pickSize(sizes.map((x) => ({ ...x, ok: true })), want); if (!o) return null; size = o.value; }
      let v = (await this.pv(p.key, color, size)).product || {};
      if (v.LotteryExclusive) { p.lottery = true; return null; }
      const fresh = {};
      for (const a of v.variationAttributes || []) fresh[a.id] = a.values || [];
      if (Object.keys(fresh).length) this.attr[p.key] = fresh;
      const ready = (x) => x.id && !(x.id === p.key && sizes.length) && x.available && x.orderable !== false && x.readyToOrder !== false;
      if (!ready(v) && sizes.length) {                // size \u0111o\u00e1n \u0111\u00e3 h\u1ebft -> ch\u1ecdn size kh\u00e1c \u0111ang c\u00f2n theo k\u1ebft qu\u1ea3 m\u1edbi
        const o = pickSize(sizeList(fresh), want);
        if (!o || o.value === size) return null;
        size = o.value;
        v = (await this.pv(p.key, color, size)).product || {};
      }
      if (!v.id || v.id === p.key && sizes.length) return null;
      const sell = v.sellStartDate ? Date.parse(v.sellStartDate) : 0;
      if (sell && sell > Date.now() + 3000) { p.notYet = true; return null; }
      if (!(v.available && v.orderable !== false && v.readyToOrder !== false)) return null;
      p.notYet = false;
      return { id: v.id, size: [color, size].filter(Boolean).join(' / ') || '-', limit: v.purchaseQtyLimitProduct || v.maxOrderQuantity || 0,
        price: (v.price && v.price.sales && v.price.sales.formatted) || '' };
    },
    async add(items) {
      const ok = [];
      await Promise.all(items.map(async (x) => {     // nhi\u1ec1u m\u00f3n: g\u1eedi c\u00f9ng l\u00fac
        for (const q of [...new Set([x.qty, 1])]) {
          const r = await fetch(`${C}/Cart-AddProduct`, { method: 'POST', credentials: 'same-origin',
            headers: { 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', Accept: 'application/json' },
            body: new URLSearchParams({ pid: x.id, quantity: String(q), options: '[]' }) });
          const j = await r.json().catch(() => ({ error: true, message: 'HTTP ' + r.status }));
          if (r.ok && !j.error) { ok.push({ ...x, qty: q }); if (j.cart) this.lastCart = j.cart; break; }
          if (q === 1) log(L('\u8ffd\u52a0\u5931\u6557: ', 'Th\u00eam th\u1ea5t b\u1ea1i: ') + x.name.slice(0, 24) + ' ' + (j.message || r.status));
        }
      }));
      return ok;
    },
    // d\u00f2ng trong gi\u1ecf: [{pid, uuid, qty, name, removeUrl}] \u2014 \u0111\u1ecdc trang /cart/ ng\u1ea7m (n\u00fat xo\u00e1 c\u00f3 data-action / pid / uuid)
    async lines() {
      const r = await fetch('/cart/', { cache: 'no-store', credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } });
      const d = new DOMParser().parseFromString(await r.text(), 'text/html');
      const seen = new Set(), out = [];
      for (const b of d.querySelectorAll('button.remove-product, .remove-product')) {
        const k = b.dataset.uuid || b.dataset.pid;
        if (!b.dataset.action || !b.dataset.pid || seen.has(k)) continue;
        seen.add(k);
        out.push({ pid: b.dataset.pid, uuid: b.dataset.uuid || '', name: b.dataset.name || b.dataset.pid, removeUrl: b.dataset.action });
      }
      return out;
    },
    async removeLines(ls) {
      await Promise.all(ls.map((x) => fetch(x.removeUrl + (x.removeUrl.includes('?') ? '&' : '?') + 'pid=' + encodeURIComponent(x.pid) + '&uuid=' + encodeURIComponent(x.uuid),
        { credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } })));
    },
    async prune(ok) {
      const want = new Set(ok.map((x) => String(x.id)));
      // nhanh: Cart-AddProduct tr\u1ea3 k\u00e8m gi\u1ecf (cart.items + actionUrls) -> kh\u00f4ng c\u1ea7n t\u1ea3i trang gi\u1ecf
      const c = this.lastCart;
      let ls = null;
      if (c && Array.isArray(c.items) && c.actionUrls && c.actionUrls.removeProductLineItemUrl && ok.every((x) => c.items.some((it) => String(it.id) === String(x.id)))) {
        ls = c.items.map((it) => ({ pid: String(it.id), uuid: it.UUID || '', name: it.productName || it.id, removeUrl: c.actionUrls.removeProductLineItemUrl }));
      } else ls = await this.lines();
      const extra = ls.filter((x) => !want.has(String(x.pid)));
      if (extra.length) await this.removeLines(extra);
      return extra.map((x) => x.name);
    },
    async clearAll() {
      const ls = await this.lines();
      if (ls.length) await this.removeLines(ls);
      return ls.length;
    },
    checkout: '/checkout/',
  };

  // Palace Hydrogen / React Router data adapter. Never evaluate page scripts.
  function decodePalace(html) {
    const m = /streamController\.enqueue\(("(?:[^"\\]|\\.)*")\)/.exec(html);
    if (!m) throw new Error('Palaceの商品データ形式を確認できません');
    const arr=JSON.parse(JSON.parse(m[1]));
    if(!Array.isArray(arr))throw new Error('Palaceデータ形式が不正です');
    const memo=new Map();
    function dec(i){
      if(typeof i!=='number')return i;
      if(i<0)return null;
      if(i>=arr.length)throw new Error('Palaceデータの参照が不正です');
      if(memo.has(i))return memo.get(i);
      const v=arr[i];
      if(Array.isArray(v)){
        if(typeof v[0]==='string')return null;
        const out=[];memo.set(i,out);for(const x of v)out.push(dec(x));return out;
      }
      if(v&&typeof v==='object'){
        const out={};memo.set(i,out);for(const [k,x] of Object.entries(v)){
          const key=arr[Number(k.slice(1))];
          if(typeof key==='string'&&!['__proto__','constructor','prototype'].includes(key))out[key]=dec(x);
        }return out;
      }
      return v;
    }
    return dec(0);
  }
  function palaceProducts(data) {
    const loaders=Object.values(data.loaderData||{}).filter(Boolean);
    const root=data.loaderData?.root;
    if(root?.locale?.country!=='JP'||root?.locale?.currency!=='JPY')throw new Blocked('Palaceが日本向け・円表示ではありません。Japanを選択してください');
    const collection=loaders.find(v=>v.collection?.products)?.collection;
    if(!collection)throw new Error('Palaceの新着一覧がありません');
    const origin=new URL(root.shopifyDomain);
    if(origin.protocol!=='https:'||origin.hostname!=='checkout.jp.palaceskateboards.com')throw new Blocked('Palace日本の購入先ドメインを確認できません。手動で購入してください');
    const products=(collection.products.edges||[]).map(({node:p})=>({
      key:p.handle,name:p.title,text:p.title,color:'',url:'https://jp.palaceskateboards.com/products/'+p.handle,
      image:p.variants?.nodes?.[0]?.image?.url||'',
      variants:(p.variants?.nodes||[]).map(v=>{
        if(v.price?.currencyCode!=='JPY')throw new Blocked('Palace商品の通貨がJPYではありません');
        const opts=v.selectedOptions||[];
        return {id:String(v.id).split('/').pop(),ok:!!v.availableForSale,
          size:opts.find(o=>/size/i.test(o.name))?.value||opts.map(o=>o.value).join(' / ')||'One Size',
          color:opts.find(o=>/colou?r/i.test(o.name))?.value||'',price:Number(v.price.amount)};
      })
    }));
    return {products,checkoutOrigin:origin.origin,nextCursor:collection.products.pageInfo?.hasNextPage?collection.products.pageInfo.endCursor:null};
  }
  const palace = {
    focus:[],checkoutUrl:'',checkoutOrigin:'',
    setFocus(keys){this.focus=keys;},
    async list(){
      const out=[];let cursor='';
      for(let page=0;page<2;page++){
        if(page)await sleep(1500);
        const r=await get('/collections/new'+(cursor?'?direction=next&cursor='+encodeURIComponent(cursor):'?_='+Date.now()));
        if(r.status>=400)throw new Blocked('Palace HTTP '+r.status);
        const parsed=palaceProducts(decodePalace(r.text));
        this.checkoutOrigin=parsed.checkoutOrigin;out.push(...parsed.products);
        cursor=parsed.nextCursor;if(!cursor)break;
      }
      return {products:out,partial:false};
    },
    async variant(p,want,kw,color){return gen.variant(p,want,kw,color);},
    async add(items){
      if(!this.checkoutOrigin)throw new Error('Palace購入先が未確認です');
      if(items.some(x=>!/^\d+$/.test(String(x.id))||!Number.isInteger(x.qty)||x.qty<1))throw new Error('商品番号・数量を確認してください');
      this.checkoutUrl=this.checkoutOrigin+'/cart/'+items.map(x=>x.id+':'+x.qty).join(',');
      return items; // The permalink performs cart insertion after navigation, not here.
    },
    async prune(){return [];},async clearAll(){return 0;},
    get checkout(){return this.checkoutUrl;}
  };

  const base = {
    home: null, homeAt: 0, checkout: '',
    idOf(tok) { const t = String(tok || '').trim();
      if (/^\d{5,}$/.test(t)) return t;
      try {
        const url = new URL(t, location.origin);
        return url.origin === location.origin ? (/^\/items\/(\d{5,})\/?$/.exec(url.pathname)?.[1] || '') : '';
      } catch { return ''; } },
    parse(html, id) {
      const fa = html.indexOf('cot-itemOrder-form"');
      if (fa < 0) return null;
      const fs = html.lastIndexOf('<form', fa), fe = html.indexOf('</form>', fa);
      const d = new DOMParser().parseFromString(html.slice(fs, fe > 0 ? fe + 7 : fa + 80000), 'text/html');
      const f = d.querySelector('form.cot-itemOrder-form');
      if (!f) return null;
      const T = (e) => (e && e.textContent || '').replace(/\s+/g, ' ').trim();
      const meta = (pr) => {
        const m = html.match(new RegExp('<meta[^>]+property="' + pr + '"[^>]*content="([^"]*)"'));
        if (!m) return '';
        const t = document.createElement('textarea'); t.innerHTML = m[1]; return t.value;
      };
      const title = (meta('og:title') || '').replace(/\s*\|[^|]*$/, '').trim() || ('BASE ' + id);
      const price = (html.match(/cot-money__amount">([\d,]+)</) || [])[1];
      const vars = [...f.querySelectorAll('li.cot-itemOrder-variationLI')].map((li) => {
        const name = T(li.querySelector('.cot-itemOrder-variationName'));
        const b = li.querySelector('.cot-itemOrder-variationSubmit[data-variation-id]');
        const stock = li.querySelector('.cot-itemOrder-variationStock');
        const sold = !b || (stock && (stock.getAttribute('data-type') === 'soldOut' || /\u5728\u5eab\u306a\u3057|SOLD ?OUT|\u58f2\u308a\u5207\u308c/i.test(T(stock))));
        const vid = (b || li.querySelector('[data-variation-id]') || { getAttribute: () => '' }).getAttribute('data-variation-id') || '';
        return { vid, name, size: name.split(/\s*[\/\uff0f]\s*/).pop(), label: name, ok: !sold };
      }).filter((v) => v.vid);
      return {
        id, title, image: meta('og:image'), price: price ? '\u00a5' + price : '', limit: +((html.match(/(\d+)\s*\u70b9\u307e\u3067\u306e\u3054\u6ce8\u6587/) || [])[1] || 0),
        vars, single: !vars.length, singleOk: !vars.length && !!f.querySelector('.cot-itemOrder-submit') && !f.querySelector('#itemUnavailable'),
        lottery: /class="cot-itemAttention__lottery/.test(html), soon: /cot-itemAttention__salesPeriod[^>]*data-status="willStart"/.test(html),
        action: f.getAttribute('action') || '', shopId: f.getAttribute('data-shop-id') || (f.querySelector('[name=shopID]') || {}).value || '',
      };
    },
    async item(id) {
      // 12/11 ch\u1ea1y th\u1eadt: /items/<id> b\u1ecb Cloudflare l\u01b0u \u0111\u1ec7m (s-maxage=20, c\u1ea3 b\u1ea3n STALE; th\u00eam ?query v\u1eabn tr\u00fang \u0111\u1ec7m) -> 20:00 m\u1edf b\u00e1n
      // m\u00e0 BOT th\u1ea5y h\u00e0ng l\u00fac 20:00:28. /items/<id>/ (d\u1ea5u / cu\u1ed1i) lu\u00f4n DYNAMIC = trang m\u1edbi t\u1eeb m\u00e1y ch\u1ee7.
      const r = await get('/items/' + id);
      if (r.status === 404) return { id, gone: true };
      return this.parse(r.text, id) || { id, gone: true };
    },
    // KW l\u00e0 ch\u1eef: t\u00ecm theo t\u00ean trong trang ch\u1ee7 shop (m\u00f3n m\u1edbi nh\u1ea5t), \u0111\u1ecdc l\u1ea1i trang ch\u1ee7 t\u1ed1i \u0111a 10 gi\u00e2y / l\u1ea7n
    async search(kw) {
      if (!this.home || Date.now() - this.homeAt > 10000) {
        const r = await get('/');
        const d = new DOMParser().parseFromString(r.text, 'text/html');
        const m = new Map();
        for (const a of d.querySelectorAll('a[href*="/items/"]')) {
          const id = this.idOf(a.getAttribute('href'));
          const t = [(a.textContent || ''), a.getAttribute('title') || '', (a.querySelector('img[alt]') || {}).alt || ''].join(' ').replace(/\s+/g, ' ').trim();
          if (id && t) m.set(id, ((m.get(id) || '') + ' ' + t).trim());
        }
        this.home = [...m]; this.homeAt = Date.now();
      }
      return this.home.filter(([, t]) => match(t, kw)).map(([id]) => id).slice(0, 3);
    },
    list: async () => ({ products: [], partial: true }),
    setFocus() {},
    // g\u1eedi form th\u00eam gi\u1ecf c\u1ee7a shop -> nh\u1eadn link checkout/bag (ch\u01b0a v\u00e0o gi\u1ecf: trang \u0111\u00f3 m\u1edbi th\u00eam). 1 m\u00f3n / l\u1ea7n.
    async add(items) {
      const x = items[0];
      if (items.length > 1) log(L(`BASE \u306f1\u56de1\u70b9\u306e\u307f\u8cfc\u5165: ${x.name.slice(0, 24)}`, `BASE m\u1ed7i l\u1ea7n ch\u1ec9 mua 1 m\u00f3n: ${x.name.slice(0, 24)}`));
      const action = new URL(x.action || `/cart/add/${x.shopId}`, location.origin);
      if (action.origin !== location.origin || !/^\/cart\/add\/[\w-]+\/?$/.test(action.pathname)) return [];
      const r = await fetch(action, { method: 'POST', credentials: 'same-origin',
        body: new URLSearchParams({ shopID: x.shopId, id: x.itemId, amount: String(x.qty), select: x.vid || '' }) });
      if (r.status === 429) throw new Http429(retryAfterSeconds(r));
      if (!r.ok || new URL(r.url || location.origin).origin !== location.origin || !/\/checkout\/bag\?/.test(r.url)) { log(L('\u8ffd\u52a0\u5931\u6557: ', 'Th\u00eam th\u1ea5t b\u1ea1i: ') + x.name.slice(0, 24) + ' (HTTP ' + r.status + ')'); return []; }
      this.checkout = r.url;
      return [x];
    },
    prune: async () => [],
    clearAll: async () => 0,
  };
  async function baseScan() {
    const rows = cfg.items.slice(0, cfg.kwCount).map((it, i) => ({ ...it, i })).filter((it) => it.kw.trim());
    const RANK = { none: 0, out: 1, soon: 2, lottery: 3 };
    const res = await Promise.all(rows.map(async (it) => {
      let ids = it.kw.split(/[&\uff06,\s]+/).filter(Boolean).map((t) => base.idOf(t));
      if (!ids.length || !ids.every(Boolean)) ids = await base.search(it.kw);
      if (!ids.length) return { it, s: 'none', hit: null };
      const ps = await Promise.all([...new Set(ids)].map((id) => base.item(id)));
      const wc = wantColors(it.color);
      const colorHit = (t) => wc.some((w) => colorOk(t, w));
      const cands = [];
      let s = 'none';
      const up = (x) => { if (RANK[x] > RANK[s]) s = x; };
      for (const p of ps) {
        if (!p || p.gone) continue;
        if (p.lottery) { up('lottery'); continue; }
        if (p.soon) { up('soon'); continue; }
        up('out');
        let opts;
        if (p.single) opts = p.singleOk && (!wc.length || colorHit(p.title)) ? [{ vid: '', size: '-', label: '-', ok: true }] : [];
        else opts = wc.length && !colorHit(p.title) ? p.vars.filter((v) => colorHit(v.name)) : p.vars;
        const o = p.single ? opts[0] : pickSize(opts, it.size);
        if (o) cands.push({ p, o });
      }
      if (!cands.length) return { it, s, hit: null };
      const { p, o } = rnd(cands);
      return { it, s: 'in', hit: { id: p.id + ':' + o.vid, itemId: p.id, vid: o.vid, qty: Math.max(1, p.limit ? Math.min(it.qty, p.limit) : it.qty),
        name: p.title, url: location.origin + '/items/' + p.id, image: p.image, size: o.label || '-', price: p.price, action: p.action, shopId: p.shopId } };
    }));
    const picked = [], stat = [];
    for (const { it, s, hit } of res) {
      if (hit && !picked.some((x) => x.id === hit.id)) picked.push(hit);
      stat.push({ label: `KW${it.i + 1}`, kw: it.kw + (it.color ? ` / ${it.color}` : '') + (it.size ? ` [${it.size}]` : ''), st: hit ? 'in' : s });
    }
    kwStat = stat;
    return picked.slice(0, 1);
  }

  const FEI_MS = 1000;
  // ===================== FEILER (feiler.jp, ecbeing) =====================
  // Kh\u1ea3o s\u00e1t 22/11 (request th\u1eadt, kh\u00f4ng \u0111\u1eb7t h\u00e0ng): trang m\u00f3n /shop/g/g<m\u00e3>/ (Shift_JIS, m\u1ed7i m\u00e0u 1 m\u00e3). C\u00f2n h\u00e0ng = c\u00f3 link
  // /shop/cart/cart.aspx?goods=<m\u00e3>. POST /shop/cart/cart.aspx goods=<m\u00e3> -> tr\u1ea3 trang gi\u1ecf (rowcartN / rowgoodsN / qtyN).
  // POST gi\u1ecf + submit.x -> /shop/order/method.aspx (qu\u00e1 gi\u1edbi h\u1ea1n th\u00ec \u1edf l\u1ea1i gi\u1ecf, b\u00e1o \u300cN\u500b\u307e\u3067\u300d). POST guest.x -> form frmMethod;
  // sau \u0111\u00f3 GET /shop/order/method.aspx v\u1eabn ra form \u0111\u00f3 -> BOT m\u1edf trang n\u00e0y, kh\u1ed1i feiOrder \u0111i\u1ec1n + b\u1ea5m \u300c\u6b21\u3078\u300d.
  // Tr\u1ea1ng th\u00e1i h\u1ebft h\u00e0ng CH\u01afA th\u1ea5y t\u1eadn m\u1eaft (kh\u00f4ng c\u00f3 link th\u00eam gi\u1ecf = coi l\u00e0 h\u1ebft).
  const feiCancelled = () => Object.assign(new Error('停止しました'), { cancelled: true });
  const feiCurrent = (epoch) => { if (!st.active || epoch !== runGeneration) throw feiCancelled(); };
  const fei = {
    checkout: '/shop/order/method.aspx',
    idOf(tok) { const t = String(tok || '').trim(); const m = t.match(/\/g\/g([0-9A-Za-z]{8,})/) || t.match(/^g?([0-9A-Za-z]{12,})$/); return m ? m[1] : ''; },
    // trang ecbeing l\u00e0 Shift_JIS -> t\u1ef1 gi\u1ea3i m\u00e3 (r.text() \u0111\u1ecdc UTF-8 s\u1ebd h\u1ecfng ch\u1eef Nh\u1eadt). D\u1eef li\u1ec7u g\u1eedi \u0111i ch\u1ec9 c\u00f3 m\u00e3 + s\u1ed1 (ASCII).
    async page(url, body, epoch = runGeneration) {
      feiCurrent(epoch);
      stats.req++;
      const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 10000);
      try {
        const r = await fetch(url, { cache: 'no-store', credentials: 'same-origin', signal: ac.signal,
          ...(body == null ? {} : { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }) });
        feiCurrent(epoch);
        if (r.status === 429) { stats.r429++; throw new Http429(parseFloat(r.headers.get('Retry-After')) || 0); }
        // b\u1ecb shop ch\u1eb7n: D\u1eeaNG h\u1eb3n, kh\u00f4ng th\u1eed l\u1ea1i (\u0111i\u1ec1u kho\u1ea3n shop c\u1ea5m n\u00e9 ch\u1eb7n)
        if (r.status === 403) { finish(L('\u30a2\u30af\u30bb\u30b9\u304c\u62d2\u5426\u3055\u308c\u307e\u3057\u305f(403) \u2192 \u505c\u6b62', 'Shop t\u1eeb ch\u1ed1i truy c\u1eadp (403) \u2013 d\u1eebng')); throw new Error('HTTP 403'); }
        const text = new TextDecoder('shift_jis').decode(await r.arrayBuffer());
        feiCurrent(epoch);
        stats.ok++;
        return { status: r.status, url: r.url, text };
      } catch (e) {
        if (!(e instanceof Http429)) stats.err++;
        throw e.name === 'AbortError' ? new Error(L('\u5fdc\u7b54\u306a\u3057(10\u79d2)', 'kh\u00f4ng ph\u1ea3n h\u1ed3i (10 gi\u00e2y)')) : e;
      } finally { clearTimeout(tm); }
    },
    rows(html) {
      return [...html.matchAll(/name="rowcart(\d+)" value="([^"]*)"/g)].map((m) => ({ n: m[1], cart: m[2],
        goods: (html.match(new RegExp('name="rowgoods' + m[1] + '" value="([^"]*)"')) || [])[1] || '',
        qty: +((html.match(new RegExp('name="qty' + m[1] + '" value="([^"]*)"')) || [])[1] || 1) }));
    },
    body(rows, btn, qty) {
      return 'refresh=true&' + rows.map((x) => `rowcart${x.n}=${x.cart}&rowgoods${x.n}=${x.goods}&qty${x.n}=${(qty && qty[x.goods]) || x.qty}`).join('&') +
        (btn ? `&${btn}.x=10&${btn}.y=10` : '');
    },
    errs(html) {
      const d = new DOMParser().parseFromString(html, 'text/html');
      return [...new Set([...d.querySelectorAll('[class*="error"],[class*="alert"],[class*="caution"],[class*="warning"]')]
        .map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean))].join(' ').slice(0, 160);
    },
    async item(id) {
      const r = await this.page('/shop/g/g' + id + '/');
      const h = r.text;
      if (r.status === 404 || !h.includes('value="' + id + '"')) return { id, gone: true };
      const un = (x) => { const t = document.createElement('textarea'); t.innerHTML = x; return t.value; };
      const img = (h.match(/src="(\/img\/goods\/L\/[^"]+)"/) || [])[1];
      return { id, title: un((h.match(/<title>([^<\uff5c]*)/) || [])[1] || id).replace(/:\s[^:]*$/, '').trim(),
        ok: h.includes('href="/shop/cart/cart.aspx?goods=' + id + '"'),
        price: (h.match(/class="goods_price_">\s*[\uffe5\u00a5]\s*([\d,]+)/) || [])[1] || '', image: img ? location.origin + img : '' };
    },
    list: async () => ({ products: [], partial: true }),
    setFocus() {},
    // th\u00eam gi\u1ecf -> b\u1ecf m\u00f3n l\u1ea1 -> \u300c\u3054\u8cfc\u5165\u624b\u7d9a\u304d\u3078\u9032\u3080\u300d -> \u300c\u4f1a\u54e1\u767b\u9332\u305b\u305a\u306b\u8cfc\u5165\u300d. Tr\u1ea3 v\u1ec1 c\u00e1c m\u00f3n \u0111\u00e3 v\u00e0o gi\u1ecf (r\u1ed7ng = ch\u01b0a sang \u0111\u01b0\u1ee3c form).
    async add(items) {
      const epoch = runGeneration, page = (url, body) => this.page(url, body, epoch);
      feiCurrent(epoch);
      let h = '';
      const ok = [];
      // 22/11 (d\u00f2 b\u1eb1ng UA iPhone, ch\u1ec9 gi\u1ecf h\u00e0ng): 1 request nh\u1eadn NHI\u1ec0U m\u00f3n k\u00e8m s\u1ed1 l\u01b0\u1ee3ng \u2013 goods=A&qty=1&goods=B&qty=2 -> gi\u1ecf c\u00f3 A\u00d71, B\u00d72.
      // Tr\u01b0\u1edbc \u0111\u00e2y: m\u1ed7i m\u00f3n 1 request + 1 request s\u1eeda s\u1ed1 l\u01b0\u1ee3ng (+ chuy\u1ec3n trang) = 5 request n\u1ed1i ti\u1ebfp \u2248 4,2 gi\u00e2y; gi\u1edd 1 request th\u00eam + 1 request m\u1edf form.
      try { h = (await page('/shop/cart/cart.aspx', items.map((x) => `goods=${x.id}&qty=${Math.max(1, +x.qty || 1)}`).join('&'))).text; }
      catch (e) { if (e.cancelled || e instanceof Http429 || /403/.test(e.message)) throw e; }
      for (const x of items) {
        if (this.rows(h).some((w) => w.goods === x.id)) { ok.push(x); continue; }
        if (items.length > 1) {                      // m\u00f3n ch\u01b0a v\u00e0o trong l\u01b0\u1ee3t g\u1ed9p -> th\u00eam ri\u00eang m\u00f3n \u0111\u00f3 1 l\u1ea7n
          h = (await page('/shop/cart/cart.aspx', `goods=${x.id}&qty=${Math.max(1, +x.qty || 1)}`)).text;
          if (this.rows(h).some((w) => w.goods === x.id)) { ok.push(x); continue; }
        }
        log(L('\u8ffd\u52a0\u5931\u6557: ', 'Th\u00eam th\u1ea5t b\u1ea1i: ') + x.name.slice(0, 24) + ' ' + this.errs(h));
      }
      if (!ok.length) return [];
      let rows = this.rows(h);
      this.formHtml = '';
      // \u0110I T\u1eaeT (th\u1eed 22/11, UA iPhone): gi\u1ecf ch\u1ec9 c\u00f3 \u0111\u00fang m\u00f3n c\u1ea7n v\u1edbi \u0111\u00fang s\u1ed1 l\u01b0\u1ee3ng -> b\u1ecf b\u01b0\u1edbc \u300c\u3054\u8cfc\u5165\u624b\u7d9a\u304d\u3078\u9032\u3080\u300d, POST guest.x th\u1eb3ng v\u1eabn ra form
      if (rows.length === ok.length && ok.every((x) => rows.some((w) => w.goods === x.id && w.qty === x.qty))) {
        try {
          const g = await page('/shop/order/method.aspx', 'guest.x=40&guest.y=10');
          if (g.text.includes('name="frmMethod"')) { this.formHtml = g.text; return ok; }
        } catch (e) { if (e.cancelled || e instanceof Http429 || /403/.test(e.message)) throw e; }
      }
      for (let k = 0; k < 10; k++) {                // gi\u1ecf c\u00f2n m\u00f3n kh\u00e1c -> xo\u00e1 t\u1eebng d\u00f2ng (trang tr\u1ea3 v\u1ec1 gi\u1ecf m\u1edbi)
        const extra = rows.find((w) => !ok.some((x) => x.id === w.goods));
        if (!extra) break;
        rows = this.rows((await page('/shop/cart/cart.aspx', this.body(rows, 'del' + extra.n))).text);
      }
      const want = {};
      for (const x of ok) want[x.id] = x.qty;
      for (let k = 0; k < 2; k++) {
        const r = await page('/shop/cart/cart.aspx', this.body(rows, 'submit', want));
        if (/\/order\/method\.aspx/i.test(r.url)) {
          if (r.text.includes('name="frmMethod"')) { this.formHtml = r.text; return ok; }   // \u0111ang \u0111\u0103ng nh\u1eadp h\u1ed9i vi\u00ean: v\u00e0o th\u1eb3ng form
          const g = await page('/shop/order/method.aspx', 'guest.x=40&guest.y=10');
          if (g.text.includes('name="frmMethod"')) { this.formHtml = g.text; return ok; }
          log(L('\u30b2\u30b9\u30c8\u8cfc\u5165\u306e\u5165\u529b\u753b\u9762\u3092\u958b\u3051\u307e\u305b\u3093', 'Kh\u00f4ng m\u1edf \u0111\u01b0\u1ee3c form mua kh\u00e1ch (\u4f1a\u54e1\u767b\u9332\u305b\u305a\u306b\u8cfc\u5165)'));
          return [];
        }
        const er = this.errs(r.text), lim = +((er.match(/(\d+)\s*\u500b\u307e\u3067/) || [])[1] || 0);
        if (!lim) { log(L('\u8cfc\u5165\u624b\u7d9a\u304d\u3078\u9032\u3081\u307e\u305b\u3093: ', 'Kh\u00f4ng sang \u0111\u01b0\u1ee3c b\u01b0\u1edbc mua: ') + er); return []; }
        log(L(`\u304a\u4e00\u4eba\u69d8${lim}\u70b9\u307e\u3067 \u2192 \u6570\u91cf\u3092${lim}\u306b\u5909\u66f4`, `Shop gi\u1edbi h\u1ea1n ${lim} c\u00e1i / ng\u01b0\u1eddi \u2192 gi\u1ea3m s\u1ed1 l\u01b0\u1ee3ng c\u00f2n ${lim}`));
        for (const x of ok) { x.qty = Math.min(x.qty, lim); want[x.id] = x.qty; }
        rows = this.rows(r.text);
      }
      return [];
    },
    prune: async () => [],                          // m\u00f3n l\u1ea1 \u0111\u00e3 b\u1ecf trong add()
    // G\u1eecI TH\u1eb2NG form mua kh\u00e1ch (kh\u00f4ng m\u1edf trang method.aspx): l\u1ea5y m\u1ecdi \u00f4 c\u1ee7a frmMethod trong HTML v\u1eeba nh\u1eadn, \u0111i\u1ec1n th\u00f4ng tin \u2699\ufe0f, d\u1ef1ng 1 form \u1ea9n
    // accept-charset Shift_JIS r\u1ed3i submit -> tr\u00ecnh duy\u1ec7t sang lu\u00f4n /shop/order/estimate.aspx (th\u1eed 22/11 b\u1eb1ng request: 302 -> estimate).
    // Thi\u1ebfu th\u00f4ng tin / form l\u1ea1 -> tr\u1ea3 false, BOT m\u1edf trang method.aspx nh\u01b0 c\u0169 (kh\u1ed1i feiOrder \u0111i\u1ec1n + b\u00e1o thi\u1ebfu g\u00ec).
    // Shop tr\u1ea3 form l\u1ea1i (b\u00e1o l\u1ed7i) -> \u0111ang \u1edf method.aspx, kh\u1ed1i feiOrder \u0111i\u1ec1n + b\u1ea5m l\u1ea1i \u0111\u00fang 1 l\u1ea7n.
    async submitForm(epoch = runGeneration) {
      try {
        if (!this.formHtml) return false;
        const lastAt = load(K_LAST, {}).at;
        const current = () => epoch === runGeneration && !!lastAt && load(K_LAST, {}).at === lastAt;
        if (!current()) return false;
        const c = load(K_BUY, {});
        await feiPref(c, current);
        if (!current()) return false;
        if (['last', 'first', 'klast', 'kfirst', 'phone', 'email', 'zip', 'pref', 'city', 'addr1'].some((k) => !String(c[k] || '').trim())) return false;
        const f = new DOMParser().parseFromString(this.formHtml, 'text/html').querySelector('form[name="frmMethod"]');
        const pay = c.pay === 'cod' ? '2' : '7';
        if (!f || !f.querySelector(`input[type=radio][name=method][value="${pay}"]`) || !f.querySelector('[name="s_name"]')) return false;
        const zip = String(c.zip || '').replace(/\D/g, '');
        const V = { s_name: c.last, s_name2: c.first, s_kana: c.klast, s_kana2: c.kfirst, s_tel: String(c.phone || '').replace(/\D/g, ''), s_mail: c.email, s_cmail: c.email,
          s_zip: zip.length === 7 ? zip.slice(0, 3) + '-' + zip.slice(3) : zip, s_pref: PREFS[+c.pref - 1] || '', s_addr: c.city, s_addr2: c.addr1, s_addr3: c.addr2 || '' };
        if (!V.s_pref) return false;
        const out = document.createElement('form');
        out.method = 'post'; out.action = '/shop/order/method.aspx'; out.acceptCharset = 'Shift_JIS'; out.style.display = 'none';
        const put = (n, v) => { const i = document.createElement('input'); i.type = 'hidden'; i.name = n; i.value = v == null ? '' : String(v); out.appendChild(i); };
        for (const e of f.querySelectorAll('input, select, textarea')) {
          const n = e.getAttribute('name'), ty = (e.getAttribute('type') || '').toLowerCase();
          if (!n || e.hasAttribute('disabled') || /^(image|submit|button|reset|file)$/.test(ty)) continue;
          if (ty === 'radio') { if (n === 'method' ? e.getAttribute('value') === pay : e.hasAttribute('checked')) put(n, e.getAttribute('value')); continue; }
          if (ty === 'checkbox') { if (n === 'chkself' || (n !== 'OtherDest' && e.hasAttribute('checked'))) put(n, e.getAttribute('value') || 'on'); continue; }
          if (n in V) { put(n, V[n]); continue; }
          if (e.tagName === 'SELECT') { const o = e.querySelector('option[selected]') || e.querySelector('option'); put(n, o ? (o.getAttribute('value') ?? o.textContent) : ''); continue; }
          put(n, e.tagName === 'TEXTAREA' ? e.textContent : e.getAttribute('value') || '');
        }
        put('submit.x', 50); put('submit.y', 20);
        try { localStorage.setItem('sxb_pay_used', JSON.stringify({ label: PAYS[c.pay === 'cod' ? 'cod' : 'card'][0], email: c.email || '', at: Date.now() })); } catch (e) {}
        if (!current()) return false;
        (document.body || document.documentElement).appendChild(out);
        HTMLFormElement.prototype.submit.call(out);
        return true;
      } catch (e) { return false; }
    },
    async clearAll() {
      const epoch = runGeneration, page = (url, body) => this.page(url, body, epoch);
      feiCurrent(epoch);
      let rows = this.rows((await page('/shop/cart/cart.aspx')).text);
      const n = rows.length;
      for (let k = 0; k < 10 && rows.length; k++) rows = this.rows((await page('/shop/cart/cart.aspx', this.body(rows, 'del' + rows[0].n))).text);
      return n;
    },
  };
  async function feiScan() {
    const epoch = runGeneration;
    feiCurrent(epoch);
    const rows = cfg.items.slice(0, cfg.kwCount).map((it, i) => ({ ...it, i })).filter((it) => it.kw.trim());
    const picked = [], stat = [];
    // 22/11: c\u00e1c KW xem C\u00d9NG L\u00daC (v\u1eabn 1 request / KW / l\u01b0\u1ee3t, s\u1ed1 request kh\u00f4ng \u0111\u1ed5i) -> bi\u1ebft c\u00f3 h\u00e0ng sau 1 l\u01b0\u1ee3t tr\u1ea3 l\u1eddi thay v\u00ec c\u1ed9ng d\u1ed3n t\u1eebng KW
    const got = await Promise.all(rows.map((it) => {
      const ids = [...new Set(it.kw.split(/[&\uff06,\s]+/).filter(Boolean).map((t) => fei.idOf(t)))];
      return ids.length && ids.every(Boolean) ? fei.item(rnd(ids)) : null;   // nhi\u1ec1u link n\u1ed1i & = m\u1ed7i l\u01b0\u1ee3t xem ng\u1eabu nhi\u00ean 1 m\u00e0u
    }));
    feiCurrent(epoch);
    for (const [k, it] of rows.entries()) {
      let s = 'none', hit = null;
      {
        const p = got[k] || { gone: true };
        if (!p.gone) {
          s = p.ok ? 'in' : 'out';
          if (p.ok) hit = { id: p.id, qty: it.qty, name: p.title, url: location.origin + '/shop/g/g' + p.id + '/', image: p.image, size: '-', price: p.price ? '\u00a5' + p.price : '' };
        }
      }
      if (hit && !picked.some((x) => x.id === hit.id)) picked.push(hit);
      stat.push({ label: `KW${it.i + 1}`, kw: it.kw.slice(-24), st: hit ? 'in' : s });
    }
    kwStat = stat;
    return picked;
  }

  const rnd = (items) => items[Math.floor(Math.random() * items.length)];
  const shop = IS_PAL ? palace : IS_SUP ? sup : IS_GEN ? gen : IS_BASE ? base : IS_FEI ? fei : sfcc;

  // ---------- 1 l\u01b0\u1ee3t qu\u00e9t: t\u00ecm m\u00f3n kh\u1edbp t\u1eeb kh\u00f3a, ch\u1ecdn size c\u00f2n h\u00e0ng ----------
  const blindAt = {}, blindSt = {};            // th\u00eam gi\u1ecf th\u1eb3ng b\u1eb1ng variant ID: l\u1ea7n th\u1eed g\u1ea7n nh\u1ea5t / k\u1ebft qu\u1ea3
  async function scan() {
    if (IS_BASE) return baseScan();
    if (IS_FEI) return feiScan();
    const { products, partial } = await shop.list();
    hits429 = 0; cfHits = 0;
    const rows = cfg.items.slice(0, cfg.kwCount).map((it, i) => ({ ...it, i })).filter((it) => it.kw.trim());
    const focus = new Set();
    // m\u1ed7i t\u1eeb kh\u00f3a d\u00f2 song song (HUMAN MADE / Buffer ph\u1ea3i h\u1ecfi kho t\u1eebng m\u00f3n: tr\u01b0\u1edbc \u0111\u00e2y h\u1ecfi l\u1ea7n l\u01b0\u1ee3t -> ch\u1eadm)
    // ---- \u00f4 t\u1eeb kh\u00f3a l\u00e0 M\u00c3 BI\u1ebeN TH\u1ec2 ----
    // Shopify: variant ID (ch\u1ec9 s\u1ed1, VD 42728889876830) ; HUMAN MADE / Buffer: m\u00e3 h\u00e0ng (VD BF31TE050BK903 / HM29CS001)
    const vidOf = (kw) => {
      let k = kw.trim();
      if (IS_VANS && /^https?:/i.test(k)) {
        try {
          const url = new URL(k);
          if (url.origin !== location.origin || !url.pathname.startsWith('/p/')) return '';
          k = url.pathname.match(/([A-Z0-9]{8,})\.html$/i)?.[1] || '';
        } catch { return ''; }
      }
      return IS_SHOPIFY ? (/^\d{8,}$/.test(k) ? k : '') : (/^[A-Z0-9]{8,}$/i.test(k) && /\d/.test(k) && /[A-Z]/i.test(k) ? k.toUpperCase() : ''); };
    // nhi\u1ec1u m\u00e3 n\u1ed1i b\u1eb1ng & (d\u1ea5u ph\u1ea9y / kho\u1ea3ng tr\u1eafng c\u0169ng \u0111\u01b0\u1ee3c), VD 111&222&333 -> m\u1ed7i \u00f4 v\u1eabn ch\u1ec9 ra 1 m\u00f3n, ch\u1ecdn NG\u1eaaU NHI\u00caN 1 m\u00e3 (user y\u00eau c\u1ea7u 2/11)
    const vidsOf = (kw) => { const a = kw.split(IS_VANS ? /[&＆,\s]+/ : /[&,\s]+/).filter(Boolean).map(vidOf); return a.length && a.every(Boolean) ? [...new Set(a)] : []; };
    const pickOne = (a) => a[Math.floor(Math.random() * a.length)];
    const listedV = (id) => { for (const p of products) { const v = (p.variants || []).find((x) => String(x.id) === id); if (v) return v; } return null; };
    function pickVid(vids) {
      if (vids.length === 1 || !IS_SHOPIFY) return pickOne(vids);
      // Shopify / Supreme: \u01b0u ti\u00ean m\u00e3 \u0111ang c\u00f3 h\u00e0ng trong danh s\u00e1ch SP
      const avail = vids.filter((id) => { const v = listedV(id); return v && v.ok; });
      if (avail.length) return pickOne(avail);
      // ch\u01b0a m\u00e3 n\u00e0o c\u00f3 h\u00e0ng: th\u00eam gi\u1ecf th\u1eb3ng 1 m\u00e3 ch\u01b0a l\u00ean danh s\u00e1ch; c\u1ea3 nh\u00f3m v\u1eabn ch\u1ec9 1 l\u1ea7n / 1,5 gi\u00e2y (kh\u00f4ng t\u0103ng request gi\u1ecf)
      const last = Math.max(0, ...vids.map((id) => blindAt[id] || 0));
      if (Date.now() - last < 1500) return vids.find((id) => (blindAt[id] || 0) === last);
      const blind = vids.filter((id) => !listedV(id));
      return pickOne(blind.length ? blind : vids);
    }
    async function byVid(it, vid) {
      const qtyOf = (lim) => Math.max(1, lim ? Math.min(it.qty, lim) : it.qty);
      if (IS_SHOPIFY) {
        // 1) c\u00f3 trong danh s\u00e1ch SP (danh s\u00e1ch ch\u1ee9a ID m\u1ecdi bi\u1ebfn th\u1ec3) -> bi\u1ebft t\u00ean / size / c\u00f2n h\u00e0ng
        const p = products.find((x) => (x.variants || []).some((v) => String(v.id) === vid));
        if (p) {
          focus.add(p.key);
          const v = p.variants.find((x) => String(x.id) === vid);
          if (!v.ok) return { it, s: 'out', hit: null };
          return { it, s: 'in', hit: { id: v.id, qty: qtyOf(p.limit), name: p.name, url: p.url, image: p.image,
            size: [v.color, v.size].filter((x) => x && x !== '-').join(' / ') || '-', price: '\u00a5' + Math.round(IS_SUP ? v.price / 100 : v.price).toLocaleString('ja-JP') } };
        }
        if (IS_PAL || IS_GR8) return { it, s: 'none', hit: null }; // No blind Shopify cart API requests on Palace.
        if (IS_GEN) {
          if (Date.now() - (blindAt[vid] || 0) < 1500) return { it, s: 'none', hit: null };
          blindAt[vid] = Date.now();
          return { it, s: 'none', hit: { id: vid, qty: qtyOf(0), name: 'Variant ' + vid, url: location.origin, size: '-', price: '' } };
        }
        // 2) ch\u01b0a l\u00ean danh s\u00e1ch: th\u1eed th\u00eam gi\u1ecf th\u1eb3ng b\u1eb1ng ID (1,5 gi\u00e2y / l\u1ea7n \u0111\u1ec3 kh\u00f4ng b\u1ecb ch\u1eb7n)
        if (Date.now() - (blindAt[vid] || 0) < 1500) return { it, s: blindSt[vid] || 'none', hit: null };
        blindAt[vid] = Date.now();
        const r = await fetch('/cart/add.js', { method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
          body: JSON.stringify({ items: [{ id: +vid, quantity: it.qty }] }) });
        if (r.status === 429) throw new Http429(retryAfterSeconds(r));
        const j = await r.json().catch(() => ({}));
        if (r.ok) {
          const x = (j.items || [])[0] || {};
          return { it, s: 'in', hit: { id: +vid, qty: x.quantity || it.qty, name: x.product_title || x.title || ('Variant ' + vid), url: location.origin + (x.url || ''),
            image: x.image || x.featured_image && x.featured_image.url || '', size: x.variant_title || '-', price: '\u00a5' + Math.round((x.price || 0) / 100).toLocaleString('ja-JP'), added: true } };
        }
        // 422 "\u58f2\u308a\u5207\u308c" = c\u00f3 m\u00e3 nh\u01b0ng h\u1ebft ; 404 / "\u898b\u3064\u304b\u308a\u307e\u305b\u3093" = m\u00e3 ch\u01b0a c\u00f3 tr\u00ean shop
        blindSt[vid] = r.status === 422 && !/\u898b\u3064\u304b\u308a|not found|cannot find/i.test(j.description || j.message || '') ? 'out' : 'none';
        return { it, s: blindSt[vid], hit: null };
      }
      // SFCC: h\u1ecfi kho th\u1eb3ng m\u00e3 h\u00e0ng; m\u00e3 bi\u1ebfn th\u1ec3 (\u0111\u1ee7 m\u00e0u + size) -> mua \u0111\u00fang m\u00e3 \u0111\u00f3, m\u00e3 master -> ch\u1ecdn m\u00e0u / size theo \u00f4
      const pr = (await sfcc.pv(vid)).product || {};
      if (!pr.id) return { it, s: 'none', hit: null };
      if (pr.LotteryExclusive) return { it, s: 'lottery', hit: null };
      const img = pr.images && pr.images.large && pr.images.large[0] ? pr.images.large[0].url : '';
      const url = pr.selectedProductUrl ? new URL(pr.selectedProductUrl, location.origin).href : location.origin;
      const isVar = pr.productType === 'variant' || (pr.id === vid && (pr.variationAttributes || []).length && (pr.variationAttributes || []).every((a) => (a.values || []).some((v) => v.selected)));
      if (isVar) {
        const sell = pr.sellStartDate ? Date.parse(pr.sellStartDate) : 0;
        if (sell && sell > Date.now() + 3000) return { it, s: 'soon', hit: null };
        if (!(pr.available && pr.orderable !== false && pr.readyToOrder !== false)) return { it, s: 'out', hit: null };
        const sel = (pr.variationAttributes || []).map((a) => ((a.values || []).find((v) => v.selected) || {}).displayValue).filter(Boolean).join(' / ');
        return { it, s: 'in', hit: { id: pr.id, qty: qtyOf(pr.purchaseQtyLimitProduct || pr.maxOrderQuantity), name: pr.productName || vid, url, image: img, size: sel || '-',
          price: (pr.price && pr.price.sales && pr.price.sales.formatted) || '' } };
      }
      const p = { key: pr.id, name: pr.productName || vid, text: pr.productName || '', url, image: img };
      const v = await sfcc.variant(p, it.size, it.kw, it.color);
      if (!v) return { it, s: p.lottery ? 'lottery' : p.notYet ? 'soon' : 'out', hit: null };
      return { it, s: 'in', hit: { id: v.id, qty: qtyOf(v.limit), name: p.name, url, image: img, size: v.size, price: v.price } };
    }
    const res = await Promise.all(rows.map(async (it) => {
      const vids = vidsOf(it.kw);
      if (vids.length) return byVid(it, pickVid(vids));
      let ps = products.filter((p) => match(p.text, it.kw));
      ps.forEach((p) => focus.add(p.key));
      const wc = wantColors(it.color);
      if (IS_SUP && wc.length) {                    // Supreme: m\u1ed7i m\u00e0u l\u00e0 1 m\u00f3n ri\u00eang -> l\u1ecdc + x\u1ebfp theo m\u00e0u \u01b0u ti\u00ean
        ps = wc.flatMap((w) => ps.filter((p) => colorOk(p.color, w)));
      }
      let s = ps.length ? 'out' : 'none';
      for (const p of ps) {
        if (IS_SHOPIFY ? !p.variants.some((v) => v.ok) : p.soldOut && !partial && !sfcc.focus.includes(p.key)) continue;
        const v = await shop.variant(p, it.size, it.kw, it.color);
        if (p.lottery) s = 'lottery';
        if (p.notYet && s !== 'lottery') s = 'soon';
        if (!v) continue;
        return { it, s: 'in', hit: { id: v.id, qty: Math.max(1, v.limit ? Math.min(it.qty, v.limit) : it.qty), name: p.name, url: p.url, image: p.image, size: v.size, price: v.price } };
      }
      return { it, s, hit: null };
    }));
    const picked = [], seen = new Set(), stat = [];
    for (const { it, s, hit } of res) {
      const id = hit && String(hit.id);
      if (hit && !seen.has(id)) { seen.add(id); picked.push(hit); }
      stat.push({ label: `KW${it.i + 1}`, kw: it.kw + (it.color ? ` / ${it.color}` : '') + (it.size ? ` [${it.size}]` : ''), st: s });
    }
    // danh s\u00e1ch \u0111\u1ea7y \u0111\u1ee7 m\u1edbi c\u1eadp nh\u1eadt m\u00f3n c\u1ea7n theo d\u00f5i nhanh (l\u01b0\u1ee3t ch\u1ec9 t\u1ea3i m\u00f3n \u0111\u00e3 bi\u1ebft th\u00ec gi\u1eef nguy\u00ean)
    if (!partial) shop.setFocus([...focus].slice(0, 6));
    kwStat = stat;
    return picked;
  }

  async function buy(items) {
    const feiEpoch = IS_FEI ? runGeneration : null;
    adding = true;
    const t0 = performance.now();
    let ok = [];
    try {
      const pre = items.filter((x) => x.added), rest = items.filter((x) => !x.added);
      ok = [...pre, ...(rest.length ? await shop.add(rest) : [])];
    } catch (e) {
      if (IS_FEI && e.cancelled) { adding = false; return false; }
      if ((IS_GEN || BASE_OR_VANS || IS_FEI) && e instanceof Http429) { adding = false; throw e; }
      if (IS_GEN && e instanceof Blocked) { finish(e.message); return false; }
      log(L('\u30ab\u30fc\u30c8\u8ffd\u52a0\u30a8\u30e9\u30fc: ', 'L\u1ed7i th\u00eam gi\u1ecf: ') + e.message);
    }
    if (ok.length) {
      if ((BASE_OR_VANS && !st.active) || (IS_FEI && (!st.active || feiEpoch !== runGeneration))) { adding = false; return false; }
      if (IS_GEN) {
        if (!st.active) return false;
        try {
          await gen.confirmCart(ok);
        } catch (error) {
          finish('購入画面へ進めません: ' + error.message);
          return false;
        }
        if (!st.active) return false;
        log('カートの商品・数量を確認しました');
      } else if (!BASE_OR_VANS) {
        // gi\u1ecf c\u00f2n m\u00f3n kh\u00e1c (th\u00eam tay t\u1eeb tr\u01b0\u1edbc / l\u01b0\u1ee3t c\u0169) -> xo\u00e1, \u0111\u1ec3 trang thanh to\u00e1n ch\u1ec9 c\u00f3 m\u00f3n trong KW
        try {
          const extra = await shop.prune(ok);
          if (extra.length) log(L('\u30ab\u30fc\u30c8\u306e\u4e0d\u8981\u306a\u5546\u54c1\u3092\u524a\u9664: ', '\u0110\u00e3 x\u00f3a m\u00f3n th\u1eeba trong gi\u1ecf: ') + extra.map((x) => String(x).slice(0, 20)).join(', '));
        } catch (e) { log(L('\u30ab\u30fc\u30c8\u6574\u7406\u30a8\u30e9\u30fc: ', 'L\u1ed7i d\u1ecdn gi\u1ecf: ') + e.message); }
      }
      if (IS_FEI && (!st.active || feiEpoch !== runGeneration)) { adding = false; return false; }
      // mua xong: D\u1eeaNG H\u1eb2N (kh\u00f4ng t\u1ef1 b\u1eadt l\u1ea1i khi quay v\u1ec1 trang shop / t\u1ea3i l\u1ea1i trang)
      st.active = false; st.now = false; st.boughtAt = Date.now(); st.reloads = []; save(K_ST, st);
      setStatus(L('\u30ab\u30fc\u30c8\u8ffd\u52a0\u5b8c\u4e86 \u2192 \u8cfc\u5165\u753b\u9762\u3078\uff08BOT\u505c\u6b62\uff09', '\u0110\u00e3 v\u00e0o gi\u1ecf \u2192 sang thanh to\u00e1n (BOT \u0111\u00e3 d\u1eebng)'));
      if (IS_VANS) setStatus('カート追加完了。公式カートでお支払い方法を選択してください。');
      if (IS_PAL) setStatus('Palaceの在庫を確認 → カートリンクへ進みます。投入結果・金額・注文内容を確認してください。');
      try { localStorage.removeItem('sxb_pay_used'); } catch (e) {}
      save(K_LAST, { shop: SHOP, site: HOST, at: Date.now(), items: ok.map((x) => ({ title: x.name, url: x.url, image: synovaThumb(x.image), size: x.size, price: x.price, qty: x.qty })) });
      gmSet('sxb_bot_buy', { at: Date.now(), host: HOST });
      if (IS_PAL) gmSet('uzura_palace_last', { shop: SHOP, site: HOST, at: Date.now(), items: ok.map(x => ({title:x.name,url:x.url,image:x.image,size:x.size,price:x.price,qty:x.qty})) });
      if (IS_FEI) {
        const submitted = await fei.submitForm(feiEpoch);
        if (feiEpoch !== runGeneration || !load(K_LAST, {}).at) { adding = false; return false; }
        if (!submitted) location.href = shop.checkout;
      } else location.href = IS_VANS ? '/cart/' : shop.checkout;               // chuy\u1ec3n trang NGAY, ghi log sau
      log(L('\u5728\u5eab\u3042\u308a \u2192 \u30ab\u30fc\u30c8\u306b\u8ffd\u52a0 \u2192 \u8cfc\u5165\u753b\u9762\u3078: ', 'C\u00f3 h\u00e0ng \u2192 \u0111\u00e3 v\u00e0o gi\u1ecf \u2192 sang thanh to\u00e1n: ') +
        ok.map((x) => `${x.name.slice(0, 22)} (${x.size})\u00d7${x.qty}`).join(', ') + ` \u00b7 ${Math.round(performance.now() - t0)}ms`);
      beep();
      return true;
    }
    adding = false;
    setStatus(L('\u30ab\u30fc\u30c8\u8ffd\u52a0\u3067\u304d\u305a \u2192 \u76e3\u8996\u3092\u7d9a\u3051\u307e\u3059', 'Kh\u00f4ng th\u00eam \u0111\u01b0\u1ee3c v\u00e0o gi\u1ecf \u2192 qu\u00e9t ti\u1ebfp'));
    return false;
  }

  let ticker = null;
  function startTicker() {
    if (ticker) return;
    let sec = 0, prev = { ...stats }, addSaid = false;
    const ST = { in: L('\u5728\u5eab\u3042\u308a\u2705', 'c\u00f2n h\u00e0ng \u2705'), out: L('\u58f2\u308a\u5207\u308c', 'h\u1ebft h\u00e0ng'), none: L('\u672a\u63b2\u8f09', 'ch\u01b0a l\u00ean k\u1ec7'),
      soon: L('\u8ca9\u58f2\u524d', 'ch\u01b0a t\u1edbi gi\u1edd b\u00e1n'), lottery: L('\u62bd\u9078\u8ca9\u58f2\uff08BOT\u5bfe\u8c61\u5916\uff09', 'b\u00e1n b\u1ed1c th\u0103m (BOT kh\u00f4ng mua)') };
    ticker = setInterval(() => {
      if (!st.active) { clearInterval(ticker); ticker = null; return; }
      sec++;
      if (adding) { if (!addSaid) { addSaid = true; log('在庫あり → カートに追加中…'); } return; }
      addSaid = false;
      if (sec > 60 && sec % 10) return;              // sau 1 ph\u00fat: 10 gi\u00e2y ghi 1 l\u1ea7n
      const d = { ok: stats.ok - prev.ok, err: stats.err - prev.err };
      prev = { ...stats };
      if (d.err && !d.ok) log(L('\u30cd\u30c3\u30c8\u30ef\u30fc\u30af\u30a8\u30e9\u30fc', 'l\u1ed7i m\u1ea1ng'));
      for (const k of [...kwStat].reverse()) log(`[${k.label}] ${k.kw} \u00b7 ${ST[k.st]}`);
    }, 1000);
  }

  // 1 l\u01b0\u1ee3t qu\u00e9t + mua n\u1ebfu c\u00f3 h\u00e0ng; l\u1ed7i x\u1eed l\u00fd t\u1ea1i \u0111\u00e2y (ch\u1ea1y \u0111\u01b0\u1ee3c song song nhi\u1ec1u l\u01b0\u1ee3t)
  let inflight = 0, runGeneration = 0, starting = false, lastScanError = '';
  async function scanOnce() {
    const feiEpoch = IS_FEI ? runGeneration : null;
    if (!st.active) return;
    inflight++;
    try {
      const items = await scan();
      if (IS_FEI && (!st.active || feiEpoch !== runGeneration)) return;
      lastScanError = '';
      pace = Math.max(1, pace * 0.93);
      if (items.length && !adding && st.active) await buy(items);
    } catch (e) {
      if (IS_FEI && (e.cancelled || !st.active || feiEpoch !== runGeneration)) return;
      if (e instanceof Http429) {
        if (Date.now() >= backoffUntil) {           // nhi\u1ec1u l\u01b0\u1ee3t c\u00f9ng tr\u1ea3 429 -> ch\u1ec9 t\u00ednh 1 l\u1ea7n
          hits429++;
          pace = Math.min(8, pace * 1.6);
          let wait = Math.min(BACKOFF_MAX, BACKOFF_MIN * 2 ** (hits429 - 1));
          if (e.retryAfter > 0) wait = Math.max(wait, e.retryAfter * 1000);
          backoffUntil = Date.now() + wait;
          if (hits429 === 1) log(L('\u30a2\u30af\u30bb\u30b9\u5236\u9650(429) \u2192 \u5c11\u3057\u5f85\u3063\u3066\u518d\u958b', 'B\u1ecb gi\u1edbi h\u1ea1n (429) \u2192 ch\u1edd ch\u00fat r\u1ed3i qu\u00e9t ti\u1ebfp'));
        }
        backoffUntil = Math.max(backoffUntil, Date.now() + e.retryAfter * 1000);
      } else if (e.blocked) {
        if (IS_PAL || BASE_OR_VANS || IS_GR8) { finish(e.message); return; }
        // Cloudflare / Queue-it: tr\u00ecnh duy\u1ec7t th\u1eadt t\u1ef1 qua khi t\u1ea3i l\u1ea1i trang -> BOT ch\u1ea1y ti\u1ebfp sau khi t\u1ea3i l\u1ea1i
        cfHits++;
        log(L(`${e.message} \u691c\u51fa \u2192 \u30da\u30fc\u30b8\u518d\u8aad\u307f\u8fbc\u307f`, `G\u1eb7p ${e.message} \u2192 t\u1ea3i l\u1ea1i trang`) + ` (${cfHits})`);
        if (cfHits >= 2 && st.active) {
          // t\u1ea3i l\u1ea1i t\u1ed1i \u0111a 4 l\u1ea7n / 3 ph\u00fat; qu\u00e1 th\u00ec d\u1eebng (tr\u01b0\u1edbc \u0111\u00e2y t\u1ea3i l\u1ea1i m\u00e3i = "BOT c\u1ee9 t\u1ef1 b\u1eadt l\u1ea1i")
          st.reloads = (st.reloads || []).filter((t) => Date.now() - t < 180e3).concat(Date.now());
          if (st.reloads.length > 4) { finish(L('Cloudflare / Queue-it \u304c\u7d9a\u304f\u305f\u3081\u505c\u6b62', 'B\u1ecb Cloudflare / Queue-it ch\u1eb7n li\u00ean t\u1ee5c \u2013 d\u1eebng')); return; }
          save(K_ST, st); await sleep(1500);
          if (st.active) location.reload();
          return;
        }
        backoffUntil = Date.now() + 2000;
      } else {
        if (IS_GEN && lastScanError !== e.message) log('監視エラー: ' + e.message);
        lastScanError = e.message;
        setStatus(L('\u30a8\u30e9\u30fc: ', 'L\u1ed7i: ') + e.message);
      }
    } finally { inflight--; }
  }

  async function run() {
    if(IS_GR8)return gr8Run();
    adding = false; hits429 = 0; cfHits = 0; backoffUntil = 0; inflight = 0; pace = 1;
    const generation = runGeneration;
    if (IS_FEI) kwStat = [];
    lastScanError = '';
    let opened = false;
    while (st.active && generation === runGeneration) {
      const t0 = Date.now();
      const left = st.now ? -1 : msToOpen();
      if (left > WATCH_FROM_SEC * 1000) {
        if (opened) { finish(L(`${GIVE_UP_MIN}\u5206\u904e\u304e\u3066\u3082\u5728\u5eab\u306a\u3057 \u2192 \u505c\u6b62`, `Qu\u00e1 ${GIVE_UP_MIN} ph\u00fat ch\u01b0a c\u00f3 h\u00e0ng \u2013 d\u1eebng`)); return; }
        const s = Math.ceil(left / 1000);
        setStatus(L(`${cfg.open}\uff08\u65e5\u672c\u6642\u9593\uff09\u307e\u3067: `, `C\u00f2n t\u1edbi ${cfg.open} gi\u1edd Nh\u1eadt: `) + `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`);
        await sleep(Math.min(1000, left - WATCH_FROM_SEC * 1000));
        continue;
      }
      opened = true;
      startTicker();
      if (adding || Date.now() < backoffUntil) { await sleep(40); continue; }
      setStatus(L('\u5728\u5eab\u76e3\u8996\u4e2d\u2026', '\u0110ang canh h\u00e0ng\u2026') + (pace > 1.05 ? ` (\u00d7${pace.toFixed(1)})` : ''));
      // c\u00e1c l\u01b0\u1ee3t ch\u1ed3ng l\u00ean nhau (kh\u00f4ng ch\u1edd l\u01b0\u1ee3t tr\u01b0\u1edbc tr\u1ea3 l\u1eddi): m\u1ea1ng ch\u1eadm v\u1eabn c\u00f3 k\u1ebft qu\u1ea3 m\u1edbi li\u00ean t\u1ee5c
      const fast = !st.now && left > -FAST_FOR_MS;
      if (IS_PAL || IS_GEN || BASE_OR_VANS || IS_FEI) { if (!inflight) await scanOnce(); await sleep(Math.max(IS_FEI ? FEI_MS : minMonitorDelay, cfg.monitorDelay, backoffUntil - Date.now())); continue; }
      if (inflight < (fast ? MAX_INFLIGHT : NOW_INFLIGHT)) scanOnce();
      await sleep(Math.max(20, Math.max(fast ? FAST_MS : NOW_MS, cfg.monitorDelay) * pace + Math.random() * 40 - (Date.now() - t0)));
    }
  }

  function start(now) {
    if ((IS_GEN || BASE_OR_VANS || IS_FEI) && (starting || inflight)) {
      log('前回の通信が終わってから実行してください');
      return;
    }
    readCfg();
    if (!cfg.items.slice(0, cfg.kwCount).some((i) => i.kw.trim())) { log(L('\u30ad\u30fc\u30ef\u30fc\u30c9\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044', 'H\u00e3y nh\u1eadp t\u1eeb kh\u00f3a')); return; }
    if (!now && !/^\d{1,2}:\d{2}$/.test(cfg.open || '')) { log(L('\u8ca9\u58f2\u958b\u59cb\u6642\u523b\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044', 'H\u00e3y nh\u1eadp gi\u1edd m\u1edf b\u00e1n')); return; }
    if(IS_GR8){ void gr8Start(now); return; }
    if (IS_HM || IS_BUF || IS_VANS) {                         // SFCC: d\u00f9ng trang danh s\u00e1ch \u0111ang m\u1edf (New / All / danh m\u1ee5c) l\u00e0m ngu\u1ed3n qu\u00e9t
      const g = document.querySelector('[data-url*="Search-UpdateGrid"]');
      if (g) { cfg.grid = g.getAttribute('data-url'); save(K_CFG, cfg); }
      log(L('\u76e3\u8996\u30da\u30fc\u30b8: ', 'Trang qu\u00e9t: ') + decodeURIComponent((cfg.grid || 'cgid=all').replace(/^.*Search-UpdateGrid\??/, '')));
    }
    if (IS_GEN) {
      const source = IS_GR8 ? '商品ページ内データ（GR8専用）' : shopifyScope.handle ? shopifyProductPath(shopifyScope.handle) : shopifyCatalogPath;
      log(`[${SHOP} v${UZURA_RELEASE}] 検索先 ${source}`);
    }
    st.active = true; st.now = !!now; st.boughtAt = 0; st.reloads = []; save(K_ST, st); keepAwake();
    if (IS_GEN || IS_FEI) {
      runGeneration++;
      starting = true;
      shop.clearAll().then(n => {
        if (n) log('開始前にカートを空にしました（' + n + '件）');
      }).catch(e => finish('開始できません: ' + e.message)).finally(() => {
        starting = false;
        if (st.active) run();
      });
      return;
    }
    if (!BASE_OR_VANS) shop.clearAll().then((n) => { if (n) log(L(`\u958b\u59cb\u524d\u306b\u30ab\u30fc\u30c8\u3092\u7a7a\u306b\u3057\u307e\u3057\u305f\uff08${n}\u4ef6\uff09`, `\u0110\u00e3 d\u1ecdn gi\u1ecf tr\u01b0\u1edbc khi ch\u1ea1y (${n} m\u00f3n)`)); }).catch(() => {});
    log(now ? L(`${SHOP}: \u4eca\u3059\u3050\u76e3\u8996`, `${SHOP}: canh h\u00e0ng ngay`) : L(`${SHOP}: ${cfg.open}\uff08\u65e5\u672c\u6642\u9593\uff09\u307e\u3067\u5f85\u6a5f`, `${SHOP}: ch\u1edd t\u1edbi ${cfg.open} gi\u1edd Nh\u1eadt`));
    run();
  }
  function finish(m) { if (IS_FEI) runGeneration++; st.active = false; save(K_ST, st); log(m); setStatus(m); }
  let wakeLock = null;
  async function keepAwake() {
    try { if (st.active && !wakeLock && navigator.wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (e) {}
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') keepAwake(); });
  function beep() { try { const a = new (window.AudioContext || window.webkitAudioContext)(); const o = a.createOscillator(); o.frequency.value = 880; o.connect(a.destination); o.start(); o.stop(a.currentTime + 0.4); } catch (e) {} }

  // ---------- B\u1ea3ng \u0111i\u1ec1u khi\u1ec3n ----------
  // Log m\u1edbi n\u1eb1m TR\u00caN C\u00d9NG, ch\u1ec9 gi\u1eef LOG_MAX d\u00f2ng m\u1edbi nh\u1ea5t (d\u00f2ng c\u0169 t\u1ef1 x\u00f3a). 4/11 th\u00e0nh vi\u00ean t\u01b0\u1edfng log "d\u1eebng" \u1edf 1500 d\u00f2ng
  // v\u00ec con s\u1ed1 \u0111\u1ee9ng y\u00ean -> hi\u1ec7n th\u00eam gi\u1edd c\u1ee7a d\u00f2ng m\u1edbi nh\u1ea5t. L\u01b0u localStorage t\u1ed1i \u0111a 1 l\u1ea7n / gi\u00e2y (tr\u01b0\u1edbc: m\u1ed7i d\u00f2ng ghi l\u1ea1i
  // c\u1ea3 1500 d\u00f2ng, iPhone gi\u1eadt l\u00fac \u0111\u00f4ng); khung log \u0111ang \u0111\u00f3ng th\u00ec kh\u00f4ng v\u1ebd l\u1ea1i. R\u1eddi trang th\u00ec l\u01b0u ngay (pagehide).
  const LOG_MAX = 1500;
  let logBuf = load(K_LOG, []), logSaveT = 0, logLast = '';
  const logFlush = () => { if (logSaveT) { clearTimeout(logSaveT); logSaveT = 0; } save(K_LOG, logBuf); };
  window.addEventListener('pagehide', logFlush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') logFlush(); });
  const logCount = () => L(`${logBuf.length}\u884c${logBuf.length >= LOG_MAX ? '\uff08\u6700\u65b0\u5206\u306e\u307f\u4fdd\u6301\uff09' : ''}${logLast ? ' \u00b7 \u6700\u65b0 ' + logLast : ''}`,
    `${logBuf.length} d\u00f2ng${logBuf.length >= LOG_MAX ? ' (ch\u1ec9 gi\u1eef d\u00f2ng m\u1edbi nh\u1ea5t)' : ''}${logLast ? ' \u00b7 m\u1edbi nh\u1ea5t ' + logLast : ''}`);
  function log(m) {
    const iso = jstNow().toISOString();            // gi\u1edd Nh\u1eadt: MM/DD HH:MM:SS.mmm
    logBuf.unshift(`${iso.slice(5, 7)}/${iso.slice(8, 10)} ${iso.slice(11, 23)} ${m}`);
    if (logBuf.length > LOG_MAX) logBuf.length = LOG_MAX;
    logLast = iso.slice(11, 19);
    if (!logSaveT) logSaveT = setTimeout(logFlush, 1000);
    const el = $('sxblog'); if (el && el.getClientRects().length) el.textContent = logBuf.join('\n');
    const n = $('sxblogn'); if (n) n.textContent = logCount();
  }
  function setStatus(s) { const el = $('sxbst'); if (el) el.textContent = s; }
  function readCfg() {
    for (let i = 0; i < MAX_KW; i++) {
      cfg.items[i].kw = $('sxbk' + i).value.trim();
      cfg.items[i].color = $('sxbc' + i).value.trim();
      cfg.items[i].size = $('sxbs' + i).value.trim();
      cfg.items[i].qty = +$('sxbq' + i).value;
    }
    cfg.open = $('sxbopen').value;
    const delay = $('sxbmonitor');
    cfg.monitorDelay = uzuraMonitorDelay(delay.value, minMonitorDelay);
    delay.value = cfg.monitorDelay || '';
    save(K_CFG, cfg);
  }
  let sxRoot = null;                          // Shadow DOM ch\u1ee9a khung BOT
  const $ = (id) => (sxRoot ? sxRoot.getElementById(id) : null);

  const ui = load(K_UI, { top: true, hide: IS_GEN || IS_BASE || IS_FEI });
  const box = document.createElement('div');
  box.id = 'sxbbox';
  const goLabel = (t) => (t ? L(`${t} \u306b\u4e88\u7d04\u30fb\u81ea\u52d5\u30b9\u30bf\u30fc\u30c8`, `H\u1eb9n \u0111\u1ebfn ${t} T\u1ef1 B\u1eadt`) : L('\u8ca9\u58f2\u958b\u59cb\u6642\u523b\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044', 'H\u00e3y nh\u1eadp gi\u1edd m\u1edf b\u00e1n'));
  const qtySel = (id) => `<select id="${id}">${Array.from({ length: MAX_QTY }, (_, i) => `<option>${i + 1}</option>`).join('')}</select>`;
  const DESC = IS_FEI
    ? L('FEILER : \u2699\ufe0f \u306b\u4f4f\u6240\u30fb\u30d5\u30ea\u30ac\u30ca\u30fb\u30e1\u30fc\u30eb\u30fb\u652f\u6255\u3044\uff08\u30ab\u30fc\u30c9 / \u4ee3\u91d1\u5f15\u63db\uff09\u3092\u5165\u529b \u2192 KW \u306b\u5546\u54c1\u30ea\u30f3\u30af\uff08\u2026/shop/g/g2L70260125259124/\uff09\u2192 \u6642\u523b\u4e88\u7d04 \u307e\u305f\u306f\u300c\u3059\u3050\u5b9f\u884c\u300d\u3002\u5728\u5eab\u304c\u51fa\u305f\u3089\u30ab\u30fc\u30c8\u306b\u5165\u308c\u3001\u4f1a\u54e1\u767b\u9332\u305b\u305a\u306b\u8cfc\u5165\u306e\u5165\u529b\u753b\u9762 \u2192 \u3054\u6ce8\u6587\u5185\u5bb9\u306e\u78ba\u8a8d\uff08\u30ab\u30fc\u30c9\u5165\u529b\u30fb\u540c\u610f\u30c1\u30a7\u30c3\u30af\uff09\u3092\u81ea\u52d5\u5165\u529b\u3057\u3066\u300c\u3054\u6ce8\u6587\u300d\u307e\u3067\u62bc\u3057\u307e\u3059\uff083D\u30bb\u30ad\u30e5\u30a2\u306f\u3054\u81ea\u5206\u3067\uff09\u3002',
        'FEILER : \u0111i\u1ec1n \u2699\ufe0f \u0111\u1ecba ch\u1ec9, \u30d5\u30ea\u30ac\u30ca, email, c\u00e1ch thanh to\u00e1n (th\u1ebb / \u4ee3\u91d1\u5f15\u63db) \u2192 KW d\u00e1n LINK M\u00d3N (\u2026/shop/g/g2L70260125259124/) \u2192 h\u1eb9n gi\u1edd ho\u1eb7c "Ch\u1ea1y Ngay". C\u00f3 h\u00e0ng BOT th\u00eam gi\u1ecf, t\u1ef1 \u0111i\u1ec1n form mua kh\u00e1ch (\u4f1a\u54e1\u767b\u9332\u305b\u305a\u306b\u8cfc\u5165), sang \u3054\u6ce8\u6587\u5185\u5bb9\u306e\u78ba\u8a8d t\u1ef1 \u0111i\u1ec1n th\u1ebb + t\u00edch \u00f4 \u0111\u1ed3ng \u00fd v\u00e0 b\u1ea5m \u300c\u3054\u6ce8\u6587\u300d (3D Secure b\u1ea1n t\u1ef1 nh\u1eadp).')
    : IS_GR8 ? 'GR8：商品一覧から複数商品をKW順に追加。サイズ別ID、または商品名・色・サイズを入力し、各1点に設定。追加後はカートを確認して手動で決済してください。' : IS_BASE ? 'BASEショップ。商品リンクまたは商品ID・商品名と種類を入力してください。'
    : IS_VANS ? 'Vans JP。商品コードとサイズを入力してください。カート追加後は公式カートに進みます。'
    : IS_GEN
    ? L(`${SHOP} : Shopify\u5e97\u8217\u3092\u81ea\u52d5\u8a8d\u8b58\u3002\u5148\u306b\u4f4f\u6240\u30fb\u652f\u6255\u3044\u60c5\u5831\u3092\u6e96\u5099\u3002\u30ad\u30fc\u30ef\u30fc\u30c9\uff08\u5546\u54c1\u540d\u306e\u4e00\u90e8\uff09\uff0b\u8272\uff0b\u30b5\u30a4\u30ba\uff0b\u500b\u6570 \u2192 \u6642\u523b\u4e88\u7d04 \u307e\u305f\u306f\u300c\u3059\u3050\u5b9f\u884c\u300d\u3002`,
        `${SHOP} : t\u1ef1 nh\u1eadn shop Shopify. Chu\u1ea9n b\u1ecb s\u1eb5n \u0111\u1ecba ch\u1ec9 + thanh to\u00e1n. Nh\u1eadp t\u1eeb kh\u00f3a (1 ph\u1ea7n t\u00ean SP) + m\u00e0u + size + s\u1ed1 l\u01b0\u1ee3ng \u2192 h\u1eb9n gi\u1edd ho\u1eb7c "Ch\u1ea1y Ngay".`)
    : IS_SUP
    ? L('Supreme JP : \u5148\u306b\u914d\u9001\u5148\u30fb\u652f\u6255\u3044\u60c5\u5831\u3092\u6e96\u5099\u3002\u30ad\u30fc\u30ef\u30fc\u30c9\uff08\u5546\u54c1\u540d\u30fb\u8272\u3001\u30b9\u30da\u30fc\u30b9\u533a\u5207\u308a\u3067\u5168\u90e8\u542b\u3080\uff09\uff0b\u30b5\u30a4\u30ba\uff0b\u500b\u6570 \u2192 \u4e88\u7d04\uff08\u6bce\u9031\u6728\u66dc 11:00 \u65e5\u672c\u6642\u9593\uff09\u3002',
        'Supreme JP : chu\u1ea9n b\u1ecb s\u1eb5n \u0111\u1ecba ch\u1ec9 + thanh to\u00e1n. Nh\u1eadp t\u1eeb kh\u00f3a (t\u00ean SP / m\u00e0u, c\u00e1ch nhau d\u1ea5u c\u00e1ch = ph\u1ea3i ch\u1ee9a h\u1ebft) + size + s\u1ed1 l\u01b0\u1ee3ng \u2192 h\u1eb9n gi\u1edd (th\u1ee9 N\u0103m 11:00 gi\u1edd Nh\u1eadt).')
    : L(`${SHOP} : \u5148\u306b\u30ed\u30b0\u30a4\u30f3\u30fb\u4f4f\u6240\u8a2d\u5b9a\u3002\u76e3\u8996\u3057\u305f\u3044\u4e00\u89a7\u30da\u30fc\u30b8\uff08New / All \u306a\u3069\uff09\u3092\u958b\u3044\u3066\u304b\u3089\u958b\u59cb\u3002\u30ad\u30fc\u30ef\u30fc\u30c9\uff08\u5546\u54c1\u540d\u30fb\u8272\uff09\uff0b\u30b5\u30a4\u30ba\uff0b\u500b\u6570\u3002\u62bd\u9078\u8ca9\u58f2\u306f\u5bfe\u8c61\u5916\u3002`,
        `${SHOP} : login + c\u00e0i \u0111\u1ecba ch\u1ec9 tr\u01b0\u1edbc. M\u1edf trang danh s\u00e1ch mu\u1ed1n canh (New / All\u2026) r\u1ed3i m\u1edbi B\u1eadt. Nh\u1eadp t\u1eeb kh\u00f3a (t\u00ean SP / m\u00e0u) + size + s\u1ed1 l\u01b0\u1ee3ng. H\u00e0ng b\u1ed1c th\u0103m BOT kh\u00f4ng mua.`);
  // ---------- Supreme: th\u00f4ng tin giao h\u00e0ng + th\u1ebb + c\u00e1ch thanh to\u00e1n (t\u1ef1 \u0111i\u1ec1n \u1edf trang thanh to\u00e1n) ----------
  const buyCfg = load(K_BUY, { fill: true, auto: false, pay: 'card' });
  const fi = (id, ph, extra) => `<input id="sxbi_${id}" placeholder="${ph}" ${extra || ''}>`;
  const BUY_HTML = `<div class="r"><button id="sxbbuyb">\u2699\ufe0f ${L('\u914d\u9001\u5148\u30fb\u652f\u6255\u3044\uff08\u81ea\u52d5\u5165\u529b\uff09', 'Th\u00f4ng tin giao h\u00e0ng & thanh to\u00e1n')}</button></div>
  <div class="sec" id="sxbbuy" style="display:none">
    <b>${L('\u914d\u9001\u5148', '\u0110\u1ecba ch\u1ec9 nh\u1eadn h\u00e0ng')}</b>
    <div class="r">${fi('last', L('\u59d3', 'H\u1ecd (\u59d3)'))}${fi('first', L('\u540d', 'T\u00ean (\u540d)'))}</div>
    <div class="r"${IS_SHOPIFY || IS_FEI ? '' : ' style="display:none"'}>${fi('klast', L('\u30bb\u30a4\uff08\u30ab\u30bf\u30ab\u30ca\uff09', 'H\u1ecd katakana (\u30bb\u30a4)'))}${fi('kfirst', L('\u30e1\u30a4\uff08\u30ab\u30bf\u30ab\u30ca\uff09', 'T\u00ean katakana (\u30e1\u30a4)'))}</div>
    <div class="r"${IS_SHOPIFY || IS_FEI ? '' : ' style="display:none"'}>${fi('email', L('\u30e1\u30fc\u30eb\u30a2\u30c9\u30ec\u30b9', 'Email'), 'type="email" autocomplete="email"')}</div>
    <div class="r">${fi('phone', L('\u643a\u5e2f\u96fb\u8a71\uff08\u4f8b 09012345678\uff09', '\u0110i\u1ec7n tho\u1ea1i (VD 09012345678)'), 'type="tel" inputmode="tel"')}</div>
    <div class="r">${fi('zip', L('\u90f5\u4fbf\u756a\u53f7', 'M\u00e3 b\u01b0u \u0111i\u1ec7n (\u3012)'), 'inputmode="numeric"')}<select id="sxbi_pref"><option value="">${L('\u90fd\u9053\u5e9c\u770c', 'T\u1ec9nh')}</option>${PREFS.map((x, i) => `<option value="${i + 1}">${x}</option>`).join('')}</select></div>
    <div class="r">${fi('city', L('\u5e02\u533a\u753a\u6751', 'Qu\u1eadn / th\u00e0nh ph\u1ed1 (\u5e02\u533a\u753a\u6751)'))}</div>
    <div class="r">${fi('addr1', L('\u4f4f\u6240\uff08\u756a\u5730\uff09', '\u0110\u1ecba ch\u1ec9 (\u756a\u5730)'))}</div>
    <div class="r">${fi('addr2', L('\u5efa\u7269\u540d\u30fb\u90e8\u5c4b\u756a\u53f7\uff08\u4efb\u610f\uff09', 'T\u00f2a nh\u00e0, ph\u00f2ng (kh\u00f4ng b\u1eaft bu\u1ed9c)'))}</div>
    <b style="display:block;margin-top:8px">${L('\u652f\u6255\u3044\u65b9\u6cd5', 'C\u00e1ch thanh to\u00e1n')}</b>
    <div class="r"${IS_SHOPIFY || IS_FEI ? '' : ' style="display:none"'}><select id="sxbi_pay" style="flex:1">${Object.entries(PAYS).filter(([k]) => IS_SHOPIFY || k === 'card' || (IS_FEI && k === 'cod')).map(([k, v]) => `<option value="${k}">${L(v[0], v[1])}</option>`).join('')}</select></div>
    <div class="r" id="sxbkstore"${IS_SHOPIFY ? '' : ' style="display:none"'}><span class="lb">\ud83c\udfea</span><select id="sxbi_kstore" style="flex:1">${KSTORES.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></div>
    <div class="desc"${IS_SHOPIFY ? '' : ' style="display:none"'}>${L('\u5e97\u8217\u306b\u306a\u3044\u652f\u6255\u3044\u65b9\u6cd5\u3092\u9078\u3076\u3068\u81ea\u52d5\u8cfc\u5165\u3057\u307e\u305b\u3093\u3002\u9280\u884c\u632f\u8fbc\u30fb\u30b3\u30f3\u30d3\u30cb\u6c7a\u6e08\u3067 KOMOJU \u306e\u753b\u9762\u306b\u79fb\u308b\u5e97\u8217\u306f\u3001\u30ab\u30bf\u30ab\u30ca\u540d\u30fb\u96fb\u8a71\u756a\u53f7\u30fb\u30b3\u30f3\u30d3\u30cb\u5e97\u8217\u3092\u81ea\u52d5\u5165\u529b\u3057\u3066\u300c\u652f\u6255\u3044\u300d\u307e\u3067\u9032\u307f\u307e\u3059\uff08KOMOJU\u753b\u9762\u3067\u4e00\u5ea6\u300c\u8cbc\u308a\u4ed8\u3051\u300d\u304c\u5fc5\u8981\uff09\u3002',
      'Shop kh\u00f4ng c\u00f3 c\u00e1ch thanh to\u00e1n \u0111\u00e3 ch\u1ecdn th\u00ec BOT kh\u00f4ng t\u1ef1 \u0111\u1eb7t. \u9280\u884c\u632f\u8fbc / \u30b3\u30f3\u30d3\u30cb\u6c7a\u6e08 chuy\u1ec3n sang trang KOMOJU: BOT t\u1ef1 \u0111i\u1ec1n t\u00ean katakana, \u0111i\u1ec7n tho\u1ea1i, ch\u1ecdn c\u1eeda h\u00e0ng konbini r\u1ed3i b\u1ea5m \u652f\u6255\u3044 (l\u1ea7n \u0111\u1ea7u b\u1ea5m "D\u00e1n" \u1edf trang KOMOJU).')}</div>
    <div id="sxbcard">
      <div class="r">${fi('cnum', L('\u30ab\u30fc\u30c9\u756a\u53f7', 'S\u1ed1 th\u1ebb'), 'inputmode="numeric" autocomplete="off"')}</div>
      <div class="r">${fi('cexp', 'MM/YY', 'inputmode="numeric" autocomplete="off"')}${fi('ccvv', L('\u30bb\u30ad\u30e5\u30ea\u30c6\u30a3\u30b3\u30fc\u30c9', 'CVV'), 'inputmode="numeric" autocomplete="off"')}</div>
      <div class="r">${fi('cname', L('\u30ab\u30fc\u30c9\u540d\u7fa9\uff08\u4f8b TARO YAMADA\uff09', 'T\u00ean tr\u00ean th\u1ebb (VD TARO YAMADA)'), 'autocomplete="off"')}</div>
      <div class="r"><button id="sxbi_cclr">${L('\u30ab\u30fc\u30c9\u60c5\u5831\u3092\u6d88\u53bb', 'X\u00f3a th\u00f4ng tin th\u1ebb')}</button></div>
      <div class="desc">${L('\u30ab\u30fc\u30c9\u60c5\u5831\u306f\u3053\u306eiPhone\u306eSafari\u5185\uff08\u3053\u306e\u30b5\u30a4\u30c8\uff09\u306b\u3060\u3051\u4fdd\u5b58\u3055\u308c\u3001\u8cfc\u5165\u753b\u9762\u306e\u5165\u529b\u6b04\u306b\u3060\u3051\u6e21\u3057\u307e\u3059\u3002', 'Th\u00f4ng tin th\u1ebb ch\u1ec9 l\u01b0u trong Safari c\u1ee7a m\u00e1y n\u00e0y (trang n\u00e0y), ch\u1ec9 chuy\u1ec3n v\u00e0o \u00f4 nh\u1eadp c\u1ee7a trang thanh to\u00e1n.')}</div>
    </div>
    <b style="display:block;margin-top:8px">${L('\u81ea\u5206\u306e Discord Webhook\uff08\u4efb\u610f\uff09', 'Webhook Discord ri\u00eang (kh\u00f4ng b\u1eaft bu\u1ed9c)')}</b>
    <div class="r">${fi('uwh', 'https://discord.com/api/webhooks/\u2026', 'autocomplete="off"')}<button id="sxbi_uwht">${L('\u30c6\u30b9\u30c8', 'Th\u1eed')}</button></div>
    <div class="desc">${L('購入成功通知は右下の「通知」から設定してください。この旧欄は使用しません。', 'Mua th\u00e0nh c\u00f4ng s\u1ebd b\u00e1o c\u1ea3 k\u00eanh SYNOVAJOY l\u1eabn webhook ri\u00eang c\u1ee7a b\u1ea1n.')}</div>
    <b style="display:block;margin-top:8px">${L('\u60c5\u5831\u306e\u30b3\u30d4\u30fc / \u8cbc\u308a\u4ed8\u3051\uff08\u4ed6\u306e\u5e97\u8217\u3078\uff09', 'Sao ch\u00e9p / d\u00e1n th\u00f4ng tin (sang shop kh\u00e1c)')}</b>
    <div class="r"><button id="sxbi_copy">\ud83d\udccb ${L('\u30b3\u30d4\u30fc', 'Sao ch\u00e9p')}</button><button id="sxbi_paste">\ud83d\udce5 ${L('\u8cbc\u308a\u4ed8\u3051', 'D\u00e1n')}</button></div>
    <label class="ck"><input type="checkbox" id="sxbi_wcard">${L('\u30ab\u30fc\u30c9\u60c5\u5831\u3082\u542b\u3081\u308b', 'K\u00e8m th\u00f4ng tin th\u1ebb')}</label>
    <div class="desc" id="sxbi_cmsg">${L('\u914d\u9001\u5148\u30fbWebhook\u30fb\u652f\u6255\u3044\u65b9\u6cd5\u3092\u30b3\u30d4\u30fc \u2192 \u4ed6\u306e\u5e97\u8217\u306eBOT\u3067\u300c\u8cbc\u308a\u4ed8\u3051\u300d\u3002', 'Ch\u00e9p \u0111\u1ecba ch\u1ec9, webhook, c\u00e1ch thanh to\u00e1n \u2192 m\u1edf BOT \u1edf shop kh\u00e1c b\u1ea5m "D\u00e1n".')}</div>
    <div class="desc">${L('BOT\u304c\u30ab\u30fc\u30c8\u306b\u5165\u308c\u305f\u6ce8\u6587\u306f\u3001\u8cfc\u5165\u753b\u9762\u3067\u81ea\u52d5\u5165\u529b\u3057\u3066\u6700\u5f8c\u306e\u30dc\u30bf\u30f3\u307e\u3067\u81ea\u52d5\u3067\u62bc\u3057\u307e\u3059\uff08\u5b9f\u969b\u306b\u8cfc\u5165\u3055\u308c\u307e\u3059\uff09\u3002', '\u0110\u01a1n BOT cho v\u00e0o gi\u1ecf: BOT t\u1ef1 \u0111i\u1ec1n trang thanh to\u00e1n v\u00e0 t\u1ef1 b\u1ea5m n\u00fat \u0111\u1eb7t h\u00e0ng cu\u1ed1i c\u00f9ng (mua th\u1eadt).')}</div>
  </div>`;
  const BUY_KEYS = ['last', 'first', 'email', 'phone', 'zip', 'pref', 'city', 'addr1', 'addr2', 'pay', 'cnum', 'cexp', 'ccvv', 'cname', 'uwh', 'klast', 'kfirst', 'kstore'];
  const CARD_KEYS = ['cnum', 'cexp', 'ccvv', 'cname'];
  function readBuy() {
    for (const k of BUY_KEYS) buyCfg[k] = $('sxbi_' + k).value.trim();
    buyCfg.fill = true; buyCfg.auto = true;
    $('sxbcard').style.display = (buyCfg.pay || 'card') === 'card' ? '' : 'none';
    if (IS_SHOPIFY) $('sxbkstore').style.display = buyCfg.pay === 'konbini' ? '' : 'none';
    save(K_BUY, buyCfg);
    if (IS_SHOPIFY) gmSet('sxb_komoju_info', komojuInfo(buyCfg));
  }
  box.innerHTML = `
<div class="hd">${ICON_TAG}<b class="ttl">${TITLE_TAG}<span class="ver">${SHOP} \u00b7 v${IS_GEN ? UZURA_RELEASE : SYNOVA_VERSION}</span></b><button id="sxbpos">${L('\u4e0a\u4e0b', 'L\u00ean/Xu\u1ed1ng')}</button><button id="sxbhide">${L('\u96a0\u3059', '\u1ea8n')}</button></div>
<div class="st" id="sxbst">${st.active ? L('\u5f85\u6a5f\u4e2d', '\u0110ang ch\u1edd') : L('\u505c\u6b62\u4e2d', '\u0110ang t\u1eaft')}</div>
<div class="body">
  <div class="desc">${DESC}</div>${UZURA_CURRENT ? `<div class="desc">対応店舗: ${SHOP} ／ 商品取得形式を確認済み・実購入は未検証</div>` : ''}
  <div class="r"><span class="lb">\u23f0</span><input type="time" id="sxbopen"><span class="desc" style="margin:0">${L('\u8ca9\u58f2\u958b\u59cb\uff08\u65e5\u672c\u6642\u9593\uff09', 'Gi\u1edd m\u1edf b\u00e1n (gi\u1edd Nh\u1eadt)')}</span></div>
  <div class="r"${BASE_OR_VANS ? ' hidden' : ''}><label class="desc" for="sxbmonitor">モニターディレイ（ms）</label><input id="sxbmonitor" type="number" min="${minMonitorDelay}" max="30000" step="1" inputmode="numeric" placeholder="自動"></div>
  ${Array.from({ length: MAX_KW }, (_, i) => `<div class="kw" id="sxbr${i}"><div class="r"><span class="lb">KW${i + 1}</span><input id="sxbk${i}" placeholder="${IS_FEI ? '例: 商品リンク …/shop/g/g2L70260125259124/' : IS_BASE ? '例: 商品リンク …/items/123456' : IS_VANS ? '例: VN000Z3DBLA1' : IS_SUP ? L('\u4f8b: polartec jacket', 'VD: polartec jacket') : L('\u4f8b: tee', 'VD: tee')}"></div>` +
    `<div class="r"><span class="lb"></span><input id="sxbc${i}" placeholder="${L('\u8272\uff08\u4f8b: black\uff09', 'M\u00e0u (VD: black)')}"><input class="sz" id="sxbs${i}" placeholder="${IS_BASE ? 'M&L' : IS_VANS ? '26&27' : L('\u30b5\u30a4\u30ba', 'Size')}">${qtySel('sxbq' + i)}</div></div>`).join('')}
  <div class="r"><button id="sxbadd">\uff0b ${L('\u30ad\u30fc\u30ef\u30fc\u30c9\u8ffd\u52a0', 'Th\u00eam t\u1eeb kh\u00f3a')}</button><button id="sxbdel">\uff0d</button><span class="desc" id="sxbcnt" style="margin:0"></span></div>
  <div class="desc">${L('\u30ad\u30fc\u30ef\u30fc\u30c9: \u5546\u54c1\u540d\u306e\u4e00\u90e8\u3067OK\uff08\u4f8b: faux fur / polartec jacket\uff09\u3002\u8272\u30fb\u30b5\u30a4\u30ba:\u300cblack,white\u300d\u300cM,L\u300d= \u512a\u5148\u9806\u3001\u7a7a\u6b04 = \u5728\u5eab\u306e\u3042\u308b\u3082\u306e',
    'T\u1eeb kh\u00f3a: ch\u1ec9 c\u1ea7n 1 ph\u1ea7n t\u00ean (VD faux fur / polartec jacket). M\u00e0u / Size: "black,white" "M,L" = \u01b0u ti\u00ean theo th\u1ee9 t\u1ef1, \u0111\u1ec3 tr\u1ed1ng = c\u00e1i n\u00e0o c\u00f2n c\u0169ng mua')}<br>${IS_SHOPIFY
      ? L('\u30d0\u30ea\u30a2\u30f3\u30c8ID\uff08\u6570\u5b57\u306e\u307f \u4f8b 42728889876830\uff09\u3092\u5165\u308c\u308b\u3068\u3001\u305d\u306e\u5546\u54c1\u30fb\u30b5\u30a4\u30ba\u3092\u76f4\u63a5\u8cfc\u5165\u3057\u307e\u3059\u3002', 'Nh\u1eadp variant ID (ch\u1ec9 s\u1ed1, VD 42728889876830) = mua th\u1eb3ng \u0111\u00fang m\u00f3n + size \u0111\u00f3.')
      : L('\u5546\u54c1\u30b3\u30fc\u30c9\uff08\u4f8b BF31TE050BK903\uff09\u3092\u5165\u308c\u308b\u3068\u3001\u305d\u306e\u30b3\u30fc\u30c9\u3092\u76f4\u63a5\u8cfc\u5165\u3057\u307e\u3059\u3002', 'Nh\u1eadp m\u00e3 h\u00e0ng (VD BF31TE050BK903) = mua th\u1eb3ng \u0111\u00fang m\u00e3 \u0111\u00f3.')}</div>
  ${BASE_OR_VANS ? '' : BUY_HTML}
  <div class="r btns"><button class="main" id="sxbgo">${goLabel(cfg.open)}</button><button id="sxbnow">${L('\u3059\u3050\u5b9f\u884c', 'Ch\u1ea1y Ngay')}</button><button id="sxbstop">${L('\u505c\u6b62', 'D\u1eebng')}</button><button id="sxblogb">${L('\u30ed\u30b0\u3092\u898b\u308b', 'Xem Log')}</button></div>
  <div id="sxblogw" style="display:none"><div class="r"><button id="sxbclr">${L('\u30ed\u30b0\u6d88\u53bb', 'X\u00f3a log')}</button><button id="sxbcopy">${L('\u30ed\u30b0\u3092\u30b3\u30d4\u30fc', 'Sao ch\u00e9p log')}</button><span class="desc" id="sxblogn" style="margin:0"></span></div><div id="sxblog"></div></div>
</div>`;
  sxRoot = uzuraMountShopPanel(box, 'sxbhost');
  const bub = synovaBubble('sxbbub', () => { ui.hide = false; apply(); });
  const apply = () => {
    box.className = ui.top ? 'top' : 'bot';
    box.style.display = ui.hide ? 'none' : '';
    if (ui.hide) bub.show(ui.top, st.active); else bub.hide();
    save(K_UI, ui);
  };
  apply();
  for (let i = 0; i < MAX_KW; i++) { $('sxbk' + i).value = cfg.items[i].kw; $('sxbc' + i).value = cfg.items[i].color || ''; $('sxbs' + i).value = cfg.items[i].size || ''; $('sxbq' + i).value = String(Math.min(MAX_QTY, cfg.items[i].qty || 1)); }
  const showRows = () => {
    for (let i = 0; i < MAX_KW; i++) $('sxbr' + i).style.display = i < cfg.kwCount ? '' : 'none';
    $('sxbcnt').textContent = `${cfg.kwCount}/${MAX_KW}`;
    $('sxbadd').disabled = cfg.kwCount >= MAX_KW;
    $('sxbdel').disabled = cfg.kwCount <= 1;
  };
  showRows();
  $('sxbadd').onclick = () => { if (cfg.kwCount < MAX_KW) { cfg.kwCount++; save(K_CFG, cfg); showRows(); $('sxbk' + (cfg.kwCount - 1)).focus(); } };
  $('sxbdel').onclick = () => {
    if (cfg.kwCount <= 1) return;
    cfg.kwCount--;
    $('sxbk' + cfg.kwCount).value = ''; $('sxbc' + cfg.kwCount).value = ''; $('sxbs' + cfg.kwCount).value = ''; $('sxbq' + cfg.kwCount).value = '1';
    readCfg(); showRows();
  };
  $('sxbopen').value = cfg.open || '';
  cfg.monitorDelay = uzuraMonitorDelay(cfg.monitorDelay, minMonitorDelay);
  $('sxbmonitor').value = cfg.monitorDelay || '';
  // \u0111\u1ed5i ch\u1eef n\u00fat khi g\u00f5 gi\u1edd ('input', kh\u00f4ng d\u00f9ng 'change' \u2013 Safari b\u1ecf m\u1ea5t c\u00fa b\u1ea5m khi \u00f4 m\u1ea5t focus)
  $('sxbopen').addEventListener('input', () => { const t = goLabel($('sxbopen').value); if ($('sxbgo').textContent !== t) $('sxbgo').textContent = t; });
  if (!BASE_OR_VANS) {
    for (const k of BUY_KEYS) $('sxbi_' + k).value = buyCfg[k] || (k === 'pay' ? 'card' : '');
    buyCfg.fill = true; buyCfg.auto = true; save(K_BUY, buyCfg);
    if (!$('sxbi_pay').value) $('sxbi_pay').value = 'card';      // shop kh\u00f4ng c\u00f3 c\u00e1ch \u0111\u00e3 l\u01b0u (VD \u4ee3\u5f15\u304d \u1edf HUMAN MADE) -> th\u1ebb
    $('sxbcard').style.display = ($('sxbi_pay').value || 'card') === 'card' ? '' : 'none';
    if (!$('sxbi_kstore').value) $('sxbi_kstore').value = 'seven';
    if (IS_SHOPIFY) $('sxbkstore').style.display = $('sxbi_pay').value === 'konbini' ? '' : 'none';
    // ---- sao ch\u00e9p / d\u00e1n: m\u00e3 d\u1ea1ng SYNOVA1:<base64 JSON> (Safari m\u1ed7i shop l\u01b0u ri\u00eang, \u0111\u00e2y l\u00e0 c\u00e1ch chuy\u1ec3n sang shop kh\u00e1c) ----
    const cmsg = (m) => { $('sxbi_cmsg').textContent = m; };
    $('sxbi_copy').onclick = () => {
      readBuy();
      const o = {};
      for (const k of BUY_KEYS) if (buyCfg[k] && ($('sxbi_wcard').checked || !CARD_KEYS.includes(k))) o[k] = buyCfg[k];
      const code = 'SYNOVA1:' + btoa(unescape(encodeURIComponent(JSON.stringify(o))));
      const ok = () => cmsg(L('\u30b3\u30d4\u30fc\u3057\u307e\u3057\u305f \u2192 \u4ed6\u306e\u5e97\u8217\u3067\u300c\u8cbc\u308a\u4ed8\u3051\u300d', '\u0110\u00e3 ch\u00e9p \u2192 sang shop kh\u00e1c b\u1ea5m "D\u00e1n"') + ($('sxbi_wcard').checked ? L('\uff08\u30ab\u30fc\u30c9\u60c5\u5831\u5165\u308a\uff1a\u8cbc\u308a\u4ed8\u3051\u5f8c\u306f\u30af\u30ea\u30c3\u30d7\u30dc\u30fc\u30c9\u3092\u4e0a\u66f8\u304d\u3057\u3066\u304f\u3060\u3055\u3044\uff09', ' (c\u00f3 th\u1ebb: d\u00e1n xong n\u00ean ch\u00e9p th\u1ee9 kh\u00e1c \u0111\u00e8 l\u00ean)') : ''));
      const old = () => { const t = document.createElement('textarea'); t.value = code; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;top:0;opacity:0';
        document.body.appendChild(t); t.select(); t.setSelectionRange(0, code.length); try { document.execCommand('copy'); ok(); } catch (e) {} t.remove(); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(ok, old); else old();
    };
    function applyCode(txt) {
      const m = (txt || '').trim().match(/SYNOVA1:([A-Za-z0-9+/=]+)/);
      if (!m) { cmsg(L('\u30b3\u30fc\u30c9\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093', 'Kh\u00f4ng th\u1ea5y m\u00e3 th\u00f4ng tin')); return; }
      let o;
      try { o = JSON.parse(decodeURIComponent(escape(atob(m[1])))); } catch (e) { cmsg(L('\u30b3\u30fc\u30c9\u304c\u58ca\u308c\u3066\u3044\u307e\u3059', 'M\u00e3 b\u1ecb l\u1ed7i')); return; }
      let n = 0;
      for (const k of BUY_KEYS) if (o[k] != null && $('sxbi_' + k)) { $('sxbi_' + k).value = o[k]; n++; }
      if (!$('sxbi_pay').value) $('sxbi_pay').value = 'card';
      for (const k of ['cexp', 'cnum']) $('sxbi_' + k).dispatchEvent(new Event('input'));
      readBuy();
      cmsg(L(`${n}\u9805\u76ee\u3092\u8cbc\u308a\u4ed8\u3051\u307e\u3057\u305f`, `\u0110\u00e3 d\u00e1n ${n} m\u1ee5c`) + (CARD_KEYS.some((k) => o[k]) ? L('\uff08\u30ab\u30fc\u30c9\u60c5\u5831\u3042\u308a\uff09', ' (c\u00f3 th\u1ebb)') : ''));
    }
    $('sxbi_paste').onclick = () => {
      const manual = () => applyCode(prompt(L('\u30b3\u30d4\u30fc\u3057\u305f\u30b3\u30fc\u30c9\u3092\u8cbc\u308a\u4ed8\u3051\u3066\u304f\u3060\u3055\u3044', 'D\u00e1n m\u00e3 \u0111\u00e3 sao ch\u00e9p v\u00e0o \u0111\u00e2y')) || '');
      if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then((t) => (/SYNOVA1:/.test(t) ? applyCode(t) : manual()), manual); else manual();
    };
    $('sxbi_uwht').onclick = () => {
      readBuy();
      if (!HOOK_RE.test(buyCfg.uwh || '')) { cmsg(L('Webhook URL \u304c\u6b63\u3057\u304f\u3042\u308a\u307e\u305b\u3093', 'URL webhook kh\u00f4ng \u0111\u00fang')); return; }
      synovaPost(buyCfg.uwh, [{ author: '\ud83d\udd14 Webhook Test', title: SHOP, url: location.origin, color: 0xe0a63a, fields: [['Site', HOST, false]] }]);
      cmsg(L('\u30c6\u30b9\u30c8\u9001\u4fe1\u3057\u307e\u3057\u305f\uff08Discord\u3092\u78ba\u8a8d\uff09', '\u0110\u00e3 g\u1eedi th\u1eed (xem Discord)'));
    };
    $('sxbbuyb').onclick = () => { const w = $('sxbbuy'); w.style.display = w.style.display === 'block' ? 'none' : 'block'; };
    // b\u00e0n ph\u00edm s\u1ed1 c\u1ee7a iPhone kh\u00f4ng c\u00f3 d\u1ea5u "/" -> g\u00f5 0330 t\u1ef1 th\u00e0nh 03/30 ; s\u1ed1 th\u1ebb t\u1ef1 c\u00e1ch 4 s\u1ed1 cho d\u1ec5 \u0111\u1ecdc
    $('sxbi_cexp').addEventListener('input', (e) => {
      const d = e.target.value.replace(/\D/g, '').slice(0, 4);
      const v = d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d;
      if (e.target.value !== v) e.target.value = v;
    });
    $('sxbi_cnum').addEventListener('input', (e) => {
      const v = e.target.value.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');
      if (e.target.value !== v) e.target.value = v;
    });
    for (const k of ['cexp', 'cnum']) $('sxbi_' + k).dispatchEvent(new Event('input'));   // gi\u00e1 tr\u1ecb \u0111\u00e3 l\u01b0u (VD 0330) hi\u1ec7n l\u1ea1i d\u1ea1ng 03/30
    $('sxbi_cclr').onclick = () => { for (const k of ['cnum', 'cexp', 'ccvv', 'cname']) $('sxbi_' + k).value = ''; readBuy(); log(L('\u30ab\u30fc\u30c9\u60c5\u5831\u3092\u6d88\u53bb\u3057\u307e\u3057\u305f', '\u0110\u00e3 x\u00f3a th\u00f4ng tin th\u1ebb')); };
    $('sxbbuy').querySelectorAll('input,select').forEach((e) => e.addEventListener('change', readBuy));
  }
  box.querySelectorAll('input,select').forEach((e) => { if (!e.id.startsWith('sxbi_')) e.addEventListener('change', readCfg); });
  $('sxbpos').onclick = () => { ui.top = !ui.top; apply(); };
  $('sxbhide').onclick = () => { ui.hide = true; apply(); };
  setInterval(() => { if (ui.hide) bub.show(ui.top, st.active); }, 1000);
  $('sxbgo').onclick = () => { if (!st.active) start(false); };
  $('sxbnow').onclick = () => {
    if (!st.active) { start(true); return; }
    if (!st.now) { readCfg(); st.now = true; save(K_ST, st); log(L('\u5f85\u6a5f\u3092\u3084\u3081\u3066\u4eca\u3059\u3050\u76e3\u8996', 'B\u1ecf ch\u1edd gi\u1edd \u2013 canh h\u00e0ng ngay')); }
  };
  $('sxbstop').onclick = () => { stopAutoBuy(); finish(L('\u505c\u6b62\u3057\u307e\u3057\u305f\uff08\u81ea\u52d5\u8cfc\u5165\u3082\u505c\u6b62\uff09', '\u0110\u00e3 d\u1eebng (t\u1eaft c\u1ea3 t\u1ef1 mua \u1edf trang thanh to\u00e1n)')); };
  $('sxblogb').onclick = () => {
    const w = $('sxblogw'); w.style.display = w.style.display === 'block' ? 'none' : 'block';
    $('sxblog').textContent = logBuf.join('\n'); $('sxblogn').textContent = logCount();
  };
  $('sxbcopy').onclick = () => {
    const txt = logBuf.join('\n'), b = $('sxbcopy'), ok = () => { b.textContent = L('\u30b3\u30d4\u30fc\u6e08\u307f \u2713', '\u0110\u00e3 ch\u00e9p \u2713'); setTimeout(() => { b.textContent = L('\u30ed\u30b0\u3092\u30b3\u30d4\u30fc', 'Sao ch\u00e9p log'); }, 1500); };
    const old = () => { const t = document.createElement('textarea'); t.value = txt; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;top:0;opacity:0';
      document.body.appendChild(t); t.select(); t.setSelectionRange(0, txt.length); try { document.execCommand('copy'); ok(); } catch (e) {} t.remove(); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, old); else old();
  };
  $('sxbclr').onclick = () => { logBuf = []; logFlush(); $('sxblog').textContent = ''; $('sxblogn').textContent = L('0\u884c', '0 d\u00f2ng'); };

  // CAPTCHA hi\u1ec7n ra (kh\u1ed1i sxbCaptchaYield b\u00e1o): \u0111\u00f3ng ph\u1ea7n c\u00e0i \u0111\u1eb7t + thu g\u1ecdn b\u1ea3ng cho kh\u1ecfi che; gi\u1ea3i xong m\u1edf l\u1ea1i nh\u01b0 c\u0169
  let capPrev = null;
  window.addEventListener('sxb-captcha', (e) => {
    const body = box.querySelector('.body');
    if (e.detail) {
      if (capPrev) return;
      capPrev = { body: body.style.display, buy: $('sxbbuy')?.style.display, logw: $('sxblogw').style.display };
      if ($('sxbbuy')) $('sxbbuy').style.display = 'none';
      $('sxblogw').style.display = 'none'; body.style.display = 'none';
      log(L('CAPTCHA \u304c\u51fa\u305f\u306e\u3067\u8a2d\u5b9a\u3092\u9589\u3058\u307e\u3057\u305f\uff08\u89e3\u304d\u7d42\u308f\u308b\u307e\u3067\u3088\u3051\u3066\u3044\u307e\u3059\uff09', 'C\u00f3 CAPTCHA \u2192 \u0111\u00e3 \u0111\u00f3ng c\u00e0i \u0111\u1eb7t, BOT tr\u00e1nh ch\u1ed7 t\u1edbi khi b\u1ea1n gi\u1ea3i xong'));
    } else if (capPrev) {
      body.style.display = capPrev.body; if ($('sxbbuy')) $('sxbbuy').style.display = capPrev.buy; $('sxblogw').style.display = capPrev.logw; capPrev = null;
      log(L('CAPTCHA \u304c\u6d88\u3048\u305f\u306e\u3067\u30d1\u30cd\u30eb\u3092\u623b\u3057\u307e\u3057\u305f', 'CAPTCHA \u0111\u00e3 xong \u2192 tr\u1ea3 b\u1ea3ng BOT v\u1ec1 nh\u01b0 c\u0169'));
    }
  });

  if (st.active) run();                         // t\u1ea3i l\u1ea1i trang (Cloudflare / Queue-it) -> ch\u1ea1y ti\u1ebfp
})();

// ===================== Supreme: t\u1ef1 \u0111i\u1ec1n trang thanh to\u00e1n (Shopify checkout) =====================
// \u00d4 \u0111\u1ecba ch\u1ec9 \u1edf trang ch\u00ednh (React: ph\u1ea3i g\u00e1n value b\u1eb1ng setter g\u1ed1c + b\u1eafn input/change, g\u00e1n th\u1eb3ng .value React kh\u00f4ng nh\u1eadn).
// \u00d4 th\u1ebb n\u1eb1m trong khung checkout.pci.shopifyinc.com (kh\u00e1c t\u00ean mi\u1ec1n, kh\u00f4ng \u0111\u1ecdc \u0111\u01b0\u1ee3c localStorage c\u1ee7a Supreme)
// -> g\u1eedi s\u1ed1 th\u1ebb qua postMessage, CH\u1ec8 t\u1edbi \u0111\u00fang t\u00ean mi\u1ec1n \u0111\u00f3; script ch\u1ea1y trong khung t\u1ef1 \u0111i\u1ec1n \u00f4 c\u1ee7a n\u00f3 (xem ph\u1ea7n d\u01b0\u1edbi).
const PCI_ORIGIN = 'https://checkout.pci.shopifyinc.com';
// t\u1eaft t\u1ef1 mua: xo\u00e1 d\u1ea5u "BOT v\u1eeba cho h\u00e0ng v\u00e0o gi\u1ecf" \u1edf shop + kho chung (KOMOJU / shop.app c\u0169ng th\u00f4i t\u1ef1 b\u1ea5m)
function stopAutoBuy() {
  try { localStorage.removeItem(K_LAST); } catch (e) {}
  gmSet('sxb_bot_buy', null);
  gmSet('sxb_komoju_order', null);
}
function synovaBanner(onStop) {
  const host = document.createElement('div');
  host.id = 'sxbbanner';
  host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;left:0;right:0;bottom:0;height:0';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>.b{position:fixed;left:8px;right:8px;bottom:calc(env(safe-area-inset-bottom) + 8px);display:flex;gap:8px;align-items:center;background:#0d1b32;color:#ffffff;
    border:1px solid #527198;border-radius:12px;padding:7px 8px 7px 10px;font:600 12px -apple-system,"Hiragino Sans",sans-serif;box-shadow:0 4px 16px #000a;box-sizing:border-box}
    .t{flex:1;line-height:1.35} button{flex:none;border:1px solid #6b2a2a;background:#2b1416;color:#ff8a80;border-radius:9px;padding:6px 9px;font:700 12px -apple-system,sans-serif}</style>
    <div class="b"><span class="t" id="t">うずら BOT</span><button id="x">\u23f9 ${L('\u505c\u6b62', 'D\u1eebng')}</button></div>`;
  root.getElementById('x').onclick = () => { onStop(); root.getElementById('x').style.display = 'none'; };
  return {
    say(m) { if (!host.isConnected && document.body) document.body.appendChild(host); root.getElementById('t').textContent = 'うずら BOT \u00b7 ' + m; },
    text: () => root.getElementById('t').textContent,
    remove: () => host.remove(),
    hideStop: () => { root.getElementById('x').style.display = 'none'; },
  };
}
// ===================== FEILER: trang /shop/order/ (\u3054\u6ce8\u6587\u65b9\u6cd5\u306e\u6307\u5b9a -> \u3054\u6ce8\u6587\u5185\u5bb9\u306e\u78ba\u8a8d) =====================
// Kh\u1ea3o s\u00e1t 22/11: form frmMethod (HTML th\u01b0\u1eddng, g\u1eedi Shift_JIS theo b\u1ea3ng m\u00e3 c\u1ee7a trang): s_name / s_name2 (\u59d3 / \u540d), s_kana / s_kana2,
// s_tel, s_mail / s_cmail, s_zip, s_pref (t\u00ean t\u1ec9nh), s_addr (\u5e02\u533a\u753a\u6751), s_addr2 (\u756a\u5730), s_addr3 (\u5efa\u7269), chkself (giao t\u1edbi ng\u01b0\u1eddi \u0111\u1eb7t),
// radio method (7 = th\u1ebb, 2 = \u4ee3\u91d1\u5f15\u63db), n\u00fat \u1ea3nh name=submit \u300c\u6b21\u3078\u300d -> /shop/order/estimate.aspx (\u3054\u6ce8\u6587\u5185\u5bb9\u306e\u78ba\u8a8d).
// Trang x\u00e1c nh\u1eadn + \u00f4 th\u1ebb + n\u00fat \u0111\u1eb7t h\u00e0ng CH\u01afA kh\u1ea3o s\u00e1t (c\u1ea7n th\u00f4ng tin ng\u01b0\u1eddi mua th\u1eadt) -> BOT d\u1eebng \u1edf \u0111\u00f3, ng\u01b0\u1eddi d\u00f9ng t\u1ef1 l\u00e0m.
// Kh\u00f4ng b\u1eafn s\u1ef1 ki\u1ec7n focus / blur v\u00e0o \u00f4 \u3012: trang c\u00f3 JS t\u1ef1 tra \u0111\u1ecba ch\u1ec9 theo \u3012, s\u1ebd ghi \u0111\u00e8 t\u1ec9nh / qu\u1eadn BOT v\u1eeba \u0111i\u1ec1n.
if (!SYNOVA_DUP && !IN_FRAME && FEI_ORDER) (async function feiOrder() {
  'use strict';
  let c = {}, last = null;
  try { c = JSON.parse(localStorage.getItem(K_BUY)) || {}; } catch (e) {}
  try { last = JSON.parse(localStorage.getItem(K_LAST)); } catch (e) {}
  if (!(last && last.items && last.items.length && Date.now() - last.at < 10 * 60e3)) return;   // \u0111\u01a1n b\u1ea1n t\u1ef1 mua: BOT kh\u00f4ng \u0111\u1ee5ng v\u00e0o
  let auto = true;
  const ban = synovaBanner(() => { stopAutoBuy(); auto = false; ban.say(L('\u81ea\u52d5\u5165\u529b\u3092\u505c\u6b62\u3057\u307e\u3057\u305f\uff08\u81ea\u5206\u3067\u64cd\u4f5c\u3057\u3066\u304f\u3060\u3055\u3044\uff09', '\u0110\u00e3 d\u1eebng \u2013 b\u1ea1n t\u1ef1 thao t\u00e1c')); });
  const path = location.pathname.toLowerCase();
  if (/estimate\.aspx/.test(path)) {
    // Kh\u1ea3o s\u00e1t 22/11 (g\u1eedi form b\u1eb1ng th\u00f4ng tin m\u1eabu, KH\u00d4NG b\u1ea5m \u3054\u6ce8\u6587): form #frmSales POST /shop/order/estimate.aspx (estimate, comment,
    // crsirefo_hidden, order_agree). N\u00fat \u1ea3nh name=submit \u300c\u3054\u6ce8\u6587\u300d b\u1ecb kho\u00e1 t\u1edbi khi t\u00edch \u00f4 \u300c\u4e0a\u8a18\u306e\u6ce8\u610f\u4e8b\u9805\u306b\u540c\u610f\u3059\u308b\u300d (order_agree.js).
    // Th\u1ebb (GMO \u30de\u30eb\u30c1\u30da\u30a4\u30e1\u30f3\u30c8, mp-token.js \u0111\u1ed5i th\u1ebb ra token l\u00fac b\u1ea5m n\u00fat): radio card 1 Visa / 2 Master / 3 JCB / 4 Amex / 5 Diners,
    // card_num, security_code, select card_m (01-12), card_y (4 s\u1ed1), card_method (1 = \u4e00\u62ec). C\u00f3 ch\u1ed1ng gian l\u1eadn ASUKA (fraudprevention.jp).
    // Ch\u01b0a \u0111\u1eb7t \u0111\u01a1n th\u1eadt l\u1ea7n n\u00e0o -> ph\u1ea7n sau c\u00fa b\u1ea5m \u300c\u3054\u6ce8\u6587\u300d (3D\u30bb\u30ad\u30e5\u30a2, trang ho\u00e0n t\u1ea5t) ch\u01b0a th\u1ea5y.
    const f = document.getElementById('frmSales') || document.querySelector('form[action*="estimate.aspx"]');
    // B\u1ea3n iPhone (UA \u0111i\u1ec7n tho\u1ea1i, d\u00f2 22/11): form kh\u00f4ng c\u00f3 id, n\u00fat l\u00e0 <input type=submit name="submit.x" value="\u6ce8\u6587\u3059\u308b">;
    // b\u1ea3n m\u00e1y t\u00ednh: n\u00fat \u1ea3nh name=submit alt \u300c\u3054\u6ce8\u6587\u300d -> nh\u1eadn c\u1ea3 hai, l\u1ea5y ch\u1eef tr\u00ean n\u00fat \u0111\u1ec3 b\u00e1o.
    const btn = f && [...f.querySelectorAll('input[name="submit.x"], input[name="submit"], button[name="submit"]')].filter((e) => !/hiddenEnter_/.test(e.className)).pop();
    const BL = '\u300c' + ((btn && (btn.value || btn.alt)) || '\u3054\u6ce8\u6587').trim() + '\u300d';
    const agree = f && f.querySelector('input[name="order_agree"]');
    if (!f || !btn) { ban.say(L('\u78ba\u8a8d\u753b\u9762\u3092\u8aad\u3081\u307e\u305b\u3093 \u2192 \u3054\u81ea\u5206\u3067\u64cd\u4f5c\u3057\u3066\u304f\u3060\u3055\u3044', 'Kh\u00f4ng \u0111\u1ecdc \u0111\u01b0\u1ee3c trang x\u00e1c nh\u1eadn \u2192 b\u1ea1n t\u1ef1 thao t\u00e1c')); return; }
    let sent = false;
    try { sent = sessionStorage.getItem('sxb_fei_order') === String(last.at); } catch (e) {}
    if (sent) { ban.say(L('\u6ce8\u6587\u304c\u901a\u308a\u307e\u305b\u3093\u3067\u3057\u305f \u2192 \u8d64\u5b57\u3092\u78ba\u8a8d\u3057\u3001\u3054\u81ea\u5206\u3067\u64cd\u4f5c\u3057\u3066\u304f\u3060\u3055\u3044', 'Shop ch\u01b0a nh\u1eadn \u0111\u01a1n \u2192 xem d\u00f2ng b\u00e1o l\u1ed7i r\u1ed3i b\u1ea1n t\u1ef1 thao t\u00e1c')); return; }
    const setV = (e, v) => { if (!e) return false; e.value = v; for (const t of ['input', 'change']) e.dispatchEvent(new Event(t, { bubbles: true })); return e.value === v; };
    const total = ((document.body.innerText || '').match(/\u6ce8\u6587\u91d1\u984d\u5408\u8a08[^\uffe5\u00a5]*[\uffe5\u00a5]\s*([\d,]+)/) || [])[1] || '';
    setTimeout(() => {                            // ch\u1edd jQuery c\u1ee7a trang g\u1eafn xong s\u1ef1 ki\u1ec7n
      if (!auto) return;
      if (f.elements.card_num) {
        const num = String(c.cnum || '').replace(/\D/g, ''), ed = String(c.cexp || '').replace(/\D/g, ''), cvv = String(c.ccvv || '').replace(/\D/g, '');
        if (num.length < 12 || ed.length < 4 || !cvv) { ban.say(L('\u2699\ufe0f \u306b\u30ab\u30fc\u30c9\u60c5\u5831\u304c\u3042\u308a\u307e\u305b\u3093 \u2192 \u3054\u81ea\u5206\u3067\u5165\u529b\u3057\u3066', 'Ch\u01b0a c\u00f3 th\u1ebb trong \u2699\ufe0f \u2192 b\u1ea1n t\u1ef1 nh\u1eadp th\u1ebb r\u1ed3i b\u1ea5m ') + BL); return; }
        const brand = /^4/.test(num) ? '1' : /^3[47]/.test(num) ? '4' : /^3[0689]/.test(num) ? '5' : /^35/.test(num) ? '3' : '2';
        const r = f.querySelector(`input[name=card][value="${brand}"]`);
        if (r && !r.checked) r.click();
        const ok = setV(f.elements.card_num, num) & setV(f.elements.security_code, cvv) & setV(f.elements.card_m, ed.slice(0, 2)) &
          setV(f.elements.card_y, '20' + ed.slice(-2)) & setV(f.elements.card_method, '1');
        if (!ok || !r) { ban.say(L('\u30ab\u30fc\u30c9\u5165\u529b\u6b04\u304c\u60f3\u5b9a\u3068\u9055\u3044\u307e\u3059 \u2192 \u3054\u81ea\u5206\u3067\u78ba\u8a8d\u3057\u3066', '\u00d4 th\u1ebb kh\u00e1c d\u1ef1 ki\u1ebfn (h\u1ea1n th\u1ebb kh\u00f4ng c\u00f3 trong danh s\u00e1ch?) \u2192 b\u1ea1n t\u1ef1 xem l\u1ea1i r\u1ed3i b\u1ea5m ') + BL); return; }
      }
      if (agree && !agree.checked) agree.click();
      let n = 0;
      const t = setInterval(() => {
        if (!auto || ++n > 100) { clearInterval(t); if (auto) ban.say(BL + L('\u30dc\u30bf\u30f3\u304c\u62bc\u305b\u307e\u305b\u3093 \u2192 \u3054\u81ea\u5206\u3067\u62bc\u3057\u3066\u304f\u3060\u3055\u3044', ' ch\u01b0a b\u1eadt \u2192 b\u1ea1n t\u1ef1 b\u1ea5m')); return; }
        // \u00f4 \u0111\u1ed3ng \u00fd \u0111\u00e3 t\u00edch m\u00e0 n\u00fat v\u1eabn kho\u00e1 (JS c\u1ee7a trang g\u1eafn s\u1ef1 ki\u1ec7n sau c\u00fa b\u1ea5m c\u1ee7a BOT) -> b\u1ea5m l\u1ea1i \u00f4 \u0111\u00f3 m\u1ed7i 0,3 gi\u00e2y
        if (btn.disabled) { if (agree && n % 6 === 0) { if (agree.checked) agree.click(); agree.click(); } return; }
        clearInterval(t);
        try { sessionStorage.setItem('sxb_fei_order', String(last.at)); } catch (e) {}
        ban.say(BL + L('\u3092\u62bc\u3057\u307e\u3057\u305f', ' \u2013 \u0111\u00e3 b\u1ea5m') + (total ? ` \u00b7 \u5408\u8a08 \u00a5${total}` : '') + (f.elements.card_num ? L('\uff083D\u30bb\u30ad\u30e5\u30a2\u304c\u51fa\u305f\u3089\u3054\u81ea\u5206\u3067\uff09', ' (c\u00f3 3D Secure th\u00ec b\u1ea1n t\u1ef1 nh\u1eadp)') : ''));
        btn.click();
      }, 50);
    }, 80);
    ban.say(L('\u3054\u6ce8\u6587\u5185\u5bb9\u306e\u78ba\u8a8d \u2192 \u81ea\u52d5\u5165\u529b\u4e2d\u2026', 'Trang x\u00e1c nh\u1eadn \u2192 \u0111ang t\u1ef1 \u0111i\u1ec1n\u2026') + (total ? ` \u5408\u8a08 \u00a5${total}` : ''));
    return;
  }
  if (!/method\.aspx/.test(path)) return;
  const f = document.forms.frmMethod;
  if (!f) {
    const g = document.querySelector('input[name="guest.x"], input[name="guest"]');   // iPhone: type=submit name="guest.x"; m\u00e1y t\u00ednh: n\u00fat \u1ea3nh name=guest
    let done = false;
    try { done = sessionStorage.getItem('sxb_fei_guest') === String(last.at); sessionStorage.setItem('sxb_fei_guest', String(last.at)); } catch (e) {}
    if (g && !done) { ban.say(L('\u300c\u4f1a\u54e1\u767b\u9332\u305b\u305a\u306b\u8cfc\u5165\u300d\u3092\u62bc\u3057\u307e\u3059', 'B\u1ea5m \u300c\u4f1a\u54e1\u767b\u9332\u305b\u305a\u306b\u8cfc\u5165\u300d')); g.click(); }
    else ban.say(L('\u5165\u529b\u753b\u9762\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093 \u2192 \u3054\u81ea\u5206\u3067\u64cd\u4f5c\u3057\u3066\u304f\u3060\u3055\u3044', 'Kh\u00f4ng th\u1ea5y form mua kh\u00e1ch \u2192 b\u1ea1n t\u1ef1 thao t\u00e1c'));
    return;
  }
  const el = (n) => f.elements[n];
  const set = (n, v) => { const e = el(n); if (e && !(e instanceof RadioNodeList) && v != null && v !== '') e.value = v; };
  const zip = String(c.zip || '').replace(/\D/g, '');
  set('s_name', c.last); set('s_name2', c.first); set('s_kana', c.klast); set('s_kana2', c.kfirst);
  set('s_tel', String(c.phone || '').replace(/\D/g, ''));
  set('s_mail', c.email); set('s_cmail', c.email);
  set('s_zip', zip.length === 7 ? zip.slice(0, 3) + '-' + zip.slice(3) : zip);
  // \u2699\ufe0f ch\u01b0a ch\u1ecdn t\u1ec9nh (22/11 user g\u1eb7p: \u00f4 \u90fd\u9053\u5e9c\u770c b\u1ecf tr\u1ed1ng) -> h\u1ecfi ch\u00ednh API tra \u3012 c\u1ee7a shop (ziplist_sb.js d\u00f9ng: /shop/search/lookupzipjson.aspx,
  // tr\u1ea3 JSON Shift_JIS {"1000001":{zip,pref,addr,addr2}}), 1 request; m\u1ecdi k\u1ebft qu\u1ea3 c\u00f9ng 1 t\u1ec9nh m\u1edbi l\u1ea5y, r\u1ed3i nh\u1edb lu\u00f4n v\u00e0o \u2699\ufe0f.
  if (!c.pref && zip.length === 7) { ban.say(L('\u3012\u304b\u3089\u90fd\u9053\u5e9c\u770c\u3092\u78ba\u8a8d\u4e2d\u2026', '\u0110ang tra t\u1ec9nh theo \u3012\u2026')); await feiPref(c, () => auto); if (!auto) return; }
  set('s_pref', PREFS[+c.pref - 1] || '');
  set('s_addr', c.city); set('s_addr2', c.addr1); set('s_addr3', c.addr2);
  if (el('chkself') && !el('chkself').checked) el('chkself').click();
  const payVal = c.pay === 'cod' ? '2' : '7';
  const radio = f.querySelector(`input[type=radio][name=method][value="${payVal}"]`);
  if (radio && !radio.checked) radio.click();     // b\u1ea5m th\u1eadt \u0111\u1ec3 JS c\u1ee7a trang (method_check.js) ch\u1ea1y nh\u01b0 ng\u01b0\u1eddi d\u00f9ng ch\u1ecdn
  try { localStorage.setItem('sxb_pay_used', JSON.stringify({ label: PAYS[c.pay === 'cod' ? 'cod' : 'card'][0], email: c.email || '', at: Date.now() })); } catch (e) {}
  const NEED = [['last', '\u59d3'], ['first', '\u540d'], ['klast', '\u30bb\u30a4'], ['kfirst', '\u30e1\u30a4'], ['phone', L('\u96fb\u8a71\u756a\u53f7', '\u0111i\u1ec7n tho\u1ea1i')], ['email', L('\u30e1\u30fc\u30eb', 'email')],
    ['zip', '\u3012'], ['pref', L('\u90fd\u9053\u5e9c\u770c', 't\u1ec9nh')], ['city', '\u5e02\u533a\u753a\u6751'], ['addr1', '\u756a\u5730']];
  const miss = NEED.filter(([k]) => !String(c[k] || '').trim()).map(([, n]) => n);
  if (miss.length) { ban.say(L('\u2699\ufe0f \u306e\u672a\u5165\u529b: ', 'Thi\u1ebfu trong \u2699\ufe0f: ') + miss.join(' / ') + L(' \u2192 \u3054\u81ea\u5206\u3067\u5165\u529b\u3057\u3066\u6b21\u3078', ' \u2192 b\u1ea1n t\u1ef1 \u0111i\u1ec1n r\u1ed3i b\u1ea5m n\u00fat sang trang x\u00e1c nh\u1eadn')); return; }
  if (!radio) { ban.say(L('\u3053\u306e\u6ce8\u6587\u3067\u306f\u9078\u3093\u3060\u652f\u6255\u3044\u65b9\u6cd5\u304c\u4f7f\u3048\u307e\u305b\u3093 \u2192 \u3054\u81ea\u5206\u3067\u9078\u3093\u3067\u6b21\u3078', '\u0110\u01a1n n\u00e0y kh\u00f4ng c\u00f3 c\u00e1ch thanh to\u00e1n \u0111\u00e3 c\u00e0i \u2192 b\u1ea1n t\u1ef1 ch\u1ecdn r\u1ed3i b\u1ea5m n\u00fat sang trang x\u00e1c nh\u1eadn')); return; }
  // ch\u1ec9 t\u1ef1 b\u1ea5m \u300c\u6b21\u3078\u300d 1 l\u1ea7n / \u0111\u01a1n: shop tr\u1ea3 form l\u1ea1i (b\u00e1o l\u1ed7i \u0111\u1ecf) th\u00ec \u0111\u1ec3 ng\u01b0\u1eddi d\u00f9ng s\u1eeda, kh\u00f4ng b\u1ea5m l\u1eb7p
  let sent = false;
  try { sent = sessionStorage.getItem('sxb_fei_next') === String(last.at); } catch (e) {}
  if (sent) { ban.say(L('\u5165\u529b\u5185\u5bb9\u306b\u30a8\u30e9\u30fc\u304c\u3042\u308a\u307e\u3059 \u2192 \u8d64\u5b57\u3092\u76f4\u3057\u3066\u6b21\u3078\u9032\u3093\u3067\u304f\u3060\u3055\u3044', 'Shop tr\u1ea3 form l\u1ea1i \u2192 xem d\u00f2ng b\u00e1o l\u1ed7i, s\u1eeda r\u1ed3i b\u1ea5m n\u00fat sang trang x\u00e1c nh\u1eadn')); return; }
  // iPhone: n\u00fat \u1ea3nh #order_next \u300c\u6ce8\u6587\u306e\u78ba\u8a8d\u753b\u9762\u306b\u9032\u3080\u300d (tr\u01b0\u1edbc n\u00f3 c\u00f3 1 n\u00fat \u1ea9n class hiddenEnter_ c\u00f9ng name); m\u00e1y t\u00ednh: n\u00fat \u1ea3nh \u300c\u6b21\u3078\u300d
  const next = f.querySelector('#order_next') || [...f.querySelectorAll('input[name="submit"], input[name="submit.x"], button[name="submit"]')].filter((e) => !/hiddenEnter_/.test(e.className)).pop();
  const NL = '\u300c' + ((next && (next.alt || next.value)) || '\u6b21\u3078').trim() + '\u300d';
  if (!next) { ban.say(L('\u300c\u6b21\u3078\u300d\u30dc\u30bf\u30f3\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093 \u2192 \u3054\u81ea\u5206\u3067\u62bc\u3057\u3066\u304f\u3060\u3055\u3044', 'Kh\u00f4ng th\u1ea5y n\u00fat sang trang x\u00e1c nh\u1eadn \u2192 b\u1ea1n t\u1ef1 b\u1ea5m')); return; }
  ban.say(L('\u5165\u529b\u5b8c\u4e86 \u2192 ', '\u0110\u00e3 \u0111i\u1ec1n xong \u2192 b\u1ea5m ') + NL + L('\u3092\u62bc\u3057\u307e\u3059', ''));
  setTimeout(() => {
    if (!auto) return;
    try { sessionStorage.setItem('sxb_fei_next', String(last.at)); } catch (e) {}
    next.click();
  }, 120);
})();

const SHOPIFY_CO = /\/checkouts\/(cn|c|co)?\/?[A-Za-z0-9]/.test(location.pathname) && (IS_SHOPIFY || (() => { try { return !!localStorage.getItem(K_BUY); } catch (e) { return false; } })());
if (!SYNOVA_DUP && !IN_FRAME && !IS_HM && !IS_BUF && SHOPIFY_CO) (function () {
  'use strict';
  let c = {}, last = null;
  try { c = JSON.parse(localStorage.getItem(K_BUY)) || {}; } catch (e) {}
  try { last = JSON.parse(localStorage.getItem(K_LAST)); } catch (e) {}
  const byBot = !!(last && Date.now() - last.at < 10 * 60e3);
  let auto = byBot;                               // t\u1ef1 \u0111\u1eb7t h\u00e0ng khi BOT v\u1eeba cho h\u00e0ng v\u00e0o gi\u1ecf (10 ph\u00fat)
  const exp = (s) => { const d = (s || '').replace(/\D/g, ''); return d.length >= 4 ? d.slice(0, 2) + d.slice(-2) : d; };   // "12/28" "1228" "12/2028" -> 1228
  const PAY = c.pay && PAYS[c.pay] ? c.pay : 'card';
  let expandTried = false, guestTried = false;
  gmSet('sxb_komoju_info', komojuInfo(c));
  let gmOrderSig = '';
  // \u0111\u01a1n kh\u00f4ng qua BOT: l\u01b0u gi\u1ecf \u0111\u1ec3 b\u00e1o Discord \u0111\u1ee7 \u1ea3nh + t\u00ean m\u00f3n (k\u1ec3 c\u1ea3 \u0111\u01a1n \u0111i qua KOMOJU)
  if (!/thank[-_]you/i.test(location.pathname)) saveCartSnap().then((ok) => { if (ok) gmOrderSig = ''; });
  // n\u00fat ch\u1ecdn c\u00e1ch thanh to\u00e1n: id "basic-creditCards" / "basic-\u30b3\u30f3\u30d3\u30cb\u6c7a\u6e08" / "basic-\u9280\u884c\u632f\u8fbc" / "basic-\u30b9\u30de\u30db\u6c7a\u6e08 (QR\u30b3\u30fc\u30c9)" / "basic-paymentOnDelivery"
  const payRadio = () => [...document.querySelectorAll('input[type=radio][name="basic"], input[type=radio][id^="basic-"]')]
    .find((r) => PAYS[PAY][2].test(r.id + ' ' + ((r.labels && r.labels[0] && r.labels[0].innerText) || '')));
  const card = PAY === 'card' && (c.cnum || '').replace(/\D/g, '').length >= 12
    ? { number: c.cnum.replace(/\D/g, ''), expiry: exp(c.cexp), verification_value: (c.ccvv || '').replace(/\D/g, ''), name: c.cname || '' } : null;

  // \u23f9 D\u1eebng ngay tr\u00ean trang thanh to\u00e1n: th\u00f4i t\u1ef1 b\u1ea5m mua (\u0111\u01a1n n\u00e0y + KOMOJU / shop.app)
  const ban = synovaBanner(() => { stopAutoBuy(); auto = false; ban.say(L('\u81ea\u52d5\u8cfc\u5165\u3092\u505c\u6b62\u3057\u307e\u3057\u305f\uff08\u81ea\u5206\u3067\u64cd\u4f5c\u3057\u3066\u304f\u3060\u3055\u3044\uff09', '\u0110\u00e3 d\u1eebng t\u1ef1 mua \u2013 b\u1ea1n t\u1ef1 thao t\u00e1c')); });
  const bn = { remove: () => ban.remove() };
  const say = (m) => ban.say(m);
  if (!auto) ban.hideStop();

  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const q = (sel) => [...document.querySelectorAll(sel)].find((e) => !/^autofill/.test(e.id) && vis(e));
  function setVal(el, v) {
    const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }
  // m\u1ecdi \u00f4 t\u00edch \u0111\u1ed3ng \u00fd \u0111ang hi\u1ec7n c\u1ee7a Supreme (id japan-\u2026-confirmation); kh\u00f4ng \u0111\u1ee5ng \u00f4 "l\u01b0u th\u00f4ng tin" / nh\u1eadn tin
  const confirms = () => [...document.querySelectorAll('input[type=checkbox][id^="japan-"][id$="-confirmation"]')].filter((b) => vis(b) || (b.labels && b.labels[0] && vis(b.labels[0])));
  const FIELDS = [['email', 'email'], ['lastName', 'last'], ['firstName', 'first'], ['postalCode', 'zip'], ['city', 'city'], ['address1', 'addr1'], ['address2', 'addr2'], ['phone', 'phone']];
  const cardOk = {};
  window.addEventListener('message', (e) => {
    if (e.origin !== PCI_ORIGIN || !e.data || !card) return;
    if (e.data.synova === 'pci-ready') e.source.postMessage({ synova: 'card', card }, PCI_ORIGIN);
    if (e.data.synova === 'pci-filled') cardOk[e.data.field] = true;
  });
  let lastSend = 0, clicks = 0, lastClick = 0;
  const t0 = Date.now();
  const timer = setInterval(() => {
    const now = Date.now();
    if (auto && !localStorage.getItem(K_LAST)) { auto = false; ban.hideStop(); }   // \u0111\u00e3 b\u1ea5m D\u1eebng \u1edf khung BOT
    if (now - t0 > 180e3 || /thank[-_]you|processing/i.test(location.pathname)) { clearInterval(timer); bn.remove(); return; }
    {
      for (const [name, k] of FIELDS) { const el = q(`input[name="${name}"]`); if (el && c[k] && !el.value) setVal(el, c[k]); }
      const zone = q('select[name="zone"]');
      if (zone && c.pref && !zone.value) setVal(zone, 'JP-' + String(c.pref).padStart(2, '0'));
      const r = payRadio();
      if (r && !r.checked) r.click();
      if (card && now - lastSend > 1000) {          // khung th\u1ebb c\u00f3 th\u1ec3 t\u1ea3i sau / b\u1ecb d\u1ef1ng l\u1ea1i -> g\u1eedi l\u1ea1i m\u1ed7i gi\u00e2y t\u1edbi khi \u0111i\u1ec1n xong
        lastSend = now;
        document.querySelectorAll('iframe[src^="' + PCI_ORIGIN + '"]').forEach((f) => { try { f.contentWindow.postMessage({ synova: 'card', card }, PCI_ORIGIN); } catch (e) {} });
      }
      // \u00f4 \u0111\u1ed3ng \u00fd: japan-terms-confirmation (\u0111i\u1ec1u kho\u1ea3n) + japan-cod-confirmation (ph\u00ed \u4ee3\u5f15\u304d, ch\u1ec9 hi\u1ec7n khi ch\u1ecdn \u4ee3\u91d1\u5f15\u63db) \u2026
      for (const b of confirms()) if (!b.checked) b.click();
    }
    // s\u1eb5n s\u00e0ng: \u00f4 b\u1eaft bu\u1ed9c c\u00f3 ch\u1eef, \u0111\u00e3 ch\u1ecdn t\u1ec9nh, \u0111\u00e3 t\u00edch m\u1ecdi \u00f4 \u0111\u1ed3ng \u00fd, \u0111\u00fang c\u00e1ch thanh to\u00e1n, th\u1ebb \u0111\u00e3 \u0111i\u1ec1n (ho\u1eb7c \u4ee3\u91d1\u5f15\u63db / th\u1ebb \u0111\u00e3 l\u01b0u)
    const need = ['email', 'lastName', 'firstName', 'postalCode', 'city', 'address1', 'phone'].map((n) => q(`input[name="${n}"]`)).filter(Boolean);
    const zone = q('select[name="zone"]');
    const pciFrames = [...document.querySelectorAll('iframe[src^="' + PCI_ORIGIN + '"]')].filter(vis);
    const cardReady = PAY !== 'card' || !pciFrames.length || (cardOk.number && cardOk.expiry && cardOk.verification_value);
    const missing = need.filter((e) => !e.value).map((e) => e.name);
    if (zone && !zone.value) missing.push('zone');
    if (confirms().some((b) => !b.checked)) missing.push(L('\u540c\u610f\u30c1\u30a7\u30c3\u30af', '\u00f4 \u0111\u1ed3ng \u00fd'));
    // CH\u1ed0T AN TO\u00c0N: ch\u1ec9 b\u1ea5m khi TH\u1ea4Y \u0111\u00fang c\u00e1ch thanh to\u00e1n \u0111\u00e3 c\u00e0i \u0111ang \u0111\u01b0\u1ee3c ch\u1ecdn.
    // T\u00e0i kho\u1ea3n Shop \u0111\u00e3 l\u01b0u th\u1ebb / \u0111\u1ecba ch\u1ec9: trang r\u00fat g\u1ecdn "\u304a\u652f\u6255\u3044 Visa \u00b7\u00b7\u00b7\u00b7 4423", kh\u00f4ng c\u00f3 n\u00fat ch\u1ecdn c\u00e1ch thanh to\u00e1n
    // -> tr\u01b0\u1edbc \u0111\u00e2y BOT v\u1eabn b\u1ea5m \u4eca\u3059\u3050\u652f\u6255\u3046 = tr\u1ea3 b\u1eb1ng th\u1ebb \u0111\u00e3 l\u01b0u d\u00f9 c\u00e0i \u30b3\u30f3\u30d3\u30cb (user b\u00e1o). Gi\u1edd: th\u1eed m\u1edf m\u1ee5c \u304a\u652f\u6255\u3044;
    // v\u1eabn kh\u00f4ng th\u1ea5y th\u00ec KH\u00d4NG b\u1ea5m. Ri\u00eang "th\u1ebb": kh\u00f4ng c\u00f3 n\u00fat ch\u1ecdn nh\u01b0ng c\u00f3 \u00f4 nh\u1eadp th\u1ebb (shop ch\u1ec9 nh\u1eadn th\u1ebb) th\u00ec v\u1eabn \u0111\u01b0\u1ee3c.
    const payR = payRadio(), radios = document.querySelectorAll('input[type=radio][name="basic"]').length;
    if (!radios && !expandTried && now - t0 > 1200) {
      expandTried = true;
      const ex = [...document.querySelectorAll('button, [role=button], summary')].find((b) => vis(b) && b.getAttribute('aria-expanded') === 'false' &&
        /^(\u304a\u652f\u6255\u3044|\u652f\u6255\u3044\u65b9\u6cd5|Payment)/i.test((b.innerText || b.getAttribute('aria-label') || '').trim()));
      if (ex) ex.click();
    }
    if (!radios && auto && !guestTried && clickGuest()) { guestTried = true; say(L('\u30b2\u30b9\u30c8\u3068\u3057\u3066\u30c1\u30a7\u30c3\u30af\u30a2\u30a6\u30c8\u306b\u5207\u308a\u66ff\u3048\u2026', 'Chuy\u1ec3n sang \u300c\u30b2\u30b9\u30c8\u3068\u3057\u3066\u30c1\u30a7\u30c3\u30af\u30a2\u30a6\u30c8\u300d\u2026')); return; }
    const cardFormOnly = PAY === 'card' && !radios && pciFrames.length > 0;
    if (!payR && !cardFormOnly) {
      missing.push(radios ? L(`\u3053\u306e\u5e97\u8217\u306b\u300c${PAYS[PAY][0]}\u300d\u304c\u3042\u308a\u307e\u305b\u3093`, `shop kh\u00f4ng c\u00f3 \u300c${PAYS[PAY][0]}\u300d`)
        : L(`\u4fdd\u5b58\u6e08\u307f\u306e\u652f\u6255\u3044\uff08Shop Pay \u7b49\uff09\u3067\u300c${PAYS[PAY][0]}\u300d\u3092\u9078\u3079\u306a\u3044\u305f\u3081\u81ea\u52d5\u8cfc\u5165\u3057\u307e\u305b\u3093`, `trang \u0111ang d\u00f9ng thanh to\u00e1n \u0111\u00e3 l\u01b0u (Shop Pay\u2026), kh\u00f4ng ch\u1ecdn \u0111\u01b0\u1ee3c \u300c${PAYS[PAY][0]}\u300d \u2192 BOT kh\u00f4ng b\u1ea5m`));
    } else if (payR && !payR.checked) missing.push(L('\u652f\u6255\u3044\u65b9\u6cd5', 'c\u00e1ch thanh to\u00e1n'));
    // c\u00e1ch thanh to\u00e1n \u0111ang ch\u1ecdn tr\u00ean trang -> ghi l\u1ea1i \u0111\u1ec3 b\u00e1o Discord
    const chk = [...document.querySelectorAll('input[type=radio][name="basic"]')].find((x) => x.checked);
    if (chk) { const lb = ((chk.labels && chk.labels[0] && chk.labels[0].innerText) || chk.id.replace(/^basic-/, '')).trim().split('\n')[0].replace(/^credit card$/i, '\u30af\u30ec\u30b8\u30c3\u30c8\u30ab\u30fc\u30c9').replace(/^creditCards$/, '\u30af\u30ec\u30b8\u30c3\u30c8\u30ab\u30fc\u30c9');
      const em = q('input[name="email"]');
      try { localStorage.setItem('sxb_pay_used', JSON.stringify({ label: lb, email: em ? em.value : '', at: Date.now() })); } catch (e) {}
      const sig = lb + '|' + (em ? em.value : '');
      if (sig !== gmOrderSig) {                      // \u0111\u01a1n \u0111i qua KOMOJU: m\u00f3n + c\u00e1ch thanh to\u00e1n + email \u0111\u1ec3 KOMOJU b\u00e1o Discord \u0111\u1ea7y \u0111\u1ee7
        gmOrderSig = sig;
        gmSet('sxb_komoju_order', { at: Date.now(), shop: HOST, pay: lb, email: em ? em.value : '', items: byBot && last && last.items ? last.items : ((cartSnap() || {}).items || []) });
      } }
    if (!cardReady) missing.push(L('\u30ab\u30fc\u30c9', 'th\u1ebb'));
    if (missing.length) { say(L('\u5165\u529b\u4e2d\u2026 \u672a\u5165\u529b: ', '\u0110ang \u0111i\u1ec1n\u2026 c\u00f2n thi\u1ebfu: ') + missing.join(', ')); return; }
    if (!auto) { say(IS_SUP ? L('\u5165\u529b\u5b8c\u4e86 \u2192\u300c\u8cfc\u5165\u3059\u308b\u300d\u3092\u62bc\u3057\u3066\u304f\u3060\u3055\u3044\uff08\u81ea\u52d5\u8cfc\u5165\u30aa\u30d5\uff09', '\u0110\u00e3 \u0111i\u1ec1n xong \u2192 b\u1ea5m \u300c\u8cfc\u5165\u3059\u308b\u300d (t\u1ef1 mua \u0111ang t\u1eaft)') : L('\u5165\u529b\u5b8c\u4e86 \u2192 \u652f\u6255\u3044\u30dc\u30bf\u30f3\u3092\u62bc\u3057\u3066\u304f\u3060\u3055\u3044\uff08\u81ea\u52d5\u8cfc\u5165\u30aa\u30d5\uff09', '\u0110\u00e3 \u0111i\u1ec1n xong \u2192 b\u1ea5m n\u00fat thanh to\u00e1n (t\u1ef1 mua \u0111ang t\u1eaft)')); return; }
    if (clicks >= 2 || now - lastClick < 10000) return;   // b\u1ea5m l\u1ea1i ch\u1ec9 khi 10 gi\u00e2y sau n\u00fat v\u1eabn b\u1ea5m \u0111\u01b0\u1ee3c (l\u1ea7n 1 kh\u00f4ng \u0103n)
    const btn = [...document.querySelectorAll('button')].find((b) => vis(b) && !b.disabled && b.getAttribute('aria-disabled') !== 'true' &&
      /^(\u8cfc\u5165\u3059\u308b|\u6ce8\u6587\u3092\u78ba\u5b9a|\u6ce8\u6587\u3092\u5b8c\u4e86|\u4eca\u3059\u3050\u652f\u6255\u3046|Pay now|Complete order)/.test((b.innerText || '').trim()));
    if (!btn) { say(L('\u300c\u8cfc\u5165\u3059\u308b\u300d\u30dc\u30bf\u30f3\u5f85\u3061\u2026', 'Ch\u1edd n\u00fat \u300c\u8cfc\u5165\u3059\u308b\u300d\u2026')); return; }
    clicks++; lastClick = now;
    say(L(`\u300c${(btn.innerText || '').trim().split('\n')[0]}\u300d\u3092\u62bc\u3057\u307e\u3057\u305f (${clicks})`, `\u0110\u00e3 b\u1ea5m \u300c${(btn.innerText || '').trim().split('\n')[0]}\u300d (${clicks})`));
    btn.click();
  }, 150);
})();

// ===================== shop.app (Shop Pay \u0111\u00e3 \u0111\u0103ng nh\u1eadp, th\u1ebb / \u0111\u1ecba ch\u1ec9 l\u01b0u s\u1eb5n) =====================
// \u0110\u01a1n BOT v\u1eeba cho v\u00e0o gi\u1ecf -> b\u1ea5m \u300c\u30b2\u30b9\u30c8\u3068\u3057\u3066\u30c1\u30a7\u30c3\u30af\u30a2\u30a6\u30c8\u3057\u307e\u3059\u300d \u0111\u1ec3 v\u1ec1 trang thanh to\u00e1n th\u01b0\u1eddng (\u0111\u1ee7 c\u00e1ch thanh to\u00e1n, BOT ch\u1ecdn
// \u0111\u00fang c\u00e1ch \u0111\u00e3 c\u00e0i). \u0110\u01a1n t\u1ef1 mua (kh\u00f4ng c\u00f3 d\u1ea5u BOT) -> kh\u00f4ng \u0111\u1ee5ng.
const GUEST_RE = /\u30b2\u30b9\u30c8\u3068\u3057\u3066(\u30c1\u30a7\u30c3\u30af\u30a2\u30a6\u30c8|\u8cfc\u5165|\u7d9a\u884c)|check\s*out as (a )?guest|continue as (a )?guest/i;
function clickGuest() {
  const g = [...document.querySelectorAll('a, button, [role=button]')].find((b) => {
    const r = b.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && GUEST_RE.test((b.innerText || b.getAttribute('aria-label') || '').trim());
  });
  if (g) g.click();
  return !!g;
}
if (!SYNOVA_DUP && !IN_FRAME && IS_SHOPAPP) (async function sxbShopApp() {
  // \u0111\u01a1n do BOT Mellojoy m\u1edf (#synova-pay-\u2026): BOT Mellojoy t\u1ef1 b\u1ea5m \u4eca\u3059\u3050\u652f\u6255\u3046 \u1edf \u0111\u00e2y -> kh\u00f4ng b\u1ea5m "\u30b2\u30b9\u30c8" chen v\u00e0o (b\u1ea3n g\u1ed9p ch\u1ea1y c\u1ea3 2)
  let mj = /synova-pay-\d+/.test(location.hash);
  try { mj = mj || !!sessionStorage.getItem('synova_pay'); } catch (e) {}
  if (mj) return;
  const bb = await gmGet('sxb_bot_buy');
  if (!bb || Date.now() - bb.at > 10 * 60e3) return;
  const t0 = Date.now();
  const timer = setInterval(() => {
    if (Date.now() - t0 > 60e3 || clickGuest()) clearInterval(timer);
  }, 250);
})();

// ===================== Khung \u00f4 th\u1ebb c\u1ee7a Shopify (checkout.pci.shopifyinc.com) =====================
// M\u1ed7i \u00f4 th\u1ebb l\u00e0 1 khung ri\u00eang: number-ltr / expiry-ltr / verification_value-ltr / name-ltr. Ch\u1ec9 nh\u1eadn d\u1eef li\u1ec7u t\u1eeb jp.supreme.com.
if (!SYNOVA_DUP && IS_PCI && IN_FRAME) (function () {
  const F = (location.pathname.match(/\/(number|expiry|verification_value|name)-/) || [])[1];
  if (!F) return;
  // g\u00f5 t\u1eebng k\u00fd t\u1ef1 (\u00f4 th\u1ebb t\u1ef1 \u0111\u1ecbnh d\u1ea1ng "1234 5678\u2026" / "MM / YY" theo t\u1eebng l\u1ea7n g\u00f5)
  function type(el, v) {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    el.focus();
    set.call(el, '');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    let cur = '';
    for (const ch of v) {
      cur += ch;
      el.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true }));
      set.call(el, cur);
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ch }));
      el.dispatchEvent(new KeyboardEvent('keyup', { key: ch, bubbles: true }));
      cur = el.value;                              // l\u1ea5y l\u1ea1i gi\u00e1 tr\u1ecb \u0111\u00e3 \u0111\u01b0\u1ee3c \u0111\u1ecbnh d\u1ea1ng
    }
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.blur();
  }
  const same = (a, b) => (a || '').replace(/[\s/]/g, '').toLowerCase() === (b || '').replace(/[\s/]/g, '').toLowerCase();
  window.addEventListener('message', (e) => {
    if (!/^https:\/\//.test(e.origin) || !e.data || e.data.synova !== 'card' || !e.data.card) return;
    const v = String(e.data.card[F] || '');
    const el = document.getElementById(F);
    if (!el || !v) return;
    if (!same(el.value, v)) type(el, v);
    if (same(el.value, v) || (F === 'expiry' && el.value.replace(/\D/g, '') === v)) {
      try { e.source.postMessage({ synova: 'pci-filled', field: F }, e.origin); } catch (x) {}
    }
  });
  try { window.top.postMessage({ synova: 'pci-ready', field: F }, '*'); } catch (e) {}   // tin b\u00e1o kh\u00f4ng k\u00e8m d\u1eef li\u1ec7u
})();

// ===================== HUMAN MADE / Buffer: t\u1ef1 \u0111i\u1ec1n trang thanh to\u00e1n Global-e =====================
// Trang /checkout/ c\u1ee7a shop ch\u1ec9 ch\u1ee9a khung Global-e (*.global-e.com): form \u0111\u1ecba ch\u1ec9 \u1edf 1 khung, \u00f4 th\u1ebb \u1edf khung con
// secure-<shop>.global-e.com/payments/\u2026 -> trang ch\u00ednh kh\u00f4ng \u0111\u1ecdc / \u0111i\u1ec1n \u0111\u01b0\u1ee3c. C\u00e1ch l\u00e0m:
//   trang ch\u00ednh h\u1ecfi "ai \u0111\u00f3?" (kh\u00f4ng k\u00e8m d\u1eef li\u1ec7u) -> khung Global-e tr\u1ea3 l\u1eddi -> CH\u1ec8 g\u1eedi d\u1eef li\u1ec7u t\u1edbi \u0111\u00fang khung \u0111\u00e3 tr\u1ea3 l\u1eddi,
//   v\u1edbi targetOrigin = t\u00ean mi\u1ec1n *.global-e.com c\u1ee7a khung \u0111\u00f3; khung t\u1ef1 \u0111i\u1ec1n r\u1ed3i b\u00e1o l\u1ea1i c\u00f2n thi\u1ebfu \u00f4 n\u00e0o / c\u00f3 n\u00fat \u6ce8\u6587\u306e\u78ba\u5b9a kh\u00f4ng.
const GE_ORIGIN = /^https:\/\/[a-z0-9-]+\.global-e\.com$/;
const GE_SHOP = /^https:\/\/(www\.)?(humanmade|buffering)\.jp$/;
if (!SYNOVA_DUP && !IN_FRAME && (IS_HM || IS_BUF) && /\/checkout/i.test(location.pathname)) (function () {
  'use strict';
  let c = {}, last = null;
  try { c = JSON.parse(localStorage.getItem(K_BUY)) || {}; } catch (e) {}
  try { last = JSON.parse(localStorage.getItem(K_LAST)); } catch (e) {}
  const byBot = !!(last && Date.now() - last.at < 10 * 60e3);
  let auto = byBot;
  const zd = (c.zip || '').replace(/\D/g, ''), ed = (c.cexp || '').replace(/\D/g, '');
  const yy = ed.length >= 4 ? ed.slice(-2) : '';
  const data = {
    fill: true,
    addr: { last: c.last, first: c.first, zip: zd.length === 7 ? zd.slice(0, 3) + '-' + zd.slice(3) : c.zip, pref: c.pref ? PREFS[+c.pref - 1] : '',
      city: c.city, addr1: c.addr1, addr2: c.addr2, phone: (c.phone || '').replace(/[^\d+]/g, '') },
    card: (c.cnum || '').replace(/\D/g, '').length >= 12
      ? { number: c.cnum.replace(/\D/g, ''), mm: ed.slice(0, 2), yy, yyyy: yy ? '20' + yy : '', cvv: (c.ccvv || '').replace(/\D/g, ''), name: c.cname || '' } : null,
  };
  // \u23f9 D\u1eebng ngay tr\u00ean trang thanh to\u00e1n: th\u00f4i t\u1ef1 b\u1ea5m mua (\u0111\u01a1n n\u00e0y + KOMOJU / shop.app)
  const ban = synovaBanner(() => { stopAutoBuy(); auto = false; ban.say(L('\u81ea\u52d5\u8cfc\u5165\u3092\u505c\u6b62\u3057\u307e\u3057\u305f\uff08\u81ea\u5206\u3067\u64cd\u4f5c\u3057\u3066\u304f\u3060\u3055\u3044\uff09', '\u0110\u00e3 d\u1eebng t\u1ef1 mua \u2013 b\u1ea1n t\u1ef1 thao t\u00e1c')); });
  const bn = { remove: () => ban.remove() };
  const say = (m) => ban.say(m);
  if (!auto) ban.hideStop();
  const known = new Map();                          // khung Global-e \u0111\u00e3 tr\u1ea3 l\u1eddi -> {origin, st, at}
  window.addEventListener('message', (e) => {
    if (!GE_ORIGIN.test(e.origin) || !e.data || typeof e.data !== 'object' || !e.source) return;
    if (e.data.synova === 'ge-ready') {
      if (!known.has(e.source)) known.set(e.source, { origin: e.origin });
      e.source.postMessage({ synova: 'ge-fill', data }, e.origin);
    }
    if (e.data.synova === 'ge-st') {
      known.set(e.source, { origin: e.origin, st: e.data, at: Date.now() });
      if (e.data.email) geEmail = e.data.email;
      if (e.data.done) geDone(e.data.orderNo || '');
    }
  });
  // \u0111\u1eb7t h\u00e0ng xong (l\u1eddi c\u1ea3m \u01a1n hi\u1ec7n TRONG khung Global-e, \u0111\u1ecba ch\u1ec9 trang c\u00f3 th\u1ec3 kh\u00f4ng \u0111\u1ed5i) -> b\u00e1o Discord 1 l\u1ea7n
  let sent = false;
  let geEmail = '';
  function geDone(orderNo) {
    if (sent) return;
    sent = true;
    try { if (localStorage.getItem('synova_sent_ge_' + (orderNo || last?.at || location.pathname))) return; localStorage.setItem('synova_sent_ge_' + (orderNo || last?.at || location.pathname), '1'); } catch (e) {}
    synovaNotify(orderEmbeds(last), buyInfo().uwh, [['Email', geEmail || emailUsed()], ['\u6ce8\u6587\u756a\u53f7', orderNo]]);
    try {
      localStorage.removeItem(K_LAST);
      const k = 'sxb_' + SITE_KEY + '_st', v = JSON.parse(localStorage.getItem(k) || '{}');
      v.active = false; v.boughtAt = Date.now(); localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {}
    say(L('\u6ce8\u6587\u5b8c\u4e86 \u2192 Discord\u306b\u901a\u77e5\u3057\u307e\u3057\u305f', '\u0110\u1eb7t h\u00e0ng xong \u2192 \u0111\u00e3 b\u00e1o Discord'));
  }
  const walk = (w, out) => { for (let i = 0; i < w.frames.length; i++) { out.push(w.frames[i]); walk(w.frames[i], out); } return out; };
  let clicks = 0, lastClick = 0;
  const t0 = Date.now();
  const timer = setInterval(() => {
    const now = Date.now();
    if (auto && !localStorage.getItem(K_LAST)) { auto = false; ban.hideStop(); }   // \u0111\u00e3 b\u1ea5m D\u1eebng \u1edf khung BOT
    if (now - t0 > 300e3 || /order-?confirm|confirmation|thank/i.test(location.href)) { clearInterval(timer); bn.remove(); return; }
    // h\u1ecfi m\u1ecdi khung (c\u1ea3 khung l\u1ed3ng nhau); tin h\u1ecfi kh\u00f4ng k\u00e8m d\u1eef li\u1ec7u n\u00ean g\u1eedi '*' c\u0169ng kh\u00f4ng l\u1ed9 g\u00ec
    for (const w of walk(window, [])) { try { w.postMessage({ synova: 'ge-hello' }, '*'); } catch (e) {} }
    for (const [w, k] of known) { try { w.postMessage({ synova: 'ge-fill', data }, k.origin); } catch (e) { known.delete(w); } }
    const sts = [...known.values()].filter((k) => k.st && now - k.at < 3000).map((k) => k.st);
    if (sent) { clearInterval(timer); return; }
    if (!sts.length) { say(L('\u8cfc\u5165\u753b\u9762\u306e\u8aad\u307f\u8fbc\u307f\u5f85\u3061\u2026', 'Ch\u1edd trang thanh to\u00e1n Global-e t\u1ea3i\u2026')); return; }
    const missing = [...new Set(sts.flatMap((s) => s.missing || []))];
    const cardFilled = sts.some((s) => s.card === 'filled'), cardEmpty = sts.some((s) => s.card === 'empty');
    if (!cardFilled || cardEmpty) missing.push(L('\u30ab\u30fc\u30c9', 'th\u1ebb'));
    if (missing.length) { say(L('\u5165\u529b\u4e2d\u2026 \u672a\u5165\u529b: ', '\u0110ang \u0111i\u1ec1n\u2026 c\u00f2n thi\u1ebfu: ') + missing.join(', ')); return; }
    if (!auto) { say(L('\u5165\u529b\u5b8c\u4e86 \u2192\u300c\u6ce8\u6587\u306e\u78ba\u5b9a\u300d\u3092\u62bc\u3057\u3066\u304f\u3060\u3055\u3044\uff08\u81ea\u52d5\u8cfc\u5165\u30aa\u30d5\uff09', '\u0110\u00e3 \u0111i\u1ec1n xong \u2192 b\u1ea5m \u300c\u6ce8\u6587\u306e\u78ba\u5b9a\u300d (t\u1ef1 mua \u0111ang t\u1eaft)')); return; }
    const cf = [...known.entries()].find(([, k]) => k.st && k.st.confirm && now - k.at < 3000);
    if (!cf) { say(L('\u300c\u6ce8\u6587\u306e\u78ba\u5b9a\u300d\u30dc\u30bf\u30f3\u5f85\u3061\u2026', 'Ch\u1edd n\u00fat \u300c\u6ce8\u6587\u306e\u78ba\u5b9a\u300d\u2026')); return; }
    if (clicks >= 2 || now - lastClick < 10000) return;
    clicks++; lastClick = now;
    say(L(`\u300c\u6ce8\u6587\u306e\u78ba\u5b9a\u300d\u3092\u62bc\u3057\u307e\u3057\u305f (${clicks})`, `\u0110\u00e3 b\u1ea5m \u300c\u6ce8\u6587\u306e\u78ba\u5b9a\u300d (${clicks})`));
    cf[0].postMessage({ synova: 'ge-click' }, cf[1].origin);
  }, 250);
})();

// ===================== Khung Global-e (*.global-e.com): \u0111i\u1ec1n form \u0111\u1ecba ch\u1ec9 / \u00f4 th\u1ebb c\u1ee7a ch\u00ednh khung n\u00e0y =====================
if (!SYNOVA_DUP && IN_FRAME && /\.global-e\.com$/.test(HOST)) (function () {
  'use strict';
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const attrs = (e) => [e.id, e.name, e.getAttribute('autocomplete'), e.getAttribute('placeholder'), e.getAttribute('aria-label'), e.getAttribute('data-fieldtype')].join(' ').toLowerCase();
  const CARDISH = /card|cc-|cvv|cvc|cvd|security|expir|\u30ab\u30fc\u30c9|\u30bb\u30ad\u30e5\u30ea\u30c6\u30a3|\u6709\u52b9\u671f\u9650/;
  // ch\u1eef nh\u00e3n c\u1ee7a \u00f4: <label for>, kh\u00f4ng th\u00ec ch\u1eef c\u1ee7a h\u00e0ng ch\u1ee9a \u00f4 (b\u1ecf \u2605 \u203b *)
  function labelOf(e) {
    let t = (e.labels && e.labels[0] && e.labels[0].innerText) || '';
    // kh\u00f4ng c\u00f3 <label>: l\u1ea5y ch\u1eef c\u1ee7a kh\u1ed1i bao g\u1ea7n nh\u1ea5t CH\u1ec8 ch\u1ee9a \u0111\u00fang \u00f4 n\u00e0y (kh\u1ed1i to h\u01a1n s\u1ebd l\u1eabn nh\u00e3n c\u1ee7a \u00f4 kh\u00e1c)
    for (let a = e.parentElement, i = 0; !t && a && i < 4; a = a.parentElement, i++) {
      if (a.querySelectorAll('input:not([type=hidden]), select').length > 1) break;
      t = a.innerText || '';
    }
    return t.replace(/[\u2605\uff0a*\u203b\s]/g, '');
  }
  const boxes = () => [...document.querySelectorAll('input:not([type=hidden]):not([type=radio]):not([type=checkbox]):not([type=submit]):not([type=button]), select')].filter(vis);
  function find(list, idRe, labRe, wantSelect) {
    let el = list.find((e) => (wantSelect === undefined || (e.tagName === 'SELECT') === wantSelect) && idRe && idRe.test(attrs(e)));
    if (!el && labRe) el = list.find((e) => (wantSelect === undefined || (e.tagName === 'SELECT') === wantSelect) && labRe.test(labelOf(e)));
    return el;
  }
  function setVal(el, v) {
    const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    el.focus && el.focus();
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    for (const t of ['input', 'change', 'keyup']) el.dispatchEvent(new Event(t, { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }
  // ch\u1ecdn option theo ch\u1eef ("\u6771\u4eac\u90fd" / "\u6771\u4eac") ho\u1eb7c theo s\u1ed1 ("06" kh\u1edbp "6", n\u0103m "2031" kh\u1edbp "31")
  function pick(sel, want, num) {
    const o = [...sel.options].find((x) => {
      if (num) { const a = parseInt((x.value || '').replace(/\D/g, ''), 10), b = parseInt((x.text || '').replace(/\D/g, ''), 10), w = parseInt(want, 10); return a === w || b === w || (w > 100 && (a === w % 100 || b === w % 100) && x.value.replace(/\D/g, '').length <= 2); }
      const t = (x.text || '').trim(); const s = want.replace(/[\u90fd\u9053\u5e9c\u770c]$/, '');
      return t === want || x.value === want || (s && t.startsWith(s));
    });
    if (!o) return false;
    if (sel.value !== o.value) setVal(sel, o.value);
    return true;
  }
  const empty = (e) => (e.tagName === 'SELECT' ? e.selectedIndex <= 0 && !/\d/.test(e.value) : !e.value.trim());
  const ADDR = [
    ['zip', /zip|postal/, /\u90f5\u4fbf\u756a\u53f7/, false, true], ['pref', /county|state|prefecture|region|province/, /\u90fd\u9053\u5e9c\u770c/, true, true],
    ['last', /last.?name|surname|family/, /^\u59d3/, false, true], ['first', /first.?name|given/, /^\u540d/, false, true],
    ['city', /city|town/, /\u5e02\u533a\u753a\u6751/, false, true], ['addr1', /address.?1|address.?line.?1|street/, /\u4f4f\u62401/, false, true],
    ['addr2', /address.?2|address.?line.?2/, /\u4f4f\u62402/, false, false], ['phone', /phone|mobile|tel(?!e)/, /\u96fb\u8a71/, false, true],
  ];
  let topWin = null, topOrigin = '', lastEmail = '';
  function run(d) {
    const all = boxes();
    const addrBoxes = all.filter((e) => !CARDISH.test(attrs(e)) && !CARDISH.test(labelOf(e)));
    const missing = [];
    for (const [k, idRe, labRe, isSel, req] of ADDR) {
      const el = find(addrBoxes, idRe, labRe, isSel);
      if (!el || !empty(el)) continue;               // kh\u00f4ng c\u00f3 \u00f4 / t\u00e0i kho\u1ea3n \u0111\u00e3 c\u00f3 s\u1eb5n -> gi\u1eef nguy\u00ean
      const v = d.addr && d.addr[k];
      if (d.fill && v) { if (isSel) pick(el, v, false); else setVal(el, v); }
      if (req && empty(el)) missing.push(labRe.source.replace(/[\^\\]/g, ''));
    }
    // \u00f4 th\u1ebb
    let card = 'none';
    const cb = all.filter((e) => CARDISH.test(attrs(e)) || CARDISH.test(labelOf(e)));
    const num = find(cb, /cc-number|card.?num|cardno|card_no|encryptedcardnumber/, /\u30ab\u30fc\u30c9\u756a\u53f7/, false);
    if (num) {
      const cv = find(cb, /cc-csc|cvv|cvc|cvd|securitycode|security.?code/, /\u30bb\u30ad\u30e5\u30ea\u30c6\u30a3/, false);
      const nm = find(cb, /cc-name|holder|cardowner|cardname|nameoncard/, /\u540d\u7fa9/, false);
      const exp1 = find(cb, /cc-exp(?!-)|expiry(?!.*(month|year))|expdate/, null, false);
      const mon = find(cb, /cc-exp-month|exp.*month|month/, null, undefined) || cb.filter((e) => /\u6709\u52b9\u671f\u9650/.test(labelOf(e)))[0];
      const yr = find(cb, /cc-exp-year|exp.*year|year/, null, undefined) || cb.filter((e) => /\u6709\u52b9\u671f\u9650/.test(labelOf(e)))[1];
      const k = d.card;
      if (d.fill && k) {
        if (num.value.replace(/\D/g, '') !== k.number) setVal(num, k.number);
        if (exp1 && empty(exp1)) setVal(exp1, k.mm + '/' + k.yy);
        if (mon && mon !== exp1) { if (mon.tagName === 'SELECT') pick(mon, k.mm, true); else if (empty(mon)) setVal(mon, k.mm); }
        if (yr && yr !== exp1 && yr !== mon) { if (yr.tagName === 'SELECT') pick(yr, k.yyyy, true); else if (empty(yr)) setVal(yr, (yr.maxLength === 2 ? k.yy : k.yyyy)); }
        if (cv && empty(cv)) setVal(cv, k.cvv);
        if (nm && empty(nm) && k.name) setVal(nm, k.name.toUpperCase());
      }
      card = num.value.replace(/\D/g, '').length >= 12 && (!cv || cv.value) ? 'filled' : 'empty';
    }
    const confirm = !!confirmBtn();
    const bt = document.body ? document.body.innerText : '';
    const done = /\u3054\u6ce8\u6587\u3042\u308a\u304c\u3068\u3046\u3054\u3056\u3044\u307e|\u3054\u6ce8\u6587\u3092\u627f\u308a\u307e\u3057\u305f|\u3054\u6ce8\u6587\u756a\u53f7|\u6ce8\u6587\u756a\u53f7|Thank you for your order|Order Number/i.test(bt);
    const em = all.find((e) => /mail/i.test(attrs(e)) && /@/.test(e.value));
    if (em) lastEmail = em.value;
    if (topWin) try { topWin.postMessage({ synova: 'ge-st', missing, card, confirm, done, orderNo: done ? findOrderNo(bt) : '', email: lastEmail }, topOrigin); } catch (e) {}
  }
  function confirmBtn() {
    return [...document.querySelectorAll('button, input[type=submit], input[type=button], a[role=button]')].find((b) => vis(b) && !b.disabled &&
      /\u6ce8\u6587\u306e\u78ba\u5b9a|\u6ce8\u6587\u3092\u78ba\u5b9a|\u3054\u6ce8\u6587\u3092\u78ba\u5b9a|\u6ce8\u6587\u3059\u308b$|\u8cfc\u5165\u3059\u308b$|Place Order|PLACE ORDER/.test((b.innerText || b.value || '').trim()));
  }
  window.addEventListener('message', (e) => {
    if (!GE_SHOP.test(e.origin) || !e.data || typeof e.data !== 'object') return;
    if (e.data.synova === 'ge-hello') { try { e.source.postMessage({ synova: 'ge-ready' }, e.origin); } catch (x) {} return; }
    if (e.data.synova === 'ge-fill' && e.data.data) { topWin = e.source; topOrigin = e.origin; run(e.data.data); }
    if (e.data.synova === 'ge-click') { const b = confirmBtn(); if (b) b.click(); }
  });
})();

// ===================== Trang thanh to\u00e1n KOMOJU (komoju.com) =====================
// \u9280\u884c\u632f\u8fbc: \u0111i\u1ec1n \u59d3/\u540d (\u30ab\u30bf\u30ab\u30ca) + \u96fb\u8a71\u756a\u53f7 ; \u30b3\u30f3\u30d3\u30cb\u6c7a\u6e08: ch\u1ecdn c\u1eeda h\u00e0ng ; r\u1ed3i b\u1ea5m \u300c\u652f\u6255\u3044\u300d.
// komoju.com l\u00e0 t\u00ean mi\u1ec1n kh\u00e1c shop -> kh\u00f4ng \u0111\u1ecdc \u0111\u01b0\u1ee3c th\u00f4ng tin l\u01b0u \u1edf shop: l\u1ea7n \u0111\u1ea7u b\u1ea5m "D\u00e1n" (m\u00e3 SYNOVA1 ch\u00e9p t\u1eeb \u2699\ufe0f c\u1ee7a shop),
// th\u00f4ng tin l\u01b0u l\u1ea1i tr\u00ean komoju.com d\u00f9ng cho M\u1eccI shop \u0111i qua KOMOJU.
if (!SYNOVA_DUP && !IN_FRAME && IS_KOMOJU) (async function sxbKomoju() {
  'use strict';
  if (!document.body) { setTimeout(sxbKomoju, 200); return; }
  const KK = 'sxb_komoju';
  let c = {};
  try { c = JSON.parse(localStorage.getItem(KK)) || {}; } catch (e) {}
  // th\u00f4ng tin giao h\u00e0ng c\u1ee7a shop (kho chung) \u0111\u00e8 l\u00ean b\u1ea3n l\u01b0u tr\u00ean komoju.com
  const gi = await gmGet('sxb_komoju_info');
  if (gi) for (const k of ['klast', 'kfirst', 'phone', 'kstore', 'last', 'first', 'email', 'uwh']) if (gi[k]) c[k] = gi[k];
  const gOrder = await gmGet('sxb_komoju_order');
  const order = gOrder && Date.now() - gOrder.at < 30 * 60e3 ? gOrder : null;
  const keep = () => { try { localStorage.setItem(KK, JSON.stringify(c)); } catch (e) {} };
  // ch\u1ec9 T\u1ef0 B\u1ea4M khi t\u1edbi \u0111\u00e2y t\u1eeb trang thanh to\u00e1n c\u1ee7a shop (kh\u00f4ng ph\u1ea3i m\u1edf l\u1ea1i link KOMOJU c\u0169)
  let ref = '';
  try { ref = document.referrer ? new URL(document.referrer).hostname : ''; } catch (e) {}
  const botBuy = await gmGet('sxb_bot_buy');
  // t\u1ef1 b\u1ea5m: \u0111i t\u1eeb shop sang + (c\u00f3 kho chung) \u0111\u01a1n do BOT cho v\u00e0o gi\u1ecf trong 30 ph\u00fat v\u00e0 ch\u01b0a b\u1ea5m D\u1eebng
  const fromShop = !!ref && !/komoju\.com$/.test(ref) && (!GMS || !!(botBuy && Date.now() - botBuy.at < 30 * 60e3));

  // ---- khung nh\u1ecf (Shadow DOM) ----
  const host = document.createElement('div');
  host.id = 'sxbkomoju';
  host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;left:0;right:0;bottom:0;height:0';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>
  .w{position:fixed;left:8px;right:8px;bottom:calc(env(safe-area-inset-bottom) + 8px);background:#0d1b32;color:#f2f2f2;border:1px solid #527198;border-radius:12px;
    padding:8px 10px;font:600 12px -apple-system,"Hiragino Sans",sans-serif;box-shadow:0 4px 16px #000a;box-sizing:border-box}
  .h{display:flex;gap:6px;align-items:center} .st{flex:1;color:#ffffff;line-height:1.35}
  button{border:1px solid #527198;background:#203a5d;color:#ffffff;border-radius:9px;padding:6px 9px;font:700 12px -apple-system,sans-serif}
  .f{display:none;margin-top:6px} .f.on{display:block} .r{display:flex;gap:6px;margin-top:6px;align-items:center}
  input,select{flex:1;min-width:0;font-size:16px;padding:6px 8px;border:1px solid #527198;border-radius:8px;background:#162a46;color:#fff;box-sizing:border-box}
  label{display:flex;gap:6px;align-items:center;margin-top:6px} label input{flex:none;width:20px;height:20px;accent-color:#ffffff}
  </style>
  <div class="w"><div class="h"><span class="st" id="st">うずら BOT</span><button id="cfg">\u2699\ufe0f</button></div>
  <div class="f" id="f">
    <div class="r"><input id="klast" placeholder="${L('\u30bb\u30a4\uff08\u30ab\u30bf\u30ab\u30ca\uff09', 'H\u1ecd katakana (\u30bb\u30a4)')}"><input id="kfirst" placeholder="${L('\u30e1\u30a4\uff08\u30ab\u30bf\u30ab\u30ca\uff09', 'T\u00ean katakana (\u30e1\u30a4)')}"></div>
    <div class="r"><input id="phone" type="tel" placeholder="${L('\u96fb\u8a71\u756a\u53f7', '\u0110i\u1ec7n tho\u1ea1i')}"></div>
    <div class="r"><select id="kstore">${KSTORES.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></div>
    <div class="r"><button id="paste">\ud83d\udce5 ${L('\u8cbc\u308a\u4ed8\u3051', 'D\u00e1n')}</button><button id="save">\ud83d\udcbe ${L('\u4fdd\u5b58', 'L\u01b0u')}</button></div>
  </div></div>`;
  document.body.appendChild(host);
  const $k = (id) => root.getElementById(id);
  const show = () => { for (const k of ['klast', 'kfirst', 'phone']) $k(k).value = c[k] || ''; $k('kstore').value = c.kstore || 'seven'; };
  const read = () => { for (const k of ['klast', 'kfirst', 'phone']) c[k] = $k(k).value.trim(); c.kstore = $k('kstore').value; keep(); };
  show();
  // c\u00f3 th\u00f4ng tin (t\u1eeb \u2699\ufe0f c\u1ee7a shop) -> ch\u1ec9 hi\u1ec7n 1 d\u00f2ng tr\u1ea1ng th\u00e1i, kh\u00f4ng hi\u1ec7n n\u00fat / b\u1ea3ng. Thi\u1ebfu th\u00ec m\u1edbi hi\u1ec7n \u0111\u1ec3 t\u1ef1 nh\u1eadp / d\u00e1n
  const hasInfo = !!(c.klast || c.phone);
  if (hasInfo) { $k('cfg').style.display = 'none'; root.querySelector('.w').style.pointerEvents = 'none'; }
  else $k('f').classList.add('on');
  $k('cfg').onclick = () => $k('f').classList.toggle('on');
  $k('save').onclick = () => { read(); say(L('\u4fdd\u5b58\u3057\u307e\u3057\u305f', '\u0110\u00e3 l\u01b0u')); };
  root.querySelectorAll('input,select').forEach((e) => e.addEventListener('change', read));
  function applyCode(txt) {
    const m = (txt || '').match(/SYNOVA1:([A-Za-z0-9+/=]+)/);
    if (!m) { say(L('\u30b3\u30fc\u30c9\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093\uff08\u5e97\u8217\u306e\u2699\ufe0f\u3067\u300c\u30b3\u30d4\u30fc\u300d\uff09', 'Kh\u00f4ng th\u1ea5y m\u00e3 (b\u1ea5m "Sao ch\u00e9p" \u1edf \u2699\ufe0f c\u1ee7a shop)')); return; }
    try {
      const o = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
      for (const k of ['klast', 'kfirst', 'phone', 'kstore', 'last', 'first', 'email', 'uwh']) if (o[k]) c[k] = o[k];
      keep(); show(); say(L('\u8cbc\u308a\u4ed8\u3051\u307e\u3057\u305f', '\u0110\u00e3 d\u00e1n th\u00f4ng tin'));
    } catch (e) { say(L('\u30b3\u30fc\u30c9\u304c\u58ca\u308c\u3066\u3044\u307e\u3059', 'M\u00e3 b\u1ecb l\u1ed7i')); }
  }
  $k('paste').onclick = () => {
    const manual = () => applyCode(prompt(L('\u30b3\u30d4\u30fc\u3057\u305f\u30b3\u30fc\u30c9\u3092\u8cbc\u308a\u4ed8\u3051\u3066\u304f\u3060\u3055\u3044', 'D\u00e1n m\u00e3 \u0111\u00e3 sao ch\u00e9p v\u00e0o \u0111\u00e2y')) || '');
    if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then((t) => (/SYNOVA1:/.test(t) ? applyCode(t) : manual()), manual); else manual();
  };
  const say = (m) => { $k('st').textContent = 'うずら BOT \u00b7 ' + m; };

  // ---- \u0111i\u1ec1n form KOMOJU ----
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  function labelOf(e) {
    let t = (e.labels && e.labels[0] && e.labels[0].innerText) || e.getAttribute('aria-label') || e.placeholder || '';
    for (let a = e.parentElement, i = 0; !t && a && i < 4; a = a.parentElement, i++) {
      if (a.querySelectorAll('input:not([type=hidden]), select').length > 1) break;
      t = a.innerText || '';
    }
    return (t + ' ' + (e.name || '') + ' ' + (e.id || '')).replace(/\s+/g, '');
  }
  function setVal(el, v) {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
    for (const t of ['input', 'change']) el.dispatchEvent(new Event(t, { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }
  const KANA = /\u30ab\u30bf\u30ab\u30ca|\u30ab\u30ca|\u30d5\u30ea\u30ac\u30ca|\uff8c\uff98\uff76\uff9e\uff85|kana/i;
  const FIELDS = [
    ['klast', (l) => KANA.test(l) && /\u59d3|\u30bb\u30a4|last|family/i.test(l)],
    ['kfirst', (l) => KANA.test(l) && /\u540d|\u30e1\u30a4|first|given/i.test(l) && !/\u59d3|\u30bb\u30a4|last|family/i.test(l)],
    ['phone', (l) => /\u96fb\u8a71|phone|tel/i.test(l) && !KANA.test(l)],
    ['last', (l) => !KANA.test(l) && /^(\u59d3|lastname|familyname)/i.test(l)],
    ['first', (l) => !KANA.test(l) && /^(\u540d|firstname|givenname)/i.test(l)],
    ['email', (l) => /\u30e1\u30fc\u30eb|mail/i.test(l)],
  ];
  // ---- b\u00e1o Discord ngay tr\u00ean KOMOJU ----
  // B\u1ea5m \u652f\u6255\u3044 xong, KOMOJU hi\u1ec7n trang h\u01b0\u1edbng d\u1eabn (s\u1ed1 ti\u1ec1n, m\u00e3 thanh to\u00e1n \u30b3\u30f3\u30d3\u30cb / t\u00e0i kho\u1ea3n \u632f\u8fbc) v\u00e0 ng\u01b0\u1eddi mua th\u01b0\u1eddng KH\u00d4NG
  // quay l\u1ea1i trang c\u1ea3m \u01a1n c\u1ee7a shop -> tr\u01b0\u1edbc \u0111\u00e2y kh\u00f4ng c\u00f3 webhook. Gi\u1edd: l\u00fac b\u1ea5m \u652f\u6255\u3044 ghi "\u0111\u01a1n \u0111ang ch\u1edd"; trang sau c\u00f3 ch\u1eef
  // h\u01b0\u1edbng d\u1eabn / ho\u00e0n t\u1ea5t -> g\u1eedi webhook (k\u00eanh SYNOVAJOY + webhook ri\u00eang: th\u00eam Email + m\u00e3 thanh to\u00e1n).
  const KP = 'sxb_komoju_pending';
  const pend = () => { try { const v = JSON.parse(localStorage.getItem(KP)); return v && Date.now() - v.at < 60 * 60e3 ? v : null; } catch (e) { return null; } };
  if (fromShop) { try { localStorage.setItem('sxb_komoju_shop', JSON.stringify({ host: ref, at: Date.now() })); } catch (e) {} }
  const shopHost = () => { try { const v = JSON.parse(localStorage.getItem('sxb_komoju_shop')); return v && Date.now() - v.at < 3 * 3600e3 ? v.host : ''; } catch (e) { return ''; } };
  function markPending(btn, storeRadios) {
    const text = document.body.innerText || '';
    const amt = (text.match(/[\u00a5\uffe5]\s?[\d,]{3,}/) || [''])[0].replace(/\s/g, '');
    const st = storeRadios.find((x) => x.checked);
    const em = [...document.querySelectorAll('input')].find((e) => /mail/i.test(e.type + e.name + e.id + labelOf(e)) && /@/.test(e.value));
    const v = { at: Date.now(), url: location.href, shop: shopHost() || (order && order.shop) || '', amount: amt, email: em ? em.value : (c.email || ''),
      method: storeRadios.length ? '\u30b3\u30f3\u30d3\u30cb\u6c7a\u6e08' + (st ? '\uff08' + labelOf(st).replace(/[^\u3040-\u30ff\u30fc\u4e00-\u9fffA-Za-z-]/g, '') + '\uff09' : '') : '\u9280\u884c\u632f\u8fbc' };
    try { localStorage.setItem(KP, JSON.stringify(v)); } catch (e) {}
  }
  const DONE_RE = /\u6255\u8fbc\u7968|\u3054?\u6ce8\u6587\u3042\u308a\u304c\u3068\u3046|\u304a\u652f\u6255\u3044\u65b9\u6cd5\u306b\u3064\u3044\u3066|\u632f\u8fbc\u5148\u53e3\u5ea7|\u652f\u6255\u671f\u9650|\u304a\u652f\u6255\u3044\u671f\u9650|\u304a\u632f\u8fbc\u5148|\u632f\u8fbc\u5148|\u632f\u8fbc\u671f\u9650|\u53d7\u4ed8\u756a\u53f7|\u304a\u652f\u6255\u3044\u756a\u53f7|\u6255\u8fbc\u7968\u756a\u53f7|\u78ba\u8a8d\u756a\u53f7|\u30aa\u30f3\u30e9\u30a4\u30f3\u6c7a\u6e08\u756a\u53f7|\u304a\u5ba2\u69d8\u756a\u53f7|\u6255\u8fbc\u756a\u53f7|\u304a\u652f\u6255\u3044\u306e\u624b\u7d9a\u304d|\u304a\u652f\u6255\u3044\u65b9\u6cd5\u306e\u6848\u5185|\u304a\u652f\u6255\u3044\u304c\u5b8c\u4e86|payment instructions|payment (is )?complete|thank you/i;
  const RECEIPT_RE = /(\u53d7\u4ed8\u756a\u53f7|\u304a\u652f\u6255\u3044\u756a\u53f7|\u6255\u8fbc\u7968\u756a\u53f7|\u78ba\u8a8d\u756a\u53f7|\u30aa\u30f3\u30e9\u30a4\u30f3\u6c7a\u6e08\u756a\u53f7|\u304a\u5ba2\u69d8\u756a\u53f7|\u6255\u8fbc\u756a\u53f7|\u53e3\u5ea7\u756a\u53f7)[^\d\n]{0,8}([\d-]{4,})/;
  let sentDone = false;
  function checkDone(payBtnVisible) {
    const pv = pend();
    if (sentDone || !pv) return false;
    const text = document.body.innerText || '';
    if (!DONE_RE.test(text) || (payBtnVisible && location.href === pv.url)) return false;   // c\u00f2n \u1edf form, n\u00fat \u652f\u6255\u3044 c\u00f2n \u0111\u00f3 -> ch\u01b0a xong
    sentDone = true;
    try { localStorage.removeItem(KP); } catch (e) {}
    gmSet('sxb_komoju_order', null);
    const rc = text.match(RECEIPT_RE);
    const host = pv.shop || shopHost();
    const its = order && order.items && order.items.length ? order.items : null;
    synovaNotify(its ? its.map((it) => ({ author: '\u2705 Checkout Successful', title: it.title, url: it.url, thumb: it.image, site: host,
      fields: [['Size', it.size], ['\u4fa1\u683c', it.price], ['Quantity', it.qty], ['\u652f\u6255\u3044\u65b9\u6cd5', pv.method], ['Site', host || order.shop, false]] }))
      : [{ author: '\u2705 Checkout Successful', title: host || 'KOMOJU', url: host ? 'https://' + host : location.origin,
        fields: [['\u4fa1\u683c', pv.amount], ['\u652f\u6255\u3044\u65b9\u6cd5', pv.method], ['Site', (host || 'komoju.com') + ' (KOMOJU)', false]] }],
      c.uwh, [['Email', pv.email], ['\u6ce8\u6587\u756a\u53f7', rc ? rc[1] + ' ' + rc[2] : '']]);
    say(L('\u6ce8\u6587\u5b8c\u4e86 \u2192 Discord\u306b\u901a\u77e5\u3057\u307e\u3057\u305f', '\u0110\u1eb7t h\u00e0ng xong \u2192 \u0111\u00e3 b\u00e1o Discord'));
    return true;
  }
  // ng\u01b0\u1eddi mua t\u1ef1 b\u1ea5m \u652f\u6255\u3044 (kh\u00f4ng qua BOT) c\u0169ng ghi l\u1ea1i
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('button, input[type=submit]');
    if (b && /^(\u652f\u6255\u3044|\u304a\u652f\u6255\u3044|Pay\b|Submit payment)/i.test((b.innerText || b.value || '').trim())) {
      const rs = [...document.querySelectorAll('input[type=radio]')].filter((r) => KSTORES.some(([, , re]) => re.test(labelOf(r) + ' ' + (r.value || ''))));
      markPending(b, rs);
    }
  }, true);
  let clicks = 0, lastClick = 0;
  const t0 = Date.now();
  const timer = setInterval(() => {
    if (Date.now() - t0 > 300e3) { clearInterval(timer); return; }
    const payBtn = [...document.querySelectorAll('button, input[type=submit]')].find((b) => vis(b) && /^(\u652f\u6255\u3044|\u304a\u652f\u6255\u3044|Pay\b|Submit payment)/i.test((b.innerText || b.value || '').trim()));
    if (checkDone(!!payBtn)) { clearInterval(timer); return; }
    if (pend() && !payBtn) { say(L('\u304a\u652f\u6255\u3044\u51e6\u7406\u4e2d\u2026', '\u0110ang x\u1eed l\u00fd thanh to\u00e1n\u2026')); return; }
    const boxes = [...document.querySelectorAll('input:not([type=hidden]):not([type=radio]):not([type=checkbox]):not([type=submit])')].filter(vis);
    for (const el of boxes) {
      if (el.value) continue;
      const l = labelOf(el);
      for (const [k, test] of FIELDS) if (c[k] && test(l)) { setVal(el, k === 'phone' ? c[k].replace(/[^\d+]/g, '') : c[k]); break; }
    }
    // c\u1eeda h\u00e0ng konbini
    const radios = [...document.querySelectorAll('input[type=radio]')];
    const st = KSTORES.find(([k]) => k === (c.kstore || 'seven'));
    const storeRadios = radios.filter((r) => KSTORES.some(([, , re]) => re.test(labelOf(r) + ' ' + (r.value || ''))));
    if (storeRadios.length && st) {
      const r = storeRadios.find((x) => st[2].test(labelOf(x) + ' ' + (x.value || '')));
      if (r && !r.checked) r.click();
    }
    const empty = boxes.filter((e) => !e.value && (e.required || e.getAttribute('aria-required') === 'true' || !/\u4efb\u610f|optional/i.test(labelOf(e))));
    const storeOk = !storeRadios.length || storeRadios.some((x) => x.checked);
    if (empty.length || !storeOk) {
      say(L('\u5165\u529b\u4e2d\u2026 \u672a\u5165\u529b: ', '\u0110ang \u0111i\u1ec1n\u2026 c\u00f2n thi\u1ebfu: ') + empty.map((e) => labelOf(e).slice(0, 12)).concat(storeOk ? [] : [L('\u30b3\u30f3\u30d3\u30cb', 'c\u1eeda h\u00e0ng')]).join(', ') +
        (!c.klast && !c.phone ? L('\uff08\u2699\ufe0f\u3067\u300c\u8cbc\u308a\u4ed8\u3051\u300d\uff09', ' (b\u1ea5m \u2699\ufe0f \u2192 D\u00e1n)') : ''));
      return;
    }
    const btn = [...document.querySelectorAll('button, input[type=submit]')].find((b) => vis(b) && !b.disabled && b.getAttribute('aria-disabled') !== 'true' &&
      /^(\u652f\u6255\u3044|\u304a\u652f\u6255\u3044|Pay\b|Submit payment)/i.test((b.innerText || b.value || '').trim()));
    if (!fromShop) { say(L('\u5165\u529b\u5b8c\u4e86 \u2192\u300c\u652f\u6255\u3044\u300d\u3092\u62bc\u3057\u3066\u304f\u3060\u3055\u3044\uff08\u5e97\u8217\u304b\u3089\u6765\u3066\u3044\u306a\u3044\u305f\u3081\uff09', '\u0110\u00e3 \u0111i\u1ec1n xong \u2192 b\u1ea5m \u300c\u652f\u6255\u3044\u300d (kh\u00f4ng \u0111i t\u1eeb shop sang)')); return; }
    if (!btn) { say(L('\u300c\u652f\u6255\u3044\u300d\u30dc\u30bf\u30f3\u5f85\u3061\u2026', 'Ch\u1edd n\u00fat \u300c\u652f\u6255\u3044\u300d\u2026')); return; }
    if (clicks >= 2 || Date.now() - lastClick < 10000) return;
    clicks++; lastClick = Date.now();
    say(L(`\u300c\u652f\u6255\u3044\u300d\u3092\u62bc\u3057\u307e\u3057\u305f (${clicks})`, `\u0110\u00e3 b\u1ea5m \u300c\u652f\u6255\u3044\u300d (${clicks})`));
    btn.click();
  }, 250);
})();

// ===================== CAPTCHA hi\u1ec7n ra \u2192 d\u1eddi khung BOT cho kh\u1ecfi che (user y\u00eau c\u1ea7u 3/11) =====================
// KH\u00d4NG gi\u1ea3i captcha: th\u1ea5y khung hCaptcha / reCAPTCHA / Turnstile \u0111ang hi\u1ec7n th\u00ec d\u1eddi c\u00e1c khung SYNOVA \u0111ang che n\u00f3 sang m\u00e9p
// c\u00f2n tr\u1ed1ng (kh\u00f4ng c\u00f2n ch\u1ed7 th\u00ec t\u1ea1m \u1ea9n), \u0111\u00f3ng ph\u1ea7n c\u00e0i \u0111\u1eb7t c\u1ee7a b\u1ea3ng BOT, hi\u1ec7n 1 d\u00f2ng b\u00e1o; captcha bi\u1ebfn m\u1ea5t th\u00ec tr\u1ea3 v\u1ec1 nh\u01b0 c\u0169.
if (!SYNOVA_DUP && !IN_FRAME && !IS_PCI && (IS_PAL || IS_SUP || IS_HM || IS_BUF || IS_GEN || SHOPIFY_CO || IS_KOMOJU || IS_SHOPAPP)) (function sxbCaptchaYield() {
  const CAP_RE = /hcaptcha\.com|\/recaptcha\/(api2|enterprise)\/(anchor|bframe)|challenges\.cloudflare\.com/i;
  const HOSTS = ['sxbhost', 'sxbbubh', 'sxbbanner', 'sxbkomoju'];
  const GAP = 6;
  const EDGES = [['calc(env(safe-area-inset-top) + 6px)', 'auto'], ['auto', 'calc(env(safe-area-inset-bottom) + 8px)']];
  const saved = new Map();                      // khung \u0111\u00e3 d\u1eddi -> style c\u0169
  let on = false, toast = null;
  function capRects() {
    const out = [];
    for (const f of document.querySelectorAll('iframe')) {
      const src = f.src || f.getAttribute('data-src') || '';
      if (!CAP_RE.test(src) || /size=invisible/.test(src)) continue;      // huy hi\u1ec7u reCAPTCHA \u1ea9n (v3) kh\u00f4ng t\u00ednh
      const r = f.getBoundingClientRect();
      if (r.width < 40 || r.height < 40 || r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) continue;
      const cs = getComputedStyle(f);
      if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
      out.push(r);
    }
    return out;
  }
  const hit = (a, rs) => a.width > 0 && rs.some((r) => a.left < r.right + GAP && a.right > r.left - GAP && a.top < r.bottom + GAP && a.bottom > r.top - GAP);
  function panels() {
    const els = [];
    for (const id of HOSTS) {
      const h = document.getElementById(id), root = h && (h.shadowRoot || h);
      if (root) for (const el of root.children) if (el.tagName !== 'STYLE' && getComputedStyle(el).position === 'fixed') els.push(el);
    }
    return els;
  }
  function restore() {
    for (const [el, o] of saved) { el.style.top = o.top; el.style.bottom = o.bottom; el.style.visibility = o.vis; el.style.pointerEvents = o.pe; }
    saved.clear();
  }
  function move(el, rs) {
    if (!hit(el.getBoundingClientRect(), rs)) return;
    saved.set(el, { top: el.style.top, bottom: el.style.bottom, vis: el.style.visibility, pe: el.style.pointerEvents });
    if (el.id !== 'sxbbub') {                   // bong b\u00f3ng t\u1ef1 \u0111\u1eb7t l\u1ea1i top/bottom m\u1ed7i gi\u00e2y -> ch\u1ec9 \u1ea9n
      for (const [t, b] of EDGES) { el.style.top = t; el.style.bottom = b; if (!hit(el.getBoundingClientRect(), rs)) return; }
    }
    el.style.visibility = 'hidden'; el.style.pointerEvents = 'none';
  }
  function say(rs) {
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'sxbcaptoast';
      toast.style.cssText = 'all:initial;position:fixed;z-index:2147483647;top:0;left:0;width:0;height:0';
      const root = toast.attachShadow({ mode: 'open' });
      root.innerHTML = `<div style="position:fixed;left:8px;right:8px;background:#0d1b32;color:#ffffff;border:1px solid #527198;border-radius:10px;padding:6px 10px;
        font:600 12px -apple-system,'Hiragino Sans',sans-serif;line-height:1.35;box-shadow:0 4px 16px #000a;box-sizing:border-box;pointer-events:none">うずら BOT \u00b7 ${
        L('CAPTCHA \u304c\u51fa\u305f\u306e\u3067\u8a2d\u5b9a\u3092\u9589\u3058\u307e\u3057\u305f\u3002\u89e3\u304d\u7d42\u308f\u308b\u307e\u3067\u3088\u3051\u3066\u3044\u307e\u3059', 'C\u00f3 CAPTCHA \u2192 \u0111\u00e3 \u0111\u00f3ng c\u00e0i \u0111\u1eb7t, BOT tr\u00e1nh ch\u1ed7 t\u1edbi khi b\u1ea1n gi\u1ea3i xong')}</div>`;
      document.body.appendChild(toast);
    }
    const el = toast.shadowRoot.firstElementChild;
    el.style.visibility = '';
    for (const [t, b] of EDGES) { el.style.top = t; el.style.bottom = b; if (!hit(el.getBoundingClientRect(), rs)) return; }
    el.style.bottom = 'auto';                     // 2 m\u00e9p \u0111\u1ec1u b\u1eadn: t\u00ecm khe tr\u1ed1ng \u1edf gi\u1eefa
    for (let y = 6; y < innerHeight - 40; y += 20) { el.style.top = y + 'px'; if (!hit(el.getBoundingClientRect(), rs)) return; }
    el.style.visibility = 'hidden';               // captcha cho\u00e1n c\u1ea3 m\u00e0n h\u00ecnh: th\u00f4i kh\u00f4ng b\u00e1o
  }
  setInterval(() => {
    if (!document.body) return;
    const els = panels();
    const rs = els.length ? capRects() : [];
    const now = rs.length > 0;
    if (now !== on) { on = now; try { window.dispatchEvent(new CustomEvent('sxb-captcha', { detail: on })); } catch (e) {} }
    restore();                                    // \u0111o l\u1ea1i m\u1ed7i l\u01b0\u1ee3t (captcha \u0111\u1ed5i t\u1eeb \u00f4 tick sang khung ch\u1ecdn h\u00ecnh) \u2013 c\u00f9ng 1 l\u01b0\u1ee3t n\u00ean kh\u00f4ng nh\u00e1y
    if (!on) { if (toast) { toast.remove(); toast = null; } return; }
    for (const el of els) move(el, rs);
    // d\u00f2ng b\u00e1o tr\u00e1nh c\u1ea3 captcha l\u1eabn khung BOT c\u00f2n hi\u1ec7n
    say(rs.concat(els.filter((el) => el.style.visibility !== 'hidden').map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0)));
  }, 400);
})();

// ===================== Thanh to\u00e1n xong \u2192 Discord =====================
// Supreme: Shopify /checkouts/.../thank-you ; HUMAN MADE / Buffer: trang x\u00e1c nh\u1eadn \u0111\u01a1n c\u1ee7a SFCC (Order-Confirm / confirmation)
if (!SYNOVA_DUP && !IN_FRAME && !IS_PCI && (IS_PAL || IS_SUP || IS_HM || IS_BUF || IS_FEI || IS_GEN || SHOPIFY_CO)) (function () {
  const FEI_OK = /ご注文ありがとう|ご注文を承り|注文が完了|注文は完了|注文完了|ありがとうございました|注文を受け付け|注文を受付/;
  const FEI_NG = /エラーが発生|決済に失敗|承認されません|ご利用いただけません|有効期限が切れ|タイムアウト/;
  const feiNo = (text) => ((text || '').match(/(?:注文|受注|受付)\s*(?:番号|No\.?|ID)[^0-9A-Za-z\n]{0,8}\n?\s*([0-9][0-9A-Za-z-]{3,})/) || [])[1] || '';
  const feiDone = () => FEI_ORDER && document.body && !document.forms.frmMethod &&
    !document.querySelector('input[name="order_agree"],input[name="guest.x"],input[name="guest"]') &&
    FEI_OK.test(document.body.innerText || '') && !FEI_NG.test(document.body.innerText || '');
  const isThanks = () => IS_FEI ? feiDone() : /thank[-_]you|\/orders\/[0-9a-z]{16,}|order-?confirm|Order-Confirm|\/confirmation/i.test(location.pathname + location.search);
  let tries = 0, fired = false;
  const tick = () => {
    if (fired) return;
    if (++tries > 1800) return clearInterval(timer);
    if (!isThanks() || !document.body) return;
    const text = document.body.innerText || '';
    if (!IS_FEI && !/ありがとう|Thank you|ご注文|注文番号|order/i.test(text)) return;
    const orderNo = IS_FEI ? feiNo(text) : findOrderNo(text) || findOrderNo(document.title);
    if (!orderNo && tries < (IS_FEI ? 4 : 12)) return;
    let last = null;
    try { last = JSON.parse(localStorage.getItem(K_LAST)); } catch (e) {}
    const unique = orderNo || (IS_FEI && last?.at ? 't' + last.at : location.pathname);
    const key = 'synova_sent_' + (IS_FEI ? location.pathname + '#' + unique : unique);
    fired = true; clearInterval(timer);
    try { if (localStorage.getItem(key)) return; localStorage.setItem(key, '1'); } catch (e) {}
    let banner;
    if (IS_FEI) { banner = synovaBanner(() => {}); banner.hideStop(); banner.say('購入完了を確認 → 通知処理中…'); }
    synovaNotify(orderEmbeds(last), buyInfo().uwh, [['Email', emailUsed()], ['注文番号', orderNo]], IS_FEI ? (status, message) => {
      if (banner) banner.say(message || (status === 'sent' ? '購入成功通知を送信しました' : '通知結果を確認してください'));
      if (status === 'error' || status === 'unconfigured') try { localStorage.removeItem(key); } catch (e) {}
    } : undefined, IS_FEI ? unique : undefined);
    try { localStorage.removeItem(K_LAST); localStorage.removeItem(K_CART); localStorage.removeItem('sxb_pay_used'); } catch (e) {}
    try {
      const k = 'sxb_' + SITE_KEY + '_st';
      const v = JSON.parse(localStorage.getItem(k) || '{}'); v.active = false; v.boughtAt = Date.now(); localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {}
  };
  const timer = setInterval(tick, IS_FEI ? 300 : 1000);
  if (IS_FEI) setTimeout(tick, 60);
})();

  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', runShop, { once: true });
  else runShop();
})();

}


