import React, { useEffect, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import FormField from "../components/FormField";
import PrimaryButton from "../components/PrimaryButton";
import { addAnnouncement, subscribeClassAnnouncements } from "../services/remindmeRepository";
import { commonStyles } from "../theme";

const emptyForm = {
  title: "",
  message: "",
  audience: "Class"
};

export default function AnnouncementsScreen({ classId }) {
  const [form, setForm] = useState(emptyForm);
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => subscribeClassAnnouncements(classId, setAnnouncements), [classId]);

  async function save() {
    if (!form.title.trim() || !form.message.trim()) return Alert.alert("Title and message are required");
    await addAnnouncement(classId, form);
    setForm(emptyForm);
  }

  return (
    <ScrollView style={commonStyles.screen}>
      <View style={commonStyles.card}>
        <Text style={commonStyles.cardTitle}>General Announcement</Text>
        <FormField label="Title" value={form.title} onChangeText={(title) => setForm((current) => ({ ...current, title }))} />
        <FormField label="Audience" value={form.audience} onChangeText={(audience) => setForm((current) => ({ ...current, audience }))} />
        <FormField label="Message" value={form.message} onChangeText={(message) => setForm((current) => ({ ...current, message }))} multiline />
        <PrimaryButton title="Post Announcement" onPress={save} />
      </View>

      {announcements.map((item) => (
        <View key={item.id} style={commonStyles.card}>
          <Text style={commonStyles.cardTitle}>{item.title}</Text>
          <Text>{item.message}</Text>
          <Text style={commonStyles.muted}>{item.audience}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
