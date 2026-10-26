const CART_KEY = 'amazon-demo-cart-id';
const cartId = getCartId();
const grid = document.querySelector('#product-grid');
const toast = document.querySelector('#toast');
const cartDialog = document.querySelector('#cart-dialog');
const checkoutDialog = document.querySelector('#checkout-dialog');
const ordersDialog = document.querySelector('#orders-dialog');
let products = [];
let cart = { items: [], count: 0, subtotal: 0 };
let toastTimer;
let searchTimer;
let currentUser = null;
let accountMode = 'login';

function getCartId() {
  try {
    let id = localStorage.getItem(CART_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(CART_KEY, id);
    }
    return id;
  } catch { return crypto.randomUUID(); }
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'X-Cart-Id': cartId, ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function formatPrice(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function productCard(product) {
  const article = document.createElement('article');
  article.className = 'box product-card catalog-card';
  article.id = product.slug;
  article.dataset.category = product.category;
  const kicker = document.createElement('p');
  kicker.className = 'card-kicker'; kicker.textContent = product.category.toUpperCase();
  const imageBox = document.createElement('div'); imageBox.className = 'product-image';
  const image = document.createElement('img'); image.src = product.image; image.alt = product.alt; image.loading = 'lazy';
  image.addEventListener('error', () => { image.src = 'amazon_logo.png'; image.classList.add('fallback-image'); }, { once: true });
  imageBox.append(image);
  const title = document.createElement('h2'); title.textContent = product.name;
  const rating = document.createElement('p'); rating.className = 'product-rating'; rating.innerHTML = `${'★'.repeat(Math.round(product.rating))}<span>${product.rating.toFixed(1)} · ${product.reviewCount.toLocaleString('en-IN')} reviews</span>`;
  const tag = document.createElement('span'); tag.className = 'product-tag'; tag.textContent = product.badge;
  const bottom = document.createElement('div'); bottom.className = 'card-bottom';
  const price = document.createElement('span'); price.className = 'price';
  const current = document.createElement('strong'); current.textContent = formatPrice(product.price);
  const old = document.createElement('span'); old.className = 'old-price'; old.textContent = formatPrice(product.originalPrice);
  const saving = document.createElement('span'); saving.className = 'saving'; saving.textContent = `${Math.round((1 - product.price / product.originalPrice) * 100)}% off`;
  price.append(current, old, saving);
  const button = document.createElement('button'); button.type = 'button'; button.className = 'add-button'; button.textContent = 'Add to cart';
  button.addEventListener('click', async () => {
    button.disabled = true;
    try { await api('/api/cart/items', { method: 'POST', body: JSON.stringify({ productId: product.id }) }); await refreshCart(); showToast(`${product.name} added to your cart`); }
    catch (error) { showToast(error.message); }
    finally { button.disabled = false; }
  });
  bottom.append(price, button);
  const description = document.createElement('p'); description.className = 'product-description'; description.textContent = product.description;
  article.append(kicker, imageBox, title, rating, tag, description, bottom);
  return article;
}

function renderProducts() {
  grid.replaceChildren();
  const query = document.querySelector('#search-input').value.trim();
  const category = document.querySelector('#search-category').value;
  const countLabel = query ? `${products.length} result${products.length === 1 ? '' : 's'} for “${query}”` : category ? `${products.length} products in ${category}` : `Showing all ${products.length} products`;
  document.querySelector('#results-count').textContent = countLabel;
  if (!products.length) {
    const empty = document.createElement('p'); empty.className = 'empty-state'; empty.textContent = 'No products found. Try another search or department.'; grid.append(empty); return;
  }
  products.forEach(product => grid.append(productCard(product)));
}

function renderDepartments(categories) {
  const select = document.querySelector('#search-category');
  const links = document.querySelector('#department-links');
  select.replaceChildren(new Option('All', ''));
  links.replaceChildren();
  categories.forEach(category => {
    select.add(new Option(category, category));
    const link = document.createElement('a'); link.href = `#${category.toLowerCase()}`; link.textContent = category; links.append(link);
  });
}

async function searchProducts() {
  const params = new URLSearchParams();
  const q = document.querySelector('#search-input').value.trim();
  const category = document.querySelector('#search-category').value;
  if (q) params.set('q', q);
  if (category) params.set('category', category);
  const result = await api(`/api/products?${params}`);
  products = result.products;
  renderProducts();
}

async function refreshCart() {
  const result = await api('/api/cart');
  cart = result.cart;
  renderCart();
}

function renderCart() {
  const count = cart.count || 0;
  document.querySelector('#cart-count').textContent = count;
  document.querySelector('#cart-total-count').textContent = `(${count})`;
  document.querySelector('#cart-subtotal').textContent = formatPrice(cart.subtotal || 0);
  const container = document.querySelector('#cart-items');
  container.replaceChildren();
  if (!cart.items?.length) {
    const empty = document.createElement('p'); empty.className = 'cart-empty'; empty.textContent = 'Your cart is empty. Add something you love.'; container.append(empty); return;
  }
  cart.items.forEach(item => {
    const row = document.createElement('article'); row.className = 'cart-row';
    const details = document.createElement('div');
    const title = document.createElement('strong'); title.textContent = item.name;
    const unit = document.createElement('small'); unit.textContent = `${formatPrice(item.price)} each`;
    const controls = document.createElement('div'); controls.className = 'quantity';
    const minus = document.createElement('button'); minus.type = 'button'; minus.textContent = '−'; minus.setAttribute('aria-label', `Remove one ${item.name}`); minus.addEventListener('click', () => setQuantity(item.id, item.quantity - 1));
    const quantity = document.createElement('span'); quantity.textContent = item.quantity;
    const plus = document.createElement('button'); plus.type = 'button'; plus.textContent = '+'; plus.setAttribute('aria-label', `Add one ${item.name}`); plus.addEventListener('click', () => setQuantity(item.id, item.quantity + 1));
    controls.append(minus, quantity, plus); details.append(title, unit, controls);
    const right = document.createElement('div');
    const linePrice = document.createElement('span'); linePrice.className = 'row-price'; linePrice.textContent = formatPrice(item.price * item.quantity);
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'remove-item'; remove.textContent = 'Delete'; remove.addEventListener('click', () => setQuantity(item.id, 0));
    right.append(linePrice, remove); row.append(details, right); container.append(row);
  });
}

async function setQuantity(id, quantity) {
  try { await api(`/api/cart/items/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ quantity }) }); await refreshCart(); }
  catch (error) { showToast(error.message); }
}

function showError(error) {
  grid.replaceChildren();
  const message = document.createElement('div'); message.className = 'error-state';
  message.append(document.createTextNode(`Could not load the store: ${error.message}`));
  const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Try again'; retry.addEventListener('click', initialize);
  message.append(retry); grid.append(message);
}

async function initialize() {
  try {
    const [catalog, cartResult] = await Promise.all([api('/api/products'), api('/api/cart')]);
    products = catalog.products;
    renderDepartments(catalog.categories);
    cart = cartResult.cart;
    renderCart();
    renderProducts();
  } catch (error) { showError(error); }
}

document.querySelector('#search-form').addEventListener('submit', async event => {
  event.preventDefault();
  clearTimeout(searchTimer);
  try { await searchProducts(); document.querySelector('#departments').scrollIntoView({ behavior: 'smooth' }); }
  catch (error) { showToast(error.message); }
});
document.querySelector('#search-input').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    try { await searchProducts(); }
    catch (error) { showToast(error.message); }
  }, 250);
});
document.querySelector('#search-category').addEventListener('change', () => {
  clearTimeout(searchTimer);
  document.querySelector('#search-form').requestSubmit();
});
document.querySelector('#all-departments').addEventListener('click', () => { document.querySelector('#search-input').value = ''; document.querySelector('#search-category').value = ''; document.querySelector('#search-form').requestSubmit(); });
document.querySelector('#sort-select').addEventListener('change', event => {
  const sort = event.target.value;
  const sorted = [...products];
  if (sort === 'price-low') sorted.sort((a, b) => a.price - b.price);
  if (sort === 'price-high') sorted.sort((a, b) => b.price - a.price);
  if (sort === 'rating') sorted.sort((a, b) => b.rating - a.rating);
  grid.replaceChildren(...sorted.map(productCard));
});
document.querySelector('#cart-button').addEventListener('click', async () => { try { await refreshCart(); cartDialog.showModal(); } catch (error) { showToast(error.message); } });
document.querySelector('#close-cart').addEventListener('click', () => cartDialog.close());
cartDialog.addEventListener('click', event => { if (event.target === cartDialog) cartDialog.close(); });
document.querySelector('#checkout-button').addEventListener('click', () => {
  if (!cart.count) { showToast('Your cart is empty'); return; }
  if (currentUser) {
    const form = document.querySelector('#checkout-form');
    if (!form.elements.name.value) form.elements.name.value = currentUser.name;
    if (!form.elements.email.value) form.elements.email.value = currentUser.email;
  }
  cartDialog.close(); checkoutDialog.showModal();
});
document.querySelector('#close-checkout').addEventListener('click', () => checkoutDialog.close());
checkoutDialog.addEventListener('click', event => { if (event.target === checkoutDialog) checkoutDialog.close(); });
document.querySelector('#checkout-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('[type="submit"]'); button.disabled = true;
  const customer = Object.fromEntries(new FormData(event.currentTarget));
  try {
    const result = await api('/api/orders', { method: 'POST', body: JSON.stringify({ customer }) });
    checkoutDialog.close(); event.currentTarget.reset(); await refreshCart();
    showToast(`Order ${result.order.id} placed successfully`);
  } catch (error) { showToast(error.message); }
  finally { button.disabled = false; }
});
document.querySelector('#orders-button').addEventListener('click', async () => {
  try {
    const result = await api('/api/orders');
    const list = document.querySelector('#orders-list'); list.replaceChildren();
    if (!result.orders.length) { const empty = document.createElement('p'); empty.className = 'cart-empty'; empty.textContent = 'No demo orders yet.'; list.append(empty); }
    result.orders.forEach(order => {
      const card = document.createElement('article'); card.className = 'order-card';
      const title = document.createElement('strong'); title.textContent = `Order ${order.id}`;
      const detail = document.createElement('p'); detail.textContent = `${order.items.map(item => `${item.name} × ${item.quantity}`).join(', ')} · ${formatPrice(order.total)}`;
      const date = document.createElement('small'); date.textContent = new Date(order.createdAt).toLocaleString('en-IN');
      card.append(title, detail, date); list.append(card);
    });
    ordersDialog.showModal();
  } catch (error) { showToast(error.message); }
});
document.querySelector('#close-orders').addEventListener('click', () => ordersDialog.close());
ordersDialog.addEventListener('click', event => { if (event.target === ordersDialog) ordersDialog.close(); });
const accountDialog = document.querySelector('#account-dialog');
const accountForm = document.querySelector('#account-form');
function renderAccount() {
  document.querySelector('#account-button').innerHTML = currentUser
    ? `<span class="muted">Hello, ${escapeText(currentUser.name.split(' ')[0])}</span><strong>Account &amp; Lists <i class="fa-solid fa-caret-down"></i></strong>`
    : '<span class="muted">Hello, sign in</span><strong>Account &amp; Lists <i class="fa-solid fa-caret-down"></i></strong>';
  document.querySelector('#account-status').textContent = currentUser ? `Signed in as ${currentUser.email}. Your cart and orders are saved to this account.` : 'Sign in to keep your cart and order history with your account.';
  document.querySelector('#account-form').hidden = Boolean(currentUser);
  document.querySelector('#account-switch').hidden = Boolean(currentUser);
  document.querySelector('#account-logout').hidden = !currentUser;
  document.querySelector('#account-name-label').hidden = accountMode !== 'register' || Boolean(currentUser);
  document.querySelector('#account-submit').textContent = accountMode === 'register' ? 'Create account' : 'Sign in';
  document.querySelector('#account-title').textContent = currentUser ? 'Your account' : accountMode === 'register' ? 'Create account' : 'Sign in';
  document.querySelector('#account-switch').textContent = accountMode === 'register' ? 'Already have an account? Sign in' : 'Create a new account';
}
function escapeText(value) { const span = document.createElement('span'); span.textContent = value; return span.innerHTML; }
async function loadCurrentUser() { const result = await api('/api/auth/me'); currentUser = result.user; renderAccount(); }
document.querySelector('#account-button').addEventListener('click', async () => { try { await loadCurrentUser(); accountDialog.showModal(); } catch (error) { showToast(error.message); } });
document.querySelector('#close-account').addEventListener('click', () => accountDialog.close());
accountDialog.addEventListener('click', event => { if (event.target === accountDialog) accountDialog.close(); });
document.querySelector('#account-switch').addEventListener('click', () => { accountMode = accountMode === 'login' ? 'register' : 'login'; accountForm.reset(); renderAccount(); });
accountForm.addEventListener('submit', async event => {
  event.preventDefault();
  const button = document.querySelector('#account-submit'); button.disabled = true;
  try {
    const payload = Object.fromEntries(new FormData(accountForm));
    const result = await api(`/api/auth/${accountMode}`, { method: 'POST', body: JSON.stringify(payload) });
    currentUser = result.user; accountForm.reset(); renderAccount(); accountDialog.close(); await refreshCart();
    showToast(accountMode === 'register' ? 'Your account is ready' : 'Signed in successfully');
  } catch (error) { showToast(error.message); }
  finally { button.disabled = false; }
});
document.querySelector('#account-logout').addEventListener('click', async () => {
  try { await api('/api/auth/logout', { method: 'POST', body: '{}' }); currentUser = null; renderAccount(); accountDialog.close(); await refreshCart(); showToast('Signed out'); }
  catch (error) { showToast(error.message); }
});
document.querySelector('#recommendation-signin').addEventListener('click', async () => { try { await loadCurrentUser(); accountDialog.showModal(); } catch (error) { showToast(error.message); } });
document.querySelector('#location-button').addEventListener('click', () => showToast('Delivery location: India'));
initialize();
loadCurrentUser().catch(() => {});
