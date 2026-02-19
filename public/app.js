const movieGridEl = document.getElementById('movie-grid');
const showtimeListEl = document.getElementById('showtime-list');
const seatGridEl = document.getElementById('seat-grid');
const summaryEl = document.getElementById('summary');
const resultEl = document.getElementById('result');
const formEl = document.getElementById('checkout-form');
const paymentLinkBoxEl = document.getElementById('payment-link-box');
const hallModalEl = document.getElementById('hall-modal');
const openHallModalEls = document.querySelectorAll('[data-open-hall]');
const closeHallModalEl = document.getElementById('close-hall-modal');
const modalCloseAreaEl = document.getElementById('modal-close-area');

let showtimes = [];
let selectedShowtime = null;
let selectedSeats = [];
let seatMap = [];

const paymentLinks = {
  s1: 'https://qr.nspk.ru/AS100048QAFNVQ6J8THOVPHTASQNE3RL?type=01&bank=100000000008&sum=350000&cur=RUB&crc=C4BE'
};

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
    map.set(item.movieId, {
      ...item
    });
  }
  return Array.from(map.values());
}

function updateSummary() {
  if (!selectedShowtime) {
    summaryEl.textContent = 'Сначала выбери фильм и сеанс';
    return;
  }

  const total = selectedSeats.length * selectedShowtime.price;
  summaryEl.textContent =
    `${selectedShowtime.title}\n` +
    `${formatDate(selectedShowtime.startsAt)} | ${selectedShowtime.hall}\n` +
    `Тип места: ${selectedShowtime.seatType}\n` +
    `Выбрано диванов: ${selectedSeats.length ? selectedSeats.join(', ') : 'не выбраны'}\n` +
    `Итого: ${formatPrice(total)}`;
}

function updatePaymentLink() {
  if (!selectedShowtime) {
    paymentLinkBoxEl.innerHTML = 'Выбери фильм, чтобы увидеть ссылку оплаты.';
    return;
  }

  const link = paymentLinks[selectedShowtime.showtimeId];
  if (link) {
    paymentLinkBoxEl.innerHTML = `<a class="pay-link-btn" href="${link}" target="_blank" rel="noopener noreferrer">Оплатить: ${formatPrice(selectedShowtime.price)}</a>`;
    return;
  }

  paymentLinkBoxEl.innerHTML = 'Для этого фильма ссылка на оплату появится позже.';
}

function scrollToBooking() {
  document.getElementById('booking').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderCatalog() {
  const movies = groupByMovie(showtimes);
  movieGridEl.innerHTML = '';

  for (const movie of movies) {
    const card = document.createElement('article');
    card.className = 'movie-card';

    card.innerHTML = `
      <img class="poster" src="${movie.banner}" alt="${movie.title}" loading="lazy" />
      <div class="card-body">
        <h3>${movie.title}</h3>
        <p class="card-meta">${movie.duration} мин • ${movie.age} • ${movie.hall}</p>
        <p class="single-date">${formatDate(movie.startsAt)}</p>
        <button class="pick-btn" type="button">Купить билет</button>
      </div>
    `;

    card.querySelector('.pick-btn').addEventListener('click', async () => {
      await selectShowtime(movie);
      scrollToBooking();
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

    card.innerHTML = `
      <strong>${showtime.shortTitle}</strong>
      <div class="meta">${formatDate(showtime.startsAt)}</div>
      <div class="meta">${showtime.age} | ${showtime.duration} мин | ${showtime.hall}</div>
      <div class="meta">${formatPrice(showtime.price)} за VIP диван для двоих</div>
    `;

    card.addEventListener('click', async () => {
      await selectShowtime(showtime);
    });

    showtimeListEl.append(card);
  }
}

function renderSeats() {
  seatGridEl.innerHTML = '';

  for (const seat of seatMap) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `seat ${seat.status}`;
    btn.textContent = `${seat.row}-${seat.number}`;
    btn.style.gridColumn = `${seat.colStart} / span 2`;
    btn.style.gridRow = `${6 - seat.row}`;

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
  seatMap = await response.json();
  renderSeats();
}

async function selectShowtime(showtime) {
  selectedShowtime = showtime;
  selectedSeats = [];
  resultEl.textContent = '';
  await loadSeats(showtime.showtimeId);
  renderShowtimes();
  updateSummary();
  updatePaymentLink();
}

formEl.addEventListener('submit', async (event) => {
  event.preventDefault();
  resultEl.className = 'result';

  if (!selectedShowtime) {
    resultEl.textContent = 'Выбери сеанс.';
    resultEl.classList.add('err');
    return;
  }

  if (selectedSeats.length === 0) {
    resultEl.textContent = 'Выбери хотя бы один VIP диван.';
    resultEl.classList.add('err');
    return;
  }

  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const card = document.getElementById('card').value.replace(/\s+/g, '');

  if (card.length < 12) {
    resultEl.textContent = 'Проверь номер карты.';
    resultEl.classList.add('err');
    return;
  }

  const payload = {
    showtimeId: selectedShowtime.showtimeId,
    seats: selectedSeats,
    customer: {
      name,
      email,
      cardLast4: card.slice(-4)
    }
  };

  const response = await fetch('/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    resultEl.textContent = data.error || 'Ошибка оплаты';
    resultEl.classList.add('err');
    await loadSeats(selectedShowtime.showtimeId);
    updateSummary();
    return;
  }

  resultEl.textContent = `Успех. Бронь ${data.bookingId}. Сумма: ${formatPrice(data.total)}.`;
  resultEl.classList.add('ok');
  selectedSeats = [];
  formEl.reset();
  await loadSeats(selectedShowtime.showtimeId);
  updateSummary();
});

loadShowtimes();
updateSummary();
updatePaymentLink();

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
