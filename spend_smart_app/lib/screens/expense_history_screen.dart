import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/expense_model.dart';

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
