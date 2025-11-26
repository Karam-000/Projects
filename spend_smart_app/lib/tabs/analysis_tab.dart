import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:intl/intl.dart';

import '../models/expense_model.dart';
import '../screens/expense_history_screen.dart';
import '../services/spending_analyser.dart';

class AnalysisTab extends StatelessWidget {
  final List<Expense> allExpenses;
  final String currency;

  const AnalysisTab(
      {super.key, required this.allExpenses, required this.currency});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Spending Analysis',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 24),
            SizedBox(
              height: 250,
              child: _buildBarChart(context),
            ),
            const SizedBox(height: 24),
            _buildCategoryBreakdown(),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () {
                final analyser = SpendingAnalyser(allExpenses: allExpenses);
                final insights = analyser.getSpendingInsights();
                showDialog(
                  context: context,
                  builder: (context) => AlertDialog(
                    title: const Text('Spending Insights'),
                    content: Text(insights),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.of(context).pop(),
                        child: const Text('Close'),
                      ),
                    ],
                  ),
                );
              },
              child: const Text('Get Insights'),
            ),
            const SizedBox(height: 12),
            TextButton(
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (context) => ExpenseHistoryScreen(
                      allExpenses: allExpenses,
                      currency: currency,
                    ),
                  ),
                );
              },
              child: const Text('View Full History'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBarChart(BuildContext context) {
    final monthlyTotals = <String, double>{};
    for (var expense in allExpenses) {
      final monthYear = DateFormat('yyyy-MM').format(expense.date);
      monthlyTotals.update(monthYear, (value) => value + expense.amount,
          ifAbsent: () => expense.amount);
    }

    final sortedKeys = monthlyTotals.keys.toList()..sort();
    final barGroups = <BarChartGroupData>[];
    for (var i = 0; i < sortedKeys.length; i++) {
      final key = sortedKeys[i];
      barGroups.add(
        BarChartGroupData(
          x: i,
          barRods: [
            BarChartRodData(
              toY: monthlyTotals[key]!,
              color: Theme.of(context).primaryColor,
            ),
          ],
        ),
      );
    }

    return BarChart(
      BarChartData(
        alignment: BarChartAlignment.spaceAround,
        barGroups: barGroups,
        titlesData: FlTitlesData(
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              getTitlesWidget: (value, meta) {
                final index = value.toInt();
                if (index >= 0 && index < sortedKeys.length) {
                  final monthYear = sortedKeys[index];
                  return Text(DateFormat('MMM yy')
                      .format(DateTime.parse('$monthYear-01')));
                }
                return const Text('');
              },
            ),
          ),
          leftTitles: AxisTitles(
            sideTitles: SideTitles(showTitles: true),
          ),
        ),
      ),
    );
  }

  Widget _buildCategoryBreakdown() {
    final categoryTotals = <String, double>{};
    for (var expense in allExpenses) {
      categoryTotals.update(expense.category, (value) => value + expense.amount,
          ifAbsent: () => expense.amount);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: categoryTotals.entries.map((entry) {
        return Card(
          margin: const EdgeInsets.symmetric(vertical: 4.0),
          child: ListTile(
            title: Text(entry.key),
            trailing: Text(
              '$currency ${entry.value.toStringAsFixed(2)}',
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
          ),
        );
      }).toList(),
    );
  }
}
