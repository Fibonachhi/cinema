const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'images')));

const VIP_PRICE = 3500;

const movies = [
  {
    id: 'm1',
    title: 'Пираты Карибского моря: Проклятие Черной жемчужины',
    shortTitle: 'Пираты 1',
    duration: 143,
    age: '12+',
    hall: 'VIP-зал',
    seatType: 'VIP диван для двоих',
    price: VIP_PRICE,
    banner: 'https://image.tmdb.org/t/p/w780/z8onk7LV9Mmw6zKz4hT6pzzvmvl.jpg',
    showtimes: [{ id: 's1', startsAt: '2026-02-27T20:00:00' }]
  },
  {
    id: 'm2',
    title: 'Пираты Карибского моря: Сундук мертвеца',
    shortTitle: 'Пираты 2',
    duration: 151,
    age: '12+',
    hall: 'VIP-зал',
    seatType: 'VIP диван для двоих',
    price: VIP_PRICE,
    banner: 'https://image.tmdb.org/t/p/w780/uXEqmloGyP7UXAiphJUu2v2pcuE.jpg',
    showtimes: [{ id: 's2', startsAt: '2026-03-06T20:00:00' }]
  },
  {
    id: 'm3',
    title: 'Пираты Карибского моря: На краю света',
    shortTitle: 'Пираты 3',
    duration: 169,
    age: '12+',
    hall: 'VIP-зал',
    seatType: 'VIP диван для двоих',
    price: VIP_PRICE,
    banner: 'https://image.tmdb.org/t/p/w780/jGWpG4YhpQwVmjyHEGkxEkeRf0S.jpg',
    showtimes: [{ id: 's3', startsAt: '2026-03-13T20:00:00' }]
  }
];

function generateVipSeatMap() {
  const layout = [
    { row: 5, cols: [1, 4, 7, 10] },
    { row: 4, cols: [2, 5, 10] },
    { row: 3, cols: [2, 5, 10] },
    { row: 2, cols: [2, 5, 10] },
    { row: 1, cols: [2, 5, 10] }
  ];

  const seats = [];
  for (const rowDef of layout) {
    rowDef.cols.forEach((col, index) => {
      seats.push({
        code: `R${rowDef.row}-${index + 1}`,
        row: rowDef.row,
        number: index + 1,
        colStart: col,
        status: 'free'
      });
    });
  }
  return seats;
}

const seatsByShowtime = {};
for (const movie of movies) {
  for (const st of movie.showtimes) {
    seatsByShowtime[st.id] = generateVipSeatMap();
  }
}

function flattenShowtimes() {
  return movies.flatMap((movie) =>
    movie.showtimes.map((st) => ({
      showtimeId: st.id,
      movieId: movie.id,
      title: movie.title,
      shortTitle: movie.shortTitle,
      duration: movie.duration,
      age: movie.age,
      hall: movie.hall,
      seatType: movie.seatType,
      price: movie.price,
      startsAt: st.startsAt,
      banner: movie.banner
    }))
  );
}

app.get('/api/showtimes', (req, res) => {
  res.json(flattenShowtimes());
});

app.get('/api/showtimes/:id/seats', (req, res) => {
  const seats = seatsByShowtime[req.params.id];
  if (!seats) {
    return res.status(404).json({ error: 'Showtime not found' });
  }
  return res.json(seats);
});

app.post('/api/bookings', (req, res) => {
  const { showtimeId, seats, customer } = req.body;

  if (!showtimeId || !Array.isArray(seats) || seats.length === 0) {
    return res.status(400).json({ error: 'showtimeId and seats are required' });
  }

  if (!customer?.name || !customer?.email || !customer?.cardLast4) {
    return res.status(400).json({ error: 'customer name, email and cardLast4 are required' });
  }

  const seatMap = seatsByShowtime[showtimeId];
  if (!seatMap) {
    return res.status(404).json({ error: 'Showtime not found' });
  }

  const requested = new Set(seats);
  const unavailable = seatMap.filter((s) => requested.has(s.code) && s.status !== 'free');
  if (unavailable.length > 0) {
    return res.status(409).json({ error: 'Некоторые VIP-диваны уже заняты', seats: unavailable.map((s) => s.code) });
  }

  for (const seat of seatMap) {
    if (requested.has(seat.code)) {
      seat.status = 'occupied';
    }
  }

  const showtime = flattenShowtimes().find((item) => item.showtimeId === showtimeId);
  const total = (showtime?.price || 0) * seats.length;

  return res.status(201).json({
    bookingId: `BK-${Math.floor(Math.random() * 1000000)}`,
    showtimeId,
    seats,
    total,
    customer: {
      name: customer.name,
      email: customer.email,
      cardLast4: customer.cardLast4
    }
  });
});

if (process.env.VERCEL) {
  module.exports = app;
} else {
  app.listen(PORT, () => {
    console.log(`Cinema app is running on http://localhost:${PORT}`);
  });
}
