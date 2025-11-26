import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'models/theme_model.dart';
import 'screens/onboarding_screen.dart';

void main() => runApp(const MyApp());

class MyApp extends StatefulWidget {
  const MyApp({super.key});

  static _MyAppState? of(BuildContext context) =>
      context.findAncestorStateOfType<_MyAppState>();

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  ThemeMode _themeMode = ThemeMode.system;

  final Map<String, AppTheme> _themes = {
    'Default': AppTheme(
        name: 'Default',
        primaryColor: const Color(0xFF6200EE),
        accentColor: const Color(0xFF03DAC6),
        backgroundColor: const Color(0xFFF5F5F5),
        cardColor: Colors.white,
        brightness: Brightness.light),
    'Dark': AppTheme(
        name: 'Dark',
        primaryColor: const Color(0xFF1F1F1F),
        accentColor: const Color(0xFF03DAC6),
        backgroundColor: const Color(0xFF121212),
        cardColor: const Color(0xFF1E1E1E),
        brightness: Brightness.dark),
    'Light': AppTheme(
        name: 'Light',
        primaryColor: Colors.blue,
        accentColor: Colors.blueAccent,
        backgroundColor: Colors.white,
        cardColor: const Color(0xFFF5F5F5),
        brightness: Brightness.light),
  };

  late AppTheme _currentTheme;

  Map<String, AppTheme> get themes => _themes;
  AppTheme get currentTheme => _currentTheme;

  @override
  void initState() {
    super.initState();
    _currentTheme = _themes['Default']!; // Default theme
    _loadTheme();
  }

  Future<void> _loadTheme() async {
    final prefs = await SharedPreferences.getInstance();
    final themeName = prefs.getString('theme') ?? 'Default';
    setState(() {
      _currentTheme = _themes[themeName] ?? _themes['Default']!;
      _themeMode = _currentTheme.brightness == Brightness.dark
          ? ThemeMode.dark
          : ThemeMode.light;
    });
  }

  void changeTheme(String themeName) async {
    if (_themes.containsKey(themeName)) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('theme', themeName);
      setState(() {
        _currentTheme = _themes[themeName]!;
        _themeMode = _currentTheme.brightness == Brightness.dark
            ? ThemeMode.dark
            : ThemeMode.light;
      });
    }
  }

  ThemeData _buildTheme(AppTheme theme) {
    return ThemeData(
      primaryColor: theme.primaryColor,
      scaffoldBackgroundColor: theme.backgroundColor,
      brightness: theme.brightness,
      appBarTheme: AppBarTheme(
        backgroundColor: theme.primaryColor,
        foregroundColor:
        theme.brightness == Brightness.dark ? Colors.white : Colors.white,
      ),
      cardTheme: CardThemeData(
        color: theme.cardColor,
        elevation: 2,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: theme.accentColor,
        foregroundColor:
        theme.brightness == Brightness.dark ? Colors.black : Colors.white,
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(foregroundColor: theme.accentColor),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
            backgroundColor: theme.accentColor,
            foregroundColor: theme.brightness == Brightness.dark
                ? Colors.black
                : Colors.white,
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8))),
      ),
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: theme.accentColor, width: 2),
        ),
      ),
      colorScheme: ColorScheme.fromSwatch().copyWith(
          secondary: theme.accentColor, brightness: theme.brightness),
    );
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Expense Tracker',
      theme: _buildTheme(_currentTheme),
      darkTheme: _buildTheme(_themes['Dark']!),
      themeMode: _themeMode,
      home: const OnboardingScreen(),
      debugShowCheckedModeBanner: false,
    );
  }
}
