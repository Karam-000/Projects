import '../models/expense_model.dart';

class SpendingAnalyser {
  final List<Expense> allExpenses;

  SpendingAnalyser({required this.allExpenses});

  String getSpendingInsights() {
    if (allExpenses.isEmpty) {
      return 'No spending data available yet. Start adding expenses to get insights!';
    }

    final totalSpending =
    allExpenses.fold(0.0, (sum, item) => sum + item.amount);
    final averageSpending = totalSpending / allExpenses.length;

    final categorySpending = <String, double>{};
    for (var expense in allExpenses) {
      categorySpending.update(
          expense.category, (value) => value + expense.amount,
          ifAbsent: () => expense.amount);
    }

    final topCategory = categorySpending.entries
        .reduce((a, b) => a.value > b.value ? a : b);

    return 'Based on your spending habits, we noticed:\n\n'
        '• Your average transaction is \$${averageSpending.toStringAsFixed(2)}.\n'
        '• Your top spending category is ${topCategory.key}, with a total of \$${topCategory.value.toStringAsFixed(2)}.\n\n'
        'Consider setting a budget for ${topCategory.key} to manage your expenses more effectively.';
  }
}
