import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const scheduleConfigRouter = Router();

scheduleConfigRouter.get("/", async (_req, res) => {
  try {
    const configs = await prisma.scheduleConfig.findMany();
    res.json(configs);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch schedule configs" });
  }
});

scheduleConfigRouter.get("/:id", async (req, res) => {
  try {
    const config = await prisma.scheduleConfig.findUnique({
      where: { id: req.params["id"] },
    });
    if (!config)
      return res.status(404).json({ error: "Schedule config not found" });
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch schedule config" });
  }
});

scheduleConfigRouter.post("/", async (req, res) => {
  try {
    const config = await prisma.scheduleConfig.create({ data: req.body });
    res.status(201).json(config);
  } catch (err) {
    res.status(400).json({ error: "Failed to create schedule config" });
  }
});

scheduleConfigRouter.put("/:id", async (req, res) => {
  try {
    const config = await prisma.scheduleConfig.update({
      where: { id: req.params["id"] },
      data: req.body,
    });
    res.json(config);
  } catch (err) {
    res.status(400).json({ error: "Failed to update schedule config" });
  }
});

scheduleConfigRouter.delete("/:id", async (req, res) => {
  try {
    await prisma.scheduleConfig.delete({ where: { id: req.params["id"] } });
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: "Failed to delete schedule config" });
  }
});
