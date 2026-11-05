import * as history from '../services/historyService.js';

export async function listMine(req, res) {
  res.json(await history.listMine(req.user.id));
}