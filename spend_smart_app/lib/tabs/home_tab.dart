import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/category_model.dart';
import '../models/expense_model.dart';

class HomeTab extends StatelessWidget {
  final double monthlySalary;
  final double totalExpenses;
  final double totalSavings;
  final String currency;
  final VoidCallback showSetSalaryDialog;
  final List<Expense> currentMonthExpenses;
  final Category Function(String) getCategoryByName;
  final Function(Expense) removeExpense;

  const HomeTab({
    super.key,
    required this.monthlySalary,
    required this.totalExpenses,
    required this.totalSavings,
    required this.currency,
    required this.showSetSalaryDialog,
    required this.currentMonthExpenses,
    required this.getCategoryByName,
    required this.removeExpense,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          _buildSummaryCard(theme),
          const SizedBox(height: 24),
          Text('Salary Breakdown', style: theme.textTheme.titleLarge),
          const SizedBox(height: 10),
          SizedBox(height: 200, child: _buildSalaryPieChart(theme)),
          const SizedBox(height: 24),
          Text('Recent Expenses', style: theme.textTheme.titleLarge),
          const SizedBox(height: 10),
          _buildExpenseList(),
        ],
      ),
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
            Text('$currency ${totalSavings.toStringAsFixed(2)}',
                style: const TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.bold,
                    color: Colors.white)),
            const SizedBox(height: 20),
            Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _buildSummaryDetail(
                      'Salary', monthlySalary, Icons.account_balance_wallet),
                  _buildSummaryDetail('Spent', totalExpenses, Icons.arrow_downward)
                ]),
            const SizedBox(height: 10),
            Center(
                child: TextButton.icon(
                    onPressed: showSetSalaryDialog,
                    icon: const Icon(Icons.edit,
                        color: Colors.white70, size: 16),
                    label: const Text('Edit Salary',
                        style: TextStyle(color: Colors.white70))))
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
            Text('$currency ${amount.toStringAsFixed(2)}',
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
    if (monthlySalary <= 0) {
      return const Center(
          child:
          Text('Please set your monthly salary to see the breakdown.'));
    }

    final totalExpenses = this.totalExpenses;
    final totalSavings = this.totalSavings;
    List<PieChartSectionData> sections = [];

    if (totalExpenses > 0) {
      sections.add(PieChartSectionData(
        color: Colors.redAccent,
        value: totalExpenses,
        title:
        '${(totalExpenses / monthlySalary * 100).toStringAsFixed(0)}%',
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
        '${(totalSavings / monthlySalary * 100).toStringAsFixed(0)}%',
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

  Widget _buildExpenseList() {
    return currentMonthExpenses.isEmpty
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
      itemCount: currentMonthExpenses.length,
      itemBuilder: (context, index) {
        final expense = currentMonthExpenses[index];
        final category = getCategoryByName(expense.category);
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
            removeExpense(expense);
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
                '- $currency ${expense.amount.toStringAsFixed(2)}',
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
