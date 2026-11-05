import * as queueService from '../services/queueService.js';

// Patient handlers. requireAuth sets req.user from the token. The front
// desk handlers are in staffQueueController.js.

export async function join(req, res) {
  const result = await queueService.joinQueue(
    req.user.id,
    req.params.id,
    req.body.reason
  );

  res.status(201).json(result);
}

export async function getMine(req, res) {
  const result = await queueService.getMyQueue(req.user.id);

  res.json(result ?? { entry: null });
}

export async function cancelMine(req, res) {
  await queueService.cancelQueue(req.user.id);

  res.status(204).end();
}

