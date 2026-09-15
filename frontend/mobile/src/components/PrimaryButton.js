import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { colors } from "../theme";

export default function PrimaryButton({ title, onPress }) {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress}>
      <Text style={styles.text}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: colors.blue,
    borderRadius: 10,
    minHeight: 46,
    justifyContent: "center",
    paddingHorizontal: 14
  },
  text: {
    color: "white",
    fontWeight: "900"
  }
});
