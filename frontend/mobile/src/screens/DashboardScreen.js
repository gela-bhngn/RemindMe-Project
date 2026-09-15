import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { subscribeClassAnnouncements, subscribeClassSchedule, subscribeClassTasks } from "../services/remindmeRepository";
import { colors, commonStyles } from "../theme";
import { generatePriorities, getTaskStatus } from "../utils/priority";

export default function DashboardScreen({ classId }) {
  const [tasks, setTasks] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    const unsubscribers = [
      subscribeClassTasks(classId, setTasks),
      subscribeClassSchedule(classId, setSchedule),
      subscribeClassAnnouncements(classId, setAnnouncements)
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [classId]);

  const priorities = useMemo(() => generatePriorities(tasks), [tasks]);
  const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const todaySchedule = schedule.filter((item) => item.day === todayName);

  return (
    <ScrollView style={commonStyles.screen}>
      <Panel title="Today's Priority Tasks">
        {priorities.map((task) => (
          <Text key={task.id} style={styles.row}>{task.title} - due in {task.daysLeft} day(s)</Text>
        ))}
        {!priorities.length && <Text style={commonStyles.muted}>No priority tasks yet.</Text>}
      </Panel>

      <Panel title="Today's Schedule">
        {todaySchedule.map((item) => (
          <Text key={item.id} style={styles.row}>{item.subject} | {item.startTime}-{item.endTime}</Text>
        ))}
        {!todaySchedule.length && <Text style={commonStyles.muted}>No classes today.</Text>}
      </Panel>

      <Panel title="Upcoming Deadlines">
        {tasks.slice(0, 5).map((task) => (
          <Text key={task.id} style={styles.row}>{task.title} | {getTaskStatus(task)} | {task.dueDate}</Text>
        ))}
      </Panel>

      <Panel title="Announcements">
        {announcements.slice(0, 3).map((item) => (
          <Text key={item.id} style={styles.row}>{item.title}</Text>
        ))}
      </Panel>
    </ScrollView>
  );
}

function Panel({ title, children }) {
  return (
    <View style={commonStyles.card}>
      <Text style={commonStyles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    color: colors.ink,
    paddingVertical: 9
  }
});
