import { createApp } from './app.js';

const PORT = Number(process.env.PORT) || 4000;

// Listen on every network interface so a phone on the same Wi-Fi can reach it.
createApp().listen(PORT, '0.0.0.0', () => {
  console.log(`QueueSmart API listening on http://localhost:${PORT}`);
});
