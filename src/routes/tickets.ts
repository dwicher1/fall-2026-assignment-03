import { insertTimeLog, getTotalHoursForTicket } from '../dal/timeLogs.js';
import { Router } from 'express';
import authMiddleware from '../middleware/auth.js';
import { getUserById } from '../dal/users.js';
import {
  getAllTickets,
  getTicketById,
  createTicket,
  updateTicketStatus,
} from '../dal/tickets.js';

const router = Router();
const validStatuses = ['TODO', 'IN_PROGRESS', 'DONE'];

router.get('/', async (req, res, next) => {
  const { limit, offset, status } = req.query;
  const parsedLimit = limit === undefined ? undefined : Number(limit);
  const parsedOffset = offset === undefined ? undefined : Number(offset);

  if (
    limit !== undefined &&
    (typeof limit !== 'string' ||
      limit.trim() === '' ||
      !Number.isSafeInteger(parsedLimit) ||
      parsedLimit! <= 0)
  ) {
    res.status(400).json({ error: 'Limit must be a positive integer' });
    return;
  }

  if (
    offset !== undefined &&
    (typeof offset !== 'string' ||
      offset.trim() === '' ||
      !Number.isSafeInteger(parsedOffset) ||
      parsedOffset! < 0)
  ) {
    res.status(400).json({ error: 'Offset must be a nonnegative integer' });
    return;
  }

  if (
    status !== undefined &&
    (typeof status !== 'string' || !validStatuses.includes(status))
  ) {
    res.status(400).json({ error: 'Invalid status filter' });
    return;
  }

  try {
    const tickets = await getAllTickets({
      limit: parsedLimit,
      offset: parsedOffset,
      status: typeof status === 'string' ? status : undefined,
    });

    res.json(tickets);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Invalid ticket ID' });
    return;
  }

  try {
    const ticket = await getTicketById(id);

    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    res.json(ticket);
  } catch (error) {
    next(error);
  }
});

router.post('/', authMiddleware, async (req, res, next) => {
  const { title, description } = req.body ?? {};
  const creatorId: number = res.locals.userId;

  if (
    typeof title !== 'string' ||
    title.trim() === '' ||
    title.trim().length > 255 ||
    (description !== undefined &&
      description !== null &&
      typeof description !== 'string')
  ) {
    res.status(400).json({ error: 'Invalid title or description' });
    return;
  }

  try {
    if (!(await getUserById(creatorId))) {
      res.status(404).json({ error: 'Creator not found' });
      return;
    }

    const ticket = await createTicket({
      title: title.trim(),
      description: description ?? null,
      creator_id: creatorId,
      assignee_id: null,
    });

    res.status(201).json(ticket);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/status', authMiddleware, async (req, res, next) => {
  const id = Number(req.params.id);
  const { status } = req.body ?? {};

  if (!Number.isSafeInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Invalid ticket ID' });
    return;
  }

  if (typeof status !== 'string' || !validStatuses.includes(status)) {
    res
      .status(400)
      .json({ error: 'Status must be TODO, IN_PROGRESS, or DONE' });
    return;
  }

  try {
    const ticket = await updateTicketStatus(id, status);

    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    res.status(200).json(ticket);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/time', authMiddleware, async (req, res, next) => {
  const ticketId = Number(req.params.id);
  const userId: number = res.locals.userId;
  const { hours } = req.body ?? {};

  if (!Number.isSafeInteger(ticketId) || ticketId <= 0) {
    res.status(400).json({ error: 'Invalid ticket ID' });
    return;
  }

  if (typeof hours !== 'number' || !Number.isFinite(hours) || hours <= 0) {
    res.status(400).json({ error: 'Hours must be a positive number' });
    return;
  }

  try {
    if (!(await getTicketById(ticketId))) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    if (!(await getUserById(userId))) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const timeLog = await insertTimeLog(ticketId, userId, hours);
    res.status(201).json(timeLog);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/time', async (req, res, next) => {
  const ticketId = Number(req.params.id);

  if (!Number.isSafeInteger(ticketId) || ticketId <= 0) {
    res.status(400).json({ error: 'Invalid ticket ID' });
    return;
  }

  try {
    if (!(await getTicketById(ticketId))) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    const totalHours = await getTotalHoursForTicket(ticketId);

    res.json({
      ticket_id: ticketId,
      total_hours: totalHours,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
