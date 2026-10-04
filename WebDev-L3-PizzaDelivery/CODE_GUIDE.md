# Code Guide (Hinglish): project kaise kaam karta hai

## Folder structure
```
pizza-app/
├── server/                 BACKEND (Node.js + Express + MongoDB)
│   ├── server.js           Yahan se start hota hai (DB connect, seed, socket, cron)
│   ├── app.js              Express app + saare routes jodta hai
│   ├── config.js           .env ki settings (JWT secret, client URL)
│   ├── constants.js        Order ke 3 status: Order Received, In Kitchen, Sent to Delivery
│   ├── seed.js             Khali database mein ingredients, pizzas aur admin account daalta hai
│   ├── socket.js           Real-time updates (Socket.IO)
│   ├── models/             Database ki tables (User, Item, Pizza, Order)
│   ├── middleware/auth.js  JWT token check karta hai (login hai ya nahi, admin hai ya nahi)
│   ├── routes/
│   │   ├── auth.js         Register, email verify, login, forgot/reset password, profile, admin login
│   │   ├── menu.js         Menu + admin inventory (stock dekhna aur badalna)
│   │   └── orders.js       Order banana, Razorpay payment verify, stock kam karna, admin order panel
│   ├── jobs/lowStock.js    node-cron: stock kam hone par admin ko email
│   └── utils/              mailer.js (email bhejna), helpers.js (chhote helper functions)
└── client/                 FRONTEND (React + Vite)
    └── src/
        ├── main.jsx        React app yahan se start hota hai
        ├── App.jsx         Navbar, sidebar (☰ se khulta hai), saare page routes
        ├── pages.jsx       Saari screens (Home, Login, Builder, Cart, Dashboard, Admin...)
        ├── lib.jsx         api() function, login/cart ki state, live updates, Razorpay loader
        ├── Pizza.jsx       Pizza ki picture (ya real photo agar public/pizzas/ mein ho)
        ├── store.js        localStorage ka chhota wrapper
        ├── mock.js         SIRF demo ke liye nakli backend (npm run demo)
        └── styles.css      Saara design
```

## Har feature ka flow

**1. Registration + email verification**
`pages.jsx (Auth)` form bharta hai -> `POST /api/auth/register` (`routes/auth.js`) -> password bcrypt se hash hota hai -> random token ban kar email mein link jaata hai -> user link kholta hai -> `GET /api/auth/verify/:token` -> `verified = true`. Verify hue bina login nahi hota.

**2. Login (JWT)**
`POST /api/auth/login` password match karta hai -> ek JWT token deta hai -> frontend use `localStorage` mein rakhta hai -> har request mein `Authorization` header ke saath bhejta hai -> `middleware/auth.js` use check karta hai.

**3. Forgot password**
`POST /api/auth/forgot` -> 1 ghante ka reset link email mein -> link `/reset/:token` page kholta hai -> `POST /api/auth/reset/:token` naya password save karta hai.

**4. Custom pizza builder**
`Builder` (pages.jsx) 4 steps dikhata hai: base, sauce, cheese, veggies. Data `GET /api/menu` se aata hai. Price: Rs 49 + chune hue ingredients ka total. Cart mein add hota hai.

**5. Order summary + Razorpay payment**
Cart page par "Pay with Razorpay" dabao ->
1. `POST /api/orders`: server price dobara calculate karta hai (browser par bharosa nahi), stock check karta hai, Razorpay order banata hai.
2. Razorpay ka popup khulta hai (test mode mein "Success" dabao).
3. `POST /api/orders/verify`: server Razorpay ka signature verify karta hai. Sahi hone par order `paid = true`, stock kam hota hai, admin ko live notification jaati hai.

**6. Stock automatically kam hona**
`routes/orders.js` ke verify step mein har ingredient ka stock `$inc` se kam hota hai. Ye sirf ek baar hota hai (`if (!order.paid)` check).

**7. Low stock email (node-cron)**
`jobs/lowStock.js` har 10 minute mein check karta hai, aur order ke turant baad bhi. Jis item ka `stock < threshold` ho aur pehle alert na gaya ho, uski email admin ko jaati hai. Threshold admin panel se har item ka alag badal sakte ho (default 20).

**8. Real-time order status (WebSockets)**
Admin status badalta hai -> `PUT /api/admin/orders/:id/status` -> server `socket.io` se `order:update` event bhejta hai us customer ke room mein -> `Dashboard` ka `useSocket` use sunta hai -> bina refresh status badal jaata hai.

**9. Admin**
Alag login `/admin/login` (sirf role `admin` wale). Panel mein: incoming orders + status buttons, inventory table (stock aur alert limit edit karke Save).

## Mentor ko kaise explain karein (short)
"Frontend React mein hai aur backend Express mein. Login JWT se hota hai. Payment Razorpay se hota hai aur server signature verify karta hai. Stock payment ke baad kam hota hai. Low stock par node-cron email bhejta hai. Order status Socket.IO se live badalta hai."
