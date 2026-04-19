import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  turf_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Turf',
    required: true,
  },
  turf_name: String,
  customer_name: {
    type: String,
    required: [true, 'Please add a customer name'],
  },
  customer_phone: {
    type: String,
    required: [true, 'Please add a customer phone number'],
  },
  customer_email: String,
  date: {
    type: String,
    required: true,
  },
  start_hour: {
    type: Number,
    required: true,
  },
  end_hour: {
    type: Number,
    required: true,
  },
  duration_hours: Number,
  total_price: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed', 'no_show'],
    default: 'confirmed',
  },
  payment_status: {
    type: String,
    enum: ['paid', 'unpaid', 'partial', 'refunded'],
    default: 'unpaid',
  },
  payment_method: {
    type: String,
    enum: ['bkash', 'nagad', 'rocket', 'cash', 'card', 'other'],
    default: 'bkash',
  },
  notes: String,
  txn_id: String,
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

const Booking = mongoose.model('Booking', bookingSchema);
export default Booking;
