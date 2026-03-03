import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const assignmentRouter = Router();

assignmentRouter.get("/", async (_req, res) => {
  try {
    const assignments = await prisma.assignment.findMany();
    res.json(assignments);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch assignments" });
  }
});

assignmentRouter.get("/:id", async (req, res) => {
  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: req.params["id"] },
      include: { employee: true, shift: true },
    });
    if (!assignment)
      return res.status(404).json({ error: "Assignment not found" });
    res.json(assignment);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch assignment" });
  }
});

assignmentRouter.post("/", async (req, res) => {
  try {
    const assignment = await prisma.assignment.create({ data: req.body });
    res.status(201).json(assignment);
  } catch (err) {
    res.status(400).json({ error: "Failed to create assignment" });
  }
});

assignmentRouter.put("/:id", async (req, res) => {
  try {
    const assignment = await prisma.assignment.update({
      where: { id: req.params["id"] },
      data: req.body,
    });
    res.json(assignment);
  } catch (err) {
    res.status(400).json({ error: "Failed to update assignment" });
  }
});

assignmentRouter.delete("/:id", async (req, res) => {
  try {
    await prisma.assignment.delete({ where: { id: req.params["id"] } });
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: "Failed to delete assignment" });
  }
});
