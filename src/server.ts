import { app, init } from './app.js';
import { config, ensureConfig } from './config.js';

ensureConfig();
init().then(() => {
  app.listen(config.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on :${config.PORT}`);
  });
}).catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Schema init failed', err);
  process.exit(1);
});
