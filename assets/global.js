// ============================================
// GLOBAL JS — MarketOnline
// ============================================

document.documentElement.className = document.documentElement.className.replace('no-js', 'js');

// ============================================
// Utilities
// ============================================
function formatMoney(cents, format) {
  if (typeof cents === 'string') cents = cents.replace('.', '');
  const amount = (cents / 100).toFixed(2);
  const amountNoDecimals = Math.floor(cents / 100).toString();
  const amountWithComma = amount.replace('.', ',');
  format = format || (window.theme?.moneyFormat) || '${{amount}}';
  return format
    .replace(/\{\{\s*amount_with_comma_separator\s*\}\}/g, amountWithComma)
    .replace(/\{\{\s*amount_no_decimals\s*\}\}/g, amountNoDecimals)
    .replace(/\{\{\s*amount\s*\}\}/g, amount);
}

function trapFocus(element) {
  const focusable = element.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  element.addEventListener('keydown', function handler(e) {
    if (e.key !== 'Tab') return;
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
}

// ============================================
// Cart API
// ============================================
const Cart = {
  get routes() {
    return window.theme?.routes || {};
  },

  async add(variantId, quantity = 1) {
    const res = await fetch(this.routes.cart_add_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ items: [{ id: variantId, quantity }] })
    });
    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  },

  async change(key, quantity) {
    const res = await fetch(this.routes.cart_change_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ id: key, quantity })
    });
    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  },

  async fetch() {
    const res = await fetch('/cart.js');
    return res.json();
  },

  updateCount(count) {
    let countEl = document.querySelector('.header__cart-count');
    if (count > 0) {
      if (!countEl) {
        const cartBtn = document.querySelector('[data-cart-drawer-open]');
        if (cartBtn) {
          countEl = document.createElement('span');
          countEl.className = 'header__cart-count';
          countEl.setAttribute('aria-hidden', 'true');
          cartBtn.appendChild(countEl);
        }
      }
      if (countEl) {
        countEl.textContent = count;
        countEl.style.display = 'flex';
      }
    } else if (countEl) {
      countEl.style.display = 'none';
    }

    const cartBtn = document.querySelector('[data-cart-drawer-open]');
    if (cartBtn) {
      const template = window.theme?.strings?.cartCount || `Cart (${count} items)`;
      cartBtn.setAttribute('aria-label', template.replace('__COUNT__', count));
      cartBtn.classList.remove('is-bumping');
      void cartBtn.offsetWidth;
      cartBtn.classList.add('is-bumping');
    }
  },

  async renderDrawer() {
    const drawer = document.getElementById('cart-drawer');
    if (!drawer) return;
    const wasOpen = drawer.classList.contains('is-open');

    const res = await fetch(`${this.routes.cart_url}?section_id=cart-drawer`);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const newDrawer = doc.getElementById('cart-drawer');
    if (newDrawer) {
      drawer.innerHTML = newDrawer.innerHTML;
      if (wasOpen) drawer.setAttribute('aria-hidden', 'false');
    }
  }
};

window.Cart = Cart;

// ============================================
// Cart Drawer
// ============================================
class CartDrawer {
  constructor() {
    this.drawer = document.getElementById('cart-drawer');
    if (!this.drawer) return;
    this.panel = this.drawer.querySelector('.cart-drawer__panel');
    this.isOpen = false;
    this.bindEvents();
  }

  bindEvents() {
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-cart-drawer-open]')) {
        e.preventDefault();
        this.open();
      }
      if (e.target.closest('[data-cart-drawer-close]')) {
        this.close();
      }
      const changeBtn = e.target.closest('[data-cart-change]');
      if (changeBtn && this.drawer.contains(changeBtn)) {
        this.changeItem(changeBtn.dataset.key, parseInt(changeBtn.dataset.quantity, 10));
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.close();
    });
  }

  open() {
    this.isOpen = true;
    this.drawer.classList.add('is-open');
    this.drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('overflow-hidden');
    this.panel = this.drawer.querySelector('.cart-drawer__panel');
    if (this.panel) {
      trapFocus(this.panel);
      this.panel.querySelector('[data-cart-drawer-close]')?.focus();
    }
    CartDrawerUpsells.load();
  }

  close() {
    this.isOpen = false;
    this.drawer.classList.remove('is-open');
    this.drawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('overflow-hidden');
    document.querySelector('[data-cart-drawer-open]')?.focus();
  }

  async changeItem(key, quantity) {
    try {
      const cart = await Cart.change(key, quantity);
      Cart.updateCount(cart.item_count);
      await Cart.renderDrawer();
      await CartDrawerUpsells.load();
      if (cart.item_count === 0) this.close();
    } catch (err) {
      console.error('Cart update failed', err);
    }
  }

  async addAndOpen(variantId, quantity = 1) {
    try {
      const cart = await Cart.add(variantId, quantity);
      Cart.updateCount(cart.item_count);
      await Cart.renderDrawer();
      this.open();
    } catch (err) {
      const message = err?.description || err?.message || 'Could not add to cart';
      alert(message);
    }
  }
}

// ============================================
// Product Form (variant selection + AJAX add)
// ============================================
class ProductForm {
  constructor(form) {
    this.form = form;
    this.sectionId = form.dataset.sectionId;
    this.jsonEl = document.getElementById(`product-json-${this.sectionId}`);
    if (!this.jsonEl) return;

    this.product = JSON.parse(this.jsonEl.textContent);
    this.variantMeta = {};
    const metaEl = document.getElementById(`variant-meta-${this.sectionId}`);
    if (metaEl) {
      try {
        JSON.parse(metaEl.textContent).forEach((item) => {
          this.variantMeta[item.id] = item;
        });
      } catch (err) {
        this.variantMeta = {};
      }
    }
    this.variantInput = form.querySelector('[name="id"]');
    this.submitBtn = form.querySelector('[type="submit"][name="add"]');
    this.priceEl = document.querySelector(`#price-${this.sectionId} [data-product-price]`);
    this.mediaGallery = document.querySelector('[data-product-media]');
    this.selectedOptions = this.getSelectedOptionsFromDOM();
    this.currentVariant = this.findVariant(this.selectedOptions);

    this.bindEvents();
    this.updateVariant(this.currentVariant, false);
  }

  getSelectedOptionsFromDOM() {
    const optionEls = this.form.querySelectorAll('.product__option');
    if (optionEls.length === 0) {
      return this.product.variants[0]?.options || [];
    }
    const options = [];
    optionEls.forEach((optionEl, index) => {
      const active = optionEl.querySelector('.product__option-btn--active, .product__swatch--active');
      options[index] = active?.dataset.value || this.product.options[index];
    });
    return options;
  }

  findVariant(options) {
    return this.product.variants.find((variant) =>
      variant.options.every((opt, i) => opt === options[i])
    );
  }

  bindEvents() {
    this.form.querySelectorAll('button.product__option-btn, button.product__swatch').forEach((btn) => {
      btn.addEventListener('click', () => {
        const value = btn.dataset.value;
        const group = btn.closest('.product__option-buttons, .product__swatches');
        if (group) {
          group.querySelectorAll('.product__option-btn, .product__swatch').forEach((b) => {
            b.classList.remove('product__option-btn--active', 'product__swatch--active');
          });
          btn.classList.add(
            btn.classList.contains('product__swatch') ? 'product__swatch--active' : 'product__option-btn--active'
          );
        }

        const optionEl = btn.closest('.product__option');
        const label = optionEl?.querySelector('.product__option-label');
        if (label) {
          const optionName = label.dataset.optionName;
          const selectedSpan = document.getElementById(`selected-${optionName}`);
          if (selectedSpan) selectedSpan.textContent = value;
        }

        this.selectedOptions = this.getSelectedOptionsFromDOM();
        const variant = this.findVariant(this.selectedOptions);
        if (variant) this.updateVariant(variant);
      });
    });

    this.form.querySelectorAll('.product__quantity-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = btn.closest('.product__quantity-wrapper')?.querySelector('.product__quantity-input');
        if (!input) return;
        const min = parseInt(input.min, 10) || 1;
        const step = parseInt(input.step, 10) || 1;
        const max = parseInt(input.max, 10);
        let val = parseInt(input.value, 10) || min;
        if (btn.dataset.action === 'increase') {
          const next = val + step;
          if (!max || next <= max) input.value = next;
        } else if (val - step >= min) {
          input.value = val - step;
        }
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });

    this.form.addEventListener('submit', (e) => this.onSubmit(e));
  }

  updateVariant(variant, updateUrl = true) {
    if (!variant) return;
    this.currentVariant = variant;

    if (this.variantInput) this.variantInput.value = variant.id;

    if (this.priceEl) {
      const onSale = variant.compare_at_price && variant.compare_at_price > variant.price;
      this.priceEl.innerHTML = onSale
        ? `<div class="product__price product__price--on-sale">
             <span class="product__price__compare"><s>${formatMoney(variant.compare_at_price)}</s></span>
             <span class="product__price__sale">${formatMoney(variant.price)}</span>
             <span class="product__price__badge">${window.theme?.strings?.sale || 'Sale'}</span>
           </div>`
        : `<div class="product__price"><span class="product__price__regular">${formatMoney(variant.price)}</span></div>`;
    }

    const mediaId = variant.featured_media_id || variant.featured_image?.id;
    if (mediaId && this.mediaGallery?._mediaController) {
      this.mediaGallery._mediaController.setActive(mediaId);
    }

    const meta = this.variantMeta[variant.id] || {};
    const buttonLabel = this.buttonLabel(variant, meta);
    const qtyInput = this.form.querySelector('[name="quantity"]');
    if (qtyInput && meta.quantity_rule) {
      const rule = meta.quantity_rule;
      qtyInput.min = rule.min || 1;
      qtyInput.step = rule.increment || 1;
      if (rule.max) qtyInput.max = rule.max;
      else qtyInput.removeAttribute('max');
      const current = parseInt(qtyInput.value, 10) || rule.min || 1;
      if (current < (rule.min || 1)) qtyInput.value = rule.min || 1;
    }

    if (this.submitBtn) {
      this.submitBtn.disabled = !variant.available;
      this.submitBtn.textContent = buttonLabel;
    }

    if (updateUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set('variant', variant.id);
      window.history.replaceState({}, '', url.toString());
    }

    document.dispatchEvent(new CustomEvent('product:variant-change', {
      detail: { variant, sectionId: this.sectionId, buttonLabel }
    }));
  }

  buttonLabel(variant, meta) {
    if (!variant.available) return window.theme?.strings?.soldOut || 'Sold out';
    const preorder = meta.inventory_management && meta.inventory_policy === 'continue' && Number(meta.inventory_quantity) <= 0;
    if (preorder) return window.theme?.strings?.preorder || 'Pre-order';
    return window.theme?.strings?.addToCart || 'Add to cart';
  }

  async onSubmit(e) {
    e.preventDefault();
    if (!this.currentVariant?.available) return;

    const quantityInput = this.form.querySelector('[name="quantity"]');
    const quantity = quantityInput ? parseInt(quantityInput.value, 10) || 1 : 1;

    if (this.submitBtn) {
      this.submitBtn.disabled = true;
      this.submitBtn.classList.add('is-loading');
    }

    try {
      await window.cartDrawer.addAndOpen(this.currentVariant.id, quantity);
    } finally {
      if (this.submitBtn) {
        this.submitBtn.disabled = !this.currentVariant?.available;
        this.submitBtn.classList.remove('is-loading');
      }
    }
  }
}

// ============================================
// Product Media Gallery
// ============================================
class ProductMedia {
  constructor(gallery) {
    this.gallery = gallery;
    this.viewer = gallery.querySelector('#product-media-viewer');
    this.thumbnails = gallery.querySelectorAll('.product__thumbnail[data-media-id]');
    if (!this.viewer) return;
    gallery._mediaController = this;
    this.bindEvents();
  }

  bindEvents() {
    this.thumbnails.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.setActive(parseInt(btn.dataset.mediaId, 10));
      });
    });
  }

  setActive(mediaId) {
    if (!mediaId) return;

    this.viewer.querySelectorAll('.product__media-item').forEach((item) => {
      const isActive = parseInt(item.dataset.mediaId, 10) === mediaId;
      item.hidden = !isActive;
      item.classList.toggle('is-active', isActive);

      if (!isActive) {
        const video = item.querySelector('video');
        if (video) {
          video.pause();
          video.currentTime = 0;
        }
      }
    });

    this.thumbnails.forEach((btn) => {
      btn.classList.toggle('product__thumbnail--active', parseInt(btn.dataset.mediaId, 10) === mediaId);
    });

    const activeItem = this.viewer.querySelector('.product__media-item.is-active');
    const video = activeItem?.querySelector('video');
    if (video) video.play().catch(() => {});
  }
}

function initProductMedia() {
  document.querySelectorAll('[data-product-media]:not([data-media-init])').forEach((gallery) => {
    gallery.setAttribute('data-media-init', '');
    new ProductMedia(gallery);
  });
}

// ============================================
// Collection AJAX Filters
// ============================================
class CollectionFilters {
  constructor(section) {
    this.section = section;
    this.sectionId = section.dataset.collectionSection;
    this.productsEl = section.querySelector('#CollectionProducts');
    this.ajaxContent = section.querySelector('#CollectionAjaxContent');
    this.countEl = section.querySelector('#CollectionProductCount');
    this.filtersForm = section.querySelector('#CollectionFiltersForm');
    this.sortSelect = section.querySelector('.collection__sort-select');
    this.filterPanel = section.querySelector('#collection-filters');
    this.filterToggle = section.querySelector('.collection__filter-toggle');
    this.layout = section.querySelector('.collection__layout');
    this.bindEvents();
  }

  bindEvents() {
    this.sortSelect?.addEventListener('change', () => this.applyFilters());

    this.section.addEventListener('click', (e) => {
      if (e.target.closest('.collection__filter-apply')) {
        e.preventDefault();
        this.applyFilters();
      }

      const clearLink = e.target.closest('[data-collection-clear]');
      if (clearLink) {
        e.preventDefault();
        this.fetchAndUpdate(clearLink.href);
      }

      const pageLink = e.target.closest('.collection__pagination a');
      if (pageLink) {
        e.preventDefault();
        this.fetchAndUpdate(pageLink.href);
      }

      if (e.target.closest('.collection__filter-toggle') && this.filterPanel) {
        const isOpen = this.filterPanel.getAttribute('aria-hidden') === 'false';
        this.filterPanel.setAttribute('aria-hidden', isOpen ? 'true' : 'false');
        this.filterToggle?.setAttribute('aria-expanded', !isOpen);
        this.layout?.classList.toggle('collection__layout--with-filters', !isOpen);
      }

      if (e.target.closest('.collection__filters-close') && this.filterPanel) {
        this.filterPanel.setAttribute('aria-hidden', 'true');
        this.filterToggle?.setAttribute('aria-expanded', 'false');
        this.layout?.classList.remove('collection__layout--with-filters');
      }
    });

    window.addEventListener('popstate', () => {
      if (document.querySelector(`[data-collection-section="${this.sectionId}"]`)) {
        this.fetchAndUpdate(window.location.href, false);
      }
    });
  }

  buildSearchParams() {
    const params = new URLSearchParams();

    if (this.sortSelect?.value) {
      params.set('sort_by', this.sortSelect.value);
    }

    this.section.querySelectorAll('.collection__filter-checkbox:checked').forEach((cb) => {
      params.append(cb.name, cb.value);
    });

    const minPrice = this.section.querySelector('.collection__filter-price-input[name*="min"]');
    const maxPrice = this.section.querySelector('.collection__filter-price-input[name*="max"]');
    if (minPrice?.value) params.set(minPrice.name, String(parseFloat(minPrice.value) * 100));
    if (maxPrice?.value) params.set(maxPrice.name, String(parseFloat(maxPrice.value) * 100));

    return params;
  }

  async applyFilters() {
    const params = this.buildSearchParams();
    const url = `${window.location.pathname}?${params.toString()}`;
    await this.fetchAndUpdate(url);
  }

  async fetchAndUpdate(url, updateHistory = true) {
    const fetchUrl = new URL(url, window.location.origin);
    fetchUrl.searchParams.set('section_id', this.sectionId);

    this.productsEl?.classList.add('is-loading');

    try {
      const res = await fetch(fetchUrl.toString());
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const newSection = doc.querySelector(`[data-collection-section="${this.sectionId}"]`);

      if (newSection) {
        const newContent = newSection.querySelector('#CollectionAjaxContent');
        const newCount = newSection.querySelector('#CollectionProductCount');
        const newFilters = newSection.querySelector('#CollectionFiltersForm');

        if (newContent && this.ajaxContent) this.ajaxContent.innerHTML = newContent.innerHTML;
        if (newCount && this.countEl) this.countEl.innerHTML = newCount.innerHTML;
        if (newFilters && this.filtersForm) this.filtersForm.innerHTML = newFilters.innerHTML;

        const newSort = newSection.querySelector('.collection__sort-select');
        if (newSort && this.sortSelect) this.sortSelect.value = newSort.value;
      }

      if (updateHistory) {
        const cleanUrl = new URL(url, window.location.origin);
        window.history.pushState({}, '', cleanUrl.toString());
      }

      document.dispatchEvent(new CustomEvent('collection:updated', { detail: { section: this.section } }));
    } catch (err) {
      console.error('Collection filter update failed', err);
    } finally {
      this.productsEl?.classList.remove('is-loading');
    }
  }
}

function initCollectionFilters() {
  document.querySelectorAll('[data-collection-section]').forEach((section) => {
    if (!section._collectionFilters) {
      section._collectionFilters = new CollectionFilters(section);
    }
  });
}

// ============================================
// Quick Add Modal
// ============================================
class QuickAddModal {
  constructor() {
    this.modal = document.getElementById('quick-add-modal');
    this.content = document.getElementById('quick-add-modal-content');
    if (!this.modal) return;
    this.panel = this.modal.querySelector('.quick-add-modal__panel');
    this.bindEvents();
  }

  bindEvents() {
    document.addEventListener('click', (e) => {
      const quickAddBtn = e.target.closest('[data-quick-add]');
      if (quickAddBtn && !quickAddBtn.disabled) {
        e.preventDefault();
        e.stopPropagation();
        window.cartDrawer.addAndOpen(parseInt(quickAddBtn.dataset.variantId, 10), 1);
        return;
      }

      const modalBtn = e.target.closest('[data-quick-add-modal]');
      if (modalBtn) {
        e.preventDefault();
        e.stopPropagation();
        this.open(modalBtn.dataset.productHandle, modalBtn);
        return;
      }

      if (e.target.closest('[data-quick-add-close]')) {
        this.close();
      }

      const addBtn = e.target.closest('[data-quick-add-submit]');
      if (addBtn && this.modal.contains(addBtn)) {
        this.submit(addBtn);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal.classList.contains('is-open')) this.close();
    });
  }

  async open(handle, trigger) {
    this.triggerEl = trigger || document.activeElement;
    this.modal.classList.add('is-open');
    this.modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('overflow-hidden');
    this.content.innerHTML = '<div class="quick-add-modal__loading"><span class="loading-spinner" aria-hidden="true"></span></div>';

    try {
      const res = await fetch(`/products/${handle}.js`);
      const product = await res.json();
      this.render(product);
      if (this.panel) trapFocus(this.panel);
    } catch (err) {
      this.content.innerHTML = `<p class="quick-add-modal__error">${window.theme?.strings?.error || 'Something went wrong'}</p>`;
    }
  }

  render(product) {
    const optionsHtml = product.options.map((optionName, optionIndex) => {
      if (optionName === 'Title' && product.variants.length === 1) return '';
      const values = [...new Set(product.variants.map((v) => v.options[optionIndex]))];
      const buttons = values.map((value, i) => `
        <button type="button"
          class="quick-add-modal__option-btn ${i === 0 ? 'is-active' : ''}"
          data-option-index="${optionIndex}"
          data-value="${value}"
        >${value}</button>
      `).join('');
      return `
        <div class="quick-add-modal__option" data-option-index="${optionIndex}">
          <p class="quick-add-modal__option-label">${optionName}</p>
          <div class="quick-add-modal__option-buttons">${buttons}</div>
        </div>
      `;
    }).join('');

    this.content.innerHTML = `
      <div class="quick-add-modal__product" data-product-id="${product.id}">
        ${product.featured_image ? `<img src="${product.featured_image}" alt="${product.title}" class="quick-add-modal__image" width="120" height="120">` : ''}
        <h3 class="quick-add-modal__title">${product.title}</h3>
        <p class="quick-add-modal__price" data-quick-add-price>${formatMoney(product.variants[0].price)}</p>
        ${optionsHtml}
        <button type="button" class="button button--primary button--full" data-quick-add-submit data-variant-id="${product.variants[0].id}">
          ${window.theme?.strings?.addToCart || 'Add to cart'}
        </button>
      </div>
    `;

    this.product = product;
    this.selectedOptions = product.variants[0].options.slice();

    this.content.querySelectorAll('.quick-add-modal__option-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const optionIndex = parseInt(btn.dataset.optionIndex, 10);
        btn.closest('.quick-add-modal__option-buttons')?.querySelectorAll('.quick-add-modal__option-btn').forEach((b) => {
          b.classList.remove('is-active');
        });
        btn.classList.add('is-active');
        this.selectedOptions[optionIndex] = btn.dataset.value;
        this.updateSelectedVariant();
      });
    });
  }

  updateSelectedVariant() {
    const variant = this.product.variants.find((v) =>
      v.options.every((opt, i) => opt === this.selectedOptions[i])
    );
    if (!variant) return;

    this.currentVariant = variant;
    const priceEl = this.content.querySelector('[data-quick-add-price]');
    const submitBtn = this.content.querySelector('[data-quick-add-submit]');
    if (priceEl) priceEl.textContent = formatMoney(variant.price);
    if (submitBtn) {
      submitBtn.dataset.variantId = variant.id;
      submitBtn.disabled = !variant.available;
      submitBtn.textContent = variant.available
        ? (window.theme?.strings?.addToCart || 'Add to cart')
        : (window.theme?.strings?.soldOut || 'Sold out');
    }
  }

  async submit(btn) {
    const variantId = parseInt(btn.dataset.variantId, 10);
    if (!variantId) return;
    btn.disabled = true;
    try {
      await window.cartDrawer.addAndOpen(variantId, 1);
      this.close();
    } catch (err) {
      btn.disabled = false;
    }
  }

  close() {
    this.modal.classList.remove('is-open');
    this.modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('overflow-hidden');
    if (this.triggerEl?.focus) this.triggerEl.focus();
    this.triggerEl = null;
  }
}

// ============================================
// Search Modal + Predictive Search
// ============================================
class SearchModal {
  constructor() {
    this.modal = document.getElementById('search-modal');
    if (!this.modal) return;
    this.panel = this.modal.querySelector('.search-modal__panel');
    this.input = this.modal.querySelector('.predictive-search__input');
    this.resultsContainer = this.modal.querySelector('.predictive-search__results');
    this.enabled = this.modal.dataset.predictiveSearch !== 'false'
      && window.theme?.predictiveSearchEnabled !== false;
    this.isOpen = false;
    this.bindEvents();
    if (this.input && this.resultsContainer) {
      this.predictive = new PredictiveSearch(this.input, this.resultsContainer, this.enabled);
    }
  }

  bindEvents() {
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-search-modal-open]')) {
        e.preventDefault();
        this.open();
      }
      if (e.target.closest('[data-search-modal-close]')) {
        this.close();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.close();
    });
  }

  open() {
    this.triggerEl = document.activeElement;
    this.isOpen = true;
    this.modal.classList.add('is-open');
    this.modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('overflow-hidden');
    if (this.panel) trapFocus(this.panel);
    setTimeout(() => this.input?.focus(), 100);
  }

  close() {
    this.isOpen = false;
    this.modal.classList.remove('is-open');
    this.modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('overflow-hidden');
    if (this.resultsContainer) {
      this.resultsContainer.innerHTML = '';
      this.resultsContainer.hidden = true;
    }
    if (this.input) this.input.value = '';
    (this.triggerEl || document.querySelector('[data-search-modal-open]'))?.focus();
    this.triggerEl = null;
  }
}

class PredictiveSearch {
  constructor(input, resultsContainer, enabled = true) {
    this.input = input;
    this.resultsContainer = resultsContainer;
    this.enabled = enabled;
    this.init();
  }

  init() {
    if (!this.enabled) return;

    let debounceTimer;
    this.input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => this.fetchResults(this.input.value), 300);
    });
  }

  fetchResults(query) {
    if (query.length < 2) {
      this.resultsContainer.innerHTML = '';
      this.resultsContainer.hidden = true;
      return;
    }

    fetch(`/search/suggest.json?q=${encodeURIComponent(query)}&resources[type]=product&resources[limit]=5`)
      .then((res) => res.json())
      .then((data) => this.renderResults(data, query))
      .catch(() => {});
  }

  renderResults(data, query) {
    const products = data?.resources?.results?.products || [];
    const viewAllTemplate = window.theme?.strings?.searchViewAll || 'View all results for "{{ terms }}"';
    const viewAllLabel = viewAllTemplate
      .replace(/\{\{\s*terms\s*\}\}/g, query)
      .replace('__TERMS__', query);

    if (products.length === 0) {
      this.resultsContainer.innerHTML = `
        <p class="predictive-search__empty">${window.theme?.strings?.error || 'No results found'}</p>
      `;
      this.resultsContainer.hidden = false;
      return;
    }

    this.resultsContainer.innerHTML = `
      <ul class="predictive-search__list" role="listbox" aria-label="Search suggestions">
        ${products.map((product) => `
          <li role="option">
            <a href="${product.url}" class="predictive-search__item">
              ${product.featured_image?.url
                ? `<img src="${product.featured_image.url}" alt="${product.title}" width="50" height="50" loading="lazy">`
                : ''
              }
              <div class="predictive-search__item-details">
                <span class="predictive-search__item-title">${product.title}</span>
                <span class="predictive-search__item-price">${formatMoney(product.price)}</span>
              </div>
            </a>
          </li>
        `).join('')}
        <li>
          <a href="${window.theme?.routes?.search_url || '/search'}?q=${encodeURIComponent(query)}&type=product" class="predictive-search__view-all">
            ${viewAllLabel}
          </a>
        </li>
      </ul>
    `;
    this.resultsContainer.hidden = false;
  }
}

// ============================================
// Cart Drawer Upsells
// ============================================
const CartDrawerUpsells = {
  async load() {
    const container = document.querySelector('[data-cart-upsells]');
    if (!container || window.theme?.cartDrawer?.showUpsells === false) return;

    const limit = parseInt(container.dataset.limit, 10)
      || window.theme?.cartDrawer?.upsellsLimit
      || 3;

    try {
      const cart = await Cart.fetch();
      if (!cart.items?.length) {
        container.innerHTML = '';
        return;
      }

      const productId = cart.items[0].product_id;
      const cartProductIds = cart.items.map((item) => item.product_id);
      const res = await fetch(
        `/recommendations/products.json?product_id=${productId}&limit=${limit + 2}&intent=complementary`
      );
      const data = await res.json();
      const products = (data.products || [])
        .filter((p) => !cartProductIds.includes(p.id))
        .slice(0, limit);

      if (products.length === 0) {
        container.innerHTML = '';
        return;
      }

      const heading = window.theme?.strings?.cartUpsellsHeading || 'You may also like';
      container.innerHTML = `
        <h3 class="cart-drawer__upsells-heading">${heading}</h3>
        <ul class="cart-drawer__upsells-list list-unstyled" role="list">
          ${products.map((product) => {
            const variant = product.variants?.find((v) => v.available) || product.variants?.[0];
            const canAdd = variant && product.available !== false;
            return `
            <li class="cart-drawer__upsells-item">
              <a href="${product.url}" class="cart-drawer__upsells-media">
                ${product.featured_image
                  ? `<img src="${product.featured_image}" alt="${product.title}" width="64" height="64" loading="lazy">`
                  : ''
                }
              </a>
              <div class="cart-drawer__upsells-details">
                <a href="${product.url}" class="cart-drawer__upsells-title">${product.title}</a>
                <span class="cart-drawer__upsells-price">${formatMoney(product.price)}</span>
              </div>
              ${canAdd
                ? `<button type="button" class="cart-drawer__upsells-add button button--secondary" data-quick-add data-variant-id="${variant.id}">
                    ${window.theme?.strings?.addToCart || 'Add'}
                  </button>`
                : ''
              }
            </li>`;
          }).join('')}
        </ul>
      `;
    } catch (err) {
      container.innerHTML = '';
    }
  }
};

// ============================================
// Sticky Add to Cart
// ============================================
class StickyAddToCart {
  constructor(bar) {
    this.bar = bar;
    this.sectionId = bar.dataset.sectionId;
    this.priceEl = document.getElementById(`sticky-atc-price-${this.sectionId}`);
    this.button = document.getElementById(`sticky-atc-button-${this.sectionId}`);
    this.form = document.querySelector(`[data-product-form][data-section-id="${this.sectionId}"]`);
    this.buyButtons = this.form?.querySelector('.product__buy-buttons');
    if (!this.form || !this.buyButtons) {
      bar.remove();
      return;
    }

    bar.hidden = false;
    this.bindEvents();
    this.observeVisibility();
  }

  bindEvents() {
    this.button?.addEventListener('click', () => {
      if (this.form.requestSubmit) {
        this.form.requestSubmit();
      } else {
        this.form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    });

    document.addEventListener('product:variant-change', (e) => {
      if (e.detail.sectionId !== this.sectionId) return;
      this.updateBar(e.detail.variant, e.detail.buttonLabel);
    });
  }

  updateBar(variant, buttonLabel) {
    if (!variant) return;
    if (this.priceEl) {
      this.priceEl.textContent = formatMoney(variant.price);
    }
    if (this.button) {
      this.button.disabled = !variant.available;
      this.button.textContent = buttonLabel || (variant.available
        ? (window.theme?.strings?.addToCart || 'Add to cart')
        : (window.theme?.strings?.soldOut || 'Sold out'));
    }
  }

  observeVisibility() {
    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const mobileOnly = this.bar.classList.contains('sticky-atc--mobile-only');
        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        if (mobileOnly && !isMobile) {
          this.bar.classList.remove('is-visible');
          document.body.classList.remove('sticky-atc-visible');
          return;
        }
        const visible = !entry.isIntersecting;
        this.bar.classList.toggle('is-visible', visible);
        const showPadding = visible && (isMobile || !mobileOnly);
        document.body.classList.toggle('sticky-atc-visible', showPadding);
      },
      { threshold: 0, rootMargin: '0px' }
    );
    observer.observe(this.buyButtons);
  }
}

function initStickyAddToCart() {
  document.querySelectorAll('[data-sticky-atc]').forEach((bar) => {
    new StickyAddToCart(bar);
  });
}

// ============================================
// Announcement Bar
// ============================================
function initAnnouncementBar() {
  const bar = document.querySelector('.announcement-bar');
  const close = document.querySelector('.announcement-bar__close');
  if (!bar || !close) return;
  close.addEventListener('click', () => {
    bar.style.display = 'none';
    sessionStorage.setItem('announcement-closed', '1');
  });
  if (sessionStorage.getItem('announcement-closed')) {
    bar.style.display = 'none';
  }
}

// ============================================
// Lazy load images fallback
// ============================================
function initLazyLoad() {
  if ('loading' in HTMLImageElement.prototype) return;
  document.querySelectorAll('img[loading="lazy"]').forEach((img) => {
    img.src = img.dataset.src || img.src;
  });
}

// ============================================
// Hero Carousel
// ============================================
class HeroCarousel {
  constructor(element) {
    this.carousel = element;
    this.slides = [...element.querySelectorAll('[data-slide]')];
    this.dots = [...element.querySelectorAll('[data-carousel-dot]')];
    this.prevBtn = element.querySelector('[data-carousel-prev]');
    this.nextBtn = element.querySelector('[data-carousel-next]');
    this.current = 0;
    this.autoplay = element.dataset.autoplay === 'true';
    this.speed = parseInt(element.dataset.autoplaySpeed, 10) || 8000;
    this.transitionMs = 800;
    this.timer = null;
    this.isTransitioning = false;

    this.liveRegion = document.createElement('div');
    this.liveRegion.className = 'visually-hidden';
    this.liveRegion.setAttribute('aria-live', 'polite');
    this.liveRegion.setAttribute('aria-atomic', 'true');
    this.carousel.appendChild(this.liveRegion);

    if (this.slides.length <= 1) return;
    this.init();
  }

  announceSlide() {
    const title = this.slides[this.current]?.querySelector('.hero__heading, h2, h1')?.textContent?.trim();
    const template = window.theme?.strings?.carouselSlide || 'Slide __CURRENT__ of __TOTAL__: __TITLE__';
    this.liveRegion.textContent = template
      .replace('__CURRENT__', this.current + 1)
      .replace('__TOTAL__', this.slides.length)
      .replace('__TITLE__', title || '');
  }

  init() {
    this.prevBtn?.addEventListener('click', () => this.goTo(this.current - 1));
    this.nextBtn?.addEventListener('click', () => this.goTo(this.current + 1));

    this.dots.forEach((dot) => {
      dot.addEventListener('click', () => this.goTo(parseInt(dot.dataset.carouselDot, 10)));
    });

    this.carousel.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); this.goTo(this.current - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); this.goTo(this.current + 1); }
    });

    this.carousel.addEventListener('mouseenter', () => this.pause());
    this.carousel.addEventListener('mouseleave', () => this.startAutoplay());
    this.carousel.addEventListener('focusin', () => this.pause());
    this.carousel.addEventListener('focusout', (e) => {
      if (!this.carousel.contains(e.relatedTarget)) this.startAutoplay();
    });

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.autoplay = false;
    }

    this.startAutoplay();
  }

  goTo(index) {
    if (this.isTransitioning) return;
    const next = (index + this.slides.length) % this.slides.length;
    if (next === this.current) return;

    this.isTransitioning = true;
    this.slides[this.current].classList.remove('is-active');
    this.dots[this.current]?.classList.remove('is-active');
    this.dots[this.current]?.setAttribute('aria-selected', 'false');

    this.current = next;
    this.slides[this.current].classList.add('is-active');
    this.dots[this.current]?.classList.add('is-active');
    this.dots[this.current]?.setAttribute('aria-selected', 'true');

    setTimeout(() => { this.isTransitioning = false; }, this.transitionMs);
    this.announceSlide();
    this.restartAutoplay();
  }

  startAutoplay() {
    if (!this.autoplay) return;
    this.pause();
    this.timer = setInterval(() => this.goTo(this.current + 1), this.speed);
  }

  pause() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  restartAutoplay() {
    this.pause();
    this.startAutoplay();
  }
}

// ============================================
// Wishlist
// ============================================
const WISHLIST_STORAGE_KEY = 'marketonline-wishlist';

const Wishlist = {
  get enabled() {
    return window.theme?.wishlistEnabled !== false;
  },

  getItems() {
    try {
      const items = JSON.parse(localStorage.getItem(WISHLIST_STORAGE_KEY) || '[]');
      return Array.isArray(items) ? items : [];
    } catch {
      return [];
    }
  },

  save(handles) {
    const unique = [...new Set(handles.filter(Boolean))];
    localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(unique));
    document.dispatchEvent(new CustomEvent('wishlist:updated', { detail: { count: unique.length } }));
    return unique;
  },

  has(handle) {
    return this.getItems().includes(handle);
  },

  toggle(handle) {
    const items = this.getItems();
    const index = items.indexOf(handle);
    if (index > -1) {
      items.splice(index, 1);
      this.save(items);
      return false;
    }
    items.unshift(handle);
    this.save(items);
    return true;
  },

  remove(handle) {
    this.save(this.getItems().filter((h) => h !== handle));
  },

  count() {
    return this.getItems().length;
  },

  updateHeaderCount() {
    if (!this.enabled) return;
    const count = this.count();
    const countEl = document.querySelector('.header__wishlist-count');
    const link = document.querySelector('[data-wishlist-link]');
    if (countEl) {
      countEl.textContent = count;
      countEl.style.display = count > 0 ? 'flex' : 'none';
    }
    if (link) {
      const template = window.theme?.strings?.wishlistCount || `Wishlist (${count} items)`;
      link.setAttribute('aria-label', template.replace('__COUNT__', count));
    }
  },

  syncButtons() {
    if (!this.enabled) return;
    const items = this.getItems();
    const strings = window.theme?.strings || {};
    document.querySelectorAll('[data-wishlist-toggle]').forEach((btn) => {
      const handle = btn.dataset.productHandle;
      const active = items.includes(handle);
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      const label = active ? (strings.wishlistRemove || 'Remove from wishlist') : (strings.wishlistAdd || 'Add to wishlist');
      btn.setAttribute('aria-label', label);
      const labelEl = btn.querySelector('[data-wishlist-label]');
      if (labelEl) labelEl.textContent = label;
    });
  }
};

function renderWishlistProductCard(product) {
  const strings = window.theme?.strings || {};
  const onSale = product.compare_at_price && product.compare_at_price > product.price;
  const image = product.featured_image || (product.images && product.images[0]) || '';
  const variant = product.variants?.[0];
  const priceHtml = onSale
    ? `<div class="product-card__price product-card__price--on-sale">
         <span class="product-card__price__compare"><s>${formatMoney(product.compare_at_price)}</s></span>
         <span class="product-card__price__sale">${formatMoney(product.price)}</span>
       </div>`
    : `<div class="product-card__price"><span class="product-card__price__regular">${formatMoney(product.price)}</span></div>`;

  const quickAddHtml = variant
    ? (product.variants.length === 1 && !product.options?.some((o) => o.values?.length > 1)
      ? `<button type="button" class="product-card__quick-add" data-quick-add data-variant-id="${variant.id}" ${variant.available ? '' : 'disabled'}>
           ${variant.available ? (strings.addToCart || 'Add to cart') : (strings.soldOut || 'Sold out')}
         </button>`
      : `<button type="button" class="product-card__quick-add" data-quick-add-modal data-product-handle="${product.handle}">
           ${strings.quickAdd || 'Quick add'}
         </button>`)
    : '';

  const saleBadge = onSale ? `<span class="product-card__badge">${strings.sale || 'Sale'}</span>` : '';
  const imageHtml = image
    ? `<img src="${image}" alt="${product.title.replace(/"/g, '&quot;')}" loading="lazy" class="product-card__image" width="600" height="600">`
    : '';

  return `<li class="wishlist__grid-item">
    <div class="product-card">
      <div class="product-card__media-wrap">
        <button type="button" class="wishlist-button wishlist-button--card is-active" data-wishlist-toggle data-product-handle="${product.handle}" aria-pressed="true" aria-label="${strings.wishlistRemove || 'Remove from wishlist'}">
          <svg class="wishlist-button__icon wishlist-button__icon--outline" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
          <svg class="wishlist-button__icon wishlist-button__icon--filled" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
        </button>
        <a href="${product.url}" class="product-card__media-link" aria-label="${product.title.replace(/"/g, '&quot;')}">
          <div class="product-card__media">
            ${imageHtml}
            ${saleBadge}
          </div>
        </a>
        ${quickAddHtml}
      </div>
      <div class="product-card__info">
        <p class="product-card__vendor">${product.vendor || ''}</p>
        <h3 class="product-card__title"><a href="${product.url}">${product.title}</a></h3>
        ${priceHtml}
      </div>
    </div>
  </li>`;
}

class WishlistPage {
  constructor(root) {
    this.root = root;
    this.grid = root.querySelector('[data-wishlist-grid]');
    this.empty = root.querySelector('[data-wishlist-empty]');
    this.render();
  }

  async render() {
    if (!this.grid || !this.empty) return;
    const handles = Wishlist.getItems();

    if (handles.length === 0) {
      this.grid.innerHTML = '';
      this.empty.hidden = false;
      return;
    }

    this.empty.hidden = true;
    this.grid.innerHTML = `<li class="wishlist__loading">${window.theme?.strings?.loading || 'Loading...'}</li>`;

    const results = await Promise.all(
      handles.map(async (handle) => {
        try {
          const res = await fetch(`/products/${handle}.js`);
          if (!res.ok) return { handle, product: null };
          const product = await res.json();
          return { handle, product };
        } catch {
          return { handle, product: null };
        }
      })
    );

    const valid = results.filter((r) => r.product);
    const invalidHandles = results.filter((r) => !r.product).map((r) => r.handle);
    if (invalidHandles.length) {
      Wishlist.save(handles.filter((h) => !invalidHandles.includes(h)));
    }

    if (valid.length === 0) {
      this.grid.innerHTML = '';
      this.empty.hidden = false;
      Wishlist.updateHeaderCount();
      return;
    }

    this.grid.innerHTML = valid.map((r) => renderWishlistProductCard(r.product)).join('');
    Wishlist.syncButtons();
  }
}

let wishlistPageInstance = null;

function initWishlist() {
  if (!Wishlist.enabled) return;

  Wishlist.updateHeaderCount();
  Wishlist.syncButtons();

  const page = document.querySelector('[data-wishlist-page]');
  if (page) {
    wishlistPageInstance = new WishlistPage(page);
  }
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-wishlist-toggle]');
  if (!btn || !Wishlist.enabled) return;
  e.preventDefault();
  e.stopPropagation();
  const handle = btn.dataset.productHandle;
  if (!handle) return;
  Wishlist.toggle(handle);
  Wishlist.updateHeaderCount();
  Wishlist.syncButtons();
  if (wishlistPageInstance) wishlistPageInstance.render();
});

document.addEventListener('wishlist:updated', () => {
  Wishlist.updateHeaderCount();
  Wishlist.syncButtons();
});

// ============================================
// Cart Page (AJAX quantity updates)
// ============================================
class CartPage {
  constructor(section) {
    this.section = section;
    this.sectionId = section.dataset.sectionId;
    this.bindEvents();
  }

  bindEvents() {
    this.section.addEventListener('click', (e) => {
      const btn = e.target.closest('.cart__quantity-btn');
      if (!btn) return;
      const key = btn.dataset.key;
      const input = this.section.querySelector(`.cart__quantity-input[data-key="${key}"]`);
      if (!input) return;
      let val = parseInt(input.value, 10) || 0;
      if (btn.dataset.action === 'increase') {
        input.value = val + 1;
      } else if (btn.dataset.action === 'decrease') {
        input.value = Math.max(0, val - 1);
      }
      this.updateItem(key, parseInt(input.value, 10));
    });

    this.section.addEventListener('change', (e) => {
      const input = e.target.closest('.cart__quantity-input');
      if (!input) return;
      this.updateItem(input.dataset.key, parseInt(input.value, 10) || 0);
    });
  }

  async updateItem(key, quantity) {
    try {
      const cart = await Cart.change(key, quantity);
      Cart.updateCount(cart.item_count);
      await this.renderSection();
      await Cart.renderDrawer();
    } catch (err) {
      console.error('Cart update failed', err);
    }
  }

  async renderSection() {
    const res = await fetch(`/cart?section_id=${this.sectionId}`);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const newSection = doc.getElementById(`shopify-section-${this.sectionId}`);
    if (newSection) {
      this.section.removeAttribute('data-cart-init');
      this.section.innerHTML = newSection.innerHTML;
      new CartPage(this.section);
    }
  }
}

function initCartPage() {
  document.querySelectorAll('[data-cart-page]:not([data-cart-init])').forEach((el) => {
    el.setAttribute('data-cart-init', '');
    new CartPage(el);
  });
}

function initMobileMenu() {
  const menuToggle = document.querySelector('.header__menu-toggle');
  const mobileMenu = document.querySelector('.mobile-menu');
  if (!menuToggle || !mobileMenu || menuToggle.dataset.menuInit) return;
  menuToggle.dataset.menuInit = 'true';

  const openMenu = () => {
    mobileMenu.classList.add('is-open');
    menuToggle.setAttribute('aria-expanded', 'true');
    mobileMenu.setAttribute('aria-hidden', 'false');
    trapFocus(mobileMenu);
    mobileMenu.querySelector('.mobile-menu__link, a, button')?.focus();
  };

  const closeMenu = () => {
    mobileMenu.classList.remove('is-open');
    menuToggle.setAttribute('aria-expanded', 'false');
    mobileMenu.setAttribute('aria-hidden', 'true');
    menuToggle.focus();
  };

  menuToggle.addEventListener('click', () => {
    if (mobileMenu.classList.contains('is-open')) closeMenu();
    else openMenu();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileMenu.classList.contains('is-open')) closeMenu();
  });
}

function initHeroCarousels() {
  document.querySelectorAll('.hero-carousel:not([data-carousel-init])').forEach((el) => {
    el.setAttribute('data-carousel-init', '');
    new HeroCarousel(el);
  });
}

function initProductForms() {
  document.querySelectorAll('[data-product-form]').forEach((form) => {
    new ProductForm(form);
  });
}

document.addEventListener('shopify:section:load', (event) => {
  const carousel = event.target.querySelector?.('.hero-carousel');
  if (carousel) {
    carousel.removeAttribute('data-carousel-init');
    new HeroCarousel(carousel);
  }
  event.target.querySelectorAll?.('[data-product-form]').forEach((form) => {
    new ProductForm(form);
  });
  event.target.querySelectorAll?.('[data-sticky-atc]').forEach((bar) => {
    new StickyAddToCart(bar);
  });
  initProductMedia();
  initCollectionFilters();
  initCartPage();
  initWishlist();
  initMobileMenu();
});

// ============================================
// Init
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  window.cartDrawer = new CartDrawer();
  new QuickAddModal();
  new SearchModal();
  initAnnouncementBar();
  initLazyLoad();
  initHeroCarousels();
  initProductForms();
  initStickyAddToCart();
  initProductMedia();
  initCollectionFilters();
  initCartPage();
  initWishlist();
  initMobileMenu();
});
