import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const scheduleRunRouter = Router();

scheduleRunRouter.get("/", async (_req, res) => {
  try {
    const runs = await prisma.scheduleRun.findMany({
      orderBy: { generated_at: "desc" },
    });
    res.json(runs);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch schedule runs" });
  }
});

scheduleRunRouter.get("/:id", async (req, res) => {
  try {
    const run = await prisma.scheduleRun.findUnique({
      where: { id: req.params["id"] },
      include: { constraint_violations: true },
    });
    if (!run) return res.status(404).json({ error: "Schedule run not found" });
    res.json(run);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch schedule run" });
  }
});

scheduleRunRouter.post("/", async (req, res) => {
  try {
    const run = await prisma.scheduleRun.create({ data: req.body });
    res.status(201).json(run);
  } catch (err) {
    res.status(400).json({ error: "Failed to create schedule run" });
  }
});

scheduleRunRouter.delete("/:id", async (req, res) => {
  try {
    await prisma.scheduleRun.delete({ where: { id: req.params["id"] } });
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: "Failed to delete schedule run" });
  }
});
