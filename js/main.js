/**
 * SF Fifty — loads the first 50 San Francisco Airbnb listings from a local
 * JSON file with fetch/await, then renders them as cards. The "creative
 * addition" is the Trip Planner on the right: hearting a listing adds it to
 * a running trip, kept in localStorage, with a live total nightly cost and
 * average host rating.
 */

const DATA_URL = "./airbnb_sf_listings_500.json";
const LISTING_COUNT = 50;
const TRIP_STORAGE_KEY = "sf-fifty-trip";

const els = {
  listings: document.querySelector("#listings"),
  emptyState: document.querySelector("#empty-state"),
  resultsCount: document.querySelector("#results-count"),
  searchInput: document.querySelector("#search-input"),
  sortSelect: document.querySelector("#sort-select"),
  statCount: document.querySelector("#stat-count"),
  statAvgPrice: document.querySelector("#stat-avg-price"),
  statSuperhosts: document.querySelector("#stat-superhosts"),
  tripList: document.querySelector("#trip-list"),
  tripEmpty: document.querySelector("#trip-empty"),
  tripSummary: document.querySelector("#trip-summary"),
  tripCount: document.querySelector("#trip-count"),
  tripTotal: document.querySelector("#trip-total"),
  tripAvgRating: document.querySelector("#trip-avg-rating"),
  tripClear: document.querySelector("#trip-clear"),
  overlay: document.querySelector("#detail-overlay"),
  detailContent: document.querySelector("#detail-content"),
  detailClose: document.querySelector("#detail-close"),
};

// All 50 loaded listings, keyed by id, so the trip panel and the detail
// modal can look one up even after the visible grid has been filtered.
let listingsById = new Map();
let currentView = [];
let tripIds = loadTrip();

/* ----------------------------- data helpers ----------------------------- */

function parsePrice(rawPrice) {
  if (!rawPrice) return 0;
  const num = parseFloat(String(rawPrice).replace(/[^0-9.]/g, ""));
  return Number.isFinite(num) ? num : 0;
}

function parseAmenities(rawAmenities) {
  if (!rawAmenities) return [];
  try {
    const parsed = JSON.parse(rawAmenities);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function stripHtml(html) {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatMoney(amount) {
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

/* ------------------------------ rendering -------------------------------- */

function renderSkeleton(count = 9) {
  els.listings.innerHTML = Array.from({ length: count })
    .map(
      () => `
      <div class="skeleton">
        <div class="thumb-wrap"></div>
        <div class="line"></div>
        <div class="line short"></div>
      </div>`
    )
    .join("");
}

function amenityPillsHtml(amenities) {
  const shown = amenities.slice(0, 4);
  const remaining = amenities.length - shown.length;
  let html = shown.map((a) => `<span class="pill">${escapeHtml(a)}</span>`).join("");
  if (remaining > 0) {
    html += `<span class="pill more">+${remaining} more</span>`;
  }
  return html;
}

function listingCardHtml(listing) {
  const price = parsePrice(listing.price);
  const amenities = parseAmenities(listing.amenities);
  const description = stripHtml(listing.description);
  const isFav = tripIds.has(listing.id);
  const rating =
    typeof listing.review_scores_rating === "number"
      ? listing.review_scores_rating.toFixed(2)
      : null;

  return `
    <article class="listing-card" data-id="${listing.id}" tabindex="0">
      <div class="thumb-wrap">
        <img
          src="${escapeHtml(listing.picture_url || "")}"
          alt="${escapeHtml(listing.name || "Listing photo")}"
          loading="lazy"
        />
        ${
          listing.host_is_superhost === "t"
            ? '<span class="superhost-badge">Superhost</span>'
            : ""
        }
        <button
          type="button"
          class="heart-btn ${isFav ? "is-active" : ""}"
          data-action="toggle-trip"
          data-id="${listing.id}"
          aria-pressed="${isFav}"
          aria-label="${isFav ? "Remove from trip" : "Add to trip"}"
        >${isFav ? "&#9829;" : "&#9825;"}</button>
      </div>
      <div class="card-body">
        <div class="card-top-row">
          <h3 class="card-title">${escapeHtml(listing.name)}</h3>
          <div class="card-price">${formatMoney(price)}<small> /night</small></div>
        </div>
        <p class="card-meta">
          ${escapeHtml(listing.neighbourhood_cleansed || "San Francisco")} ·
          ${escapeHtml(listing.room_type || "")}
        </p>
        <p class="card-desc">${escapeHtml(description)}</p>
        <div class="amenity-pills">${amenityPillsHtml(amenities)}</div>
        <div class="host-row">
          <img
            class="host-photo"
            src="${escapeHtml(listing.host_picture_url || "")}"
            alt="${escapeHtml(listing.host_name || "Host")}"
            loading="lazy"
          />
          <div class="host-name">
            ${escapeHtml(listing.host_name || "Host")}
            <span>Hosting since ${
              listing.host_since ? new Date(listing.host_since).getFullYear() : "—"
            }</span>
          </div>
          ${rating ? `<span class="rating-chip">★ ${rating}</span>` : ""}
        </div>
      </div>
    </article>`;
}

function renderListings(listings) {
  currentView = listings;

  if (listings.length === 0) {
    els.listings.innerHTML = "";
    els.emptyState.hidden = false;
  } else {
    els.emptyState.hidden = true;
    els.listings.innerHTML = listings.map(listingCardHtml).join("\n");
  }

  els.resultsCount.textContent = `${listings.length} of ${listingsById.size} listings shown`;
}

function renderStats(listings) {
  const prices = listings.map((l) => parsePrice(l.price)).filter((p) => p > 0);
  const avgPrice = prices.length
    ? prices.reduce((sum, p) => sum + p, 0) / prices.length
    : 0;
  const superhostCount = listings.filter((l) => l.host_is_superhost === "t").length;

  els.statCount.textContent = listings.length;
  els.statAvgPrice.textContent = formatMoney(avgPrice);
  els.statSuperhosts.textContent = superhostCount;
}

/* -------------------------- search / sort -------------------------- */

function applyFilters() {
  const query = els.searchInput.value.trim().toLowerCase();
  const sortMode = els.sortSelect.value;

  let filtered = [...listingsById.values()];

  if (query) {
    filtered = filtered.filter((l) => {
      const haystack = [
        l.name,
        l.neighbourhood_cleansed,
        l.host_name,
        l.property_type,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }

  if (sortMode === "price-asc") {
    filtered.sort((a, b) => parsePrice(a.price) - parsePrice(b.price));
  } else if (sortMode === "price-desc") {
    filtered.sort((a, b) => parsePrice(b.price) - parsePrice(a.price));
  } else if (sortMode === "rating-desc") {
    filtered.sort(
      (a, b) => (b.review_scores_rating || 0) - (a.review_scores_rating || 0)
    );
  }

  renderListings(filtered);
}

/* ------------------------------ trip panel ------------------------------- */

function loadTrip() {
  try {
    const raw = localStorage.getItem(TRIP_STORAGE_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    return new Set(ids);
  } catch (err) {
    return new Set();
  }
}

function saveTrip() {
  localStorage.setItem(TRIP_STORAGE_KEY, JSON.stringify([...tripIds]));
}

function toggleTrip(id) {
  if (tripIds.has(id)) {
    tripIds.delete(id);
  } else {
    tripIds.add(id);
  }
  saveTrip();
  renderTrip();

  // Update just the affected heart button + re-render the current view so
  // the card's active state matches, without losing the search/sort state.
  applyFilters();
}

function renderTrip() {
  const items = [...tripIds]
    .map((id) => listingsById.get(id))
    .filter(Boolean);

  if (items.length === 0) {
    els.tripList.innerHTML = "";
    els.tripEmpty.hidden = false;
    els.tripSummary.hidden = true;
    return;
  }

  els.tripEmpty.hidden = true;
  els.tripSummary.hidden = false;

  els.tripList.innerHTML = items
    .map(
      (listing) => `
      <li class="trip-item">
        <img src="${escapeHtml(listing.picture_url || "")}" alt="" />
        <div class="trip-item-info">
          <div class="trip-item-name">${escapeHtml(listing.name)}</div>
          <div class="trip-item-price">${formatMoney(
            parsePrice(listing.price)
          )} /night</div>
        </div>
        <button
          type="button"
          class="trip-item-remove"
          data-action="toggle-trip"
          data-id="${listing.id}"
          aria-label="Remove from trip"
        >&times;</button>
      </li>`
    )
    .join("");

  const total = items.reduce((sum, l) => sum + parsePrice(l.price), 0);
  const ratings = items
    .map((l) => l.review_scores_rating)
    .filter((r) => typeof r === "number");
  const avgRating = ratings.length
    ? (ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(2)
    : "—";

  els.tripCount.textContent = items.length;
  els.tripTotal.textContent = `${formatMoney(total)} /night`;
  els.tripAvgRating.textContent = ratings.length ? `★ ${avgRating}` : "—";
}

function clearTrip() {
  tripIds.clear();
  saveTrip();
  renderTrip();
  applyFilters();
}

/* ------------------------------ detail modal ------------------------------ */

function openDetail(id) {
  const listing = listingsById.get(id);
  if (!listing) return;

  const amenities = parseAmenities(listing.amenities);
  const description = stripHtml(listing.description);
  const rating =
    typeof listing.review_scores_rating === "number"
      ? listing.review_scores_rating.toFixed(2)
      : null;

  els.detailContent.innerHTML = `
    <img class="detail-thumb" src="${escapeHtml(
      listing.picture_url || ""
    )}" alt="${escapeHtml(listing.name || "")}" />
    <h2 id="detail-title">${escapeHtml(listing.name)}</h2>
    <p class="detail-meta">
      ${escapeHtml(listing.neighbourhood_cleansed || "San Francisco")} ·
      ${escapeHtml(listing.room_type || "")} ·
      ${formatMoney(parsePrice(listing.price))} / night
      ${rating ? ` · ★ ${rating} (${listing.number_of_reviews || 0} reviews)` : ""}
    </p>

    <div class="detail-host">
      <img src="${escapeHtml(listing.host_picture_url || "")}" alt="" />
      <div>
        <strong>${escapeHtml(listing.host_name || "Host")}</strong>
        ${listing.host_is_superhost === "t" ? " · Superhost" : ""}
        <div class="card-meta">
          Hosting since ${
            listing.host_since ? new Date(listing.host_since).getFullYear() : "—"
          }
        </div>
      </div>
    </div>

    <div class="detail-section">
      <h3>About this place</h3>
      <p>${escapeHtml(description) || "No description provided."}</p>
    </div>

    <div class="detail-section">
      <h3>Amenities (${amenities.length})</h3>
      <div class="detail-amenities">
        ${amenities.map((a) => `<span class="pill">${escapeHtml(a)}</span>`).join("")}
      </div>
    </div>
  `;

  els.overlay.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeDetail() {
  els.overlay.hidden = true;
  document.body.style.overflow = "";
}

/* -------------------------------- events --------------------------------- */

els.listings.addEventListener("click", (event) => {
  const heartBtn = event.target.closest('[data-action="toggle-trip"]');
  if (heartBtn) {
    event.stopPropagation();
    toggleTrip(Number(heartBtn.dataset.id));
    return;
  }

  const card = event.target.closest(".listing-card");
  if (card) {
    openDetail(Number(card.dataset.id));
  }
});

els.listings.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const card = event.target.closest(".listing-card");
  if (card) {
    event.preventDefault();
    openDetail(Number(card.dataset.id));
  }
});

els.tripList.addEventListener("click", (event) => {
  const btn = event.target.closest('[data-action="toggle-trip"]');
  if (btn) toggleTrip(Number(btn.dataset.id));
});

els.tripClear.addEventListener("click", clearTrip);
els.detailClose.addEventListener("click", closeDetail);
els.overlay.addEventListener("click", (event) => {
  if (event.target === els.overlay) closeDetail();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !els.overlay.hidden) closeDetail();
});

els.searchInput.addEventListener("input", applyFilters);
els.sortSelect.addEventListener("change", applyFilters);

/* --------------------------------- boot ----------------------------------- */

async function loadListings() {
  renderSkeleton();

  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    const allListings = await response.json();
    const firstFifty = allListings.slice(0, LISTING_COUNT);

    listingsById = new Map(firstFifty.map((listing) => [listing.id, listing]));

    renderStats(firstFifty);
    renderTrip();
    applyFilters();
  } catch (err) {
    els.listings.innerHTML = `
      <p class="empty-state">
        Couldn't load listings (${escapeHtml(err.message)}). If you're
        opening this file directly from disk, serve the folder with a
        local server instead — browsers block <code>fetch</code> on
        <code>file://</code> URLs.
      </p>`;
  }
}

loadListings();