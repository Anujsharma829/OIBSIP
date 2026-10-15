# SliceCraft — MERN Pizza Delivery Application

**Oasis Infobyte Internship (OIBSIP) · Web Development & Designing · Level 3 · Task 1**

A full-stack pizza ordering and inventory-management platform with separate **User** and **Admin** roles, JWT auth, email verification, Razorpay (test mode) payments, live order tracking and automated low-stock email alerts.

## Tech stack
| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, lucide-react, custom CSS (responsive) |
| Backend | Node.js, Express.js |
| Database | MongoDB + Mongoose (automatic local-JSON fallback if MongoDB is not running) |
| Auth | JWT, bcryptjs |
| Payments | Razorpay (test mode) |
| Email & jobs | Nodemailer, node-cron |

## Feature checklist (Level 3)

**User side**
- [x] Registration with **email verification** (verification link emailed; account can't log in until verified)
- [x] Login with **JWT** authorisation
- [x] **Forgot password** flow with emailed, single-use, 15-minute reset link
- [x] Dashboard with the available pizza varieties
- [x] **Custom pizza builder**: 5 bases → 5 sauces → cheese type → multiple vegetables
- [x] **Order summary** page before payment
- [x] **Razorpay checkout (test mode)** — clicking *Success* confirms the order (payment signature is verified on the server)
- [x] **Real-time order status** on the user dashboard (Order Received → In Kitchen → Sent to Delivery → Delivered), refreshed by polling every 5 seconds

**Admin side**
- [x] **Separate admin login** (`/admin`) — admin accounts cannot sign in or be created from the customer flow
- [x] Inventory dashboard: pizza bases, sauces, cheese, vegetables
- [x] **Stock decremented automatically** after each confirmed order
- [x] **Manual stock update** for every item
- [x] **Automated email to the admin** when an item falls below a **configurable threshold** (per-item, editable in the dashboard) using a **node-cron** scheduled job (also checked right after each order)
- [x] Order management panel: view all orders and update their status — customers see the change live

## Run locally

Requirements: Node.js 18+ and npm. MongoDB, Gmail and Razorpay keys are **optional** (see below).

```bash
# 1) backend  (terminal 1)
cd server
npm install
cp .env.example .env      # optional – works without it
npm run dev               # http://localhost:5000

# 2) frontend (terminal 2)
cd client
npm install
npm run dev               # open http://localhost:5173
```

### Admin account
Open `http://localhost:5173/admin` (or the *Admin login* link in the footer).

- Email: `admin@slicecraft.local`
- Password: `Admin123!`

## Optional configuration (`server/.env`)
Everything works out of the box. Add these to switch the demo parts to the real thing:

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | Use MongoDB instead of `server/data/db.json` (if MongoDB is unreachable the server falls back automatically) |
| `EMAIL_USER`, `EMAIL_PASS` | Gmail address + **App Password** → real verification, reset and low-stock emails |
| `ADMIN_EMAIL` | Who receives low-stock alerts (defaults to `EMAIL_USER`) |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Razorpay **test** keys → real Razorpay test checkout |
| `LOW_STOCK_THRESHOLD`, `STOCK_CRON` | Default threshold (20) and cron schedule (every 5 min) |

**When email is not configured:** emails are printed in the backend console and the verification / reset link is shown on screen, so the app is never blocked.
**When Razorpay keys are not set:** a simulated Razorpay test checkout (with a *Success* / *Failure* button) opens, using the same verify-and-confirm flow on the server.

### Razorpay test payment
Use Razorpay's test credentials, e.g. card `4111 1111 1111 1111`, any future expiry, any CVV, or UPI `success@razorpay`. No real money is charged.

## API overview
`POST /api/auth/signup · /verify-email · /resend-verification · /login · /admin-login · /forgot-password · /reset-password`
`GET /api/menu · /api/orders/mine` · `POST /api/orders · /api/payments/verify · /api/payments/cancel`
`GET /api/admin/overview` · `PATCH /api/admin/inventory/:id · /api/admin/orders/:id` · `POST /api/admin/check-stock`

## Notes
- Passwords are hashed with bcrypt; reset links are single-use and expire in 15 minutes.
- Order prices are recalculated on the server, never trusted from the browser.
- For production add rate limiting, HTTPS, a real email domain and remove the on-screen fallback links.
