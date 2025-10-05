<?php
// Developed by Abdulwahab Almusailem
header('Content-Type: application/json');
$world = $_GET['world'] ?? 'earth';
$file = __DIR__ . '/../data/labels-' . basename($world) . '.json';
if (!file_exists($file)) { echo '[]'; exit; }
echo file_get_contents($file);
