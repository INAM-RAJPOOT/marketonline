(function () {
  const RECENT_KEY = 'marketonline-recent';
  const AGE_KEY = 'marketonline-age-ok';
  const POPUP_KEY = 'marketonline-popup-closed';

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function money(cents) {
    return typeof formatMoney === 'function' ? formatMoney(cents) : (cents / 100).toFixed(2);
  }

  function productCard(product) {
    const image = product.featured_image || '';
    const onSale = product.compare_at_price && product.compare_at_price > product.price;
    return `
      <li>
        <div class="product-card">
          <a href="${product.url}" class="product-card__media-link">
            <div class="product-card__media">
              ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(product.title)}" class="product-card__image" loading="lazy" width="600" height="600">` : ''}
            </div>
          </a>
          <div class="product-card__info">
            <p class="product-card__vendor">${escapeHtml(product.vendor || '')}</p>
            <h3 class="product-card__title"><a href="${product.url}">${escapeHtml(product.title)}</a></h3>
            <div class="product-card__price">
              ${onSale ? `<s>${money(product.compare_at_price)}</s> ` : ''}
              <span>${money(product.price)}</span>
            </div>
          </div>
        </div>
      </li>`;
  }

  function trackRecent() {
    const handle = document.body.dataset.trackProduct;
    if (!handle) return;
    let items = [];
    try { items = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch (e) { items = []; }
    items = [handle, ...items.filter((item) => item !== handle)].slice(0, 12);
    localStorage.setItem(RECENT_KEY, JSON.stringify(items));
  }

  async function renderRecent() {
    let handles = [];
    try { handles = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch (e) { handles = []; }
    const sections = document.querySelectorAll('[data-recently-viewed]');
    for (const section of sections) {
      const limit = parseInt(section.dataset.limit, 10) || 4;
      const current = section.dataset.current;
      const wanted = handles.filter((handle) => handle && handle !== current).slice(0, limit);
      const grid = section.querySelector('[data-recently-viewed-grid]');
      if (!wanted.length || !grid) {
        section.hidden = true;
        continue;
      }
      const products = (await Promise.all(wanted.map(async (handle) => {
        try {
          const res = await fetch(`/products/${handle}.js`);
          return res.ok ? res.json() : null;
        } catch (e) {
          return null;
        }
      }))).filter(Boolean);
      if (!products.length) {
        section.hidden = true;
        continue;
      }
      grid.innerHTML = products.map(productCard).join('');
      section.hidden = false;
    }
  }

  async function renderComplementary() {
    const sections = document.querySelectorAll('[data-complementary]');
    for (const section of sections) {
      const productId = section.dataset.productId;
      const limit = parseInt(section.dataset.limit, 10) || 4;
      const grid = section.querySelector('[data-complementary-grid]');
      if (!productId || !grid) {
        section.hidden = true;
        continue;
      }
      try {
        const res = await fetch(`/recommendations/products.json?product_id=${productId}&limit=${limit}&intent=complementary`);
        const data = await res.json();
        const products = data.products || [];
        if (!products.length) {
          section.hidden = true;
          continue;
        }
        grid.innerHTML = products.map(productCard).join('');
        section.hidden = false;
      } catch (e) {
        section.hidden = true;
      }
    }
  }

  function variantMeta(sectionId) {
    const el = document.getElementById(`variant-meta-${sectionId}`);
    if (!el) return {};
    try {
      return JSON.parse(el.textContent).reduce((map, item) => {
        map[item.id] = item;
        return map;
      }, {});
    } catch (e) {
      return {};
    }
  }

  function fillTemplate(template, values) {
    return Object.keys(values).reduce((text, key) => text.replace(key, values[key]), template || '');
  }

  function updateStock(sectionId, variant) {
    const meta = variantMeta(sectionId)[variant.id];
    document.querySelectorAll('[data-stock-counter]').forEach((el) => {
      if (!meta) return;
      const threshold = parseInt(el.dataset.threshold, 10) || 5;
      const qty = Number(meta.inventory_quantity);
      const tracked = Boolean(meta.inventory_management);
      let dot = 'in';
      let label = el.dataset.labelIn;
      if (!variant.available) {
        dot = 'out';
        label = el.dataset.labelOut;
      } else if (tracked && qty > 0 && qty <= threshold) {
        dot = 'low';
        label = fillTemplate(el.dataset.labelLow, { '__COUNT__': qty });
      } else if (el.dataset.showCount === 'true' && tracked && qty > 0) {
        label = fillTemplate(el.dataset.labelCount, { '__COUNT__': qty });
      }
      el.innerHTML = `<span class="stock-counter__dot stock-counter__dot--${dot}"></span> ${escapeHtml(label)}`;
    });

    document.querySelectorAll('[data-back-in-stock]').forEach((el) => {
      el.hidden = Boolean(variant.available);
      const body = el.querySelector('[data-bis-body]');
      if (body) {
        body.value = body.value.replace(/— .+$/, `— ${variant.title || variant.name || ''}`);
      }
    });
  }

  function updateVolume(sectionId, variant) {
    const meta = variantMeta(sectionId)[variant.id];
    document.querySelectorAll('[data-volume-pricing]').forEach((el) => {
      if (!meta) return;
      const rule = meta.quantity_rule || {};
      const rules = el.querySelector('[data-volume-rules]');
      const breaks = el.querySelector('[data-volume-breaks]');
      const ruleItems = [];
      if (rule.min > 1) ruleItems.push(`<li>${escapeHtml(fillTemplate(el.dataset.labelMin, { '__COUNT__': rule.min }))}</li>`);
      if (rule.max) ruleItems.push(`<li>${escapeHtml(fillTemplate(el.dataset.labelMax, { '__COUNT__': rule.max }))}</li>`);
      if (rule.increment > 1) ruleItems.push(`<li>${escapeHtml(fillTemplate(el.dataset.labelStep, { '__COUNT__': rule.increment }))}</li>`);
      if (rules) rules.innerHTML = ruleItems.join('');
      const priceBreaks = meta.price_breaks || [];
      if (breaks) {
        breaks.hidden = priceBreaks.length === 0;
        breaks.innerHTML = priceBreaks.map((item) => {
          const label = fillTemplate(el.dataset.labelBreak, { '__COUNT__': item.min, '__PRICE__': item.price });
          return `<li data-min="${item.min}">${escapeHtml(label)}</li>`;
        }).join('');
      }
      el.hidden = ruleItems.length === 0 && priceBreaks.length === 0;
    });
  }

  function highlightVolume() {
    const input = document.querySelector('.product__quantity-input');
    const qty = parseInt(input?.value, 10) || 1;
    document.querySelectorAll('[data-volume-breaks] li').forEach((item) => {
      const min = parseInt(item.dataset.min, 10) || 0;
      item.classList.toggle('is-active', qty >= min);
    });
  }

  function initOverlays() {
    const age = document.querySelector('[data-age-verifier]');
    let ageBlocking = false;
    if (age && localStorage.getItem(AGE_KEY) !== '1') {
      age.hidden = false;
      document.body.classList.add('overflow-hidden');
      ageBlocking = true;
      age.querySelector('[data-age-enter]')?.addEventListener('click', () => {
        localStorage.setItem(AGE_KEY, '1');
        age.hidden = true;
        document.body.classList.remove('overflow-hidden');
        openPopup();
      });
      age.querySelector('[data-age-leave]')?.addEventListener('click', () => {
        window.location.href = 'https://www.google.com';
      });
    }

    const popup = document.querySelector('[data-promo-popup]');
    function openPopup() {
      if (!popup || sessionStorage.getItem(POPUP_KEY) === '1') return;
      if (popup.querySelector('.promo-popup__success')) {
        popup.hidden = false;
        return;
      }
      const delay = parseInt(popup.dataset.delay, 10) || 4000;
      window.setTimeout(() => {
        if (sessionStorage.getItem(POPUP_KEY) === '1') return;
        popup.hidden = false;
      }, delay);
    }
    if (popup) {
      popup.querySelectorAll('[data-promo-close]').forEach((btn) => {
        btn.addEventListener('click', () => {
          popup.hidden = true;
          sessionStorage.setItem(POPUP_KEY, '1');
        });
      });
      if (!ageBlocking) openPopup();
    }

    const top = document.querySelector('[data-back-to-top]');
    if (top) {
      const onScroll = () => { top.hidden = window.scrollY < 400; };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
      top.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    }
  }

  function initDialogs() {
    document.addEventListener('click', (event) => {
      const open = event.target.closest('[data-size-chart-open]');
      if (open) {
        const dialog = document.getElementById(open.getAttribute('aria-controls'));
        if (dialog) dialog.hidden = false;
      }
      if (event.target.closest('[data-size-chart-close]')) {
        event.target.closest('.size-chart__dialog')?.setAttribute('hidden', '');
        const dialog = event.target.closest('.size-chart__dialog');
        if (dialog) dialog.hidden = true;
      }
      const tab = event.target.closest('.product-tabs__tab');
      if (tab) {
        const root = tab.closest('[data-product-tabs]');
        root.querySelectorAll('.product-tabs__tab').forEach((item) => {
          const active = item === tab;
          item.classList.toggle('is-active', active);
          item.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        root.querySelectorAll('[data-tab-panel]').forEach((panel) => {
          panel.classList.toggle('is-active', panel.dataset.tabPanel === tab.dataset.tab);
        });
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      document.querySelectorAll('.size-chart__dialog, #quick-view').forEach((dialog) => {
        dialog.hidden = true;
      });
    });
  }

  function initQuickView() {
    const modal = document.getElementById('quick-view');
    if (!modal) return;
    const content = modal.querySelector('[data-quick-view-content]');

    function close() {
      modal.hidden = true;
      document.body.classList.remove('overflow-hidden');
    }

    modal.querySelectorAll('[data-quick-view-close]').forEach((btn) => btn.addEventListener('click', close));

    document.addEventListener('click', async (event) => {
      const trigger = event.target.closest('[data-quick-view]');
      if (!trigger) return;
      event.preventDefault();
      const handle = trigger.dataset.productHandle;
      if (!handle) return;
      content.innerHTML = `<p>${escapeHtml(window.theme?.strings?.loading || 'Loading')}</p>`;
      modal.hidden = false;
      document.body.classList.add('overflow-hidden');
      try {
        const res = await fetch(`/products/${handle}.js`);
        const product = await res.json();
        const options = (product.options || []).map((option, index) => {
          const values = [...new Set(product.variants.map((variant) => variant.options[index]).filter(Boolean))];
          return `<label>${escapeHtml(option)}<select data-quick-option="${index}">${values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('')}</select></label>`;
        }).join('');
        content.innerHTML = `
          <div class="quick-view__layout">
            <div>${product.featured_image ? `<img class="quick-view__image" src="${escapeHtml(product.featured_image)}" alt="${escapeHtml(product.title)}" width="800" height="800">` : ''}</div>
            <div>
              <p class="product-card__vendor">${escapeHtml(product.vendor || '')}</p>
              <h2 id="quick-view-title" class="quick-view__title">${escapeHtml(product.title)}</h2>
              <p class="quick-view__price" data-quick-price>${money(product.price)}</p>
              <div class="quick-view__options">${options}</div>
              <div class="quick-view__actions">
                <button type="button" class="button button--primary" data-quick-view-add>${escapeHtml(window.theme?.strings?.addToCart || 'Add to cart')}</button>
                <a class="button button--secondary" href="${product.url}">${escapeHtml(window.theme?.strings?.viewDetails || 'View details')}</a>
              </div>
            </div>
          </div>`;
        content.dataset.product = JSON.stringify(product);
      } catch (e) {
        content.innerHTML = `<p>${escapeHtml(window.theme?.strings?.error || 'Something went wrong')}</p>`;
      }
    });

    content.addEventListener('click', async (event) => {
      if (!event.target.closest('[data-quick-view-add]')) return;
      const product = JSON.parse(content.dataset.product || '{}');
      const selected = [...content.querySelectorAll('[data-quick-option]')].map((select) => select.value);
      const variant = (product.variants || []).find((item) => item.options.every((option, index) => option === selected[index])) || product.variants?.[0];
      if (!variant || !window.cartDrawer) return;
      await window.cartDrawer.addAndOpen(variant.id, 1);
      close();
    });

    content.addEventListener('change', () => {
      const product = JSON.parse(content.dataset.product || '{}');
      const selected = [...content.querySelectorAll('[data-quick-option]')].map((select) => select.value);
      const variant = (product.variants || []).find((item) => item.options.every((option, index) => option === selected[index]));
      const price = content.querySelector('[data-quick-price]');
      const button = content.querySelector('[data-quick-view-add]');
      if (variant && price) price.textContent = money(variant.price);
      if (button) button.disabled = variant ? !variant.available : true;
    });
  }

  function initCountdown() {
    document.querySelectorAll('[data-countdown]').forEach((timer) => {
      const end = new Date(String(timer.dataset.end || '').replace(' ', 'T'));
      if (Number.isNaN(end.getTime())) return;
      const units = {
        days: timer.querySelector('[data-countdown-days]'),
        hours: timer.querySelector('[data-countdown-hours]'),
        minutes: timer.querySelector('[data-countdown-minutes]'),
        seconds: timer.querySelector('[data-countdown-seconds]')
      };
      const tick = () => {
        const diff = end.getTime() - Date.now();
        if (diff <= 0) {
          timer.innerHTML = `<p>${escapeHtml(timer.dataset.ended || '')}</p>`;
          return;
        }
        const total = Math.floor(diff / 1000);
        units.days.textContent = String(Math.floor(total / 86400)).padStart(2, '0');
        units.hours.textContent = String(Math.floor((total % 86400) / 3600)).padStart(2, '0');
        units.minutes.textContent = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
        units.seconds.textContent = String(total % 60).padStart(2, '0');
      };
      tick();
      window.setInterval(tick, 1000);
    });
  }

  function initBeforeAfter() {
    document.querySelectorAll('[data-before-after]').forEach((stage) => {
      const range = stage.querySelector('[data-before-after-range]');
      const pane = stage.querySelector('[data-before-pane]');
      if (!range || !pane) return;
      const sync = () => {
        const width = stage.clientWidth;
        stage.querySelectorAll('img, svg').forEach((media) => {
          media.style.width = `${width}px`;
        });
        pane.style.width = `${range.value}%`;
      };
      range.addEventListener('input', sync);
      window.addEventListener('resize', sync);
      sync();
    });
  }

  function initHotspots() {
    document.addEventListener('click', (event) => {
      const dot = event.target.closest('[data-hotspot]');
      if (dot) {
        const card = document.getElementById(dot.getAttribute('aria-controls'));
        const willOpen = card?.hidden;
        document.querySelectorAll('.lookbook__card').forEach((item) => { item.hidden = true; });
        document.querySelectorAll('[data-hotspot]').forEach((item) => item.setAttribute('aria-expanded', 'false'));
        if (card && willOpen) {
          card.hidden = false;
          dot.setAttribute('aria-expanded', 'true');
        }
        return;
      }
      if (!event.target.closest('.lookbook__card')) {
        document.querySelectorAll('.lookbook__card').forEach((item) => { item.hidden = true; });
        document.querySelectorAll('[data-hotspot]').forEach((item) => item.setAttribute('aria-expanded', 'false'));
      }
    });
  }

  function initReveal() {
    if (!document.body.classList.contains('theme-animate')) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const nodes = document.querySelectorAll('.section-spacing, .hero');
    if (!('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    nodes.forEach((node) => {
      node.classList.add('reveal');
      observer.observe(node);
    });
  }

  let noteTimer;
  function saveCartAttributes(extra) {
    const note = document.querySelector('[data-cart-note]')?.value;
    const message = document.querySelector('[data-gift-message]')?.value;
    const wrap = document.querySelector('[data-gift-wrap]');
    const attributes = {
      'Gift message': message || ''
    };
    if (wrap && !wrap.dataset.variantId) attributes['Gift wrap'] = wrap.checked ? 'Yes' : '';
    if (extra) Object.assign(attributes, extra);
    return fetch(window.theme.routes.cart_update_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        note: note || '',
        attributes
      })
    });
  }

  function initCartExtras() {
    document.addEventListener('input', (event) => {
      if (!event.target.matches('[data-cart-note], [data-gift-message]')) return;
      window.clearTimeout(noteTimer);
      noteTimer = window.setTimeout(() => { saveCartAttributes(); }, 400);
    });

    document.addEventListener('change', async (event) => {
      const wrap = event.target.closest('[data-gift-wrap]');
      if (!wrap) return;
      const variantId = wrap.dataset.variantId;
      try {
        if (variantId) {
          if (wrap.checked) {
            await fetch(window.theme.routes.cart_add_url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
              body: JSON.stringify({ items: [{ id: Number(variantId), quantity: 1, properties: { 'Gift wrap': 'Yes' } }] })
            });
          } else {
            const cart = await fetch('/cart.js').then((res) => res.json());
            const item = cart.items.find((line) => String(line.variant_id) === String(variantId));
            if (item) await Cart.change(item.key, 0);
          }
          await saveCartAttributes({ 'Gift wrap': wrap.checked ? 'Yes' : '' });
          const cart = await fetch('/cart.js').then((res) => res.json());
          Cart.updateCount(cart.item_count);
          await Cart.renderDrawer();
          if (window.cartDrawer && wrap.checked) window.cartDrawer.open();
        } else {
          await saveCartAttributes({ 'Gift wrap': wrap.checked ? 'Yes' : '' });
        }
      } catch (e) {
        wrap.checked = !wrap.checked;
      }
    });
  }

  function initQuickOrder() {
    const form = document.querySelector('[data-quick-order-form]');
    if (!form) return;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const status = form.querySelector('[data-quick-order-status]');
      const items = [...form.querySelectorAll('[data-quick-order-qty]')]
        .map((input) => ({ id: Number(input.dataset.variantId), quantity: parseInt(input.value, 10) || 0 }))
        .filter((item) => item.quantity > 0);
      if (!items.length) {
        if (status) status.textContent = window.theme?.strings?.quickOrderEmpty || '';
        return;
      }
      try {
        const res = await fetch(window.theme.routes.cart_add_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ items })
        });
        const data = await res.json();
        if (!res.ok) throw data;
        const cart = await fetch('/cart.js').then((response) => response.json());
        Cart.updateCount(cart.item_count);
        await Cart.renderDrawer();
        window.cartDrawer?.open();
        form.querySelectorAll('[data-quick-order-qty]').forEach((input) => { input.value = 0; });
        if (status) status.textContent = window.theme?.strings?.quickOrderAdded || '';
      } catch (e) {
        if (status) status.textContent = e?.description || window.theme?.strings?.error || '';
      }
    });
  }

  function bindInfinite(section) {
    if (!section || section.dataset.infiniteBound === 'true') return;
    const sentinel = section.querySelector('[data-infinite-sentinel]');
    if (!sentinel || !('IntersectionObserver' in window)) return;
    section.dataset.infiniteBound = 'true';
    const pagination = section.querySelector('.collection__pagination');
    if (pagination) pagination.hidden = true;
    const grid = section.querySelector('#product-grid');
    let loading = false;
    const observer = new IntersectionObserver(async (entries) => {
      if (!entries.some((entry) => entry.isIntersecting) || loading) return;
      const nextUrl = sentinel.dataset.nextUrl;
      if (!nextUrl) return;
      loading = true;
      try {
        const url = new URL(nextUrl, window.location.origin);
        url.searchParams.set('section_id', section.dataset.collectionSection);
        const res = await fetch(url.toString());
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const newItems = doc.querySelectorAll('#product-grid > li');
        newItems.forEach((item) => grid?.appendChild(item));
        const next = doc.querySelector('[data-infinite-sentinel]');
        if (next?.dataset.nextUrl) {
          sentinel.dataset.nextUrl = next.dataset.nextUrl;
        } else {
          sentinel.remove();
          observer.disconnect();
          section.dataset.infiniteBound = 'false';
        }
      } catch (e) {
        if (pagination) pagination.hidden = false;
      } finally {
        loading = false;
      }
    }, { rootMargin: '400px' });
    observer.observe(sentinel);
  }

  function initInfinite() {
    document.querySelectorAll('[data-infinite-scroll]').forEach(bindInfinite);
    document.addEventListener('collection:updated', (event) => {
      const section = event.detail?.section;
      if (section) {
        section.dataset.infiniteBound = 'false';
        bindInfinite(section);
      }
    });
  }

  function initFeatures() {
    trackRecent();
    renderRecent();
    renderComplementary();
    initOverlays();
    initDialogs();
    initQuickView();
    initCountdown();
    initBeforeAfter();
    initHotspots();
    initReveal();
    initCartExtras();
    initQuickOrder();
    initInfinite();
    highlightVolume();
  }

  document.addEventListener('product:variant-change', (event) => {
    updateStock(event.detail.sectionId, event.detail.variant);
    updateVolume(event.detail.sectionId, event.detail.variant);
    highlightVolume();
  });

  document.addEventListener('change', (event) => {
    if (event.target.matches('.product__quantity-input')) highlightVolume();
  });

  document.addEventListener('DOMContentLoaded', initFeatures);
  document.addEventListener('shopify:section:load', () => {
    initCountdown();
    initBeforeAfter();
    renderRecent();
    renderComplementary();
    initReveal();
  });
})();
