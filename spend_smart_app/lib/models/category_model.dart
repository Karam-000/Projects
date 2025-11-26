import 'package:flutter/material.dart';

class Category {
  String name;
  String emoji;
  Color color;

  Category({required this.name, required this.emoji, required this.color});

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
