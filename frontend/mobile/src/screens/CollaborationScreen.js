import React from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import PrimaryButton from "../components/PrimaryButton";
import { createClassWorkspace } from "../services/remindmeRepository";
import { commonStyles } from "../theme";

export default function CollaborationScreen({ classId }) {
  const inviteLink = `remindme://join/${classId}`;

  async function createWorkspace() {
    try {
      await createClassWorkspace(classId, "RemindMe Class Workspace");
      Alert.alert("Workspace created", "You can now add schedules, tasks, notes, and announcements.");
    } catch (error) {
      Alert.alert("Workspace not created", error.message);
    }
  }

  return (
    <ScrollView style={commonStyles.screen}>
      <View style={commonStyles.card}>
        <Text style={commonStyles.cardTitle}>QR Code & Invitation</Text>
        <Text style={commonStyles.muted}>Class ID</Text>
        <Text style={styles.code}>{classId}</Text>
        <Text style={commonStyles.muted}>Invitation Link</Text>
        <Text style={styles.code}>{inviteLink}</Text>
        <PrimaryButton title="Create Class Workspace" onPress={createWorkspace} />
      </View>

      <View style={commonStyles.card}>
        <Text style={commonStyles.cardTitle}>Android Next Step</Text>
        <Text style={commonStyles.muted}>
          Connect Expo Camera here to scan QR codes and call the backend invite endpoint.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  code: {
    fontWeight: "900",
    marginBottom: 14
  }
});
