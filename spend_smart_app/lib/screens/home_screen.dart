import 'dart:convert';
import 'dart:io';

import 'package:currency_picker/currency_picker.dart';
import 'package:excel/excel.dart' as excel;
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../main.dart';
import '../models/category_model.dart';
import '../models/expense_model.dart';
import '../tabs/analysis_tab.dart';
import '../tabs/budgets_tab.dart';
import '../tabs/home_tab.dart';
import 'category_management_screen.dart';

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
  Map<String, double> _monthlySavingsHistory = {};
  double _totalCumulativeSavings = 0.0;

  int _selectedIndex = 0;
  final PageController _pageController = PageController();

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
    _pageController.dispose();
    super.dispose();
  }

  // --- DATA MANAGEMENT ---
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

  Future<void> _checkForMonthlyReset() async {
    final prefs = await SharedPreferences.getInstance();
    final lastResetString = prefs.getString('lastResetDate');
    final now = DateTime.now();

    DateTime lastReset =
    lastResetString != null ? DateTime.parse(lastResetString) : now;

    if (now.month != lastReset.month || now.year != lastReset.year) {
      final prevMonth = DateTime(now.year, now.month - 1);
      final monthYearKey = DateFormat('yyyy-MM').format(prevMonth);

      final totalExpensesForMonth = _currentMonthExpenses.fold(
          0.0, (sum, item) => sum + item.amount * (item.quantity ?? 1));
      final monthSavings = _monthlySalary - totalExpensesForMonth;

      final expensesToArchive =
      _currentMonthExpenses.where((exp) => !exp.isRecurring).toList();
      final recurringExpenses =
      _currentMonthExpenses.where((exp) => exp.isRecurring).toList();

      if (mounted) {
        setState(() {
          _totalCumulativeSavings += monthSavings;
          _monthlySavingsHistory[monthYearKey] = monthSavings;
          _archivedExpenses.addAll(expensesToArchive);
          _currentMonthExpenses = recurringExpenses.map((e) {
            return Expense(
              title: e.title,
              amount: e.amount,
              date: now,
              quantity: e.quantity,
              category: e.category,
              isRecurring: e.isRecurring,
            );
          }).toList();
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
      await prefs.setString('lastResetDate', now.toIso8601String());
    }
  }

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

  Future<void> _saveMonthlySavingsHistory() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
        'monthlySavingsHistory', json.encode(_monthlySavingsHistory));
  }

  Future<void> _saveTotalCumulativeSavings() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setDouble('totalCumulativeSavings', _totalCumulativeSavings);
  }

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

  int _getDaysLeftInMonth() {
    final now = DateTime.now();
    final lastDayOfMonth = DateTime(now.year, now.month + 1, 0);
    return lastDayOfMonth.day - now.day;
  }

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

  void _showSetBudgetDialog() {
    showDialog(
      context: context,
      builder: (context) {
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
                        value: appState.currentTheme.name,
                        isExpanded: true,
                        items: appState.themes.keys.map((String value) {
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

  void _onItemTapped(int index) {
    setState(() {
      _selectedIndex = index;
    });
    _pageController.animateToPage(
      index,
      duration: const Duration(milliseconds: 300),
      curve: Curves.ease,
    );
  }

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
          title: const Text('Dashboard'),
          elevation: 0,
          actions: [
            TextButton(
              onPressed: _showCurrencyPicker,
              child: Text(_currency, style: const TextStyle(color: Colors.white)),
            ),
            IconButton(
                icon: const Icon(Icons.settings_outlined),
                onPressed: _showSettingsSheet,
                tooltip: 'Settings'),
          ]),
      body: PageView(
        controller: _pageController,
        onPageChanged: (index) {
          setState(() {
            _selectedIndex = index;
          });
        },
        children: [
          HomeTab(
            monthlySalary: _monthlySalary,
            totalExpenses: _totalExpenses,
            totalSavings: _totalSavings,
            currency: _currency,
            showSetSalaryDialog: _showSetSalaryDialog,
            currentMonthExpenses: _currentMonthExpenses,
            getCategoryByName: _getCategoryByName,
            removeExpense: _removeExpense,
          ),
          BudgetsTab(
            budgets: _budgets,
            categories: _categories,
            currency: _currency,
            currentMonthExpenses: _currentMonthExpenses,
            showSetBudgetDialog: _showSetBudgetDialog,
          ),
          AnalysisTab(
            allExpenses: [..._currentMonthExpenses, ..._archivedExpenses],
            currency: _currency,
          ),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        items: const <BottomNavigationBarItem>[
          BottomNavigationBarItem(
            icon: Icon(Icons.home),
            label: 'Home',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.pie_chart),
            label: 'Budgets',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.analytics),
            label: 'Analysis',
          ),
        ],
        currentIndex: _selectedIndex,
        onTap: _onItemTapped,
      ),
      floatingActionButton: FloatingActionButton(
          onPressed: _showAddExpenseDialog,
          tooltip: 'Add Expense',
          child: const Icon(Icons.add)),
    );
  }
}
