import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  booking_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
  },
  amount: {
    type: Number,
    required: [true, 'Please add a payment amount'],
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'completed',
  },
  method: {
    type: String,
    required: true,
  },
  transaction_id: String,
  customer_name: String,
  customer_phone: String,
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

const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;
