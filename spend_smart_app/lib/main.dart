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


// Main function to run the app
void main() => runApp(MyApp());


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

class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Expense Tracker',
      theme: ThemeData(
        primarySwatch: Colors.teal,
        visualDensity: VisualDensity.adaptivePlatformDensity,
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.teal,
          foregroundColor: Colors.white,
        ),
      ),
      home: OnboardingScreen(),
    );
  }
}

/// The onboarding screen shown on first launch.
class OnboardingScreen extends StatefulWidget {
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
      MaterialPageRoute(builder: (_) => HomeScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (!_isFirstTime) {
      return HomeScreen();
    }

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
          image: Image.asset('Images/AppIcon.png', width: 100.0, height: 100.0,
              errorBuilder: (context, error, stackTrace) => const Icon(Icons.monetization_on, size: 100.0, color: Colors.teal)),
          decoration: pageDecoration,
        ),
        PageViewModel(
          title: "Organize with Categories",
          body:
          "Categorize your spending to get a clear picture of your finances.",
          image: const Icon(Icons.category, size: 100.0, color: Colors.teal),
          decoration: pageDecoration,
        ),
        PageViewModel(
          title: "Set Your Budgets",
          body: "Create budgets for each category and track your progress.",
          image: const Icon(Icons.money_off, size: 100.0, color: Colors.teal),
          decoration: pageDecoration,
        ),
        PageViewModel(
          title: "Visualize Your Savings",
          body: "Use graphs to monitor your savings and expenses over time.",
          image: const Icon(Icons.bar_chart, size: 100.0, color: Colors.teal),
          decoration: pageDecoration,
        ),
        PageViewModel(
          title: "Export Your Data",
          body: "Easily export your financial data to an Excel sheet.",
          image: const Icon(Icons.file_download, size: 100.0, color: Colors.teal),
          decoration: pageDecoration,
        ),
      ],
      onDone: () => _onIntroEnd(context),
      onSkip: () => _onIntroEnd(context),
      showSkipButton: true,
      skip: const Text('Skip'),
      next: const Icon(Icons.arrow_forward),
      done: const Text('Done', style: TextStyle(fontWeight: FontWeight.w600)),
      dotsDecorator: const DotsDecorator(
        size: Size(10.0, 10.0),
        color: Color(0xFFBDBDBD),
        activeSize: Size(22.0, 10.0),
        activeShape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(25.0)),
        ),
      ),
    );
  }
}

/// The main screen of the app, containing all the functionality.
class HomeScreen extends StatefulWidget {
  @override
  _HomeScreenState createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  double _monthlySalary = 0.0;
  List<Expense> _expenses = [];
  Map<String, double> _budgets = {};
  String _currency = 'AED';
  final TextEditingController _salaryController = TextEditingController();
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  Map<String, double> _monthlySavingsHistory = {};
  double _totalCumulativeSavings = 0.0;
  List<Category> _categories = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData().then((_) {
      _checkForMonthlyReset();
    });
    _searchController.addListener(() {
      if (mounted) {
        setState(() {
          _searchQuery = _searchController.text;
        });
      }
    });
  }

  @override
  void dispose() {
    _salaryController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  /// Loads all the saved data from SharedPreferences.
  Future<void> _loadData() async {
    setState(() { _isLoading = true; });
    final prefs = await SharedPreferences.getInstance();

    // Load categories or set defaults
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
      _categories = categoriesJson.map((c) => Category.fromJson(jsonDecode(c) as Map<String, dynamic>)).toList();
    }

    _monthlySalary = prefs.getDouble('monthlySalary') ?? 0.0;
    _currency = prefs.getString('currency') ?? 'AED';
    _salaryController.text = _monthlySalary > 0 ? _monthlySalary.toStringAsFixed(2) : '';

    List<String> expensesJson = prefs.getStringList('expenses') ?? [];
    _expenses =
        expensesJson.map((e) => Expense.fromJson(jsonDecode(e) as Map<String, dynamic>)).toList();

    final budgetsJson = prefs.getString('budgets') ?? '{}';
    _budgets = (json.decode(budgetsJson) as Map<String, dynamic>)
        .map((key, value) => MapEntry(key, (value as num).toDouble()));

    final monthlySavingsJson =
        prefs.getString('monthlySavingsHistory') ?? '{}';
    _monthlySavingsHistory =
        (json.decode(monthlySavingsJson) as Map<String, dynamic>)
            .map((key, value) => MapEntry(key, (value as num).toDouble()));

    _totalCumulativeSavings = prefs.getDouble('totalCumulativeSavings') ?? 0.0;

    if (mounted) {
      setState(() { _isLoading = false; });
    }
  }

  /// Check if a new month has started to auto-archive.
  Future<void> _checkForMonthlyReset() async {
    final prefs = await SharedPreferences.getInstance();
    final lastVisitString = prefs.getString('lastVisitDate');
    final now = DateTime.now();

    if (lastVisitString != null) {
      final lastVisit = DateTime.parse(lastVisitString);
      // **FIXED:** The monthly reset now only resets the current month's expenses,
      // not all expenses, and only those that are not recurring.
      if (now.month != lastVisit.month || now.year != lastVisit.year) {
        // It's a new month, archive the previous one
        final prevMonth = DateTime(now.year, now.month - 1);
        final expensesForMonth = _expenses.where((exp) => exp.date.year == prevMonth.year && exp.date.month == prevMonth.month);
        final totalExpensesForMonth = expensesForMonth.fold(0.0, (sum, item) => sum + item.amount * (item.quantity ?? 1));
        final monthSavings = _monthlySalary - totalExpensesForMonth;
        final monthYearKey = '${prevMonth.year}-${prevMonth.month}';

        // Add savings to history and cumulative total
        if (mounted) {
          setState(() {
            _totalCumulativeSavings += monthSavings;
            _monthlySavingsHistory[monthYearKey] = monthSavings;
            // Filter out old expenses, keeping only recurring ones or those from the current month
            _expenses.removeWhere((exp) => exp.date.month == prevMonth.month && exp.date.year == prevMonth.year && !exp.isRecurring);
          });
        }
        await _saveTotalCumulativeSavings();
        await _saveMonthlySavingsHistory();
        await _saveExpenses();

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Welcome to the new month! Last month\'s data has been archived and reset.')),
          );
        }
      }
    }
    // Save the current visit date
    // FIX: Corrected typo from toIso86o1String to toIso8601String
    await prefs.setString('lastVisitDate', now.toIso8601String());
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

  /// Save the list of categories
  Future<void> _saveCategories() async {
    final prefs = await SharedPreferences.getInstance();
    List<String> categoriesJson = _categories.map((c) => jsonEncode(c.toJson())).toList();
    await prefs.setStringList('categories', categoriesJson);
  }

  Future<void> _saveExpenses() async {
    final prefs = await SharedPreferences.getInstance();
    List<String> expensesJson =
    _expenses.map((e) => jsonEncode(e.toJson())).toList();
    await prefs.setStringList('expenses', expensesJson);
  }

  Future<void> _saveBudgets() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('budgets', json.encode(_budgets));
  }

  Future<void> _saveMonthlySavingsHistory() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('monthlySavingsHistory', json.encode(_monthlySavingsHistory));
  }

  Future<void> _saveTotalCumulativeSavings() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setDouble('totalCumulativeSavings', _totalCumulativeSavings);
  }

  // --- CORE LOGIC METHODS ---
  void _addExpense(Expense expense) {
    if (mounted) {
      setState(() {
        _expenses.add(expense);
      });
    }
    _saveExpenses();
  }

  void _updateExpense(Expense oldExpense, Expense newExpense) {
    if (mounted) {
      final index = _expenses.indexOf(oldExpense);
      if (index != -1) {
        setState(() {
          _expenses[index] = newExpense;
        });
        _saveExpenses();
      }
    }
  }

  void _removeExpense(Expense expense) {
    if (mounted) {
      setState(() {
        _expenses.remove(expense);
      });
      _saveExpenses();
    }
  }

  // --- GETTERS for calculations ---
  double get _totalExpenses {
    final now = DateTime.now();
    return _expenses
        .where((exp) => exp.date.month == now.month && exp.date.year == now.year)
        .fold(0.0, (sum, item) => sum + item.amount * (item.quantity ?? 1));
  }

  double get _totalSavings {
    return _monthlySalary - _totalExpenses;
  }

  Category _getCategoryByName(String name) {
    return _categories.firstWhere((c) => c.name == name, orElse: () => Category(name: 'Other', emoji: '🛍️', color: Colors.grey));
  }

  // NEW: Function to get days left in the current month
  int _getDaysLeftInMonth() {
    final now = DateTime.now();
    final lastDayOfMonth = DateTime(now.year, now.month + 1, 0);
    return lastDayOfMonth.day - now.day;
  }

  // --- DIALOGS ---
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
            TextButton(
              child: const Text('Save'),
              onPressed: () {
                final newSalary = double.tryParse(_salaryController.text) ?? 0.0;
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
      favorite: ['AED', 'USD', 'EUR', 'GBP'],
    );
  }

  void _showSetBudgetDialog() {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Set Budgets'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: _categories.map((category) {
                final budgetController = TextEditingController(
                    text: _budgets[category.name]?.toStringAsFixed(2) ?? '');
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
                      _budgets[category.name] = double.tryParse(value) ?? 0.0;
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
            TextButton(
              child: const Text('Save'),
              onPressed: () {
                _saveBudgets();
                Navigator.of(context).pop();
              },
            ),
          ],
        );
      },
    );
  }

  /// Add expense dialog with date picker
  void _showAddOrEditExpenseDialog({Expense? expenseToEdit}) {
    final isEditing = expenseToEdit != null;
    final titleController = TextEditingController(text: isEditing ? expenseToEdit.title : '');
    final amountController = TextEditingController(text: isEditing ? expenseToEdit.amount.toString() : '');
    final quantityController = TextEditingController(text: isEditing ? (expenseToEdit.quantity ?? 1).toString() : '1');
    String selectedCategory = isEditing ? expenseToEdit.category : (_categories.isNotEmpty ? _categories.first.name : '');
    bool isRecurring = isEditing ? expenseToEdit.isRecurring : false;
    DateTime selectedDate = isEditing ? expenseToEdit.date : DateTime.now();

    showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setState) {
            return AlertDialog(
              title: Text(isEditing ? 'Edit Expense' : 'Add New Expense'),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextField(
                      controller: titleController,
                      decoration: const InputDecoration(labelText: 'Expense Title'),
                    ),
                    TextField(
                      controller: amountController,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: InputDecoration(
                        labelText: 'Amount',
                        prefixText: '$_currency ',
                      ),
                    ),
                    TextField(
                      controller: quantityController,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: const InputDecoration(labelText: 'Quantity'),
                    ),
                    const SizedBox(height: 10),
                    if (_categories.isNotEmpty) DropdownButtonFormField<String>(
                      decoration: const InputDecoration(labelText: 'Category'),
                      value: selectedCategory,
                      onChanged: (String? newValue) {
                        if (newValue != null) {
                          setState(() {
                            selectedCategory = newValue;
                          });
                        }
                      },
                      items: _categories
                          .map<DropdownMenuItem<String>>((Category category) {
                        return DropdownMenuItem<String>(
                          value: category.name,
                          child: Text('${category.emoji} ${category.name}'),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text("Date: ${selectedDate.day}/${selectedDate.month}/${selectedDate.year}"),
                        IconButton(
                          icon: const Icon(Icons.calendar_today),
                          onPressed: () async {
                            final DateTime? picked = await showDatePicker(
                              context: context,
                              initialDate: selectedDate,
                              firstDate: DateTime(2000),
                              lastDate: DateTime(2101),
                            );
                            if (picked != null && picked != selectedDate) {
                              setState(() {
                                selectedDate = picked;
                              });
                            }
                          },
                        ),
                      ],
                    ),
                    Row(
                      children: [
                        const Text('Is Recurring?'),
                        Checkbox(
                          value: isRecurring,
                          onChanged: (bool? value) {
                            setState(() {
                              isRecurring = value ?? false;
                            });
                          },
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              actions: <Widget>[
                TextButton(
                  child: const Text('Cancel'),
                  onPressed: () => Navigator.of(context).pop(),
                ),
                TextButton(
                  child: Text(isEditing ? 'Save' : 'Add'),
                  onPressed: () {
                    final title = titleController.text;
                    final amount = double.tryParse(amountController.text) ?? 0.0;
                    final quantity = int.tryParse(quantityController.text) ?? 1;
                    if (title.isNotEmpty && amount > 0 && selectedCategory.isNotEmpty) {
                      final newExpense = Expense(
                        title: title,
                        amount: amount,
                        date: selectedDate,
                        quantity: quantity,
                        category: selectedCategory,
                        isRecurring: isRecurring,
                      );
                      if (isEditing) {
                        _updateExpense(expenseToEdit, newExpense);
                      } else {
                        _addExpense(newExpense);
                      }
                      Navigator.of(context).pop();
                    }
                  },
                ),
              ],
            );
          },
        );
      },
    );
  }


  /// Navigate to category management screen
  void _manageCategories() async {
    final updatedCategories = await Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => CategoryManagementScreen(
        categories: _categories,
        allExpenses: _expenses,
      )),
    );
    if (updatedCategories != null) {
      setState(() {
        _categories = updatedCategories as List<Category>;
      });
      _saveCategories();
    }
  }

  /// Exports the expense data to an Excel file.
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
    for (final expense in _expenses) {
      sheetObject.appendRow([
        "${expense.date.year}-${expense.date.month}-${expense.date.day}",
        expense.title,
        expense.quantity ?? 'N/A',
        expense.amount,
        _currency,
        expense.isRecurring ? 'Yes' : 'No',
      ]);
    }
    sheetObject.appendRow([]);
    sheetObject.appendRow(['Monthly Salary', _monthlySalary, _currency]);
    sheetObject.appendRow(['Total Expenses (This Month)', _totalExpenses, _currency]);
    sheetObject.appendRow(['Total Savings (This Month)', _totalSavings, _currency]);
    sheetObject.appendRow(['Total Cumulative Savings', _totalCumulativeSavings, _currency]);
    final directory = await getApplicationDocumentsDirectory();
    final path = '${directory.path}/financial_report_${DateTime.now().millisecondsSinceEpoch}.xlsx';
    final fileBytes = excelInstance.encode();
    if (fileBytes != null) {
      final file = File(path);
      await file.writeAsBytes(fileBytes);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Excel file saved to $path'),
            action: SnackBarAction(
              label: 'Open',
              onPressed: () {
                // OpenFile.open(path); // Requires the open_file package
              },
            ),
          ),
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

    return Scaffold(
      appBar: AppBar(
        title: const Text('Monthly Overview'),
        actions: [
          IconButton(
            icon: const Icon(Icons.edit),
            onPressed: _showSetSalaryDialog,
            tooltip: 'Set Salary',
          ),
          IconButton(
            icon: const Icon(Icons.currency_exchange),
            onPressed: _showCurrencyPicker,
            tooltip: 'Set Currency',
          ),
          IconButton(
            icon: const Icon(Icons.history), // NEW: History button
            onPressed: () {
              Navigator.of(context).push(MaterialPageRoute(
                builder: (context) => ExpenseHistoryScreen(allExpenses: _expenses, currency: _currency),
              ));
            },
            tooltip: 'View Expense History',
          ),
          IconButton(
            icon: const Icon(Icons.category),
            onPressed: _manageCategories,
            tooltip: 'Manage Categories',
          ),
          IconButton(
            icon: const Icon(Icons.file_download),
            onPressed: _exportToExcel,
            tooltip: 'Export to Excel',
          ),
          IconButton(
            icon: const Icon(Icons.smart_toy_outlined),
            onPressed: () {
              Navigator.of(context).push(MaterialPageRoute(builder: (context) => ChatbotScreen()));
            },
            tooltip: 'Open Chatbot',
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Container(
              padding: const EdgeInsets.symmetric(vertical: 8.0, horizontal: 16.0),
              decoration: BoxDecoration(
                color: Colors.teal.shade100,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                '${_getDaysLeftInMonth()} days left this month! 🗓️',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Colors.teal,
                ),
                textAlign: TextAlign.center,
              ),
            ),
            const SizedBox(height: 20),
            _buildSummaryCard(),
            const SizedBox(height: 20),
            _buildCumulativeSavingsCard(),
            const SizedBox(height: 20),
            Text('Salary Breakdown', style: Theme.of(context).textTheme.titleLarge), // **MODIFIED:** Chart title
            const SizedBox(height: 10),
            Container(
              height: 250,
              padding: const EdgeInsets.all(16.0),
              child: _buildSalaryPieChart(), // **MODIFIED:** Calling the new chart function
            ),
            const SizedBox(height: 20),
            Text('Savings History', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 10),
            Container(
              height: 250,
              padding: const EdgeInsets.all(16.0),
              child: _buildSavingsHistoryChart(),
            ),
            const SizedBox(height: 20),
            _buildBudgetOverview(),
            const SizedBox(height: 20),
            Text('Recent Expenses', style: Theme.of(context).textTheme.titleLarge),
            _buildExpenseList(),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showAddOrEditExpenseDialog(),
        child: const Icon(Icons.add),
        tooltip: 'Add Expense',
      ),
    );
  }

  Widget _buildSummaryCard() {
    return Card(
      elevation: 4,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            _buildSummaryRow('Monthly Salary', _monthlySalary, Colors.teal),
            const Divider(),
            _buildSummaryRow('Total Expenses', _totalExpenses, Colors.red),
            const Divider(),
            _buildSummaryRow('Total Savings', _totalSavings, Colors.green),
          ],
        ),
      ),
    );
  }

  Widget _buildCumulativeSavingsCard() {
    return Card(
      elevation: 4,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      color: Colors.teal.shade50,
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Total Cumulative Savings',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            Text(
              '$_currency ${_totalCumulativeSavings.toStringAsFixed(2)}',
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: Colors.green,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryRow(String title, double amount, Color color) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            title,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          ),
          Text(
            '$_currency ${amount.toStringAsFixed(2)}',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  // **NEW:** Pie chart representing the total monthly salary
  Widget _buildSalaryPieChart() {
    if (_monthlySalary <= 0) {
      return const Center(child: Text('Please set your monthly salary to see the breakdown.'));
    }

    final totalExpenses = _totalExpenses;
    final totalSavings = _totalSavings;

    List<PieChartSectionData> sections = [];

    // Add expenses slice
    if (totalExpenses > 0) {
      final expensesPercentage = (totalExpenses / _monthlySalary) * 100;
      sections.add(PieChartSectionData(
        color: Colors.red,
        value: totalExpenses,
        title: 'Expenses\n${expensesPercentage.toStringAsFixed(1)}%',
        radius: 60,
        titleStyle: const TextStyle(
            fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white),
      ));
    }

    // Add savings slice
    if (totalSavings > 0) {
      final savingsPercentage = (totalSavings / _monthlySalary) * 100;
      sections.add(PieChartSectionData(
        color: Colors.green,
        value: totalSavings,
        title: 'Savings\n${savingsPercentage.toStringAsFixed(1)}%',
        radius: 60,
        titleStyle: const TextStyle(
            fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white),
      ));
    }

    // Handle case where savings are negative (overspending)
    if (_totalSavings < 0) {
      final overspent = _totalSavings.abs();
      final overspentPercentage = (overspent / _monthlySalary) * 100;
      sections.add(PieChartSectionData(
        color: Colors.grey, // A different color for the "remaining" portion of the salary
        value: _monthlySalary - totalExpenses,
        title: 'Overspent\n${overspentPercentage.toStringAsFixed(1)}%',
        radius: 60,
        titleStyle: const TextStyle(
            fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white),
      ));
    }

    if (sections.isEmpty) {
      return const Center(child: Text('No data to display.'));
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


  Widget _buildSavingsHistoryChart() {
    if (_monthlySavingsHistory.isEmpty) {
      return const Center(child: Text('No savings history to display.'));
    }

    final sortedKeys = _monthlySavingsHistory.keys.toList()..sort((a, b) => a.compareTo(b));
    final dataPoints = sortedKeys.asMap().entries.map((entry) {
      int index = entry.key;
      String key = entry.value;
      double savings = _monthlySavingsHistory[key]!;
      return BarChartGroupData(
        x: index,
        barRods: [
          BarChartRodData(
            toY: savings,
            color: savings >= 0 ? Colors.green : Colors.red,
            width: 15,
            borderRadius: BorderRadius.circular(5),
          ),
        ],
      );
    }).toList();

    return BarChart(
      BarChartData(
        barGroups: dataPoints,
        titlesData: FlTitlesData(
          show: true,
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              getTitlesWidget: (value, meta) {
                final index = value.toInt();
                if (index < 0 || index >= sortedKeys.length) return const SizedBox();
                final key = sortedKeys[index];
                final parts = key.split('-');
                return Text('${parts[1]}-${parts[0]}');
              },
            ),
          ),
          leftTitles: AxisTitles(
            sideTitles: SideTitles(showTitles: true),
          ),
          topTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
          rightTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
        ),
        gridData: FlGridData(show: true),
        borderData: FlBorderData(
          show: true,
          border: Border.all(color: const Color(0xff37434d), width: 1),
        ),
      ),
    );
  }

  Widget _buildBudgetOverview() {
    final now = DateTime.now();
    final thisMonthExpenses = _expenses.where((exp) =>
    exp.date.month == now.month && exp.date.year == now.year);
    final expensesByCategory = <String, double>{};
    for (var expense in thisMonthExpenses) {
      expensesByCategory.update(
          expense.category,
              (value) => value + (expense.amount * (expense.quantity ?? 1)),
          ifAbsent: () => (expense.amount * (expense.quantity ?? 1)));
    }

    return Card(
      elevation: 4,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Budgets',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                TextButton(
                  onPressed: _showSetBudgetDialog,
                  child: const Text('Set Budgets'),
                ),
              ],
            ),
            const SizedBox(height: 10),
            ..._categories.map((category) {
              final budget = _budgets[category.name] ?? 0.0;
              final spent = expensesByCategory[category.name] ?? 0.0;
              final progress = budget > 0 ? spent / budget : 0.0;
              final isOverBudget = spent > budget && budget > 0;
              final progressBarColor = isOverBudget ? Colors.red : Colors.teal;

              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 8.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          '${category.emoji} ${category.name}',
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                        Text(
                          '$_currency ${spent.toStringAsFixed(2)} / $_currency ${budget.toStringAsFixed(2)}',
                          style: TextStyle(
                              color: isOverBudget ? Colors.red : null),
                        ),
                      ],
                    ),
                    const SizedBox(height: 5),
                    LinearProgressIndicator(
                      value: progress.clamp(0.0, 1.0),
                      backgroundColor: Colors.grey.shade300,
                      color: progressBarColor,
                      minHeight: 10,
                      borderRadius: BorderRadius.circular(5),
                    ),
                  ],
                ),
              );
            }).toList(),
          ],
        ),
      ),
    );
  }

  Widget _buildExpenseList() {
    final now = DateTime.now();
    final filteredExpenses = _expenses.where((exp) {
      final matchesQuery = _searchQuery.isEmpty ||
          exp.title.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          exp.category.toLowerCase().contains(_searchQuery.toLowerCase());
      final isThisMonth = exp.date.month == now.month && exp.date.year == now.year;
      return matchesQuery && isThisMonth;
    }).toList();

    return filteredExpenses.isEmpty
        ? const Padding(
      padding: EdgeInsets.all(16.0),
      child: Center(child: Text('No expenses found for this month.')),
    )
        : ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: filteredExpenses.length,
      itemBuilder: (context, index) {
        final expense = filteredExpenses[index];
        final category = _getCategoryByName(expense.category);
        // **NEW:** `Dismissible` widget to allow for swipe-to-delete.
        return Dismissible(
          key: Key(expense.title + expense.date.toString()), // Unique key for each item
          direction: DismissDirection.endToStart,
          background: Container(
            color: Colors.red,
            alignment: Alignment.centerRight,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: const Icon(Icons.delete, color: Colors.white),
          ),
          onDismissed: (direction) {
            _removeExpense(expense);
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('${expense.title} dismissed'),
                action: SnackBarAction(
                  label: 'Undo',
                  onPressed: () {
                    // **NEW:** Re-add the expense to the list on undo
                    setState(() {
                      _expenses.insert(index, expense);
                    });
                    _saveExpenses();
                  },
                ),
              ),
            );
          },
          child: Card(
            margin: const EdgeInsets.symmetric(vertical: 8.0),
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: category.color,
                child: Text(category.emoji),
              ),
              title: Text(
                expense.title,
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
              subtitle: Text(
                  '${expense.category} | ${DateFormat('MMM d, y').format(expense.date)}'),
              trailing: Text(
                '$_currency ${expense.amount.toStringAsFixed(2)}',
                style: const TextStyle(
                    color: Colors.red, fontWeight: FontWeight.bold),
              ),
              // **NEW:** onTap to edit the expense
              onTap: () => _showAddOrEditExpenseDialog(expenseToEdit: expense),
            ),
          ),
        );
      },
    );
  }
}


// =================================================================
// NEW WIDGETS AND CLASSES FOR CHATBOT FEATURE
// =================================================================

/// A model class for a chat message.
class ChatMessage {
  final String text;
  final bool isUser;

  ChatMessage({required this.text, required this.isUser});
}

/// A full-screen widget for the chatbot.
class ChatbotScreen extends StatefulWidget {
  @override
  _ChatbotScreenState createState() => _ChatbotScreenState();
}

class _ChatbotScreenState extends State<ChatbotScreen> {
  final TextEditingController _textController = TextEditingController();
  final List<ChatMessage> _messages = [
    ChatMessage(text: "Hello! I am your personal financial assistant. How can I help you?", isUser: false),
  ];
  bool _isThinking = false;
  late SharedPreferences _prefs;
  List<Expense> _allExpenses = [];
  String _currency = 'AED';

  // Rate limiting variables
  DateTime _lastMessageTime = DateTime.now();
  int _messageCount = 0;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    _prefs = await SharedPreferences.getInstance();
    final expensesJson = _prefs.getStringList('expenses') ?? [];
    _allExpenses = expensesJson
        .map((e) => Expense.fromJson(jsonDecode(e) as Map<String, dynamic>))
        .toList();
    _currency = _prefs.getString('currency') ?? 'AED';
  }

  // Helper function to build a rich prompt for the AI.
  Future<List<Map<String, String>>> _buildPrompt(String userMessage, {bool isAnalyze = false}) async {
    List<Map<String, String>> messages = [];

    // System prompt to set the AI's persona and instructions
    final systemPrompt = """
      You are a helpful and friendly financial assistant. Your goal is to help the user understand their spending habits, provide budget advice, and give insights into their financial data.
      You can answer general financial questions and analyze their spending history.
      Your responses should be encouraging, concise, and easy to understand. Do not make up any data.
      When asked to analyze spending, use the provided data to give a summary and practical recommendations.
    """;
    messages.add({"role": "system", "content": systemPrompt});

    // Add previous messages for context
    for (var msg in _messages) {
      if (msg.isUser) {
        messages.add({"role": "user", "content": msg.text});
      } else {
        messages.add({"role": "assistant", "content": msg.text});
      }
    }

    // Special prompt for spending analysis
    if (isAnalyze) {
      final expensesLastTwoMonths = _allExpenses
          .where((e) => e.date.isAfter(DateTime.now().subtract(const Duration(days: 60))))
          .toList();
      final expensesJson = jsonEncode(expensesLastTwoMonths.map((e) => e.toJson()).toList());
      final currency = _currency;

      final analysisPrompt = """
        Analyze the following user's expenses. The data is for the last two months.
        Expenses data (JSON): $expensesJson
        Currency: $currency
        Based on this data, please provide:
        1. A summary of their spending habits.
        2. Any notable trends (e.g., increased spending in a certain category).
        3. A brief, practical piece of advice.
      """;
      messages.add({"role": "user", "content": analysisPrompt});
    } else {
      // Add the user's direct message if it's not a special analysis command
      messages.add({"role": "user", "content": userMessage});
    }

    return messages;
  }

  // NEW: Method to send a message to the chatbot
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

    bool isAnalyze = userMessage.toLowerCase().contains('analyze my spending');

    try {
      final promptMessages = await _buildPrompt(userMessage, isAnalyze: isAnalyze);
      final botResponse = await _callApi(promptMessages);
      if (mounted) {
        setState(() {
          _messages.add(ChatMessage(text: botResponse, isUser: false));
          _isThinking = false;
        });
      }
    } catch (e) {
      print('Error calling API: $e');
      if (mounted) {
        setState(() {
          _messages.add(ChatMessage(text: 'I am sorry, I am unable to process your request at this time.', isUser: false));
          _isThinking = false;
        });
      }
    }
  }

  // Placeholder for the API call to your backend/AI model.
  Future<String> _callApi(List<Map<String, String>> messages) async {
    const _huggingFaceApiUrl = "https://router.huggingface.co/v1/chat/completions";
    const _huggingFaceApiKey = "";

    if (_huggingFaceApiKey == "YOUR_HUGGING_FACE_API_KEY_HERE") {
      return "Please replace 'YOUR_HUGGING_FACE_API_KEY_HERE' with a valid API key to enable the chatbot.";
    }

    final url = Uri.parse(_huggingFaceApiUrl);
    final headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $_huggingFaceApiKey',
    };

    final body = jsonEncode({
      'messages': messages.map((m) => {'role': m['role'], 'content': m['content']}).toList(),
      'model': "openai/gpt-oss-20b:fireworks-ai",
      'stream': false,
    });

    final response = await http.post(url, headers: headers, body: body);

    if (response.statusCode == 200) {
      final jsonResponse = jsonDecode(response.body);
      final botMessage = jsonResponse['choices'][0]['message']['content'] as String;
      return _sanitizeResponse(botMessage);
    } else {
      print('API Error: ${response.statusCode} - ${response.body}');
      throw Exception('Failed to get response from API');
    }
  }

  // Helper function to filter the response text
  String _sanitizeResponse(String text) {
    // This regex now keeps only letters, numbers, hyphens, and spaces.
    // The `^` inside the square brackets means "not".
    final regex = RegExp(r'[^\w\s-]', unicode: true);
    return text.replaceAll(regex, '');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Financial Chatbot'),
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView.builder(
              reverse: true,
              itemCount: _messages.length,
              itemBuilder: (context, index) {
                final message = _messages[_messages.length - 1 - index];
                return _buildMessage(message);
              },
            ),
          ),
          if (_isThinking)
            const Padding(
              padding: EdgeInsets.all(8.0),
              child: LinearProgressIndicator(),
            ),
          _buildInputArea(),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _isThinking
            ? null
            : () => _sendMessage(predefinedMessage: 'analyze my spending'),
        tooltip: 'Get Savings Suggestions',
        child: const Icon(Icons.savings_outlined),
        backgroundColor: Colors.teal,
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
          color: message.isUser ? Colors.teal.shade100 : Colors.grey.shade200,
          borderRadius: BorderRadius.circular(15.0),
        ),
        child: Text(
          message.text,
          style: const TextStyle(fontSize: 16.0),
        ),
      ),
    );
  }

  Widget _buildInputArea() {
    return Container(
      padding: const EdgeInsets.all(8.0),
      color: Colors.white,
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _textController,
              decoration: const InputDecoration(
                hintText: 'Ask me about your finances...',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.all(Radius.circular(20.0)),
                ),
                contentPadding: EdgeInsets.symmetric(horizontal: 20.0),
              ),
              onSubmitted: (_) => _sendMessage(),
            ),
          ),
          const SizedBox(width: 8.0),
          IconButton(
            icon: const Icon(Icons.send),
            onPressed: _isThinking ? null : () => _sendMessage(),
            color: Colors.teal,
            disabledColor: Colors.grey,
          ),
        ],
      ),
    );
  }
}
// =================================================================
// NEW WIDGETS AND CLASSES FOR EXPENSE HISTORY AND CATEGORY MANAGEMENT
// =================================================================

/// Screen to display all expenses, filterable by month.
class ExpenseHistoryScreen extends StatefulWidget {
  final List<Expense> allExpenses;
  final String currency;

  ExpenseHistoryScreen({required this.allExpenses, required this.currency});

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
    final uniqueDates = widget.allExpenses.map((e) => DateFormat('yyyy-MM').format(e.date)).toSet().toList();
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
    _filteredExpenses = widget.allExpenses.where((e) => e.date.year == year && e.date.month == month).toList();
    _filteredExpenses.sort((a, b) => b.date.compareTo(a.date)); // Sort by date descending
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
                  child: Text(DateFormat('MMMM yyyy').format(DateTime.parse(value + '-01'))),
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
            subtitle: Text('${DateFormat('MMM d, y').format(expense.date)} | ${expense.category}'),
            trailing: Text('${widget.currency} ${expense.amount.toStringAsFixed(2)}'),
          );
        },
      ),
    );
  }
}

/// Screen to manage categories.
class CategoryManagementScreen extends StatefulWidget {
  final List<Category> categories;
  final List<Expense> allExpenses;

  CategoryManagementScreen({required this.categories, required this.allExpenses});

  @override
  _CategoryManagementScreenState createState() => _CategoryManagementScreenState();
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

  void _showColorPicker() {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Select a color'),
          content: SingleChildScrollView(
            child: ColorPicker(
              pickerColor: _currentColor,
              onColorChanged: (color) {
                setState(() {
                  _currentColor = color;
                });
              },
            ),
          ),
          actions: <Widget>[
            TextButton(
              child: const Text('Done'),
              onPressed: () {
                Navigator.of(context).pop();
              },
            ),
          ],
        );
      },
    );
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
              const SizedBox(height: 10),
              Row(
                children: [
                  const Text('Color: '),
                  GestureDetector(
                    onTap: _showColorPicker,
                    child: CircleAvatar(
                      backgroundColor: _currentColor,
                      radius: 15,
                    ),
                  ),
                ],
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancel'),
            ),
            TextButton(
              onPressed: () {
                if (_nameController.text.isNotEmpty && _emojiController.text.isNotEmpty) {
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
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: _showAddCategoryDialog,
            tooltip: 'Add Category',
          ),
          IconButton(
            icon: const Icon(Icons.save),
            onPressed: () {
              Navigator.pop(context, _categories);
            },
            tooltip: 'Save and Close',
          ),
        ],
      ),
      body: ListView.builder(
        itemCount: _categories.length,
        itemBuilder: (context, index) {
          final category = _categories[index];
          final isUsed = widget.allExpenses.any((e) => e.category == category.name);
          return ListTile(
            leading: CircleAvatar(backgroundColor: category.color, child: Text(category.emoji)),
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
    );
  }
}
