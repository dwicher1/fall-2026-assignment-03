import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';

async function createTestUser() {
  const response = await request(app)
    .post('/users')
    .set('X-User-Id', '1')
    .send({ name: 'Dylan', email: 'dylan@example.com' })
    .expect(201);

  return response.body.id as number;
}

async function createTestTicket(userId: number, title = 'Test ticket') {
  const response = await request(app)
    .post('/tickets')
    .set('X-User-Id', String(userId))
    .send({ title, description: 'Test description' })
    .expect(201);

  return response.body.id as number;
}

describe('Part 1: API Integration Tests', () => {
  it('creates a user and retrieves the user and user list', async () => {
    const userId = await createTestUser();

    const single = await request(app).get(`/users/${userId}`).expect(200);
    expect(single.body).toMatchObject({
      id: userId,
      name: 'Dylan',
      email: 'dylan@example.com',
    });

    const all = await request(app).get('/users').expect(200);
    expect(all.body).toHaveLength(1);
    expect(all.body[0].id).toBe(userId);
  });

  it('creates a ticket using the authenticated creator ID', async () => {
    const userId = await createTestUser();
    const ticketId = await createTestTicket(userId);

    const response = await request(app).get(`/tickets/${ticketId}`).expect(200);

    expect(response.body).toMatchObject({
      id: ticketId,
      title: 'Test ticket',
      description: 'Test description',
      creator_id: userId,
      status: 'TODO',
    });
  });

  it('rejects missing and invalid authentication headers', async () => {
    await request(app)
      .post('/users')
      .send({ name: 'Dylan', email: 'dylan@example.com' })
      .expect(401);

    for (const header of ['abc', '0', '-1', '1.5']) {
      await request(app)
        .post('/tickets')
        .set('X-User-Id', header)
        .send({ title: 'Unauthorized' })
        .expect(401);
    }

    await request(app)
      .patch('/tickets/1/status')
      .send({ status: 'DONE' })
      .expect(401);
  });

  it('returns 404 for users and tickets that do not exist', async () => {
    await request(app).get('/users/99999').expect(404);
    await request(app).get('/tickets/99999').expect(404);

    await request(app)
      .patch('/tickets/99999/status')
      .set('X-User-Id', '1')
      .send({ status: 'DONE' })
      .expect(404);
  });

  it('supports ticket pagination and status filtering', async () => {
    const userId = await createTestUser();
    const firstId = await createTestTicket(userId, 'First');
    const secondId = await createTestTicket(userId, 'Second');
    const thirdId = await createTestTicket(userId, 'Third');

    await request(app)
      .patch(`/tickets/${secondId}/status`)
      .set('X-User-Id', String(userId))
      .send({ status: 'DONE' })
      .expect(200);

    const page = await request(app)
      .get('/tickets?limit=1&offset=1')
      .expect(200);

    expect(page.body).toHaveLength(1);
    expect(page.body[0].id).toBe(secondId);

    const filtered = await request(app).get('/tickets?status=TODO').expect(200);

    expect(filtered.body.map((ticket: { id: number }) => ticket.id)).toEqual([
      firstId,
      thirdId,
    ]);

    const combined = await request(app)
      .get('/tickets?status=TODO&limit=1&offset=1')
      .expect(200);

    expect(combined.body).toHaveLength(1);
    expect(combined.body[0].id).toBe(thirdId);
  });

  it('updates a ticket status', async () => {
    const userId = await createTestUser();
    const ticketId = await createTestTicket(userId);

    const response = await request(app)
      .patch(`/tickets/${ticketId}/status`)
      .set('X-User-Id', String(userId))
      .send({ status: 'IN_PROGRESS' })
      .expect(200);

    expect(response.body.status).toBe('IN_PROGRESS');

    const stored = await request(app).get(`/tickets/${ticketId}`).expect(200);

    expect(stored.body.status).toBe('IN_PROGRESS');
  });

  it('rejects invalid user and ticket payloads', async () => {
    await request(app)
      .post('/users')
      .set('X-User-Id', '1')
      .send({ name: '', email: 'dylan@example.com' })
      .expect(400);

    const userId = await createTestUser();

    for (const payload of [
      {},
      { title: ' ' },
      { title: 123 },
      { title: 'Ticket', description: 123 },
    ]) {
      await request(app)
        .post('/tickets')
        .set('X-User-Id', String(userId))
        .send(payload)
        .expect(400);
    }

    const ticketId = await createTestTicket(userId);

    await request(app)
      .patch(`/tickets/${ticketId}/status`)
      .set('X-User-Id', String(userId))
      .send({ status: 'INVALID' })
      .expect(400);
  });

  it('rejects invalid pagination, filters, and route IDs', async () => {
    for (const query of [
      'limit=abc',
      'limit=0',
      'offset=-1',
      'offset=1.5',
      'status=INVALID',
    ]) {
      await request(app).get(`/tickets?${query}`).expect(400);
    }

    await request(app).get('/users/abc').expect(400);
    await request(app).get('/tickets/abc').expect(400);
  });
});
