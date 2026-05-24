/* ─── Auth & Session Helpers ─────────────────────────────────────────────────── */
function getUser() {
    try { return JSON.parse(localStorage.getItem('stayez_user')); } catch { return null; }
}
function saveUser(user) {
    localStorage.setItem('stayez_user', JSON.stringify(user));
}
function logout() {
    localStorage.removeItem('stayez_user');
    window.location.href = '/index.html';
}

/** Redirect if user doesn't have one of the required roles. Returns the user object or null. */
function requireAuth(roles) {
    const user = getUser();
    if (!user) { window.location.href = '/index.html'; return null; }
    if (roles && !roles.includes(user.role)) {
        const home = user.role === 'Guest'  ? '/index.html'        :
                     user.role === 'Host'   ? '/host-listings.html' :
                                              '/admin-listings.html';
        window.location.href = home;
        return null;
    }
    return user;
}

/* ─── API Helper ─────────────────────────────────────────────────────────────── */
function getHeaders() {
    const user = getUser();
    const h = { 'Content-Type': 'application/json' };
    if (user) { h['user-id'] = user._id; h['user-role'] = user.role; }
    return h;
}

async function api(method, path, body) {
    const opts = { method, headers: getHeaders() };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res  = await fetch('/api' + path, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data;
}

/* ─── Toast Notification ─────────────────────────────────────────────────────── */
function showToast(message, type = 'info') {
    const old = document.querySelector('.toast');
    if (old) old.remove();

    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ'}</span><span>${message}</span>`;
    document.body.appendChild(t);

    requestAnimationFrame(() => t.classList.add('toast-show'));
    setTimeout(() => {
        t.classList.remove('toast-show');
        setTimeout(() => t.remove(), 320);
    }, 3500);
}

/* ─── Navigation Renderer ────────────────────────────────────────────────────── */
function renderNav(activePage) {
    const nav  = document.getElementById('main-nav');
    if (!nav) return;
    const user = getUser();

    const roleLinks = {
        Guest: [
            { href: '/index.html',        label: 'Home' },
            { href: '/listings.html',     label: 'Browse' },
            { href: '/my-bookings.html',  label: 'My Bookings' },
        ],
        Host: [
            { href: '/host-listings.html',  label: 'My Listings' },
            { href: '/host-bookings.html',  label: 'Requests' },
        ],
        Admin: [
            { href: '/admin-listings.html', label: 'Listings' },
            { href: '/admin-bookings.html', label: 'Bookings' },
            { href: '/admin-users.html',    label: 'Users' },
        ],
    };

    const links = user ? (roleLinks[user.role] || []) : [];
    const homeHref = !user ? '/index.html' :
                     user.role === 'Guest'  ? '/index.html' :
                     user.role === 'Host'   ? '/host-listings.html' :
                                              '/admin-listings.html';

    nav.innerHTML = `
        <div class="nav-inner">
            <a href="${homeHref}" class="nav-brand">
                <div class="nav-logo-circle">🗺️</div> StayEZ
            </a>
            <div class="nav-links" id="nav-links-inner">
                ${links.map(l => `
                    <a href="${l.href}" class="nav-link ${activePage === l.href ? 'active' : ''}">${l.label}</a>
                `).join('')}
                ${user ? `
                    <div class="nav-user">
                        <div class="nav-avatar">${user.name[0].toUpperCase()}</div>
                        <span class="nav-username" style="color: var(--text-primary); font-weight: 700;">${user.name.split(' ')[0]}</span>
                    </div>
                    <button onclick="logout()" class="btn btn-primary btn-sm" style="border-radius: 20px;">Log Out</button>
                ` : `
                    <a href="/index.html"    class="btn btn-outline btn-sm">Login</a>
                    <a href="/register.html" class="btn btn-primary btn-sm">Sign Up</a>
                `}
            </div>
            <button class="nav-toggle" onclick="document.getElementById('nav-links-inner').classList.toggle('open')">☰</button>
        </div>
    `;
}

/* ─── Listing Card Builder ───────────────────────────────────────────────────── */
function listingCard(listing) {
    const price = listing.price ? `₱${Number(listing.price).toLocaleString()}` : '—';
    const img   = listing.image || '/images/bedroom-balcony.jpg';
    return `
        <div class="listing-card">
            <div class="listing-img-wrap">
                <img src="${img}" alt="${listing.name}"
                     onerror="this.src='/images/bedroom-balcony.jpg'"
                     loading="lazy">
                <span class="ribbon-badge">${listing.type}</span>
            </div>
            <div class="listing-info">
                <h3 class="listing-name">${listing.name}</h3>
                <p class="listing-location">📍 ${listing.location}</p>
                <p class="listing-desc">${listing.description || ''}</p>
                <div class="listing-footer">
                    <span class="listing-price">${price}<span class="listing-price-label">/night</span></span>
                    <a href="/listing-details.html?id=${listing._id}" class="btn-view-details">View Details</a>
                </div>
            </div>
        </div>
    `;
}

/* ─── Utility Formatters ─────────────────────────────────────────────────────── */
function formatDate(d) {
    return new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}
function statusBadge(status) {
    return `<span class="status-pill ${status.toLowerCase()}">${status}</span>`;
}
