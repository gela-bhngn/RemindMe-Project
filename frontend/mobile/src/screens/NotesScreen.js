import React, { useEffect, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import FormField from "../components/FormField";
import PrimaryButton from "../components/PrimaryButton";
import { addSubjectNote, subscribeClassNotes } from "../services/remindmeRepository";
import { commonStyles } from "../theme";

const emptyForm = {
  title: "",
  subject: "",
  content: "",
  link: ""
};

export default function NotesScreen({ classId }) {
  const [form, setForm] = useState(emptyForm);
  const [notes, setNotes] = useState([]);

  useEffect(() => subscribeClassNotes(classId, setNotes), [classId]);

  async function save() {
    if (!form.title.trim() || !form.subject.trim()) return Alert.alert("Note title and subject are required");
    await addSubjectNote(classId, normalizeId(form.subject), form);
    setForm(emptyForm);
  }

  return (
    <ScrollView style={commonStyles.screen}>
      <View style={commonStyles.card}>
        <Text style={commonStyles.cardTitle}>Shared Notes</Text>
        <FormField label="Title" value={form.title} onChangeText={(title) => setForm((current) => ({ ...current, title }))} />
        <FormField label="Subject" value={form.subject} onChangeText={(subject) => setForm((current) => ({ ...current, subject }))} />
        <FormField label="Content" value={form.content} onChangeText={(content) => setForm((current) => ({ ...current, content }))} multiline />
        <FormField label="Material Link" value={form.link} onChangeText={(link) => setForm((current) => ({ ...current, link }))} />
        <PrimaryButton title="Add Note" onPress={save} />
      </View>

      {notes.map((note) => (
        <View key={note.id} style={commonStyles.card}>
          <Text style={commonStyles.cardTitle}>{note.title}</Text>
          <Text style={commonStyles.muted}>{note.subject}</Text>
          <Text>{note.content}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function normalizeId(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "subject";
}
