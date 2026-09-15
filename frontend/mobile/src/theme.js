export const colors = {
  background: "#eef6ff",
  surface: "#ffffff",
  ink: "#10213f",
  muted: "#62708a",
  line: "#d7e8ff",
  blue: "#1677ff",
  blueDark: "#0f4bc7",
  cyan: "#20d2ff",
  yellow: "#f0b323",
  red: "#df4d56",
  green: "#14a66c",
  darkBackground: "#071426",
  darkSurface: "#10243d",
  darkInk: "#f4f8ff",
  darkMuted: "#a8b7cc"
};

export const commonStyles = {
  screen: {
    flex: 1,
    padding: 18,
    backgroundColor: colors.background
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 6
  },
  muted: {
    color: colors.muted
  }
};
