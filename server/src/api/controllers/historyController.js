import * as history from '../services/historyService.js';

export function listMine(req, res) {
  res.json(history.listMine(req.user.id));
}