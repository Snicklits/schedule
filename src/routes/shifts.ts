import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const shiftRouter = Router();

shiftRouter.get("/", async (_req, res) => {
  try {
    const shifts = await prisma.shift.findMany({ orderBy: { date: "asc" } });
    res.json(shifts);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch shifts" });
  }
});

shiftRouter.get("/:id", async (req, res) => {
  try {
    const shift = await prisma.shift.findUnique({
      where: { id: req.params["id"] },
      include: { assignments: true },
    });
    if (!shift) return res.status(404).json({ error: "Shift not found" });
    res.json(shift);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch shift" });
  }
});

shiftRouter.post("/", async (req, res) => {
  try {
    const shift = await prisma.shift.create({ data: req.body });
    res.status(201).json(shift);
  } catch (err) {
    res.status(400).json({ error: "Failed to create shift" });
  }
});

shiftRouter.put("/:id", async (req, res) => {
  try {
    const shift = await prisma.shift.update({
      where: { id: req.params["id"] },
      data: req.body,
    });
    res.json(shift);
  } catch (err) {
    res.status(400).json({ error: "Failed to update shift" });
  }
});

shiftRouter.delete("/:id", async (req, res) => {
  try {
    await prisma.shift.delete({ where: { id: req.params["id"] } });
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: "Failed to delete shift" });
  }
});
