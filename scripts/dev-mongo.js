import { MongoMemoryReplSet } from 'mongodb-memory-server';

const replica = await MongoMemoryReplSet.create({
  binary: { version: '7.0.24' },
  instanceOpts: [{ port: 27018 }],
  replSet: { count: 1 },
});
process.stdout.write(
  `Disposable development database: ${replica.getUri('kirana-preview')}\nData lasts only for this process. Use Compose/Atlas for durable storage.\n`,
);
async function stop() {
  await replica.stop();
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
