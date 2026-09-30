import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';

async function createTestData() {
  const user = await request(app)
    .post('/users')
    .set('X-User-Id', '1')
    .send({ name: 'Dylan', email: 'dylan@example.com' })
    .expect(201);

  const userId = user.body.id as number;

  const ticket = await request(app)
    .post('/tickets')
    .set('X-User-Id', String(userId))
    .send({ title: 'Time logging test' })
    .expect(201);

  return { userId, ticketId: ticket.body.id as number };
}

describe('Part 2: Time Logs Tests', () => {
  it('creates logs and correctly sums multiple entries', async () => {
    const { userId, ticketId } = await createTestData();

    for (const hours of [1.5, 2, 0.75]) {
      const log = await request(app)
        .post(`/tickets/${ticketId}/time`)
        .set('X-User-Id', String(userId))
        .send({ hours })
        .expect(201);

      expect(log.body).toMatchObject({
        ticket_id: ticketId,
        user_id: userId,
        hours,
      });
      expect(log.body.id).toEqual(expect.any(Number));
      expect(log.body.logged_at).toEqual(expect.any(String));
    }

    const total = await request(app)
      .get(`/tickets/${ticketId}/time`)
      .expect(200);

    expect(total.body).toEqual({
      ticket_id: ticketId,
      total_hours: 4.25,
    });
  });

  it('returns zero when a ticket has no time logs', async () => {
    const { ticketId } = await createTestData();

    const response = await request(app)
      .get(`/tickets/${ticketId}/time`)
      .expect(200);

    expect(response.body).toEqual({
      ticket_id: ticketId,
      total_hours: 0,
    });
  });

  it('keeps totals separate for different tickets', async () => {
    const { userId, ticketId } = await createTestData();

    const second = await request(app)
      .post('/tickets')
      .set('X-User-Id', String(userId))
      .send({ title: 'Second ticket' })
      .expect(201);

    await request(app)
      .post(`/tickets/${ticketId}/time`)
      .set('X-User-Id', String(userId))
      .send({ hours: 2 })
      .expect(201);

    await request(app)
      .post(`/tickets/${second.body.id}/time`)
      .set('X-User-Id', String(userId))
      .send({ hours: 7 })
      .expect(201);

    const response = await request(app)
      .get(`/tickets/${ticketId}/time`)
      .expect(200);

    expect(response.body.total_hours).toBe(2);
  });

  it('rejects missing or invalid authentication', async () => {
    const { ticketId } = await createTestData();

    await request(app)
      .post(`/tickets/${ticketId}/time`)
      .send({ hours: 1 })
      .expect(401);

    await request(app)
      .post(`/tickets/${ticketId}/time`)
      .set('X-User-Id', 'abc')
      .send({ hours: 1 })
      .expect(401);
  });

  it('rejects invalid hours without inserting logs', async () => {
    const { userId, ticketId } = await createTestData();

    for (const payload of [
      {},
      { hours: 0 },
      { hours: -2 },
      { hours: '2' },
      { hours: null },
    ]) {
      await request(app)
        .post(`/tickets/${ticketId}/time`)
        .set('X-User-Id', String(userId))
        .send(payload)
        .expect(400);
    }

    const response = await request(app)
      .get(`/tickets/${ticketId}/time`)
      .expect(200);

    expect(response.body.total_hours).toBe(0);
  });

  it('returns 404 for a missing ticket or logging user', async () => {
    const { ticketId } = await createTestData();

    await request(app).get('/tickets/99999/time').expect(404);

    await request(app)
      .post('/tickets/99999/time')
      .set('X-User-Id', '1')
      .send({ hours: 1 })
      .expect(404);

    await request(app)
      .post(`/tickets/${ticketId}/time`)
      .set('X-User-Id', '99999')
      .send({ hours: 1 })
      .expect(404);
  });
});
