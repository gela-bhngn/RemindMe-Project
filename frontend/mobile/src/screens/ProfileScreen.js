import React, { useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import FormField from "../components/FormField";
import PrimaryButton from "../components/PrimaryButton";
import { supabase } from "../services/supabase";
import { commonStyles } from "../theme";

export default function ProfileScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function register() {
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { name: "" } } });
    if (error) throw error;
    Alert.alert("Account created");
  }

  async function login() {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    Alert.alert("Logged in");
  }

  async function resetPassword() {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
    Alert.alert("Password reset email sent");
  }

  return (
    <ScrollView style={commonStyles.screen}>
      <View style={commonStyles.card}>
        <Text style={commonStyles.cardTitle}>Student Account</Text>
        <FormField label="Email" value={email} onChangeText={setEmail} />
        <FormField label="Password" value={password} onChangeText={setPassword} secureTextEntry />
        <View style={{ gap: 10 }}>
          <PrimaryButton title="Register" onPress={register} />
          <PrimaryButton title="Login" onPress={login} />
          <PrimaryButton title="Forgot Password" onPress={resetPassword} />
          <PrimaryButton title="Logout" onPress={() => supabase.auth.signOut()} />
        </View>
      </View>
    </ScrollView>
  );
}
