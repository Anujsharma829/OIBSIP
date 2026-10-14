import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
const schema = new mongoose.Schema({ name: String, email: { type: String, unique: true }, password: String, role: String });
const User = mongoose.model('User', schema);
if (!process.env.MONGODB_URI) {
  console.log('Set MONGODB_URI in .env to seed MongoDB. Local JSON mode seeds the admin automatically.');
  process.exit(0);
}
await mongoose.connect(process.env.MONGODB_URI);
const email = 'admin@slicecraft.local';
if (!await User.findOne({ email })) {
  await User.create({ name: 'SliceCraft Admin', email, password: await bcrypt.hash('Admin123!', 10), role: 'admin' });
  console.log('Admin created.');
} else console.log('Admin already exists.');
await mongoose.disconnect();
