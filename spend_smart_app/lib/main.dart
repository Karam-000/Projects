import 'dart:convert';
import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:introduction_screen/introduction_screen.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:excel/excel.dart' as excel;
import 'package:path_provider/path_provider.dart';
import 'package:flutter_colorpicker/flutter_colorpicker.dart';
import 'package:intl/intl.dart';
import 'package:currency_picker/currency_picker.dart';

//================================================================================================
// SECTION: DATA MODELS
// Description: These classes define the structure of the data used throughout the app,
// such as Expenses, Categories, and App Themes. They include methods for converting
// data to and from JSON for persistent storage.
//================================================================================================

/// A model class to hold category data.
/// Includes name, emoji, and a customizable color.
class Category {
  String name;
  String emoji;
  Color color;

  Category({required this.name, required this.emoji, required this.color});

  // Methods for JSON serialization for storing in SharedPreferences
  Map<String, dynamic> toJson() => {
    'name': name,
    'emoji': emoji,
    'color': color.value,
  };

  factory Category.fromJson(Map<String, dynamic> json) => Category(
    name: json['name'],
    emoji: json['emoji'],
    color: Color(json['color'] as int),
  );
}

/// A model class to hold expense data.
class Expense {
  final String title;
  final double amount;
  final DateTime date;
  final int? quantity;
  final String category;
  final bool isRecurring;

  Expense({
    required this.title,
    required this.amount,
    required this.date,
    this.quantity,
    required this.category,
    this.isRecurring = false,
  });

  Map<String, dynamic> toJson() => {
    'title': title,
    'amount': amount,
    'date': date.toIso8601String(),
    'quantity': quantity,
    'category': category,
    'isRecurring': isRecurring,
  };

  factory Expense.fromJson(Map<String, dynamic> json) => Expense(
    title: json['title'],
    amount: (json['amount'] as num).toDouble(),
    date: DateTime.parse(json['date']),
    quantity: json['quantity'] as int?,
    category: json['category'],
    isRecurring: json['isRecurring'] as bool? ?? false,
  );
}

/// A model class for defining the app's color scheme.
class AppTheme {
  final String name;
  final Color primaryColor;
  final Color accentColor;
  final Color backgroundColor;
  final Color cardColor;
  final Brightness brightness;

  AppTheme({
    required this.name,
    required this.primaryColor,
    required this.accentColor,
    required this.backgroundColor,
    required this.cardColor,
    required this.brightness,
  });
}

//================================================================================================
// SECTION: MAIN APP & THEME MANAGEMENT
// Description: This is the root of the application. It manages the app's theme state
// and initializes the main screen.
//================================================================================================

// Main function to run the app
void main() => runApp(const MyApp());

class MyApp extends StatefulWidget {
  const MyApp({super.key});

  // Allows descendant widgets to access and rebuild when the theme changes.
  static _MyAppState? of(BuildContext context) =>
      context.findAncestorStateOfType<_MyAppState>();

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  ThemeMode _themeMode = ThemeMode.system;

  // Predefined themes
  final Map<String, AppTheme> _themes = {
    'Mint': AppTheme(
        name: 'Mint',
        primaryColor: const Color(0xFF00695C),
        accentColor: const Color(0xFF004D40),
        backgroundColor: const Color(0xFFF0F7F6),
        cardColor: Colors.white,
        brightness: Brightness.light),
    'Dark': AppTheme(
        name: 'Dark',
        primaryColor: const Color(0xFF1F1F1F),
        accentColor: Colors.tealAccent,
        backgroundColor: const Color(0xFF121212),
        cardColor: const Color(0xFF1E1E1E),
        brightness: Brightness.dark),
    'Light': AppTheme(
        name: 'Light',
        primaryColor: Colors.teal,
        accentColor: Colors.tealAccent,
        backgroundColor: Colors.white,
        cardColor: const Color(0xFFF5F5F5),
        brightness: Brightness.light),
  };

  late AppTheme _currentTheme;

  @override
  void initState() {
    super.initState();
    _currentTheme = _themes['Mint']!; // Default theme
    _loadTheme();
  }

  /// Loads the saved theme from SharedPreferences.
  Future<void> _loadTheme() async {
    final prefs = await SharedPreferences.getInstance();
    final themeName = prefs.getString('theme') ?? 'Mint';
    setState(() {
      _currentTheme = _themes[themeName] ?? _themes['Mint']!;
      _themeMode = _currentTheme.brightness == Brightness.dark
          ? ThemeMode.dark
          : ThemeMode.light;
    });
  }

  /// Changes the application's theme and saves the preference.
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

  /// Builds the ThemeData object based on the current AppTheme.
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

//================================================================================================
// SECTION: ONBOARDING SCREEN
// Description: A screen shown to the user on their first launch of the app.
// It provides a brief introduction to the app's features.
//================================================================================================

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  _OnboardingScreenState createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  bool _isFirstTime = true;

  @override
  void initState() {
    super.initState();
    _checkFirstTime();
  }

  Future<void> _checkFirstTime() async {
    final prefs = await SharedPreferences.getInstance();
    final isFirstTime = prefs.getBool('isFirstTime') ?? true;
    if (mounted) {
      setState(() {
        _isFirstTime = isFirstTime;
      });
    }
  }

  void _onIntroEnd(context) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('isFirstTime', false);
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const HomeScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (!_isFirstTime) {
      return const HomeScreen();
    }

    final theme = Theme.of(context);

    const pageDecoration = PageDecoration(
      titleTextStyle: TextStyle(fontSize: 28.0, fontWeight: FontWeight.w700),
      bodyTextStyle: TextStyle(fontSize: 19.0),
      bodyPadding: EdgeInsets.fromLTRB(16.0, 0.0, 16.0, 16.0),
      pageColor: Colors.white,
      imagePadding: EdgeInsets.zero,
    );

    return IntroductionScreen(
      pages: [
        PageViewModel(
          title: "Welcome to Expense Tracker",
          body: "Manage your monthly salary and expenses with ease.",
          image: Icon(Icons.monetization_on,
              size: 100.0, color: theme.primaryColor),
          decoration: pageDecoration,
        ),
        PageViewModel(
          title: "Organize with Categories",
          body:
          "Categorize your spending to get a clear picture of your finances.",
          image: Icon(Icons.category, size: 100.0, color: theme.primaryColor),
          decoration: pageDecoration,
        ),
        PageViewModel(
          title: "Visualize Your Savings",
          body: "Use graphs to monitor your savings and expenses over time.",
          image: Icon(Icons.bar_chart, size: 100.0, color: theme.primaryColor),
          decoration: pageDecoration,
        ),
      ],
      onDone: () => _onIntroEnd(context),
      onSkip: () => _onIntroEnd(context),
      showSkipButton: true,
      skip: const Text('Skip'),
      next: const Icon(Icons.arrow_forward),
      done: const Text('Done', style: TextStyle(fontWeight: FontWeight.w600)),
      dotsDecorator: DotsDecorator(
        size: const Size(10.0, 10.0),
        color: const Color(0xFFBDBDBD),
        activeColor: theme.primaryColor,
        activeSize: const Size(22.0, 10.0),
        activeShape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(25.0)),
        ),
      ),
    );
  }
}

//================================================================================================
// SECTION: HOME SCREEN
// Description: The main screen of the app. It displays a summary of finances,
// lists recent expenses, and provides navigation to other features.
//================================================================================================

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  _HomeScreenState createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  // --- State Variables ---
  double _monthlySalary = 0.0;
  List<Expense> _currentMonthExpenses = [];
  List<Expense> _archivedExpenses = [];
  Map<String, double> _budgets = {};
  String _currency = 'USD';
  final TextEditingController _salaryController = TextEditingController();
  List<Category> _categories = [];
  bool _isLoading = true;
  // **NEW**: State variables for historical savings data
  Map<String, double> _monthlySavingsHistory = {};
  double _totalCumulativeSavings = 0.0;

  @override
  void initState() {
    super.initState();
    _loadAllData().then((_) {
      _checkForMonthlyReset();
    });
  }

  @override
  void dispose() {
    _salaryController.dispose();
    super.dispose();
  }

  // --- DATA MANAGEMENT ---

  /// Loads all data from SharedPreferences on startup.
  Future<void> _loadAllData() async {
    if (!mounted) return;
    setState(() {
      _isLoading = true;
    });

    final prefs = await SharedPreferences.getInstance();

    List<String> categoriesJson = prefs.getStringList('categories') ?? [];
    if (categoriesJson.isEmpty) {
      _categories = [
        Category(name: 'Groceries', emoji: '🛒', color: Colors.blue),
        Category(name: 'Rent', emoji: '🏠', color: Colors.orange),
        Category(name: 'Entertainment', emoji: '🎬', color: Colors.purple),
        Category(name: 'Transportation', emoji: '🚗', color: Colors.green),
        Category(name: 'Utilities', emoji: '💡', color: Colors.pink),
        Category(name: 'Other', emoji: '🛍️', color: Colors.redAccent),
      ];
    } else {
      _categories = categoriesJson
          .map((c) => Category.fromJson(jsonDecode(c) as Map<String, dynamic>))
          .toList();
    }

    _monthlySalary = prefs.getDouble('monthlySalary') ?? 0.0;
    _currency = prefs.getString('currency') ?? 'USD';
    _salaryController.text =
    _monthlySalary > 0 ? _monthlySalary.toStringAsFixed(2) : '';

    List<String> currentExpensesJson =
        prefs.getStringList('currentMonthExpenses') ?? [];
    _currentMonthExpenses = currentExpensesJson
        .map((e) => Expense.fromJson(jsonDecode(e) as Map<String, dynamic>))
        .toList();

    List<String> archivedExpensesJson =
        prefs.getStringList('archivedExpenses') ?? [];
    _archivedExpenses = archivedExpensesJson
        .map((e) => Expense.fromJson(jsonDecode(e) as Map<String, dynamic>))
        .toList();

    final budgetsJson = prefs.getString('budgets') ?? '{}';
    _budgets = (json.decode(budgetsJson) as Map<String, dynamic>)
        .map((key, value) => MapEntry(key, (value as num).toDouble()));

    // **NEW**: Load savings data
    final monthlySavingsJson =
        prefs.getString('monthlySavingsHistory') ?? '{}';
    _monthlySavingsHistory =
        (json.decode(monthlySavingsJson) as Map<String, dynamic>)
            .map((key, value) => MapEntry(key, (value as num).toDouble()));
    _totalCumulativeSavings = prefs.getDouble('totalCumulativeSavings') ?? 0.0;

    if (mounted) {
      setState(() {
        _isLoading = false;
      });
    }
  }

  /// **ENHANCED**: This function now correctly archives the previous month's expenses,
  /// calculates savings, and updates cumulative totals.
  Future<void> _checkForMonthlyReset() async {
    final prefs = await SharedPreferences.getInstance();
    final lastResetString = prefs.getString('lastResetDate');
    final now = DateTime.now();

    DateTime lastReset =
    lastResetString != null ? DateTime.parse(lastResetString) : now;

    if (now.month != lastReset.month || now.year != lastReset.year) {
      // It's a new month, so we process the previous month's data.
      final prevMonth = DateTime(now.year, now.month - 1);
      final monthYearKey = DateFormat('yyyy-MM').format(prevMonth);

      // Calculate total expenses for the last month.
      final totalExpensesForMonth = _currentMonthExpenses.fold(
          0.0, (sum, item) => sum + item.amount * (item.quantity ?? 1));
      final monthSavings = _monthlySalary - totalExpensesForMonth;

      final expensesToArchive =
      _currentMonthExpenses.where((exp) => !exp.isRecurring).toList();

      if (mounted) {
        setState(() {
          _totalCumulativeSavings += monthSavings;
          _monthlySavingsHistory[monthYearKey] = monthSavings;
          _archivedExpenses.addAll(expensesToArchive);
          _currentMonthExpenses =
              _currentMonthExpenses.where((exp) => exp.isRecurring).toList();
        });
      }

      await _saveMonthlySavingsHistory();
      await _saveTotalCumulativeSavings();
      await _saveExpenses();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text(
                  'Welcome to a new month! Your previous expenses are archived.')),
        );
      }
      // Update the last reset date to today
      await prefs.setString('lastResetDate', now.toIso8601String());
    }
  }

  // --- SAVE DATA METHODS ---
  Future<void> _saveSalary() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setDouble('monthlySalary', _monthlySalary);
  }

  Future<void> _saveCurrency() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('currency', _currency);
  }

  Future<void> _saveCategories() async {
    final prefs = await SharedPreferences.getInstance();
    List<String> categoriesJson =
    _categories.map((c) => jsonEncode(c.toJson())).toList();
    await prefs.setStringList('categories', categoriesJson);
  }

  Future<void> _saveExpenses() async {
    final prefs = await SharedPreferences.getInstance();
    List<String> currentExpensesJson =
    _currentMonthExpenses.map((e) => jsonEncode(e.toJson())).toList();
    await prefs.setStringList('currentMonthExpenses', currentExpensesJson);
    List<String> archivedExpensesJson =
    _archivedExpenses.map((e) => jsonEncode(e.toJson())).toList();
    await prefs.setStringList('archivedExpenses', archivedExpensesJson);
  }

  Future<void> _saveBudgets() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('budgets', json.encode(_budgets));
  }

  // **NEW**: Methods to save savings data
  Future<void> _saveMonthlySavingsHistory() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
        'monthlySavingsHistory', json.encode(_monthlySavingsHistory));
  }

  Future<void> _saveTotalCumulativeSavings() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setDouble('totalCumulativeSavings', _totalCumulativeSavings);
  }

  // --- CORE LOGIC METHODS ---
  void _addExpense(Expense expense) {
    if (mounted) {
      setState(() {
        _currentMonthExpenses.add(expense);
        _currentMonthExpenses.sort((a, b) => b.date.compareTo(a.date));
      });
    }
    _saveExpenses();
  }

  void _removeExpense(Expense expense) {
    if (mounted) {
      final index = _currentMonthExpenses.indexOf(expense);
      setState(() {
        _currentMonthExpenses.remove(expense);
      });
      _saveExpenses();

      // **NEW**: Show SnackBar with Undo action
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${expense.title} deleted'),
          action: SnackBarAction(
            label: 'Undo',
            onPressed: () {
              setState(() {
                _currentMonthExpenses.insert(index, expense);
              });
              _saveExpenses();
            },
          ),
        ),
      );
    }
  }

  // --- GETTERS for calculations ---
  double get _totalExpenses {
    return _currentMonthExpenses.fold(
        0.0, (sum, item) => sum + item.amount * (item.quantity ?? 1));
  }

  double get _totalSavings {
    return _monthlySalary - _totalExpenses;
  }

  Category _getCategoryByName(String name) {
    return _categories.firstWhere((c) => c.name == name,
        orElse: () => Category(name: 'Other', emoji: '🛍️', color: Colors.grey));
  }

  // **NEW**: Function to get days left in the current month
  int _getDaysLeftInMonth() {
    final now = DateTime.now();
    final lastDayOfMonth = DateTime(now.year, now.month + 1, 0);
    return lastDayOfMonth.day - now.day;
  }

  // --- DIALOGS & NAVIGATION ---
  void _showSetSalaryDialog() {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Set Monthly Salary'),
          content: TextField(
            controller: _salaryController,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(
              labelText: 'Enter your salary',
              prefixText: '$_currency ',
            ),
          ),
          actions: <Widget>[
            TextButton(
              child: const Text('Cancel'),
              onPressed: () => Navigator.of(context).pop(),
            ),
            ElevatedButton(
              child: const Text('Save'),
              onPressed: () {
                final newSalary =
                    double.tryParse(_salaryController.text) ?? 0.0;
                if (mounted) {
                  setState(() {
                    _monthlySalary = newSalary;
                  });
                }
                _saveSalary();
                Navigator.of(context).pop();
              },
            ),
          ],
        );
      },
    );
  }

  void _showCurrencyPicker() {
    showCurrencyPicker(
      context: context,
      showFlag: true,
      showCurrencyName: true,
      showCurrencyCode: true,
      onSelect: (Currency currency) {
        if (mounted) {
          setState(() {
            _currency = currency.symbol;
          });
          _saveCurrency();
        }
      },
      favorite: ['USD', 'EUR', 'GBP', 'AED'],
    );
  }

  void _showAddExpenseDialog() {
    final titleController = TextEditingController();
    final amountController = TextEditingController();
    final quantityController = TextEditingController(text: '1');
    String selectedCategory =
    _categories.isNotEmpty ? _categories.first.name : '';
    bool isRecurring = false;
    DateTime selectedDate = DateTime.now();
    showDialog(
        context: context,
        builder: (context) {
          return StatefulBuilder(builder: (context, setState) {
            return AlertDialog(
                title: const Text('Add New Expense'),
                content: SingleChildScrollView(
                    child: Column(mainAxisSize: MainAxisSize.min, children: [
                      TextField(
                          controller: titleController,
                          decoration:
                          const InputDecoration(labelText: 'Expense Title')),
                      TextField(
                          controller: amountController,
                          keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                          decoration: InputDecoration(
                              labelText: 'Amount', prefixText: '$_currency ')),
                      if (_categories.isNotEmpty)
                        DropdownButtonFormField<String>(
                            decoration:
                            const InputDecoration(labelText: 'Category'),
                            value: selectedCategory,
                            onChanged: (String? newValue) {
                              if (newValue != null) {
                                setState(() {
                                  selectedCategory = newValue;
                                });
                              }
                            },
                            items: _categories.map<DropdownMenuItem<String>>(
                                    (Category category) {
                                  return DropdownMenuItem<String>(
                                      value: category.name,
                                      child:
                                      Text('${category.emoji} ${category.name}'));
                                }).toList()),
                      Row(children: [
                        const Text('Recurring'),
                        Checkbox(
                            value: isRecurring,
                            onChanged: (bool? value) {
                              setState(() {
                                isRecurring = value ?? false;
                              });
                            })
                      ])
                    ])),
                actions: <Widget>[
                  TextButton(
                      child: const Text('Cancel'),
                      onPressed: () => Navigator.of(context).pop()),
                  ElevatedButton(
                      child: const Text('Add'),
                      onPressed: () {
                        final title = titleController.text;
                        final amount =
                            double.tryParse(amountController.text) ?? 0.0;
                        final quantity =
                            int.tryParse(quantityController.text) ?? 1;
                        if (title.isNotEmpty &&
                            amount > 0 &&
                            selectedCategory.isNotEmpty) {
                          final newExpense = Expense(
                              title: title,
                              amount: amount,
                              date: selectedDate,
                              quantity: quantity,
                              category: selectedCategory,
                              isRecurring: isRecurring);
                          _addExpense(newExpense);
                          Navigator.of(context).pop();
                        }
                      })
                ]);
          });
        });
  }

  // **NEW**: Dialog to set category-wise budgets
  void _showSetBudgetDialog() {
    showDialog(
      context: context,
      builder: (context) {
        // Use a temporary map to hold changes until saved.
        final tempBudgets = Map<String, double>.from(_budgets);
        return AlertDialog(
          title: const Text('Set Budgets'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: _categories.map((category) {
                final budgetController = TextEditingController(
                    text: tempBudgets[category.name]?.toStringAsFixed(2) ??
                        '');
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8.0),
                  child: TextField(
                    controller: budgetController,
                    keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                    decoration: InputDecoration(
                      labelText: '${category.emoji} ${category.name} Budget',
                      prefixText: '$_currency ',
                      border: const OutlineInputBorder(),
                    ),
                    onChanged: (value) {
                      tempBudgets[category.name] =
                          double.tryParse(value) ?? 0.0;
                    },
                  ),
                );
              }).toList(),
            ),
          ),
          actions: <Widget>[
            TextButton(
              child: const Text('Cancel'),
              onPressed: () => Navigator.of(context).pop(),
            ),
            ElevatedButton(
              child: const Text('Save'),
              onPressed: () {
                setState(() {
                  _budgets = tempBudgets;
                });
                _saveBudgets();
                Navigator.of(context).pop();
              },
            ),
          ],
        );
      },
    );
  }

  void _showSettingsSheet() {
    showModalBottomSheet(
        context: context,
        builder: (context) {
          final appState = MyApp.of(context)!;
          return Container(
              padding: const EdgeInsets.all(16),
              child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Settings',
                        style: Theme.of(context).textTheme.headlineSmall),
                    const SizedBox(height: 16),
                    const Text('App Theme'),
                    DropdownButton<String>(
                        value: appState._currentTheme.name,
                        isExpanded: true,
                        items: appState._themes.keys.map((String value) {
                          return DropdownMenuItem<String>(
                              value: value, child: Text(value));
                        }).toList(),
                        onChanged: (String? newValue) {
                          if (newValue != null) {
                            appState.changeTheme(newValue);
                          }
                        }),
                    ListTile(
                        leading: const Icon(Icons.category_outlined),
                        title: const Text('Manage Categories'),
                        onTap: () {
                          Navigator.pop(context);
                          _manageCategories();
                        }),
                    ListTile(
                        leading: const Icon(Icons.rule_folder_outlined),
                        title: const Text('Set Budgets'),
                        onTap: () {
                          Navigator.pop(context);
                          _showSetBudgetDialog();
                        }),
                    ListTile(
                        leading: const Icon(Icons.cloud_download_outlined),
                        title: const Text('Export Data to Excel'),
                        onTap: () {
                          Navigator.pop(context);
                          _exportToExcel();
                        })
                  ]));
        });
  }

  void _manageCategories() async {
    final updatedCategories = await Navigator.push(
      context,
      MaterialPageRoute(
          builder: (context) => CategoryManagementScreen(
            categories: _categories,
            allExpenses: _currentMonthExpenses + _archivedExpenses,
          )),
    );
    if (updatedCategories != null) {
      setState(() {
        _categories = updatedCategories as List<Category>;
      });
      _saveCategories();
    }
  }

  Future<void> _exportToExcel() async {
    final excel.Excel excelInstance = excel.Excel.createExcel();
    final sheetObject = excelInstance['Financial Report'];
    sheetObject.appendRow([
      'Date',
      'Expense Title',
      'Quantity',
      'Amount',
      'Currency',
      'Category',
      'Is Recurring'
    ]);
    final allExpenses = _currentMonthExpenses + _archivedExpenses;
    for (final expense in allExpenses) {
      sheetObject.appendRow([
        "${expense.date.year}-${expense.date.month}-${expense.date.day}",
        expense.title,
        expense.quantity ?? 'N/A',
        expense.amount,
        _currency,
        expense.category,
        expense.isRecurring ? 'Yes' : 'No'
      ]);
    }
    final directory = await getApplicationDocumentsDirectory();
    final path =
        '${directory.path}/financial_report_${DateTime.now().millisecondsSinceEpoch}.xlsx';
    final fileBytes = excelInstance.encode();
    if (fileBytes != null) {
      final file = File(path);
      await file.writeAsBytes(fileBytes);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Excel file saved to $path')),
        );
      }
    }
  }

  // --- UI BUILDING ---
  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Monthly Overview')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
          title: const Text('Dashboard'),
          elevation: 0,
          actions: [
            // **NEW**: Currency selector button
            TextButton(
              onPressed: _showCurrencyPicker,
              child: Text(_currency, style: const TextStyle(color: Colors.white)),
            ),
            IconButton(
                icon: const Icon(Icons.history),
                onPressed: () {
                  Navigator.of(context).push(MaterialPageRoute(
                      builder: (context) => ExpenseHistoryScreen(
                          allExpenses:
                          _currentMonthExpenses + _archivedExpenses,
                          currency: _currency)));
                },
                tooltip: 'View Expense History'),
            IconButton(
                icon: const Icon(Icons.settings_outlined),
                onPressed: _showSettingsSheet,
                tooltip: 'Settings'),
            IconButton(
                icon: const Icon(Icons.smart_toy_outlined),
                onPressed: () {
                  Navigator.of(context).push(MaterialPageRoute(
                      builder: (context) => const ChatbotScreen()));
                },
                tooltip: 'Open Chatbot')
          ]),
      body: RefreshIndicator(
          onRefresh: _loadAllData,
          child: SingleChildScrollView(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    // **NEW**: Days left counter
                    Container(
                        padding: const EdgeInsets.symmetric(
                            vertical: 8.0, horizontal: 16.0),
                        decoration: BoxDecoration(
                            color: theme.primaryColor.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(10)),
                        child: Text(
                            '${_getDaysLeftInMonth()} days left this month! 🗓️',
                            style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: theme.primaryColor),
                            textAlign: TextAlign.center)),
                    const SizedBox(height: 16),
                    _buildSummaryCard(theme),
                    const SizedBox(height: 24),
                    // **NEW**: Cumulative savings card
                    _buildCumulativeSavingsCard(),
                    const SizedBox(height: 24),
                    Text('Salary Breakdown', style: theme.textTheme.titleLarge),
                    const SizedBox(height: 10),
                    SizedBox(
                        height: 200, child: _buildSalaryPieChart(theme)),
                    const SizedBox(height: 24),
                    // **NEW**: Budgets overview
                    _buildBudgetOverview(),
                    const SizedBox(height: 24),



                    const SizedBox(height: 24),
                    Text('Recent Expenses', style: theme.textTheme.titleLarge),
                    const SizedBox(height: 10),
                    _buildExpenseList()
                  ]))),
      floatingActionButton: FloatingActionButton(
          onPressed: _showAddExpenseDialog,
          tooltip: 'Add Expense',
          child: const Icon(Icons.add)),
    );
  }

  Widget _buildSummaryCard(ThemeData theme) {
    return Card(
      elevation: 4,
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          gradient: LinearGradient(
            colors: [theme.primaryColor, theme.colorScheme.secondary],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('This Month\'s Balance',
                style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Colors.white)),
            const SizedBox(height: 8),
            Text('$_currency ${_totalSavings.toStringAsFixed(2)}',
                style: const TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.bold,
                    color: Colors.white)),
            const SizedBox(height: 20),
            Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _buildSummaryDetail(
                      'Salary', _monthlySalary, Icons.account_balance_wallet),
                  _buildSummaryDetail(
                      'Spent', _totalExpenses, Icons.arrow_downward)
                ]),
            const SizedBox(height: 10),
            Center(
                child: TextButton.icon(
                    onPressed: _showSetSalaryDialog,
                    icon: const Icon(Icons.edit,
                        color: Colors.white70, size: 16),
                    label: const Text('Edit Salary',
                        style: TextStyle(color: Colors.white70))))
          ],
        ),
      ),
    );
  }

  // **NEW**: Card to display total cumulative savings
  Widget _buildCumulativeSavingsCard() {
    return Card(
      elevation: 2,
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('Total Cumulative Savings',
                style: Theme.of(context).textTheme.titleMedium),
            Text('$_currency ${_totalCumulativeSavings.toStringAsFixed(2)}',
                style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: _totalCumulativeSavings >= 0
                        ? Colors.green
                        : Colors.red)),
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryDetail(String title, double amount, IconData icon) {
    return Row(
      children: [
        Icon(icon, color: Colors.white70, size: 20),
        const SizedBox(width: 8),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title,
                style: const TextStyle(fontSize: 14, color: Colors.white70)),
            Text('$_currency ${amount.toStringAsFixed(2)}',
                style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.white)),
          ],
        ),
      ],
    );
  }

  Widget _buildSalaryPieChart(ThemeData theme) {
    if (_monthlySalary <= 0) {
      return const Center(
          child:
          Text('Please set your monthly salary to see the breakdown.'));
    }

    final totalExpenses = _totalExpenses;
    final totalSavings = _totalSavings;
    List<PieChartSectionData> sections = [];

    if (totalExpenses > 0) {
      sections.add(PieChartSectionData(
        color: Colors.redAccent,
        value: totalExpenses,
        title:
        '${(totalExpenses / _monthlySalary * 100).toStringAsFixed(0)}%',
        radius: 60,
        titleStyle: const TextStyle(
            fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white),
      ));
    }

    if (totalSavings > 0) {
      sections.add(PieChartSectionData(
        color: theme.colorScheme.secondary,
        value: totalSavings,
        title:
        '${(totalSavings / _monthlySalary * 100).toStringAsFixed(0)}%',
        radius: 60,
        titleStyle: const TextStyle(
            fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white),
      ));
    }

    if (sections.isEmpty) {
      return const Center(child: Text('No expenses recorded this month.'));
    }

    return PieChart(
      PieChartData(
        sections: sections,
        centerSpaceRadius: 40,
        sectionsSpace: 2,
        borderData: FlBorderData(show: false),
      ),
    );
  }


  // **NEW**: Widget to display budget progress
  Widget _buildBudgetOverview() {
    return Card(
      elevation: 2,
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Budgets',
                    style: Theme.of(context).textTheme.titleLarge),
                TextButton(
                    onPressed: _showSetBudgetDialog,
                    child: const Text('Set Budgets'))
              ],
            ),
            const SizedBox(height: 10),
            if (_budgets.isEmpty)
              const Center(child: Text('No budgets set.')),
            ..._categories.where((cat) => _budgets.containsKey(cat.name)).map(
                  (category) {
                final budget = _budgets[category.name] ?? 0.0;
                final spent = _currentMonthExpenses
                    .where((exp) => exp.category == category.name)
                    .fold(
                    0.0,
                        (sum, item) =>
                    sum + item.amount * (item.quantity ?? 1));
                final progress = budget > 0 ? (spent / budget).clamp(0.0, 1.0) : 0.0;
                final isOverBudget = spent > budget && budget > 0;
                return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8.0),
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text('${category.emoji} ${category.name}',
                                    style: const TextStyle(
                                        fontWeight: FontWeight.bold)),
                                Text(
                                    '$_currency ${spent.toStringAsFixed(2)} / $_currency ${budget.toStringAsFixed(2)}',
                                    style: TextStyle(
                                        color: isOverBudget
                                            ? Colors.red
                                            : null))
                              ]),
                          const SizedBox(height: 5),
                          LinearProgressIndicator(
                              value: progress,
                              backgroundColor: Colors.grey.shade300,
                              color: isOverBudget
                                  ? Colors.red
                                  : Theme.of(context).primaryColor,
                              minHeight: 10)
                        ]));
              },
            ).toList()
          ],
        ),
      ),
    );
  }

  Widget _buildExpenseList() {
    return _currentMonthExpenses.isEmpty
        ? const Card(
      child: Padding(
        padding: EdgeInsets.all(16.0),
        child: Center(
            child: Text('No expenses found for this month.',
                style: TextStyle(fontSize: 16, color: Colors.grey))),
      ),
    )
        : ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: _currentMonthExpenses.length,
      itemBuilder: (context, index) {
        final expense = _currentMonthExpenses[index];
        final category = _getCategoryByName(expense.category);
        return Dismissible(
          key: Key(expense.date.toString() + expense.title),
          direction: DismissDirection.endToStart,
          background: Container(
            color: Colors.red,
            alignment: Alignment.centerRight,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: const Icon(Icons.delete, color: Colors.white),
          ),
          onDismissed: (direction) {
            // The remove logic is now inside the _removeExpense method
            // which also handles the Undo snackbar.
          },
          confirmDismiss: (direction) async {
            _removeExpense(expense);
            return false; // Prevents the widget from being removed immediately
          },
          child: Card(
            margin: const EdgeInsets.symmetric(vertical: 6.0),
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: category.color.withOpacity(0.2),
                child: Text(category.emoji,
                    style: const TextStyle(fontSize: 20)),
              ),
              title: Text(
                expense.title,
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
              subtitle: Text(
                  '${expense.category} | ${DateFormat('MMM d').format(expense.date)}'),
              trailing: Text(
                '- $_currency ${expense.amount.toStringAsFixed(2)}',
                style: const TextStyle(
                    color: Colors.red, fontWeight: FontWeight.bold),
              ),
            ),
          ),
        );
      },
    );
  }
}

//================================================================================================
// SECTION: CHATBOT SCREEN
// Description: An interactive chatbot powered by an AI model to provide financial advice
// and analyze spending habits.
//================================================================================================
String _sanitizeMessage(String input) {
  // Remove unwanted characters like control codes, excessive whitespace, or symbols
  final cleaned = input
      .replaceAll(RegExp(r'[^\x20-\x7E]'), '') // Removes non-printable ASCII
      .replaceAll(RegExp(r'\s+'), ' ')         // Collapses multiple spaces
      .trim();                                 // Removes leading/trailing spaces
  return cleaned;
}

class ChatMessage {
  final String text;
  final bool isUser;
  ChatMessage({required this.text, required this.isUser});
}

class ChatbotScreen extends StatefulWidget {
  const ChatbotScreen({super.key});
  @override
  _ChatbotScreenState createState() => _ChatbotScreenState();
}

class _ChatbotScreenState extends State<ChatbotScreen> {
  final TextEditingController _textController = TextEditingController();
  final List<ChatMessage> _messages = [
    ChatMessage(
        text: "Hello! I'm your AI financial assistant. How can I help?",
        isUser: false),
  ];
  bool _isThinking = false;
  late SharedPreferences _prefs;
  List<Expense> _allExpenses = [];
  String _currency = 'USD';

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    _prefs = await SharedPreferences.getInstance();
    final currentExpensesJson =
        _prefs.getStringList('currentMonthExpenses') ?? [];
    final archivedExpensesJson = _prefs.getStringList('archivedExpenses') ?? [];
    _allExpenses = [
      ...currentExpensesJson.map(
              (e) => Expense.fromJson(jsonDecode(e) as Map<String, dynamic>)),
      ...archivedExpensesJson.map(
              (e) => Expense.fromJson(jsonDecode(e) as Map<String, dynamic>))
    ];
    _currency = _prefs.getString('currency') ?? 'USD';
  }

  void _sendMessage({String? predefinedMessage}) async {
    final userMessage = predefinedMessage ?? _textController.text.trim();
    if (userMessage.isEmpty) return;
    if (mounted) {
      setState(() {
        _isThinking = true;
        _messages.add(ChatMessage(text: userMessage, isUser: true));
        _textController.clear();
      });
    }

    try {
      final promptMessages = await _buildPrompt(userMessage);
      final botResponse = await _callApi(promptMessages);
      final filteredResponse = _sanitizeMessage(botResponse);
      if (mounted) {
        setState(() {
          _messages.add(ChatMessage(text: filteredResponse, isUser: false));
          _isThinking = false;

        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _messages.add(ChatMessage(
              text: 'Sorry, I am unable to process your request right now.',
              isUser: false));
          _isThinking = false;
        });
      }
    }
  }

  Future<List<Map<String, String>>> _buildPrompt(String userMessage) async {
    List<Map<String, String>> messages = [];
    final systemPrompt =
        "You are a helpful and friendly financial assistant. Your goal is to help the user understand their spending habits and provide budget advice. Your responses should be encouraging and concise.";
    messages.add({"role": "system", "content": systemPrompt});

    if (userMessage.toLowerCase().contains('analyze')) {
      final expensesJson =
      jsonEncode(_allExpenses.map((e) => e.toJson()).toList());
      final analysisPrompt =
          "Analyze the user's expenses. Data: $expensesJson. Currency: $_currency. Provide a summary of spending habits, any notable trends, and a brief, practical piece of advice.";
      messages.add({"role": "user", "content": analysisPrompt});
    } else {
      messages.add({"role": "user", "content": userMessage});
    }
    return messages;
  }

  Future<String> _callApi(List<Map<String, String>> messages) async {
    const apiUrl = "https://router.huggingface.co/v1/chat/completions";
    const apiKey =
        "Add your token here"; // Replace with your key

    final response = await http.post(
      Uri.parse(apiUrl),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $apiKey'
      },
      body: jsonEncode({
        'messages': messages,
        'model': "openai/gpt-oss-20b:fireworks-ai",
        'stream': false,
      }),
    );

    if (response.statusCode == 200) {
      final jsonResponse = jsonDecode(response.body);
      return jsonResponse['choices'][0]['message']['content'] as String;
    } else {
      throw Exception('Failed to get response from API');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Financial Chatbot')),
      body: Column(
        children: [
          Expanded(
            child: ListView.builder(
              reverse: true,
              itemCount: _messages.length,
              itemBuilder: (context, index) {
                final message = _messages.reversed.toList()[index];
                return _buildMessage(message);
              },
            ),
          ),
          if (_isThinking) const LinearProgressIndicator(),
          _buildInputArea(),
        ],
      ),
    );
  }

  Widget _buildMessage(ChatMessage message) {
    return Align(
      alignment: message.isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4.0, horizontal: 8.0),
        padding: const EdgeInsets.all(12.0),
        decoration: BoxDecoration(
          color: message.isUser
              ? Theme.of(context).colorScheme.secondary
              : Theme.of(context).cardColor,
          borderRadius: BorderRadius.circular(15.0),
        ),
        child: Text(
          message.text,
          style: TextStyle(
              fontSize: 16.0,
              color: message.isUser ? Colors.white : null),
        ),
      ),
    );
  }

  Widget _buildInputArea() {
    return Container(
      padding: const EdgeInsets.all(8.0),
      color: Theme.of(context).scaffoldBackgroundColor,
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _textController,
              decoration: const InputDecoration(
                hintText: 'Ask about your finances...',
              ),
              onSubmitted: (_) => _sendMessage(),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.send),
            onPressed: _isThinking ? null : () => _sendMessage(),
            color: Theme.of(context).colorScheme.secondary,
          ),
        ],
      ),
    );
  }
}

//================================================================================================
// SECTION: EXPENSE HISTORY SCREEN
// Description: Displays a complete list of all expenses (current and archived),
// allowing the user to filter by month and year.
//================================================================================================

class ExpenseHistoryScreen extends StatefulWidget {
  final List<Expense> allExpenses;
  final String currency;

  const ExpenseHistoryScreen(
      {super.key, required this.allExpenses, required this.currency});

  @override
  _ExpenseHistoryScreenState createState() => _ExpenseHistoryScreenState();
}

class _ExpenseHistoryScreenState extends State<ExpenseHistoryScreen> {
  late List<String> _monthYears;
  late String _selectedMonthYear;
  late List<Expense> _filteredExpenses;

  @override
  void initState() {
    super.initState();
    _monthYears = _getUniqueMonthYears();
    _selectedMonthYear = _monthYears.isNotEmpty ? _monthYears.first : '';
    _filterExpenses();
  }

  List<String> _getUniqueMonthYears() {
    final uniqueDates = widget.allExpenses
        .map((e) => DateFormat('yyyy-MM').format(e.date))
        .toSet()
        .toList();
    uniqueDates.sort((a, b) => b.compareTo(a)); // Sort descending
    return uniqueDates;
  }

  void _filterExpenses() {
    if (_selectedMonthYear.isEmpty) {
      _filteredExpenses = [];
      return;
    }
    final year = int.parse(_selectedMonthYear.substring(0, 4));
    final month = int.parse(_selectedMonthYear.substring(5, 7));
    _filteredExpenses = widget.allExpenses
        .where((e) => e.date.year == year && e.date.month == month)
        .toList();
    _filteredExpenses.sort((a, b) => b.date.compareTo(a.date));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Expense History'),
        actions: [
          if (_monthYears.isNotEmpty)
            DropdownButton<String>(
              value: _selectedMonthYear,
              dropdownColor: Theme.of(context).primaryColor,
              style: const TextStyle(color: Colors.white),
              onChanged: (String? newValue) {
                if (newValue != null) {
                  setState(() {
                    _selectedMonthYear = newValue;
                    _filterExpenses();
                  });
                }
              },
              items: _monthYears.map<DropdownMenuItem<String>>((String value) {
                return DropdownMenuItem<String>(
                  value: value,
                  child: Text(DateFormat('MMMM yyyy')
                      .format(DateTime.parse('$value-01'))),
                );
              }).toList(),
            ),
        ],
      ),
      body: _filteredExpenses.isEmpty
          ? const Center(child: Text('No expenses found for this period.'))
          : ListView.builder(
        itemCount: _filteredExpenses.length,
        itemBuilder: (context, index) {
          final expense = _filteredExpenses[index];
          return ListTile(
            title: Text(expense.title),
            subtitle: Text(
                '${DateFormat('MMM d, y').format(expense.date)} | ${expense.category}'),
            trailing: Text(
                '${widget.currency} ${expense.amount.toStringAsFixed(2)}'),
          );
        },
      ),
    );
  }
}

//================================================================================================
// SECTION: CATEGORY MANAGEMENT SCREEN
// Description: Allows users to create, view, and delete spending categories.
//================================================================================================

class CategoryManagementScreen extends StatefulWidget {
  final List<Category> categories;
  final List<Expense> allExpenses;

  const CategoryManagementScreen(
      {super.key, required this.categories, required this.allExpenses});

  @override
  _CategoryManagementScreenState createState() =>
      _CategoryManagementScreenState();
}

class _CategoryManagementScreenState extends State<CategoryManagementScreen> {
  late List<Category> _categories;
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _emojiController = TextEditingController();
  Color _currentColor = Colors.blue;

  @override
  void initState() {
    super.initState();
    _categories = List.from(widget.categories);
  }

  void _showAddCategoryDialog() {
    _nameController.clear();
    _emojiController.clear();
    _currentColor = Colors.blue;

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Add New Category'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: _nameController,
                decoration: const InputDecoration(labelText: 'Category Name'),
              ),
              TextField(
                controller: _emojiController,
                decoration: const InputDecoration(labelText: 'Emoji (e.g. 🛒)'),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () {
                if (_nameController.text.isNotEmpty &&
                    _emojiController.text.isNotEmpty) {
                  setState(() {
                    _categories.add(Category(
                      name: _nameController.text,
                      emoji: _emojiController.text,
                      color: _currentColor,
                    ));
                  });
                  Navigator.of(context).pop();
                }
              },
              child: const Text('Add'),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Manage Categories'),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => Navigator.pop(context, _categories),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: _showAddCategoryDialog,
          ),
        ],
      ),
      body: WillPopScope(
        onWillPop: () async {
          Navigator.pop(context, _categories);
          return true;
        },
        child: ListView.builder(
          itemCount: _categories.length,
          itemBuilder: (context, index) {
            final category = _categories[index];
            final isUsed =
            widget.allExpenses.any((e) => e.category == category.name);
            return ListTile(
              leading: CircleAvatar(
                  backgroundColor: category.color,
                  child: Text(category.emoji)),
              title: Text(category.name),
              trailing: isUsed
                  ? null
                  : IconButton(
                icon: const Icon(Icons.delete, color: Colors.red),
                onPressed: () {
                  setState(() {
                    _categories.removeAt(index);
                  });
                },
              ),
            );
          },
        ),
      ),
    );
  }
}

