import dataSource from '../database/data-source';

/** Applies pending migrations (for deployments that run with RUN_MIGRATIONS=false). */
async function main() {
  await dataSource.initialize();
  const applied = await dataSource.runMigrations({ transaction: 'each' });
  // eslint-disable-next-line no-console
  console.log(applied.length ? `Applied: ${applied.map((m) => m.name).join(', ')}` : 'Database is up to date.');
  await dataSource.destroy();
}
main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
