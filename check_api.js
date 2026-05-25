const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const Booking = require('./models/Booking');
const Listing = require('./models/Listing');

const dbURI = process.env.MONGODB_URI || process.env.MONGO_URI;

async function run() {
    await mongoose.connect(dbURI);
    try {
        console.log('Users in DB:');
        const users = await User.find();
        users.forEach(u => {
            console.log(`- ${u.name} (${u.email}) [${u.role}] ID: ${u._id}`);
        });

        // Get first Host
        const host = users.find(u => u.role === 'Host');
        if (!host) {
            console.log('No Host found in DB!');
            return;
        }

        console.log('\nTesting /api/bookings/host logic for Host:', host.name);
        const hostId = host._id;
        const listings = await Listing.find({ hostId });
        const listingIds = listings.map(l => l._id);
        console.log('Host listings:', listingIds);

        const bookings = await Booking.find({ listingId: { $in: listingIds } })
            .populate('listingId', 'name location price image type')
            .populate('guestId', 'name email')
            .sort({ createdAt: -1 });
        console.log(`Successfully fetched ${bookings.length} bookings for host.`);

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
