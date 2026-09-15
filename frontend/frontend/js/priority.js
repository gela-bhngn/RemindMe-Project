const difficultyScore = {
  Easy: 1,
  Medium: 2,
  Hard: 3
};

export function getTaskStatus(task, today = new Date()) {
  if (task.status === "Completed") return "completed";
  const due = new Date(`${task.dueDate}T23:59:59`);
  if (due < today) return "overdue";
  return "upcoming";
}

export function generatePriorities(tasks, today = new Date()) {
  return tasks
    .filter((task) => getTaskStatus(task, today) !== "completed")
    .map((task) => {
      const due = new Date(`${task.dueDate}T23:59:59`);
      const daysLeft = Math.max(0, Math.ceil((due - today) / 86400000));
      const urgency = Math.max(1, 8 - daysLeft);
      const score = urgency + difficultyScore[task.difficulty] * 2 + Number(task.workload || 1);
      return { ...task, score, daysLeft };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

export function suggestedStudyBlock(task) {
  const hours = Number(task.workload || 1);
  if (hours >= 5) return "Split into 2 study blocks today";
  if (task.difficulty === "Hard") return "Start with a 90-minute focused block";
  return "Finish in one short study block";
}
