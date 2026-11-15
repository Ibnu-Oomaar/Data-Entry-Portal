import 'dotenv/config';
import 'reflect-metadata';
import { INestApplicationContext, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';

/** Boots the Nest container without an HTTP server, runs the task, always shuts down cleanly. */
export async function runCli(task: (app: INestApplicationContext) => Promise<number | void>): Promise<void> {
  let code = 0;
  let app: INestApplicationContext | undefined;
  try {
    app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
    code = (await task(app)) ?? 0;
  } catch (err) {
    new Logger('CLI').error((err as Error).message);
    code = 1;
  } finally {
    if (app) await app.close();
  }
  process.exit(code);
}
