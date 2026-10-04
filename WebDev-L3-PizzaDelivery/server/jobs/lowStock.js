// Automated low stock email to the admin (uses node-cron).
const cron = require('node-cron');
const Item = require('../models/Item');
const User = require('../models/User');
const { sendMail } = require('../utils/mailer');

// Finds items below their threshold that we have not already warned about, then emails the admin.
async function checkLowStock() {
  const notAlertedYet = await Item.find({ alerted: false });
  const lowItems = notAlertedYet.filter((item) => item.stock < item.threshold);

  if (lowItems.length === 0) return;

  const admin = await User.findOne({ role: 'admin' });
  const list = lowItems
    .map((i) => `<li>${i.name} (${i.type}): <b>${i.stock}</b> left, limit ${i.threshold}</li>`)
    .join('');

  await sendMail(
    process.env.ADMIN_ALERT_EMAIL || admin.email,
    `Low stock: ${lowItems.length} item(s)`,
    `<h3>These items are running low</h3><ul>${list}</ul>`
  );

  // Remember that we warned, so the admin does not get the same email every 10 minutes.
  await Item.updateMany({ _id: { $in: lowItems.map((i) => i._id) } }, { alerted: true });
}

// Runs the check every 10 minutes. ("*/10 * * * *" is cron syntax for that)
function startLowStockJob() {
  cron.schedule('*/10 * * * *', checkLowStock);
}

module.exports = { checkLowStock, startLowStockJob };
