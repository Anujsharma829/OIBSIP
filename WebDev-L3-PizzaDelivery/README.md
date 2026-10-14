# SliceCraft — Pizza Delivery Full-Stack App

A responsive pizza ordering demo with separate customer and admin areas.

## Features
- Customer sign-up and login (JWT auth, bcrypt password hashing)
- Login does **not** require email verification in this starter, so you can repeatedly sign up/log in during testing
- Forgot-password demo flow (returns a reset link in development; no email provider needed)
- Pizza menu, custom pizza builder, cart, order summary and demo checkout
- Payment choices: UPI, net banking, card and cash on delivery (demo only; no real payment is processed)
- Customer order history with full items, delivery address, payment method/status and order tracking
- Separate admin login, inventory dashboard, manual stock updates, order status management
- Stock decrement when an order is placed; low-stock warning list
- Responsive styling for mobile, tablet and desktop
- MongoDB supported; local JSON fallback included for easy setup without MongoDB

## Requirements
- Node.js 18+
- npm

## Run locally

**Important:** Open the Vite URL printed by the frontend terminal (usually `http://localhost:5173`), not the backend URL. Keep both terminals running. This version also fixes a frontend startup crash that caused a blank white screen.

### 1) Start backend
```bash
cd server
npm install
# optional: copy .env.example to .env and set MONGODB_URI
npm run dev
```
Backend runs at `http://localhost:5000`.

If `MONGODB_URI` is not set, the app uses `server/data/db.json` for local development. This makes sign-up/login work immediately without installing MongoDB. For a real deployment, configure MongoDB.

### 2) Start frontend (new terminal)
```bash
cd client
npm install
npm run dev
```
Open the Vite URL printed in the terminal, normally `http://localhost:5173`.

## Login troubleshooting
- Start the **backend first**, then the frontend. Open `http://localhost:5173` (127.0.0.1 also works now).
- Do NOT put a `MONGODB_URI` in `server/.env` unless MongoDB is actually running. If it is unreachable the server now falls back to local JSON automatically.

## Demo admin account
- Email: `admin@slicecraft.local`
- Password: `Admin123!`

The local fallback seeds this account automatically. For MongoDB mode, register a user and change their role to `admin` in the database, or run the seed script:
```bash
cd server
npm run seed
```

## Important notes
- Checkout offers UPI, net banking, card and cash-on-delivery choices for demonstration. UPI/net banking/card selections are saved with the order but do not charge money. Connect and verify a payment gateway such as Razorpay before accepting real payments.
- Password reset is a development demo flow. Configure an email provider before using it in production.
- Do not use this starter as-is for production without rate limiting, CSRF/security review, email delivery, logging and deployment configuration.
