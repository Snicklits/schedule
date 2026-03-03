import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const timeOffRouter = Router();

timeOffRouter.get("/", async (_req, res) => {
  try {
    const requests = await prisma.timeOffRequest.findMany({
      orderBy: { created_at: "desc" },
    });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch time-off requests" });
  }
});

timeOffRouter.get("/:id", async (req, res) => {
  try {
    const request = await prisma.timeOffRequest.findUnique({
      where: { id: req.params["id"] },
      include: { employee: true },
    });
    if (!request)
      return res.status(404).json({ error: "Time-off request not found" });
    res.json(request);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch time-off request" });
  }
});

timeOffRouter.post("/", async (req, res) => {
  try {
    const request = await prisma.timeOffRequest.create({ data: req.body });
    res.status(201).json(request);
  } catch (err) {
    res.status(400).json({ error: "Failed to create time-off request" });
  }
});

timeOffRouter.put("/:id", async (req, res) => {
  try {
    const request = await prisma.timeOffRequest.update({
      where: { id: req.params["id"] },
      data: req.body,
    });
    res.json(request);
  } catch (err) {
    res.status(400).json({ error: "Failed to update time-off request" });
  }
});

timeOffRouter.delete("/:id", async (req, res) => {
  try {
    await prisma.timeOffRequest.delete({ where: { id: req.params["id"] } });
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: "Failed to delete time-off request" });
  }
});
