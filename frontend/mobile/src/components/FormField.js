import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "../theme";

export default function FormField({ label, value, onChangeText, placeholder, multiline, keyboardType, secureTextEntry }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.multiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        multiline={multiline}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 12
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 6
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.ink,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: "top"
  }
});
