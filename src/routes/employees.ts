import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const employeeRouter = Router();

employeeRouter.get("/", async (_req, res) => {
  try {
    const employees = await prisma.employee.findMany();
    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch employees" });
  }
});

employeeRouter.get("/:id", async (req, res) => {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: req.params["id"] },
      include: { assignments: true, time_off_requests: true },
    });
    if (!employee) return res.status(404).json({ error: "Employee not found" });
    res.json(employee);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch employee" });
  }
});

employeeRouter.post("/", async (req, res) => {
  try {
    const employee = await prisma.employee.create({ data: req.body });
    res.status(201).json(employee);
  } catch (err) {
    res.status(400).json({ error: "Failed to create employee" });
  }
});

employeeRouter.put("/:id", async (req, res) => {
  try {
    const employee = await prisma.employee.update({
      where: { id: req.params["id"] },
      data: req.body,
    });
    res.json(employee);
  } catch (err) {
    res.status(400).json({ error: "Failed to update employee" });
  }
});

employeeRouter.delete("/:id", async (req, res) => {
  try {
    await prisma.employee.delete({ where: { id: req.params["id"] } });
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: "Failed to delete employee" });
  }
});
