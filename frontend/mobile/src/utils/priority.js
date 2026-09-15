const difficultyScore = {
  Easy: 1,
  Medium: 2,
  Hard: 3
};

export function getTaskStatus(task) {
  if (task.status === "Completed") return "Completed";
  const due = new Date(`${task.dueDate}T23:59:59`);
  return due < new Date() ? "Overdue" : "Upcoming";
}

export function generatePriorities(tasks) {
  const now = new Date();
  return tasks
    .filter((task) => getTaskStatus(task) !== "Completed")
    .map((task) => {
      const due = new Date(`${task.dueDate}T23:59:59`);
      const daysLeft = Math.max(0, Math.ceil((due - now) / 86400000));
      const score = Math.max(1, 8 - daysLeft) + (difficultyScore[task.difficulty] || 1) * 2 + Number(task.workload || 1);
      return { ...task, daysLeft, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
