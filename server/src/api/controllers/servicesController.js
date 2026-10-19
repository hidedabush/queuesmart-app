import * as services from '../services/servicesService.js';

export function list(req, res) {
  res.json({ services: services.listServices() });
}

export function get(req, res) {
  res.json({ service: services.getService(req.params.id) });
}

export function create(req, res) {
  res.status(201).json({ service: services.createService(req.body) });
}

export function update(req, res) {
  res.json({ service: services.updateService(req.params.id, req.body) });
}

export function setOpen(req, res) {
  res.json({ service: services.setQueueOpen(req.params.id, req.body.isOpen) });
}

export function remove(req, res) {
  services.deleteService(req.params.id);
  res.status(204).end();
}
