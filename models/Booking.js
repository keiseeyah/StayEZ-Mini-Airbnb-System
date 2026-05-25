const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    listingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Listing',
        required: true
    },
    guestId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending' // As per the booking logic specs
    },
    listingName: String,
    listingLocation: String,
    listingType: String,
    listingImage: String
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);