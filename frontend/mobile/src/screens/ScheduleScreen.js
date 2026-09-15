import React, { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import FormField from "../components/FormField";
import PrimaryButton from "../components/PrimaryButton";
import { addScheduleItem, subscribeClassSchedule } from "../services/remindmeRepository";
import { colors, commonStyles } from "../theme";

const emptyForm = {
  subject: "",
  instructor: "",
  room: "",
  day: "Monday",
  startTime: "09:00",
  endTime: "10:00",
  semester: "1st Semester",
  schoolYear: "2026-2027"
};

export default function ScheduleScreen({ classId }) {
  const [form, setForm] = useState(emptyForm);
  const [schedule, setSchedule] = useState([]);

  useEffect(() => subscribeClassSchedule(classId, setSchedule), [classId]);

  async function save() {
    if (!form.subject.trim()) return Alert.alert("Subject is required");
    await addScheduleItem(classId, form);
    setForm(emptyForm);
  }

  return (
    <ScrollView style={commonStyles.screen}>
      <View style={commonStyles.card}>
        <Text style={commonStyles.cardTitle}>Create Semester Schedule</Text>
        {Object.keys(emptyForm).map((key) => (
          <FormField
            key={key}
            label={labelFor(key)}
            value={form[key]}
            onChangeText={(value) => setForm((current) => ({ ...current, [key]: value }))}
          />
        ))}
        <PrimaryButton title="Add Subject" onPress={save} />
      </View>

      {schedule.map((item) => (
        <View key={item.id} style={commonStyles.card}>
          <Text style={styles.itemTitle}>{item.subject}</Text>
          <Text style={commonStyles.muted}>{item.day} | {item.startTime}-{item.endTime}</Text>
          <Text style={commonStyles.muted}>{item.room} | {item.instructor}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function labelFor(key) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

const styles = StyleSheet.create({
  itemTitle: {
    color: colors.ink,
    fontWeight: "900"
  }
});
