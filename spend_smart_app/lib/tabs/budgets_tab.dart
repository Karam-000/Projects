import 'package:flutter/material.dart';

import '../models/category_model.dart';
import '../models/expense_model.dart';

class BudgetsTab extends StatelessWidget {
  final Map<String, double> budgets;
  final List<Category> categories;
  final String currency;
  final List<Expense> currentMonthExpenses;
  final VoidCallback showSetBudgetDialog;

  const BudgetsTab({
    super.key,
    required this.budgets,
    required this.categories,
    required this.currency,
    required this.currentMonthExpenses,
    required this.showSetBudgetDialog,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          _buildBudgetOverview(context),
        ],
      ),
    );
  }

  Widget _buildBudgetOverview(BuildContext context) {
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
                    onPressed: showSetBudgetDialog,
                    child: const Text('Set Budgets'))
              ],
            ),
            const SizedBox(height: 10),
            if (budgets.isEmpty)
              const Center(child: Text('No budgets set.')),
            ...categories.where((cat) => budgets.containsKey(cat.name)).map(
                  (category) {
                final budget = budgets[category.name] ?? 0.0;
                final spent = currentMonthExpenses
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
                                    '$currency ${spent.toStringAsFixed(2)} / $currency ${budget.toStringAsFixed(2)}',
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
}
