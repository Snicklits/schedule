import express from "express";
import { employeeRouter } from "./routes/employees.js";
import { shiftRouter } from "./routes/shifts.js";
import { timeOffRouter } from "./routes/time-off.js";
import { assignmentRouter } from "./routes/assignments.js";
import { scheduleConfigRouter } from "./routes/schedule-config.js";
import { scheduleRunRouter } from "./routes/schedule-runs.js";

const app = express();

app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ name: "schedule-api", status: "ok" });
});

app.use("/employees", employeeRouter);
app.use("/shifts", shiftRouter);
app.use("/time-off", timeOffRouter);
app.use("/assignments", assignmentRouter);
app.use("/schedule-config", scheduleConfigRouter);
app.use("/schedule-runs", scheduleRunRouter);

export default app;
