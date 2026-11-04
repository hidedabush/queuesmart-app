import * as services from '../services/servicesService.js';

export async function list(req, res) {
  res.json({ services: await services.listServices() });
}

export async function get(req, res) {
  res.json({ service: await services.getService(req.params.id) });
}

export async function create(req, res) {
  res.status(201).json({ service: await services.createService(req.body) });
}

export async function update(req, res) {
  res.json({ service: await services.updateService(req.params.id, req.body) });
}

export async function setOpen(req, res) {
  res.json({ service: await services.setQueueOpen(req.params.id, req.body.isOpen) });
}

export async function remove(req, res) {
  await services.deleteService(req.params.id);
  res.status(204).end();
}
