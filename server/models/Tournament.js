import mongoose from 'mongoose';

const tournamentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a tournament name'],
    trim: true,
  },
  turf_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Turf',
    required: true,
  },
  turf_name: String,
  start_date: Date,
  end_date: Date,
  max_teams: {
    type: Number,
    default: 8,
  },
  entry_fee: {
    type: Number,
    default: 0,
  },
  prize_pool: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['upcoming', 'registration_open', 'in_progress', 'completed', 'cancelled'],
    default: 'upcoming',
  },
  format: {
    type: String,
    enum: ['knockout', 'league', 'group_stage'],
    default: 'knockout',
  },
  description: String,
  rules: String,
  teams: [
    {
      name: String,
      captain_name: String,
      captain_phone: String,
      paid: {
        type: Boolean,
        default: false,
      },
    }
  ],
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

const Tournament = mongoose.model('Tournament', tournamentSchema);
export default Tournament;
