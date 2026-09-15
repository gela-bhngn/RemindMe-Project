import React, { useEffect, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import FormField from "../components/FormField";
import PrimaryButton from "../components/PrimaryButton";
import { addSubjectTask, subscribeClassTasks } from "../services/remindmeRepository";
import { commonStyles } from "../theme";
import { getTaskStatus } from "../utils/priority";

const emptyForm = {
  title: "",
  subject: "",
  type: "Homework",
  description: "",
  dueDate: "2026-07-20",
  difficulty: "Medium",
  workload: "2",
  status: "Upcoming"
};

export default function TasksScreen({ classId }) {
  const [form, setForm] = useState(emptyForm);
  const [tasks, setTasks] = useState([]);

  useEffect(() => subscribeClassTasks(classId, setTasks), [classId]);

  async function save() {
    if (!form.title.trim() || !form.subject.trim()) return Alert.alert("Task title and subject are required");
    await addSubjectTask(classId, normalizeId(form.subject), form);
    setForm(emptyForm);
  }

  return (
    <ScrollView style={commonStyles.screen}>
      <View style={commonStyles.card}>
        <Text style={commonStyles.cardTitle}>Add Academic Task</Text>
        {Object.keys(emptyForm).map((key) => (
          <FormField
            key={key}
            label={key.replace(/^./, (letter) => letter.toUpperCase())}
            value={form[key]}
            onChangeText={(value) => setForm((current) => ({ ...current, [key]: value }))}
            multiline={key === "description"}
            keyboardType={key === "workload" ? "numeric" : "default"}
          />
        ))}
        <PrimaryButton title="Save Task" onPress={save} />
      </View>

      {tasks.map((task) => (
        <View key={task.id} style={commonStyles.card}>
          <Text style={commonStyles.cardTitle}>{task.title}</Text>
          <Text style={commonStyles.muted}>{task.subject} | {task.type} | {getTaskStatus(task)}</Text>
          <Text style={commonStyles.muted}>Due {task.dueDate}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function normalizeId(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "subject";
}
