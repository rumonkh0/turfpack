import mongoose from 'mongoose';

const turfSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a turf name'],
    trim: true,
  },
  type: {
    type: String,
    required: true,
    enum: ['5-a-side', '7-a-side', '11-a-side', 'futsal', 'multi-purpose'],
  },
  size: String,
  location: String,
  description: String,
  image_url: String,
  status: {
    type: String,
    enum: ['active', 'maintenance', 'inactive'],
    default: 'active',
  },
  base_price: {
    type: Number,
    default: 0,
  },
  peak_price: {
    type: Number,
    default: 0,
  },
  night_price: {
    type: Number,
    default: 0,
  },
  opening_hour: {
    type: Number,
    default: 6,
  },
  closing_hour: {
    type: Number,
    default: 23,
  },
  peak_hours_start: {
    type: Number,
    default: 17,
  },
  peak_hours_end: {
    type: Number,
    default: 21,
  },
  weekend_multiplier: {
    type: Number,
    default: 1.2,
  },
  amenities: [String],
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

const Turf = mongoose.model('Turf', turfSchema);
export default Turf;
