import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a product name'],
    trim: true,
  },
  category: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: [true, 'Please add a price'],
  },
  cost_price: {
    type: Number,
    default: 0,
  },
  stock: {
    type: Number,
    default: 0,
  },
  unit: {
    type: String,
    default: 'pcs',
  },
  sku: String,
  status: {
    type: String,
    enum: ['active', 'inactive', 'out_of_stock'],
    default: 'active',
  },
  image_url: String,
  description: String,
  low_stock_alert: {
    type: Number,
    default: 5,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
      ret.id = ret._id;
      ret.created_date = ret.createdAt;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

const Product = mongoose.model('Product', productSchema);
export default Product;
