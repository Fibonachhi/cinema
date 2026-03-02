const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'images')));

const showtimes = [
  {
    showtimeId: 's1-vip',
    movieId: 'm1',
    part: 1,
    title: 'Пираты Карибского моря: Проклятие Черной жемчужины',
    duration: 143,
    age: '12+',
    startsAt: '2026-03-20T20:00:00+03:00',
    salesOpensAt: '2026-03-01T10:00:00+03:00',
    hall: 'VIP-зал Отрадное',
    hallShort: 'Отрадное VIP',
    hallType: 'vip_sofa',
    seatType: 'VIP диван для двоих',
    price: 3500,
    banner: 'https://image.tmdb.org/t/p/w780/z8onk7LV9Mmw6zKz4hT6pzzvmvl.jpg',
    paymentLink:
      'https://qr.nspk.ru/AS100048QAFNVQ6J8THOVPHTASQNE3RL?type=01&bank=100000000008&sum=350000&cur=RUB&crc=C4BE'
  },
  {
    showtimeId: 's1-h9',
    movieId: 'm1',
    part: 1,
    title: 'Пираты Карибского моря: Проклятие Черной жемчужины',
    duration: 143,
    age: '12+',
    startsAt: '2026-03-20T20:00:00+03:00',
    salesOpensAt: '2026-03-01T10:00:00+03:00',
    hall: 'Европолис, Зал 9',
    hallShort: 'Зал 9',
    hallType: 'hall9_standard',
    seatType: 'Стандарт',
    price: 1000,
    banner: 'https://image.tmdb.org/t/p/w780/z8onk7LV9Mmw6zKz4hT6pzzvmvl.jpg',
    paymentLink: ''
  },
  {
    showtimeId: 's2',
    movieId: 'm2',
    part: 2,
    title: 'Пираты Карибского моря: Сундук мертвеца',
    duration: 151,
    age: '12+',
    startsAt: '2026-03-27T20:00:00+03:00',
    salesOpensAt: '2026-03-13T20:00:00+03:00',
    hall: 'Скоро объявим зал',
    hallShort: 'Скоро',
    hallType: 'upcoming',
    seatType: 'Скоро',
    price: 1000,
    banner: 'https://image.tmdb.org/t/p/w780/uXEqmloGyP7UXAiphJUu2v2pcuE.jpg',
    paymentLink: ''
  },
  {
    showtimeId: 's3',
    movieId: 'm3',
    part: 3,
    title: 'Пираты Карибского моря: На краю света',
    duration: 169,
    age: '12+',
    startsAt: '2026-04-03T20:00:00+03:00',
    salesOpensAt: '2026-03-20T20:00:00+03:00',
    hall: 'Скоро объявим зал',
    hallShort: 'Скоро',
    hallType: 'upcoming',
    seatType: 'Скоро',
    price: 1000,
    banner: 'https://image.tmdb.org/t/p/w780/jGWpG4YhpQwVmjyHEGkxEkeRf0S.jpg',
    paymentLink: ''
  }
];

function withBookable(showtime) {
  const now = new Date();
  const salesOpen = new Date(showtime.salesOpensAt);
  const bookable = now >= salesOpen && (showtime.hallType === 'vip_sofa' || showtime.hallType === 'hall9_standard');
  return { ...showtime, bookable };
}

function generateVipSofaMap() {
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
        code: `V-${rowDef.row}-${index + 1}`,
        row: rowDef.row,
        number: index + 1,
        colStart: col,
        span: 2,
        status: 'free'
      });
    });
  }
  return seats;
}

function generateHall9Map() {
  const rows = [
    { row: 4, start: 1, count: 12 },
    { row: 3, start: 2, count: 9 },
    { row: 2, start: 2, count: 9 },
    { row: 1, start: 2, count: 9 }
  ];

  const seats = [];
  for (const rowDef of rows) {
    for (let i = 0; i < rowDef.count; i += 1) {
      seats.push({
        code: `H9-${rowDef.row}-${i + 1}`,
        row: rowDef.row,
        number: i + 1,
        colStart: rowDef.start + i,
        span: 1,
        status: 'free'
      });
    }
  }
  return seats;
}

const seatsByShowtime = {
  's1-vip': generateVipSofaMap(),
  's1-h9': generateHall9Map()
};

app.get('/api/showtimes', (req, res) => {
  res.json(showtimes.map(withBookable));
});

app.get('/api/showtimes/:id/seats', (req, res) => {
  const source = showtimes.find((s) => s.showtimeId === req.params.id);
  const showtime = source ? withBookable(source) : null;

  if (!showtime) {
    return res.status(404).json({ error: 'Showtime not found' });
  }

  if (!showtime.bookable) {
    return res.status(409).json({ error: 'Продажи по этому сеансу еще не открыты', salesOpensAt: showtime.salesOpensAt });
  }

  const seats = seatsByShowtime[req.params.id];
  if (!seats) {
    return res.status(404).json({ error: 'Seat map not found' });
  }

  return res.json(seats);
});

app.post('/api/bookings', (req, res) => {
  const { showtimeId, seats } = req.body;

  if (!showtimeId || !Array.isArray(seats) || seats.length === 0) {
    return res.status(400).json({ error: 'showtimeId and seats are required' });
  }

  const source = showtimes.find((s) => s.showtimeId === showtimeId);
  const showtime = source ? withBookable(source) : null;

  if (!showtime) {
    return res.status(404).json({ error: 'Showtime not found' });
  }

  if (!showtime.bookable) {
    return res.status(409).json({ error: 'Продажи по этому сеансу еще не открыты' });
  }

  const seatMap = seatsByShowtime[showtimeId];
  if (!seatMap) {
    return res.status(404).json({ error: 'Seat map not found' });
  }

  const requested = new Set(seats);
  const unavailable = seatMap.filter((s) => requested.has(s.code) && s.status !== 'free');
  if (unavailable.length > 0) {
    return res.status(409).json({ error: 'Некоторые места уже заняты', seats: unavailable.map((s) => s.code) });
  }

  for (const seat of seatMap) {
    if (requested.has(seat.code)) {
      seat.status = 'occupied';
    }
  }

  const total = showtime.price * seats.length;

  return res.status(201).json({
    bookingId: `BK-${Math.floor(Math.random() * 1000000)}`,
    showtimeId,
    seats,
    total,
    paymentLink: showtime.paymentLink || ''
  });
});

if (process.env.VERCEL) {
  module.exports = app;
} else {
  app.listen(PORT, () => {
    console.log(`Cinema app is running on http://localhost:${PORT}`);
  });
}
