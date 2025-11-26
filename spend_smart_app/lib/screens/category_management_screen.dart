import 'package:flutter/material.dart';

import '../models/category_model.dart';
import '../models/expense_model.dart';

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
