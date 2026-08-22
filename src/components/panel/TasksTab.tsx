import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Clock, Loader2, PlayCircle } from "lucide-react";
import { Toggle } from "../ui/Toggle";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { Input, Label, Select } from "../ui/Input";
import { useToast } from "../ui/Toast";
import { cn } from "../../lib/cn";

const actionOptions = ["Restart server", "Create backup", "Save-all + flush", "Send chat broadcast", "Run console command"] as const;

function actionToTask(action: string, command: string): { action: string; payload: string } {
  switch (action) {
    case "Restart server":
      return { action: "power", payload: "restart" };
    case "Create backup":
      return { action: "backup", payload: "" };
    case "Save-all + flush":
      return { action: "command", payload: "save-all flush" };
    case "Send chat broadcast":
      return { action: "command", payload: "say Scheduled broadcast" };
    default:
      return { action: "command", payload: command };
  }
}

function describeTask(task?: { action: string; payload: string }): string {
  if (!task) return "No action configured";
  if (task.action === "power") return `Power: ${task.payload}`;
  if (task.action === "backup") return "Create backup";
  return `Command: ${task.payload}`;
}

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function describeCron(cron: { minute: string; hour: string; day_of_week: string; day_of_month: string }): string {
  const time = `${cron.hour.padStart(2, "0")}:${cron.minute.padStart(2, "0")}`;
  if (cron.day_of_week === "*" || cron.day_of_week === "") {
    return `Daily at ${time}`;
  }
  const days = cron.day_of_week
    .split(",")
    .map((d) => dayLabels[Number(d)])
    .filter(Boolean)
    .join(", ");
  return `${days || "Custom"} at ${time}`;
}

interface ScheduleRow {
  id: number;
  name: string;
  cron: { minute: string; hour: string; day_of_week: string; day_of_month: string };
  is_active: boolean;
  last_run_at: string | null;
  tasks: { id: number; action: string; payload: string }[];
}

export function TasksTab({ identifier }: { identifier: string }) {
  const [tasks, setTasks] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [time, setTime] = useState("03:00");
  const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set());
  const [action, setAction] = useState<string>(actionOptions[0]);
  const [command, setCommand] = useState("");
  const [deleting, setDeleting] = useState<ScheduleRow | null>(null);
  const { push } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/servers/${identifier}/schedules`, { credentials: "include" });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { schedules: ScheduleRow[] };
      setTasks(data.schedules);
    } catch {
      push("Could not load scheduled tasks.", "warn");
    } finally {
      setLoading(false);
    }
  }, [identifier, push]);

  useEffect(() => {
    load();
  }, [load]);

  // Pterodactyl's schedule-update endpoint validates the full create payload, not
  // just the changed field — so every PATCH here re-sends the schedule's complete
  // cron + name, not just is_active.
  async function toggleTask(task: ScheduleRow) {
    try {
      const res = await fetch(`/api/servers/${identifier}/schedules/${task.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: task.name,
          minute: task.cron.minute,
          hour: task.cron.hour,
          day_of_month: task.cron.day_of_month,
          day_of_week: task.cron.day_of_week,
          is_active: !task.is_active,
        }),
      });
      if (!res.ok) throw new Error();
      setTasks((list) => list.map((t) => (t.id === task.id ? { ...t, is_active: !task.is_active } : t)));
    } catch {
      push("Failed to update task.", "warn");
    }
  }

  function toggleDay(day: number) {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  async function handleCreate() {
    if (!name.trim()) return;
    const [hour, minute] = time.split(":").map((v) => String(Number(v)));
    const dayOfWeek = selectedDays.size === 0 || selectedDays.size === 7 ? "*" : [...selectedDays].sort().join(",");
    try {
      const res = await fetch(`/api/servers/${identifier}/schedules`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          minute,
          hour,
          day_of_month: "*",
          day_of_week: dayOfWeek,
          is_active: true,
        }),
      });
      if (!res.ok) throw new Error();
      const { schedule } = (await res.json()) as { schedule: ScheduleRow };

      const taskPayload = actionToTask(action, command);
      await fetch(`/api/servers/${identifier}/schedules/${schedule.id}/tasks`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...taskPayload, time_offset: 0 }),
      });

      push(`Scheduled task "${name.trim()}" created.`, "success");
      setCreating(false);
      setName("");
      setCommand("");
      setTime("03:00");
      setSelectedDays(new Set());
      load();
    } catch {
      push("Failed to create scheduled task.", "warn");
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      const res = await fetch(`/api/servers/${identifier}/schedules/${deleting.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      push(`Deleted task "${deleting.name}"`, "warn");
      setDeleting(null);
      load();
    } catch {
      push("Failed to delete task.", "warn");
    }
  }

  async function handleExecute(task: ScheduleRow) {
    try {
      const res = await fetch(`/api/servers/${identifier}/schedules/${task.id}/execute`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      push(`Ran "${task.name}" now.`, "success");
    } catch {
      push("Failed to run task.", "warn");
    }
  }

  return (
    <div className="rounded-xl border border-line bg-panel/60">
      <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
        <div className="flex items-center gap-2 text-[13px] text-text-md">
          <Clock size={14} className="text-accent-400" />
          {tasks.filter((t) => t.is_active).length} of {tasks.length} tasks active
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus size={14} /> New task
        </Button>
      </div>

      <div className="divide-y divide-line-soft">
        {loading && (
          <div className="flex items-center justify-center gap-2 px-4 py-8 text-[13px] text-text-lo">
            <Loader2 size={15} className="animate-spin" /> Loading...
          </div>
        )}
        {!loading && tasks.length === 0 && (
          <p className="px-4 py-8 text-center text-[13px] text-text-lo">No scheduled tasks yet.</p>
        )}
        {!loading &&
          tasks.map((task) => (
            <div key={task.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-3">
                <Toggle checked={task.is_active} onChange={() => toggleTask(task)} label={`Toggle ${task.name}`} />
                <div>
                  <p className="text-[13.5px] font-medium text-text-hi">{task.name}</p>
                  <p className="mt-0.5 text-xs text-text-lo">
                    {describeCron(task.cron)} · {describeTask(task.tasks[0])} · last run{" "}
                    {task.last_run_at ? new Date(task.last_run_at).toLocaleString() : "Never"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => handleExecute(task)} title="Run now">
                  <PlayCircle size={15} />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setDeleting(task)} title="Delete task">
                  <Trash2 size={15} />
                </Button>
              </div>
            </div>
          ))}
      </div>

      <Modal open={creating} onClose={() => setCreating(false)} title="New scheduled task" description="Runs automatically based on a cron-style schedule.">
        <div className="space-y-4">
          <div>
            <Label htmlFor="task-name">Task name</Label>
            <Input id="task-name" placeholder="Nightly restart" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="task-time">Time of day</Label>
            <Input id="task-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="max-w-[140px]" />
          </div>
          <div>
            <Label>Days</Label>
            <div className="flex flex-wrap gap-1.5">
              {dayLabels.map((label, i) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={cn(
                    "rounded-md border px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                    selectedDays.has(i)
                      ? "border-accent-500/40 bg-accent-500/10 text-accent-300"
                      : "border-line bg-panel-2 text-text-md hover:border-line-soft hover:text-text-hi"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-text-lo">
              {selectedDays.size === 0 || selectedDays.size === 7 ? "Runs every day" : "Runs only on the selected days"}
            </p>
          </div>
          <div>
            <Label htmlFor="task-action">Action</Label>
            <Select id="task-action" value={action} onChange={(e) => setAction(e.target.value)}>
              {actionOptions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          </div>
          {action === "Run console command" && (
            <div>
              <Label htmlFor="task-command">Command</Label>
              <Input id="task-command" placeholder="say hello" value={command} onChange={(e) => setCommand(e.target.value)} className="font-mono" />
            </div>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setCreating(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate}>Create task</Button>
        </div>
      </Modal>

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete task"
        description={`Delete scheduled task "${deleting?.name}"?`}
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
