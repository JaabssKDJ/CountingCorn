require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://20240029666_db_user:CCDBProject1@cluster0.pp3hfky.mongodb.net/CCDB';

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB (CCDB)');
    seedInitialData();
  })
  .catch(err => console.error('MongoDB Connection Error:', err));

const userSchema = new mongoose.Schema({
  name: String,
  username: { type: String, unique: true },
  password: String,
  role: { type: String, enum: ['Admin', 'Staff', 'Customer'], required: true }
});

const cornTypeSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  unit: { type: String, default: 'kg' },
  currentPrice: { type: Number, required: true },
  img: { type: String, default: '🌽' },
  priceHistory: [{
    previousPrice: Number,
    updatedPrice: Number,
    updatedAt: { type: Date, default: Date.now }
  }]
});

const batchSchema = new mongoose.Schema({
  batchCode: { type: String, required: true, unique: true },
  cornTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'CornType' },
  cornName: String,
  initialQty: Number,
  sellableQty: Number,
  spoiledQty: { type: Number, default: 0 },
  spoilagePercentage: { type: Number, default: 0 },
  harvestDate: { type: Date, default: Date.now }
});

const spoilageReasonSchema = new mongoose.Schema({
  reason: { type: String, required: true, unique: true }
});

const spoilageLogSchema = new mongoose.Schema({
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'HarvestBatch' },
  batchCode: String,
  cornName: String,
  qty: Number,
  reason: String,
  loggedAt: { type: Date, default: Date.now }
});

const orderSchema = new mongoose.Schema({
  orderId: String,
  receiptNumber: String,
  customerName: String,
  items: [{
    cornTypeId: String,
    name: String,
    qty: Number,
    price: Number,
    subtotal: Number
  }],
  totalAmount: Number,
  address: String,
  lat: Number,
  lng: Number,
  paymentStatus: { type: String, enum: ['Unpaid', 'Paid'], default: 'Unpaid' },
  status: { type: String, enum: ['Pending', 'Processing', 'In Transit', 'Completed', 'Cancelled'], default: 'Pending' },
  cancelReason: { type: String, default: '' },
  inventoryDeducted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const salesReportSchema = new mongoose.Schema({
  periodType: { type: String, enum: ['Daily', 'Monthly'], required: true },
  periodKey: { type: String, required: true },
  totalOrders: { type: Number, default: 0 },
  completedOrders: { type: Number, default: 0 },
  cancelledOrders: { type: Number, default: 0 },
  totalKgSold: { type: Number, default: 0 },
  totalRevenue: { type: Number, default: 0 },
  generatedAt: { type: Date, default: Date.now }
});

salesReportSchema.index({ periodType: 1, periodKey: 1 }, { unique: true });

const User = mongoose.model('User', userSchema);
const CornType = mongoose.model('CornType', cornTypeSchema);
const HarvestBatch = mongoose.model('HarvestBatch', batchSchema);
const SpoilageReason = mongoose.model('SpoilageReason', spoilageReasonSchema);
const SpoilageLog = mongoose.model('SpoilageLog', spoilageLogSchema);
const Order = mongoose.model('Order', orderSchema);
const SalesReport = mongoose.model('SalesReport', salesReportSchema);

async function syncSalesReports() {
  const orders = await Order.find();
  const dailyMap = {};
  const monthlyMap = {};

  for (const o of orders) {
    const dt = new Date(o.createdAt);
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');

    const dayKey = `${yyyy}-${mm}-${dd}`;
    const monthKey = `${yyyy}-${mm}`;

    if (!dailyMap[dayKey]) {
      dailyMap[dayKey] = { totalOrders: 0, completedOrders: 0, cancelledOrders: 0, totalKgSold: 0, totalRevenue: 0 };
    }
    if (!monthlyMap[monthKey]) {
      monthlyMap[monthKey] = { totalOrders: 0, completedOrders: 0, cancelledOrders: 0, totalKgSold: 0, totalRevenue: 0 };
    }

    const orderKg = o.items.reduce((sum, i) => sum + (i.qty || 0), 0);

    dailyMap[dayKey].totalOrders += 1;
    monthlyMap[monthKey].totalOrders += 1;

    if (o.status === 'Completed') {
      dailyMap[dayKey].completedOrders += 1;
      dailyMap[dayKey].totalKgSold += orderKg;
      dailyMap[dayKey].totalRevenue += o.totalAmount;

      monthlyMap[monthKey].completedOrders += 1;
      monthlyMap[monthKey].totalKgSold += orderKg;
      monthlyMap[monthKey].totalRevenue += o.totalAmount;
    } else if (o.status === 'Cancelled') {
      dailyMap[dayKey].cancelledOrders += 1;
      monthlyMap[monthKey].cancelledOrders += 1;
    }
  }

  for (const [periodKey, stats] of Object.entries(dailyMap)) {
    await SalesReport.findOneAndUpdate(
      { periodType: 'Daily', periodKey },
      { ...stats, generatedAt: new Date() },
      { upsert: true, new: true }
    );
  }

  for (const [periodKey, stats] of Object.entries(monthlyMap)) {
    await SalesReport.findOneAndUpdate(
      { periodType: 'Monthly', periodKey },
      { ...stats, generatedAt: new Date() },
      { upsert: true, new: true }
    );
  }

  const daily = await SalesReport.find({ periodType: 'Daily' }).sort({ periodKey: -1 });
  const monthly = await SalesReport.find({ periodType: 'Monthly' }).sort({ periodKey: -1 });
  return { daily, monthly };
}

async function seedInitialData() {
  if (await User.countDocuments() === 0) {
    await User.insertMany([
      { name: 'Farm Owner', username: 'admin', password: '123', role: 'Admin' },
      { name: 'Warehouse & Delivery Staff', username: 'staff', password: '123', role: 'Staff' },
      { name: 'Kristina Abejay', username: 'customer', password: '123', role: 'Customer' }
    ]);
  }
  if (await CornType.countDocuments() === 0) {
    const c1 = await CornType.create({ name: 'Yellow Sweet Corn', currentPrice: 45, img: '🌽' });
    const c2 = await CornType.create({ name: 'White Glutinous Corn', currentPrice: 50, img: '🌾' });
    await HarvestBatch.create({
      batchCode: 'BATCH-001',
      cornTypeId: c1._id,
      cornName: c1.name,
      initialQty: 500,
      sellableQty: 480,
      spoiledQty: 20,
      spoilagePercentage: 4.0
    });
  }
  if (await SpoilageReason.countDocuments() === 0) {
    await SpoilageReason.insertMany([
      { reason: 'Overripe / Mold' },
      { reason: 'Pest Damage' },
      { reason: 'Transport Damage' }
    ]);
  }
  await syncSalesReports();
}

app.post('/api/login', async (req, res) => {
  const { username, password, role } = req.body;
  let user = await User.findOne({ username, password, role });
  if (!user && password === '123') {
    user = await User.findOne({ role });
  }
  if (!user) return res.status(401).json({ error: 'Invalid credentials or role' });
  res.json({ id: user._id, name: user.name, role: user.role });
});

app.get('/api/state', async (req, res) => {
  const cornTypes = await CornType.find();
  const batches = await HarvestBatch.find().sort({ harvestDate: -1 });
  const reasons = await SpoilageReason.find();
  const spoilageLogs = await SpoilageLog.find().sort({ loggedAt: -1 });
  const orders = await Order.find().sort({ createdAt: -1 });
  const salesReports = await syncSalesReports();

  const catalog = cornTypes.map(ct => {
    const matchingBatches = batches.filter(b => b.cornName === ct.name);
    const availableStock = matchingBatches.reduce((sum, b) => sum + b.sellableQty, 0);
    return { ...ct.toObject(), availableStock };
  });

  res.json({ catalog, batches, reasons, spoilageLogs, orders, salesReports });
});

app.get('/api/reports/sales', async (req, res) => {
  const reports = await syncSalesReports();
  res.json(reports);
});

app.post('/api/corn-types', async (req, res) => {
  try {
    const { name, currentPrice, img } = req.body;
    const newCorn = await CornType.create({ name, currentPrice: Number(currentPrice), img: img || '🌽' });
    res.json(newCorn);
  } catch (err) {
    res.status(400).json({ error: 'Corn type already exists or invalid data' });
  }
});

app.put('/api/corn-types/:id/price', async (req, res) => {
  const { newPrice } = req.body;
  const corn = await CornType.findById(req.params.id);
  if (!corn) return res.status(404).json({ error: 'Corn type not found' });

  corn.priceHistory.push({
    previousPrice: corn.currentPrice,
    updatedPrice: Number(newPrice)
  });
  corn.currentPrice = Number(newPrice);
  await corn.save();
  res.json(corn);
});

app.post('/api/batches', async (req, res) => {
  const { cornTypeId, initialQty } = req.body;
  const corn = await CornType.findById(cornTypeId);
  const count = await HarvestBatch.countDocuments();
  const batch = await HarvestBatch.create({
    batchCode: `BATCH-${String(count + 1).padStart(3, '0')}`,
    cornTypeId: corn._id,
    cornName: corn.name,
    initialQty: Number(initialQty),
    sellableQty: Number(initialQty),
    spoiledQty: 0,
    spoilagePercentage: 0
  });
  res.json(batch);
});

app.post('/api/spoilage-reasons', async (req, res) => {
  try {
    const reason = await SpoilageReason.create({ reason: req.body.reason });
    res.json(reason);
  } catch (err) {
    res.status(400).json({ error: 'Reason already exists' });
  }
});

app.post('/api/spoilage', async (req, res) => {
  const { batchId, qty, reason } = req.body;
  const batch = await HarvestBatch.findById(batchId);
  const lossQty = Number(qty);

  if (!batch || lossQty > batch.sellableQty) {
    return res.status(400).json({ error: 'Invalid batch or spoilage exceeds sellable stock' });
  }

  batch.sellableQty -= lossQty;
  batch.spoiledQty += lossQty;
  batch.spoilagePercentage = Number(((batch.spoiledQty / batch.initialQty) * 100).toFixed(2));
  await batch.save();

  await SpoilageLog.create({
    batchId: batch._id,
    batchCode: batch.batchCode,
    cornName: batch.cornName,
    qty: lossQty,
    reason
  });

  res.json(batch);
});

app.post('/api/orders', async (req, res) => {
  const { customerName, items, address, lat, lng } = req.body;
  let totalAmount = 0;
  const verifiedItems = [];

  for (const item of items) {
    const corn = await CornType.findById(item.cornTypeId);
    const subtotal = corn.currentPrice * item.qty;
    totalAmount += subtotal;
    verifiedItems.push({
      cornTypeId: corn._id,
      name: corn.name,
      qty: item.qty,
      price: corn.currentPrice,
      subtotal
    });
  }

  const orderCount = await Order.countDocuments();
  const orderId = `ORD-${1001 + orderCount}`;
  const receiptNumber = `RCPT-${Date.now().toString().slice(-6)}`;

  const newOrder = await Order.create({
    orderId,
    receiptNumber,
    customerName,
    items: verifiedItems,
    totalAmount,
    address,
    lat,
    lng,
    status: 'Pending',
    paymentStatus: 'Unpaid'
  });

  await syncSalesReports();
  res.json(newOrder);
});

app.put('/api/orders/:id/status', async (req, res) => {
  const { status, cancelReason } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  if (status === 'Cancelled') {
    if (order.status === 'In Transit' || order.status === 'Completed') {
      return res.status(400).json({ error: 'Cannot cancel an order already in transit or completed' });
    }
    if (order.inventoryDeducted) {
      for (const item of order.items) {
        const batch = await HarvestBatch.findOne({ cornName: item.name }).sort({ harvestDate: -1 });
        if (batch) {
          batch.sellableQty += item.qty;
          await batch.save();
        }
      }
      order.inventoryDeducted = false;
    }
    order.cancelReason = cancelReason || 'Cancelled by customer';
  }

  if ((status === 'Processing' || status === 'Completed') && !order.inventoryDeducted) {
    for (const item of order.items) {
      let remainingToDeduct = item.qty;
      const batches = await HarvestBatch.find({ cornName: item.name, sellableQty: { $gt: 0 } }).sort({ harvestDate: 1 });
      
      for (const batch of batches) {
        if (remainingToDeduct <= 0) break;
        const deduct = Math.min(batch.sellableQty, remainingToDeduct);
        batch.sellableQty -= deduct;
        remainingToDeduct -= deduct;
        await batch.save();
      }
    }
    order.inventoryDeducted = true;
  }

  if (status === 'Completed') {
    order.paymentStatus = 'Paid';
  }

  order.status = status;
  await order.save();
  await syncSalesReports();
  res.json(order);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));