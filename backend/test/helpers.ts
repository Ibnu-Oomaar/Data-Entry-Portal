import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import Redis from 'ioredis';
import { join } from 'path';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { REDIS_CLIENT } from '../src/redis/redis.module';
import { buildTypeOrmOptions } from '../src/database/typeorm.options';

export const WORKBOOK = join(__dirname, '../../data/Noradin_Boys_Sorted.xlsx');

export const FULL_MARKS = {
  chapter1Notes: 2,
  chapter1Exercises: 6,
  chapter1Assignment: 5,
  chapter2Notes: 2,
  chapter2Exercises: 6,
  chapter2Assignment: 5,
  textbook: 4,
};

export interface TestContext {
  app: INestApplication;
  ds: DataSource;
  redis: Redis;
}

/** Fresh schema (through the real migrations), empty Redis DB, full production request pipeline. */
export async function bootApp(): Promise<TestContext> {
  const url = process.env.DATABASE_URL!;
  const redisUrl = process.env.REDIS_URL!;
  if (!/classes_portal_test/.test(url) || !/\/1$/.test(redisUrl)) {
    throw new Error('Refusing to run destructive tests against a non-test database/Redis');
  }
  const wipe = new DataSource(buildTypeOrmOptions({ databaseUrl: url }));
  await wipe.initialize();
  await wipe.dropDatabase();
  await wipe.destroy();

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  const redis = app.get<Redis>(REDIS_CLIENT);
  await redis.flushdb();
  return { app, ds: app.get(DataSource), redis };
}

export interface Session {
  agent: ReturnType<typeof request.agent>;
  csrf: string;
}

export async function teacherSession(app: INestApplication, name: string): Promise<Session> {
  const agent = request.agent(app.getHttpServer());
  const res = await agent.post('/api/auth/teacher/login').send({ name }).expect(200);
  return { agent, csrf: res.body.data.csrfToken };
}

export async function studentSession(app: INestApplication, studentId: number): Promise<Session> {
  const agent = request.agent(app.getHttpServer());
  const res = await agent.post('/api/auth/student/login').send({ studentId }).expect(200);
  return { agent, csrf: res.body.data.csrfToken };
}

export const saveMarks = (s: Session, studentId: number, body: Record<string, unknown>) =>
  s.agent.put(`/api/assessments/student/${studentId}`).set('X-CSRF-Token', s.csrf).send(body);
