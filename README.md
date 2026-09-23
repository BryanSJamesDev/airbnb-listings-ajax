# SF Fifty: AirBnB Listings, AJAX Edition

**Live site:** https://bryansjamesdev.github.io/airbnb-listings-ajax/

A single static page that loads the first 50 San Francisco Airbnb listings
from a local JSON file using `fetch`/`await`, and renders them as a
searchable, sortable grid. No framework, no build step, no server.

Built for the CS5610 "AJAX / fetch" assignment, starting from the class
demo at https://github.com/john-guerra/Airbnb_Listings_demo_page
and rewritten from scratch.

## What it shows per listing

- Thumbnail photo
- Name
- Description (HTML stripped, truncated to 3 lines, full text in the detail view)
- Amenities (first 4 as pills, "+N more", full list in the detail view)
- Host name and host photo, plus a "Superhost" badge when applicable
- Price per night
- Star rating, when the listing has one

Click a card to open a detail overlay with the full description, the full
amenities list, and host info.

## Creative addition: the Trip Planner

Every card has a heart button. Hearting a listing adds it to a **Trip
Planner** panel on the right, which:

- Keeps a running list of the listings you've picked, with a remove button on each
- Shows the **combined nightly rate** across everything in the trip
- Shows the **average host rating** across the trip
- Saves to `localStorage`, so your trip survives a page reload

It's a small planning tool layered on top of the listing data rather than
just another display of it, letting you build out "night 1, night 2, night 3"
style combinations and see the running cost as you go.

The page also has a live **search** box (matches name, neighborhood, host,
and property type) and a **sort** dropdown (price low→high, price high→low,
rating), both applied client-side against the same 50 listings already in
memory, with no extra network calls.

## How the data loads

`js/main.js` fetches `airbnb_sf_listings_500.json` once on page load:

```js
async function loadListings() {
  const response = await fetch(DATA_URL);
  const allListings = await response.json();
  const firstFifty = allListings.slice(0, LISTING_COUNT); // LISTING_COUNT = 50
  // ...render
}
```

The dataset is the class-provided `airbnb_sf_listings_500.json`
(Airbnb Inside SF listings export), included in this repo so the page
works with no backend: it's just a static file next to `index.html`.

## Running it locally

Because the page uses `fetch()` against a local file, it needs to be served
over `http://`, not opened directly as a `file://` URL (browsers block
`fetch` on `file://`). From the project folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

or, with Node installed:

```bash
npx serve .
```

## Deploying (GitHub Pages)

1. Push this repo to GitHub.
2. In the repo settings, go to **Pages**.
3. Under "Build and deployment", set **Source** to `Deploy from a branch`,
   branch `main`, folder `/ (root)`.
4. Save. GitHub will publish the site at
   `https://bryansjamesdev.github.io/airbnb-listings-ajax/` within a
   minute or two.

## File structure

.
├── index.html # page structure
├── css/main.css # all styling (no CSS framework)
├── js/main.js # fetch/await data load + all interactivity
├── airbnb_sf_listings_500.json # dataset (500 SF listings; only first 50 are used)
└── README.md


## Notes

- All listing photos and host photos are hotlinked directly from Airbnb's
  own image CDN (`a0.muscache.com`), exactly as they appear in the dataset.
- No external JS framework or CSS framework is used: just vanilla `fetch`,
  DOM APIs, and hand-written CSS, per the assignment's AJAX focus.