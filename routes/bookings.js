const express = require('express');
const router  = express.Router();
const Booking = require('../models/Booking');
const Listing = require('../models/Listing');
const checkRole = require('../middleware/roleCheck');

// ─── Date Overlap Helper ───────────────────────────────────────────────────────
// Returns true when [s1, e1) and [s2, e2) share at least one day
function datesOverlap(s1, e1, s2, e2) {
    return s1 < e2 && e1 > s2;
}

// ─── POST /api/bookings ─── Guest creates a new booking ──────────────────────
router.post('/', checkRole(['Guest']), async (req, res) => {
    try {
        const guestId = req.userId;
        const { listingId, startDate, endDate } = req.body;

        const start = new Date(startDate);
        const end   = new Date(endDate);

        // ── Basic date validation ─────────────────────────────────────────────
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({ message: 'Invalid date format.' });
        }
        if (start >= end) {
            return res.status(400).json({ message: 'Check-out must be after check-in.' });
        }

        // ── Verify listing exists and is not removed ──────────────────────────
        const listing = await Listing.findById(listingId);
        if (!listing || listing.isRemoved) return res.status(404).json({ message: 'Listing not found.' });

        // ── Date-Range Overlap Check (against ALL approved bookings) ──────────
        const approvedBookings = await Booking.find({ listingId, status: 'approved' });
        const conflict = approvedBookings.find(b =>
            datesOverlap(start, end, new Date(b.startDate), new Date(b.endDate))
        );
        if (conflict) {
            return res.status(409).json({
                message: `These dates overlap with an existing approved booking (${new Date(conflict.startDate).toLocaleDateString()} – ${new Date(conflict.endDate).toLocaleDateString()}). Please choose different dates.`
            });
        }

        const booking = new Booking({
            listingId,
            guestId,
            startDate: start,
            endDate: end,
            status: 'pending',
            listingName: listing.name,
            listingLocation: listing.location,
            listingType: listing.type,
            listingImage: listing.image
        });
        const saved   = await booking.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(400).json({ message: 'Error creating booking.', error: err.message });
    }
});

// ─── GET /api/bookings/mine ─── Guest sees their own bookings ────────────────
router.get('/mine', checkRole(['Guest']), async (req, res) => {
    try {
        const guestId  = req.userId;
        const bookings = await Booking.find({ guestId })
            .populate('listingId', 'name location price image type contactNumber isRemoved')
            .sort({ createdAt: -1 });

        // Redact contact number unless booking is approved
        const result = bookings.map(b => {
            const obj = b.toObject();
            if (obj.status !== 'approved' && obj.listingId) {
                delete obj.listingId.contactNumber;
            }
            return obj;
        });

        res.status(200).json(result);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching your bookings.', error: err.message });
    }
});

// ─── GET /api/bookings/host ─── Host sees ALL booking requests for ALL of their listings ──
router.get('/host', checkRole(['Host']), async (req, res) => {
    try {
        const hostId = req.userId;
        const listings = await Listing.find({ hostId });
        const listingIds = listings.map(l => l._id);

        const bookings = await Booking.find({ listingId: { $in: listingIds } })
            .populate('listingId', 'name location price image type isRemoved')
            .populate('guestId', 'name email')
            .sort({ createdAt: -1 });

        res.status(200).json(bookings);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching host bookings.', error: err.message });
    }
});

// ─── GET /api/bookings/listing/:listingId ─── Host sees bookings for one listing ──
router.get('/listing/:listingId', checkRole(['Host']), async (req, res) => {
    try {
        const hostId    = req.userId;
        const { listingId } = req.params;

        // Verify this host owns the listing
        const listing = await Listing.findById(listingId);
        if (!listing) return res.status(404).json({ message: 'Listing not found.' });
        if (listing.hostId.toString() !== hostId) {
            return res.status(403).json({ message: 'You do not own this listing.' });
        }

        const bookings = await Booking.find({ listingId })
            .populate('listingId', 'name location price image type isRemoved')
            .populate('guestId', 'name email')
            .sort({ createdAt: -1 });

        res.status(200).json(bookings);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching booking requests.', error: err.message });
    }
});

// ─── PUT /api/bookings/:id/status ─── Host approves or rejects ───────────────
router.put('/:id/status', checkRole(['Host']), async (req, res) => {
    try {
        const hostId  = req.userId;
        const { status } = req.body;

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Status must be "approved" or "rejected".' });
        }

        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ message: 'Booking not found.' });

        // Verify host owns the associated listing
        const listing = await Listing.findById(booking.listingId);
        if (!listing) return res.status(404).json({ message: 'Associated listing not found.' });
        if (listing.hostId.toString() !== hostId) {
            return res.status(403).json({ message: 'You do not own this listing.' });
        }

        // ── If approving: re-check overlap against OTHER already-approved bookings ──
        if (status === 'approved') {
            const otherApproved = await Booking.find({
                listingId: booking.listingId,
                status:    'approved',
                _id:       { $ne: booking._id }
            });

            const conflict = otherApproved.find(b =>
                datesOverlap(
                    new Date(booking.startDate), new Date(booking.endDate),
                    new Date(b.startDate),       new Date(b.endDate)
                )
            );

            if (conflict) {
                return res.status(409).json({
                    message: `Cannot approve: these dates conflict with an already-approved booking (${new Date(conflict.startDate).toLocaleDateString()} – ${new Date(conflict.endDate).toLocaleDateString()}).`
                });
            }
        }

        booking.status = status;
        const updated  = await booking.save();
        res.status(200).json(updated);
    } catch (err) {
        res.status(400).json({ message: 'Error updating booking status.', error: err.message });
    }
});

// ─── GET /api/bookings ─── Admin sees ALL bookings system-wide ───────────────
router.get('/', checkRole(['Admin']), async (req, res) => {
    try {
        const bookings = await Booking.find()
            .populate('listingId', 'name location type price isRemoved')
            .populate('guestId',   'name email')
            .sort({ createdAt: -1 });

        res.status(200).json(bookings);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching all bookings.', error: err.message });
    }
});

router.delete('/:id', checkRole(['Guest', 'Host']), async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ message: 'Booking not found.' });

        if (req.userRole === 'Guest') {
            // Verify this booking belongs to the logged-in Guest
            if (booking.guestId.toString() !== req.userId) {
                return res.status(403).json({ message: 'You do not own this booking.' });
            }
        } else if (req.userRole === 'Host') {
            // Verify host owns the listing associated with this booking
            if (booking.listingId) {
                const listing = await Listing.findById(booking.listingId);
                if (listing && listing.hostId.toString() !== req.userId) {
                    return res.status(403).json({ message: 'You do not own the listing associated with this booking.' });
                }
            }
        }

        await Booking.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: 'Booking deleted successfully.' });
    } catch (err) {
        res.status(500).json({ message: 'Error deleting booking.', error: err.message });
    }
});

module.exports = router;
