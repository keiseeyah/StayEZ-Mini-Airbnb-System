const express   = require('express');
const router    = express.Router();
const Listing   = require('../models/Listing');
const checkRole = require('../middleware/roleCheck');

// ─── GET /api/listings/host ─── Host sees their own listings ─────────────────
// MUST be defined BEFORE /:id to prevent "host" being parsed as a MongoDB ID
router.get('/host', checkRole(['Host']), async (req, res) => {
    try {
        const listings = await Listing.find({ hostId: req.userId });
        res.status(200).json(listings);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching your listings.', error: err.message });
    }
});

// ─── GET /api/listings ─── Public: search by name, filter by location/type, sort by price ──
router.get('/', async (req, res) => {
    try {
        const { search, location, type, sort } = req.query;
        const query = { isRemoved: { $ne: true } };

        if (search)   query.name     = { $regex: search,   $options: 'i' };
        if (location) query.location = { $regex: location, $options: 'i' };
        if (type)     query.type     = { $regex: type,     $options: 'i' };

        const sortOption =
            sort === 'price_asc'  ? { price:  1 } :
            sort === 'price_desc' ? { price: -1 } : {};

        const listings = await Listing.find(query).sort(sortOption).populate('hostId', 'name');
        res.status(200).json(listings);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching listings.', error: err.message });
    }
});

// ─── POST /api/listings ─── Hosts create a listing ───────────────────────────
router.post('/', checkRole(['Host']), async (req, res) => {
    try {
        // hostId is taken from the auth header — never trust the client body
        const newListing = new Listing({ ...req.body, hostId: req.userId });
        const saved      = await newListing.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(400).json({ message: 'Error creating listing.', error: err.message });
    }
});

// ─── GET /api/listings/:id ─── Single listing (public) ───────────────────────
router.get('/:id', async (req, res) => {
    try {
        const listing = await Listing.findById(req.params.id);
        if (!listing || listing.isRemoved) return res.status(404).json({ message: 'Listing not found.' });
        res.status(200).json(listing);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching listing.', error: err.message });
    }
});

// ─── PUT /api/listings/:id ─── Hosts update their own listing ────────────────
router.put('/:id', checkRole(['Host']), async (req, res) => {
    try {
        const listing = await Listing.findById(req.params.id);
        if (!listing) return res.status(404).json({ message: 'Listing not found.' });
        if (listing.hostId.toString() !== req.userId) {
            return res.status(403).json({ message: 'You do not own this listing.' });
        }

        const updated = await Listing.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.status(200).json(updated);
    } catch (err) {
        res.status(400).json({ message: 'Error updating listing.', error: err.message });
    }
});

// ─── DELETE /api/listings/:id ─── Hosts delete own; Admins delete any ────────
router.delete('/:id', checkRole(['Host', 'Admin']), async (req, res) => {
    try {
        const listing = await Listing.findById(req.params.id);
        if (!listing) return res.status(404).json({ message: 'Listing not found.' });

        // Hosts may only delete their own listing
        if (req.userRole === 'Host' && listing.hostId.toString() !== req.userId) {
            return res.status(403).json({ message: 'You do not own this listing.' });
        }

        if (listing.isRemoved) {
            // Already soft-deleted: hard-delete from the database
            await Listing.findByIdAndDelete(req.params.id);
            // Cascade delete any bookings referencing this listing
            const Booking = require('../models/Booking');
            await Booking.deleteMany({ listingId: req.params.id });
            res.status(200).json({ message: 'Listing permanently deleted from records.' });
        } else {
            // Soft-delete
            listing.isRemoved = true;
            await listing.save();
            res.status(200).json({ message: 'Listing deleted successfully.' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Error deleting listing.', error: err.message });
    }
});

module.exports = router;