const movieGridEl = document.getElementById('movie-grid');
const showtimeListEl = document.getElementById('showtime-list');
const seatGridEl = document.getElementById('seat-grid');
const seatTitleEl = document.getElementById('seat-title');
const summaryEl = document.getElementById('summary');
const resultEl = document.getElementById('result');
const paymentLinkBoxEl = document.getElementById('payment-link-box');
const reserveBtnEl = document.getElementById('reserve-btn');
const hallModalEl = document.getElementById('hall-modal');
const openHallModalEls = document.querySelectorAll('[data-open-hall]');
const closeHallModalEl = document.getElementById('close-hall-modal');
const modalCloseAreaEl = document.getElementById('modal-close-area');

let showtimes = [];
let selectedShowtime = null;
let selectedSeats = [];
let seatMap = [];

function formatDate(value) {
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatPrice(value) {
  return new Intl.NumberFormat('ru-RU').format(value) + ' ₽';
}

function groupByMovie(items) {
  const map = new Map();

  for (const item of items) {
    if (!map.has(item.movieId)) {
      map.set(item.movieId, {
        movieId: item.movieId,
        part: item.part,
        title: item.title,
        duration: item.duration,
        age: item.age,
        banner: item.banner,
        startsAt: item.startsAt,
        salesOpensAt: item.salesOpensAt,
        variants: []
      });
    }
    map.get(item.movieId).variants.push(item);
  }

  return Array.from(map.values()).sort((a, b) => a.part - b.part);
}

function updateSummary() {
  if (!selectedShowtime) {
    summaryEl.textContent = 'Выбери зал и сеанс части 1, затем отметь места.';
    return;
  }

  const total = selectedSeats.length * selectedShowtime.price;
  const salesInfo = selectedShowtime.bookable
    ? 'Продажи открыты'
    : `Продажи откроются: ${formatDate(selectedShowtime.salesOpensAt)}`;

  summaryEl.textContent =
    `${selectedShowtime.title}\n` +
    `${formatDate(selectedShowtime.startsAt)} | ${selectedShowtime.hall}\n` +
    `Тип места: ${selectedShowtime.seatType} (${formatPrice(selectedShowtime.price)})\n` +
    `${salesInfo}\n` +
    `Выбрано мест: ${selectedSeats.length ? selectedSeats.join(', ') : 'не выбраны'}\n` +
    `Итого: ${formatPrice(total)}`;
}

function updatePaymentBox() {
  if (!selectedShowtime) {
    paymentLinkBoxEl.textContent = 'После выбора мест появится сценарий оплаты.';
    return;
  }

  if (!selectedShowtime.bookable) {
    paymentLinkBoxEl.textContent = `Продажи еще не открыты. Старт продаж: ${formatDate(selectedShowtime.salesOpensAt)}.`;
    return;
  }

  if (selectedShowtime.paymentLink) {
    paymentLinkBoxEl.innerHTML = `<a class="pay-link-btn" href="${selectedShowtime.paymentLink}" target="_blank" rel="noopener noreferrer">Перейти к оплате (${formatPrice(selectedShowtime.price)} за место)</a>`;
    return;
  }

  paymentLinkBoxEl.textContent = 'Ссылка на оплату для этого зала появится позже. Сейчас можно зафиксировать бронь мест.';
}

function renderCatalog() {
  const movies = groupByMovie(showtimes);
  movieGridEl.innerHTML = '';

  for (const movie of movies) {
    const card = document.createElement('article');
    card.className = 'movie-card';
    if (movie.part === 1) {
      card.classList.add('focus-card');
    }

    const isUpcoming = movie.part !== 1;
    const salesLabel = isUpcoming
      ? `Продажи откроются: ${formatDate(movie.salesOpensAt)}`
      : 'Закрытый кинопоказ: продажи активны';

    const variants = movie.variants
      .map((variant) => {
        const disabled = variant.bookable ? '' : 'disabled';
        const label = `${variant.hallShort} • ${formatPrice(variant.price)}`;
        return `<button class="hall-chip" data-showtime-id="${variant.showtimeId}" ${disabled}>${label}</button>`;
      })
      .join('');

    card.innerHTML = `
      <img class="poster" src="${movie.banner}" alt="${movie.title}" loading="lazy" />
      <div class="card-body">
        <p class="part-label">Часть ${movie.part}</p>
        <h3>${movie.title}</h3>
        <p class="card-meta">${movie.duration} мин • ${movie.age}</p>
        <p class="single-date">${formatDate(movie.startsAt)}</p>
        <p class="sales-label">${salesLabel}</p>
        <div class="hall-chips">${variants}</div>
      </div>
    `;

    card.addEventListener('click', async (event) => {
      const button = event.target.closest('.hall-chip');
      if (!button || button.disabled) {
        return;
      }
      const found = showtimes.find((s) => s.showtimeId === button.dataset.showtimeId);
      if (!found) {
        return;
      }
      await selectShowtime(found);
      document.getElementById('booking').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    movieGridEl.append(card);
  }
}

function renderShowtimes() {
  showtimeListEl.innerHTML = '';

  for (const showtime of showtimes) {
    const card = document.createElement('article');
    card.className = 'showtime-card';

    if (selectedShowtime?.showtimeId === showtime.showtimeId) {
      card.classList.add('active');
    }

    if (!showtime.bookable) {
      card.classList.add('locked');
    }

    card.innerHTML = `
      <strong>Часть ${showtime.part} • ${showtime.hallShort}</strong>
      <div class="meta">${formatDate(showtime.startsAt)}</div>
      <div class="meta">${showtime.seatType} • ${formatPrice(showtime.price)}</div>
      <div class="meta">${showtime.bookable ? 'Продажи открыты' : `Продажи с ${formatDate(showtime.salesOpensAt)}`}</div>
    `;

    card.addEventListener('click', async () => {
      await selectShowtime(showtime);
    });

    showtimeListEl.append(card);
  }
}

function renderSeats() {
  seatGridEl.innerHTML = '';

  if (!selectedShowtime || !selectedShowtime.bookable) {
    seatGridEl.innerHTML = '<p class="empty-hint">Продажи по этому сеансу еще не открыты. Выбери другой зал или дождись старта.</p>';
    return;
  }

  const maxRow = Math.max(...seatMap.map((s) => s.row));
  for (const seat of seatMap) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `seat ${seat.status}`;
    btn.textContent = `${seat.row}-${seat.number}`;
    btn.style.gridColumn = `${seat.colStart} / span ${seat.span || 1}`;
    btn.style.gridRow = `${maxRow - seat.row + 1}`;

    if (selectedSeats.includes(seat.code)) {
      btn.classList.add('selected');
    }

    if (seat.status === 'occupied') {
      btn.disabled = true;
    }

    btn.addEventListener('click', () => {
      if (seat.status !== 'free') {
        return;
      }
      if (selectedSeats.includes(seat.code)) {
        selectedSeats = selectedSeats.filter((x) => x !== seat.code);
      } else {
        selectedSeats.push(seat.code);
        selectedSeats.sort();
      }
      renderSeats();
      updateSummary();
    });

    seatGridEl.append(btn);
  }
}

async function loadShowtimes() {
  const response = await fetch('/api/showtimes');
  showtimes = await response.json();
  renderCatalog();
  renderShowtimes();
}

async function loadSeats(showtimeId) {
  const response = await fetch(`/api/showtimes/${showtimeId}/seats`);
  if (!response.ok) {
    seatMap = [];
    renderSeats();
    return;
  }
  seatMap = await response.json();
  renderSeats();
}

async function selectShowtime(showtime) {
  selectedShowtime = showtime;
  selectedSeats = [];
  resultEl.textContent = '';
  seatTitleEl.textContent = `Карта: ${showtime.hall}`;
  seatGridEl.className = `seat-grid ${showtime.hallType === 'hall9_standard' ? 'hall-9' : 'hall-vip'}`;

  await loadSeats(showtime.showtimeId);
  renderShowtimes();
  updateSummary();
  updatePaymentBox();
}

reserveBtnEl.addEventListener('click', async () => {
  resultEl.className = 'result';

  if (!selectedShowtime) {
    resultEl.textContent = 'Сначала выбери сеанс.';
    resultEl.classList.add('err');
    return;
  }

  if (!selectedShowtime.bookable) {
    resultEl.textContent = `Продажи стартуют ${formatDate(selectedShowtime.salesOpensAt)}.`;
    resultEl.classList.add('err');
    return;
  }

  if (selectedSeats.length === 0) {
    resultEl.textContent = 'Выбери хотя бы одно место.';
    resultEl.classList.add('err');
    return;
  }

  const response = await fetch('/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      showtimeId: selectedShowtime.showtimeId,
      seats: selectedSeats
    })
  });

  const data = await response.json();

  if (!response.ok) {
    resultEl.textContent = data.error || 'Ошибка бронирования';
    resultEl.classList.add('err');
    await loadSeats(selectedShowtime.showtimeId);
    updateSummary();
    return;
  }

  resultEl.textContent = `Бронь ${data.bookingId} создана. Сумма: ${formatPrice(data.total)}.`;
  resultEl.classList.add('ok');
  selectedSeats = [];
  await loadSeats(selectedShowtime.showtimeId);
  updateSummary();
});

loadShowtimes();
updateSummary();
updatePaymentBox();

function openHallModal() {
  hallModalEl.classList.remove('hidden');
}

function closeHallModal() {
  hallModalEl.classList.add('hidden');
}

openHallModalEls.forEach((item) => item.addEventListener('click', openHallModal));
closeHallModalEl.addEventListener('click', closeHallModal);
modalCloseAreaEl.addEventListener('click', closeHallModal);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !hallModalEl.classList.contains('hidden')) {
    closeHallModal();
  }
});
