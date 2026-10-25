import * as authService from '../services/authService.js';

export async function register(req, res) {
  const result = await authService.register(req.body);
  res.status(201).json(result);
}

export async function login(req, res) {
  const result = await authService.login(req.body);
  res.status(200).json(result);
}

export function getMe(req, res) {
  const result = authService.getCurrentUser(req.user.id);
  res.status(200).json(result);
}

export async function changePassword(req, res) {
  await authService.changePassword(req.user.id, req.body.password);
  res.status(204).end();
}