// Find our date picker inputs on the page
const startInput = document.getElementById('startDate');
const endInput = document.getElementById('endDate');

// Call the setupDateInputs function from dateRange.js
// This sets up the date pickers to:
// - Default to a range of 9 days (from 9 days ago to today)
// - Restrict dates to NASA's image archive (starting from 1995)
setupDateInputs(startInput, endInput);

const getImagesButton = document.getElementById('getImages');
const gallery = document.getElementById('gallery');

function toApodDate(date) {
  return date.slice(2).replaceAll('-', '');
}

const pagination = document.getElementById('galleryPagination');
const previousPage = document.getElementById('previousPage');
const nextPage = document.getElementById('nextPage');
const pageLabel = document.getElementById('pageLabel');

const daysPerPage = 24;
const millisecondsPerDay = 24 * 60 * 60 * 1000;
let selectedRange;

function addDays(date, days) {
  const timestamp = Date.parse(date) + days * millisecondsPerDay;
  return new Date(timestamp).toISOString().slice(0, 10);
}

getImagesButton.addEventListener('click', () => {
  pagination.hidden = true;
  const startDate = startInput.value;
  const endDate = endInput.value;

  if (!startDate || !endDate || !startInput.validity.valid ||
    !endInput.validity.valid || startDate > endDate) {
    gallery.textContent = 'Choose a valid start and end date in order.';
    return;
  }

  selectedRange = { startDate, endDate };
  loadPage(0);
});

async function loadPage(pageIndex) {
  const { startDate, endDate } = selectedRange;
  const totalDays =
    (Date.parse(endDate) - Date.parse(startDate)) / millisecondsPerDay + 1;
  const pageCount = Math.ceil(totalDays / daysPerPage);

  const pageStart = addDays(startDate, pageIndex * daysPerPage);
  const lastDayOfPage = addDays(pageStart, daysPerPage - 1);
  const pageEnd = lastDayOfPage < endDate ? lastDayOfPage : endDate;

  pagination.hidden = pageCount === 1;
  pageLabel.textContent = `Page ${pageIndex + 1} of ${pageCount}`;
  previousPage.disabled = true;
  nextPage.disabled = true;

  const apiUrl = new URL('https://science.nasa.gov/wp-json/wp/v2/apod-basic');
  apiUrl.searchParams.set('date_from', toApodDate(pageStart));
  apiUrl.searchParams.set('date_to', toApodDate(pageEnd));
  apiUrl.searchParams.set('per_page', '25');

  gallery.textContent = 'Loading space photos…';
  getImagesButton.disabled = true;

  try {
    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`NASA API returned HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log('NASA APOD response:', data);
    gallery.replaceChildren();

    if (data.length === 0) {
      gallery.textContent = 'No APOD entries found for these dates.';
      return;
    }

    data.sort((first, second) => first.date.localeCompare(second.date));

    for (const entry of data) {
      const card = document.createElement('article');
      card.className = 'gallery-card';

      const title = document.createElement('h2');
      title.textContent = entry.title;

      const date = document.createElement('time');
      date.dateTime = entry.date;
      date.textContent = entry.date;

      if (entry.media_type === 'image' && entry.hdurl) {
        const image = document.createElement('img');
        image.src = entry.hdurl;
        image.alt = entry.title;
        image.loading = 'lazy';
        const openButton = document.createElement('button');
        openButton.type = 'button';
        openButton.className = 'gallery-image-button';
        openButton.setAttribute('aria-label', `View details for ${entry.title}`);
        openButton.append(image);

        openButton.addEventListener('click', () => {
          document.getElementById('apodTitle').textContent = entry.title;
          document.getElementById('apodDate').textContent = entry.date;

          const modalImage = document.getElementById('apodImage');
          modalImage.src = entry.hdurl;
          modalImage.alt = entry.title;

          // NASA sends the explanation with HTML tags. Extract the readable text.
          const explanation = new DOMParser().parseFromString(
            entry.explanation || '',
            'text/html'
          );
          document.getElementById('apodExplanation').textContent =
            explanation.body.textContent;

          document.getElementById('apodDialog').showModal();
        });

        card.append(openButton);
      } else {
        const link = document.createElement('a');
        link.href = entry.permalink;
        link.textContent = entry.media_type === 'video'
          ? 'Watch on NASA’s site'
          : 'View on NASA’s site';
        card.append(link);

        if (entry.media_type === 'video') {
          link.classList.add('video-preview');

          if (entry.hdurl) {
            const preview = new Image();

            preview.addEventListener('load', () => {
              link.style.backgroundImage =
                `linear-gradient(transparent, #07111dcc), url("${preview.src}")`;
              link.classList.add('has-thumbnail');
            }, { once: true });

            preview.src = entry.hdurl;
          }
        }
      }

      card.append(title, date);
      gallery.append(card);
    }
  } catch (error) {
    console.error('Could not load APOD entries:', error);
    gallery.textContent = 'Could not load space photos. Please try again.';
  } finally {
    getImagesButton.disabled = false;
    previousPage.disabled = pageIndex === 0;
    nextPage.disabled = pageIndex >= pageCount - 1;
    previousPage.onclick = () => loadPage(pageIndex - 1);
    nextPage.onclick = () => loadPage(pageIndex + 1);
  }
}