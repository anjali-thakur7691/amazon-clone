![Amazon.in inspired storefront project structure](project-structure.svg)

# Amazon.in Storefront Demo

A full-stack shopping storefront inspired by Amazon.in, made with **HTML, CSS, vanilla JavaScript, Node.js, and SQLite**. The interface uses Amazon's familiar navy navigation, orange search accent, yellow shopping buttons, and light gray catalog background.

> **Learning demo:** This is an independent project, not an official Amazon product. It supports demo accounts and records demo orders; it does not process payments or ship purchases.

## Features

### Storefront
- Responsive layout for desktop, tablet, and mobile
- Amazon-inspired colors and shopping layout
- Expanded sample catalog across shopping departments, with prices, ratings, and offers
- Live search updates results as you type; multi-word search and department filters are supported
- Server-side product search and department filtering
- Sort products by price or customer rating

### Backend
- Node.js HTTP server with a JSON REST API
- SQLite persistence for carts and demo orders
- Cart quantity and stock validation
- Demo checkout with address validation and order history
- Separate accounts with email and password sign-in, plus account-specific carts and order history
- Passwords are stored as scrypt hashes; sign-in uses an HTTP-only session cookie
- Same-origin API and static file serving; no frontend build or third-party server package required

## Getting started

### Requirements

- Node.js **22.13.0 or newer** (uses the built-in `node:sqlite` module)
- A modern web browser

### Start the app

No dependency installation is required. From the project folder run:

```bash
npm start
```

If PowerShell blocks the `npm` script, use the Windows command shim:

```powershell
npm.cmd start
```

Then open <http://localhost:3000>.

For automatic server restart while editing, run `npm run dev` (or `npm.cmd run dev` in PowerShell).

The SQLite database is created automatically at `data/storefront.sqlite`. Set `DATABASE_PATH` to choose a different database location, and `PORT` to change the server port.

## How to use

1. Search for a product or choose a department.
2. Use **Add to cart** and the cart icon to review items and adjust quantities.
3. Choose **Proceed to checkout**, enter demo delivery details, and place a demo order.
4. Create an account from **Account & Lists** or sign in. Orders placed while signed in appear in **Returns & Orders** for that account.

Signed-in carts and order history follow the account across browsers. Signed-out guest carts and orders are stored against a random browser cart ID. Clearing browser storage creates a new guest cart ID; the old guest cart remains in the local database.

## API overview

All API routes are served by the same Node.js process as the storefront. Guest cart requests use the `X-Cart-Id` request header; signed-in cart and order requests use the session cookie.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Check server status |
| `GET` | `/api/products?q=headphones&category=Electronics` | List and search catalog |
| `POST` | `/api/auth/register` | Create `{ "name", "email", "password" }` account and sign in |
| `POST` | `/api/auth/login` | Sign in with `{ "email", "password" }` |
| `POST` | `/api/auth/logout` | End the current session |
| `GET` | `/api/auth/me` | Read the signed-in account |
| `GET` | `/api/cart` | Read cart and subtotal |
| `POST` | `/api/cart/items` | Add `{ "productId": "elec-01" }` |
| `PATCH` | `/api/cart/items/:productId` | Set `{ "quantity": 2 }`; zero removes item |
| `GET` | `/api/orders` | List this cart's demo orders |
| `POST` | `/api/orders` | Validate customer details, create an order, and clear the cart |
| `GET` | `/api/orders/:orderId` | Read an order belonging to this cart |

## Project structure

```text
amazon-clone/
├── data/
│   └── products.json       # Sample catalog; SQLite file is created at runtime
├── index.html              # Storefront markup and dialogs
├── style.css               # Amazon-inspired responsive interface
├── script.js               # Frontend rendering and API requests
├── server.js               # Node.js server and REST API
├── package.json            # Start scripts and Node.js version requirement
├── amazon_logo.png         # Local logo asset
├── project-structure.svg   # Diagram shown above
└── README.md               # Project documentation
```

## Deployment

This version needs a Node.js host that supports **Node 22.13+** and a **persistent writable filesystem** for the SQLite database. Configure `DATABASE_PATH` to point to that persistent storage. GitHub Pages can only serve the static files, so it cannot run this app's API or SQLite database by itself.

The app uses external Unsplash photos, Google Fonts, and Font Awesome icons; those assets need an internet connection. Sample catalog content and prices are stored in `data/products.json`.

## Demo limitations

- Payments, email verification, password reset, and shipping are not implemented; checkout only records a demo order.
- This learning demo is not production account infrastructure. Do not use it for real personal information or production orders.
- Stock values are sample limits and are not a real inventory system.
