import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  customer_name: String,
  customer_phone: String,
  items: [
    {
      product_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
      },
      product_name: String,
      quantity: {
        type: Number,
        required: true,
      },
      unit_price: {
        type: Number,
        required: true,
      },
      subtotal: Number,
    }
  ],
  total_amount: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled', 'delivered'],
    default: 'confirmed',
  },
  payment_method: {
    type: String,
    enum: ['cash', 'bkash', 'nagad', 'rocket', 'card', 'other'],
    default: 'cash',
  },
  payment_status: {
    type: String,
    enum: ['paid', 'unpaid', 'partial'],
    default: 'paid',
  },
  notes: String,
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

const Order = mongoose.model('Order', orderSchema);
export default Order;
