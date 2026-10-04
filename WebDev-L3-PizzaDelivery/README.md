# Slice Society: MERN Pizza Delivery App

## Run it
1. Install Node.js 18+ and MongoDB (or use a free MongoDB Atlas URI).
2. Backend: `cd server && cp .env.example .env` (fill Razorpay TEST keys + SMTP), then `npm install && npm start`
3. Frontend: `cd client && npm install && npm run dev` then open http://localhost:5173

Admin login page: http://localhost:5173/admin/login (default admin@pizza.com / Admin@123, set in .env).
Menu, inventory and the admin account are created automatically on first start.
If SMTP_HOST is empty, emails (verify, reset, low-stock) are printed in the server terminal.

See CODE_GUIDE.md for a file-by-file explanation (Hinglish).

## Features
User: register + email verification, JWT login, forgot/reset password, menu, 4-step pizza builder with live preview, order summary, Razorpay test checkout, real-time order tracking (Socket.IO).
Admin: separate login, inventory dashboard + manual stock edit, auto stock decrement after payment, node-cron low-stock email, order panel with status updates pushed live to users.
