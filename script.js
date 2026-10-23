const CART_KEY = 'amazon-demo-cart-v1';
const cards = [...document.querySelectorAll('.product-card')];
const cartCount = document.querySelector('#cart-count');
const cartDialog = document.querySelector('#cart-dialog');
const cartItems = document.querySelector('#cart-items');
const toast = document.querySelector('#toast');
let cart = loadCart();
let toastTimer;

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    return Array.isArray(saved) ? saved.filter(item => item && typeof item.name === 'string' && Number.isFinite(item.price) && Number.isInteger(item.quantity) && item.quantity > 0) : [];
  } catch { return []; }
}

function saveCart() {
  try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* Cart remains usable for this page session. */ }
}

function formatPrice(price) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(price);
}

function renderCart() {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  cartCount.textContent = String(count);
  document.querySelector('#cart-total-count').textContent = `(${count})`;
  document.querySelector('#cart-subtotal').textContent = formatPrice(total);
  cartItems.replaceChildren();
  if (!cart.length) {
    const empty = document.createElement('p');
    empty.className = 'cart-empty';
    empty.textContent = 'Your cart is empty. Add something you love.';
    cartItems.append(empty);
    return;
  }
  cart.forEach(item => {
    const row = document.createElement('article');
    row.className = 'cart-row';
    const details = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = item.name;
    const unit = document.createElement('small');
    unit.textContent = `${formatPrice(item.price)} each`;
    const controls = document.createElement('div');
    controls.className = 'quantity';
    const minus = document.createElement('button');
    minus.type = 'button'; minus.textContent = '−'; minus.setAttribute('aria-label', `Remove one ${item.name}`);
    minus.addEventListener('click', () => changeQuantity(item.name, -1));
    const amount = document.createElement('span'); amount.textContent = String(item.quantity); amount.setAttribute('aria-label', 'Quantity');
    const plus = document.createElement('button');
    plus.type = 'button'; plus.textContent = '+'; plus.setAttribute('aria-label', `Add one ${item.name}`);
    plus.addEventListener('click', () => changeQuantity(item.name, 1));
    controls.append(minus, amount, plus);
    details.append(name, unit, controls);
    const side = document.createElement('div');
    const linePrice = document.createElement('span'); linePrice.className = 'row-price'; linePrice.textContent = formatPrice(item.price * item.quantity);
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'remove-item'; remove.textContent = 'Remove';
    remove.addEventListener('click', () => { cart = cart.filter(entry => entry.name !== item.name); saveCart(); renderCart(); });
    side.append(linePrice, remove);
    row.append(details, side);
    cartItems.append(row);
  });
}

function changeQuantity(name, delta) {
  const item = cart.find(entry => entry.name === name);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) cart = cart.filter(entry => entry.name !== name);
  saveCart(); renderCart();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

document.querySelectorAll('.add-button').forEach(button => button.addEventListener('click', () => {
  const name = button.dataset.product;
  const price = Number(button.dataset.price);
  if (!name || !Number.isFinite(price)) return;
  const existing = cart.find(item => item.name === name);
  if (existing) existing.quantity += 1;
  else cart.push({ name, price, quantity: 1 });
  saveCart(); renderCart(); showToast(`${name} added to your cart`);
}));

document.querySelector('#search-form').addEventListener('submit', event => {
  event.preventDefault();
  const query = document.querySelector('#search-input').value.trim().toLocaleLowerCase();
  const category = document.querySelector('#search-category').value.toLocaleLowerCase();
  let visible = 0;
  cards.forEach(card => {
    const categoryMatches = category === 'all' || card.dataset.category.toLocaleLowerCase() === category;
    const textMatches = !query || `${card.dataset.search} ${card.textContent}`.toLocaleLowerCase().includes(query);
    card.hidden = !(categoryMatches && textMatches);
    if (!card.hidden) visible += 1;
  });
  document.querySelector('#empty-state').hidden = visible !== 0;
  document.querySelector('.shop-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

document.querySelector('#search-category').addEventListener('change', () => document.querySelector('#search-form').requestSubmit());
document.querySelector('#search-input').addEventListener('input', event => { if (!event.target.value.trim() && document.querySelector('#search-category').value === 'all') document.querySelector('#search-form').requestSubmit(); });
document.querySelector('#cart-button').addEventListener('click', () => cartDialog.showModal());
document.querySelector('#close-cart').addEventListener('click', () => cartDialog.close());
cartDialog.addEventListener('click', event => { if (event.target === cartDialog) cartDialog.close(); });
document.querySelector('#checkout-button').addEventListener('click', () => showToast(cart.length ? 'Checkout is a demo feature' : 'Your cart is empty'));

function signInDemo() { showToast('Sign-in is not enabled in this storefront demo'); }
document.querySelector('#account-button').addEventListener('click', signInDemo);
document.querySelector('#recommendation-signin').addEventListener('click', signInDemo);
document.querySelector('#location-button').addEventListener('click', () => showToast('Delivery location: India'));
renderCart();
