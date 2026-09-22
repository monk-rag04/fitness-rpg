import { app } from './app.js';

const port = Number.parseInt(process.env.PORT ?? '3000', 10);

const server = app.listen(port, () => {
  console.log(`Fitness RPG server listening on http://localhost:${port}`);
});

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `Port ${port} is already in use.\n` +
      'Stop the existing backend before starting a new one.',
    );
  } else {
    console.error(`Unable to start backend on port ${port}.`);
  }
  process.exitCode = 1;
});
