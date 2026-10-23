'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3000;
const databasePath = path.resolve(process.env.DATABASE_PATH || path.join(ROOT, 'data', 'storefront.sqlite'));
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const products = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'products.json'), 'utf8'));
const productsById = new Map(products.map(product => [product.id, product]));
const categories = [...new Set(products.map(product => product.category))].sort();
const db = new DatabaseSync(databasePath);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS carts (
    cart_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    PRIMARY KEY (cart_id, product_id)
  );
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    cart_id TEXT NOT NULL,
    customer_json TEXT NOT NULL,
    total INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS order_items (
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    name TEXT NOT NULL,
    unit_price INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    PRIMARY KEY (order_id, product_id)
  );
`);

const staticFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/script.js', ['script.js', 'text/javascript; charset=utf-8']],
  ['/amazon_logo.png', ['amazon_logo.png', 'image/png']],
  ['/project-structure.svg', ['project-structure.svg', 'image/svg+xml; charset=utf-8']],
]);

function sendJson(response, status, value) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(value));
}

function getCartId(request) {
  const id = request.headers['x-cart-id'];
  if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/i.test(id)) {
    const error = new Error('A valid cart id is required. Reload the page and try again.');
    error.status = 400;
    throw error;
  }
  return id;
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        const error = new Error('Request body is too large.');
        error.status = 413;
        reject(error);
        request.destroy();
      }
    });
    request.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); }
      catch { const error = new Error('Request body must be valid JSON.'); error.status = 400; reject(error); }
    });
    request.on('error', reject);
  });
}

function cartFor(cartId) {
  const rows = db.prepare('SELECT product_id, quantity FROM carts WHERE cart_id = ? ORDER BY rowid').all(cartId);
  const items = rows.map(row => {
    const product = productsById.get(row.product_id);
    return product ? { id: product.id, slug: product.slug, name: product.name, price: product.price, image: product.image, quantity: row.quantity, stock: product.stock } : null;
  }).filter(Boolean);
  return {
    items,
    count: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
  };
}

function orderFor(orderId) {
  const order = db.prepare('SELECT id, total, created_at, customer_json FROM orders WHERE id = ?').get(orderId);
  if (!order) return null;
  const items = db.prepare('SELECT product_id AS id, name, unit_price AS price, quantity FROM order_items WHERE order_id = ?').all(order.id);
  return { id: order.id, total: order.total, createdAt: order.created_at, customer: JSON.parse(order.customer_json), items };
}

function validateCustomer(value) {
  const customer = {
    name: String(value?.name || '').trim(),
    email: String(value?.email || '').trim(),
    phone: String(value?.phone || '').trim(),
    address: String(value?.address || '').trim(),
    pincode: String(value?.pincode || '').trim(),
  };
  if (customer.name.length < 2 || customer.name.length > 100) throw Object.assign(new Error('Enter a valid full name.'), { status: 400 });
  if (customer.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) throw Object.assign(new Error('Enter a valid email address.'), { status: 400 });
  if (!/^[0-9 +()-]{10,18}$/.test(customer.phone)) throw Object.assign(new Error('Enter a valid mobile number.'), { status: 400 });
  if (customer.address.length < 8 || customer.address.length > 300) throw Object.assign(new Error('Enter a complete delivery address.'), { status: 400 });
  if (!/^\d{6}$/.test(customer.pincode)) throw Object.assign(new Error('Enter a valid 6 digit PIN code.'), { status: 400 });
  return customer;
}

async function handleApi(request, response, url) {
  const method = request.method;

  if (url.pathname === '/api/health' && method === 'GET') return sendJson(response, 200, { status: 'ok' });

  if (url.pathname === '/api/products' && method === 'GET') {
    const query = (url.searchParams.get('q') || '').trim().toLocaleLowerCase('en-IN');
    const category = (url.searchParams.get('category') || '').trim().toLocaleLowerCase('en-IN');
    const filtered = products.filter(product => {
      const productText = `${product.name} ${product.description} ${product.category} ${product.badge}`.toLocaleLowerCase('en-IN');
      return (!query || productText.includes(query)) && (!category || product.category.toLocaleLowerCase('en-IN') === category);
    });
    return sendJson(response, 200, { products: filtered, categories });
  }

  if (url.pathname === '/api/cart' && method === 'GET') {
    return sendJson(response, 200, { cart: cartFor(getCartId(request)) });
  }

  if (url.pathname === '/api/cart/items' && method === 'POST') {
    const cartId = getCartId(request);
    const body = await readJson(request);
    const product = productsById.get(String(body.productId || ''));
    if (!product) return sendJson(response, 404, { error: 'Product not found.' });
    const existing = db.prepare('SELECT quantity FROM carts WHERE cart_id = ? AND product_id = ?').get(cartId, product.id);
    if ((existing?.quantity || 0) >= product.stock) return sendJson(response, 409, { error: 'There is no more stock available for this item.' });
    db.prepare(`INSERT INTO carts(cart_id, product_id, quantity) VALUES (?, ?, 1)
      ON CONFLICT(cart_id, product_id) DO UPDATE SET quantity = quantity + 1`).run(cartId, product.id);
    return sendJson(response, 201, { cart: cartFor(cartId) });
  }

  const cartItemMatch = url.pathname.match(/^\/api\/cart\/items\/([^/]+)$/);
  if (cartItemMatch && method === 'PATCH') {
    const cartId = getCartId(request);
    const productId = decodeURIComponent(cartItemMatch[1]);
    const body = await readJson(request);
    const quantity = Number(body.quantity);
    const product = productsById.get(productId);
    if (!product) return sendJson(response, 404, { error: 'Product not found.' });
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > product.stock) return sendJson(response, 400, { error: `Quantity must be between 0 and ${product.stock}.` });
    if (quantity === 0) db.prepare('DELETE FROM carts WHERE cart_id = ? AND product_id = ?').run(cartId, productId);
    else db.prepare(`INSERT INTO carts(cart_id, product_id, quantity) VALUES (?, ?, ?)
      ON CONFLICT(cart_id, product_id) DO UPDATE SET quantity = excluded.quantity`).run(cartId, productId, quantity);
    return sendJson(response, 200, { cart: cartFor(cartId) });
  }

  if (url.pathname === '/api/orders' && method === 'GET') {
    const cartId = getCartId(request);
    const rows = db.prepare('SELECT id FROM orders WHERE cart_id = ? ORDER BY created_at DESC').all(cartId);
    return sendJson(response, 200, { orders: rows.map(row => orderFor(row.id)) });
  }

  if (url.pathname === '/api/orders' && method === 'POST') {
    const cartId = getCartId(request);
    const body = await readJson(request);
    const customer = validateCustomer(body.customer);
    const cart = cartFor(cartId);
    if (!cart.items.length) return sendJson(response, 409, { error: 'Your cart is empty.' });
    const id = `AMZ-${randomUUID().toUpperCase()}`;
    const createdAt = new Date().toISOString();
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('INSERT INTO orders(id, cart_id, customer_json, total, created_at) VALUES (?, ?, ?, ?, ?)').run(id, cartId, JSON.stringify(customer), cart.subtotal, createdAt);
      const addItem = db.prepare('INSERT INTO order_items(order_id, product_id, name, unit_price, quantity) VALUES (?, ?, ?, ?, ?)');
      for (const item of cart.items) addItem.run(id, item.id, item.name, item.price, item.quantity);
      db.prepare('DELETE FROM carts WHERE cart_id = ?').run(cartId);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    return sendJson(response, 201, { order: orderFor(id) });
  }

  const orderMatch = url.pathname.match(/^\/api\/orders\/([^/]+)$/);
  if (orderMatch && method === 'GET') {
    const cartId = getCartId(request);
    const orderId = decodeURIComponent(orderMatch[1]);
    const belongsToCart = db.prepare('SELECT 1 AS found FROM orders WHERE id = ? AND cart_id = ?').get(orderId, cartId);
    const order = belongsToCart ? orderFor(orderId) : null;
    return order ? sendJson(response, 200, { order }) : sendJson(response, 404, { error: 'Order not found.' });
  }

  sendJson(response, 404, { error: 'API route not found.' });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(request, response, url);
    if (request.method !== 'GET' && request.method !== 'HEAD') return sendJson(response, 405, { error: 'Method not allowed.' });
    const file = staticFiles.get(url.pathname);
    if (!file) return sendJson(response, 404, { error: 'Page not found.' });
    const filePath = path.join(ROOT, file[0]);
    if (!fs.existsSync(filePath)) return sendJson(response, 404, { error: 'Page not found.' });
    response.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': file[0] === 'index.html' ? 'no-cache' : 'public, max-age=3600' });
    if (request.method === 'HEAD') return response.end();
    fs.createReadStream(filePath).pipe(response);
  } catch (error) {
    if (!response.headersSent) sendJson(response, error.status || 500, { error: error.status ? error.message : 'Something went wrong. Please try again.' });
    else response.destroy(error);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Amazon storefront running at http://localhost:${PORT}`);
  console.log(`SQLite database: ${databasePath}`);
});

function shutdown() {
  server.close(() => { db.close(); process.exit(0); });
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
