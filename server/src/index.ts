import { app } from './app.js';

const port = Number.parseInt(process.env.PORT ?? '3000', 10);

app.listen(port, () => {
  console.log(`Fitness RPG server listening on http://localhost:${port}`);
});
