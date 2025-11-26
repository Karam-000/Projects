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
