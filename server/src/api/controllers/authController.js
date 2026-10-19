import * as auth from '../services/authService.js';

// Controllers are thin: read the request, call the business service, send JSON.

export function register(req, res) {
  res.status(201).json({ user: auth.register(req.body) });
}

export function login(req, res) {
  res.json(auth.login(req.body));
}

export function me(req, res) {
  res.json({ user: req.user });
}

export function changePassword(req, res) {
  auth.changePassword(req.user.id, req.body.password);
  res.status(204).end();
}
