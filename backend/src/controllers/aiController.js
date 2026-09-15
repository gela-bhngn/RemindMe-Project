const difficultyScore = {
  Easy: 1,
  Medium: 2,
  Hard: 3
};

export function generatePriorityPlan(tasks) {
  const today = new Date();
  return tasks
    .filter((task) => task.status !== "Completed")
    .map((task) => {
      const due = new Date(`${task.dueDate}T23:59:59`);
      const daysLeft = Math.max(0, Math.ceil((due - today) / 86400000));
      const score = Math.max(1, 8 - daysLeft) + (difficultyScore[task.difficulty] || 1) * 2 + Number(task.workload || 1);
      return {
        ...task,
        score,
        suggestion: score >= 12 ? "Do this first today" : "Schedule after urgent tasks"
      };
    })
    .sort((a, b) => b.score - a.score);
}
