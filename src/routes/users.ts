import { Router } from 'express';
import authMiddleware from '../middleware/auth.js';
import { getAllUsers, getUserById, createUser } from '../dal/users.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    res.json(await getAllUsers());
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Invalid user ID' });
    return;
  }

  try {
    const user = await getUserById(id);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
});

router.post('/', authMiddleware, async (req, res, next) => {
  const { name, email } = req.body ?? {};

  if (
    typeof name !== 'string' ||
    name.trim() === '' ||
    typeof email !== 'string' ||
    email.trim() === ''
  ) {
    res.status(400).json({ error: 'Name and email are required strings' });
    return;
  }

  try {
    const user = await createUser({
      name: name.trim(),
      email: email.trim(),
    });

    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
});

export default router;
