<?php
// Developed by Abdulwahab Almusailem
header('Content-Type: application/json');
$input = json_decode(file_get_contents('php://input'), true);
$world = $input['world'] ?? 'earth';
$file = __DIR__ . '/../data/labels-' . basename($world) . '.json';
$items = file_exists($file) ? json_decode(file_get_contents($file), true) : [];
$items[] = [
  'lat' => floatval($input['lat'] ?? 0),
  'lng' => floatval($input['lng'] ?? 0),
  'title' => substr($input['title'] ?? 'Label', 0, 80),
  'desc'  => substr($input['desc'] ?? '', 0, 500),
  'ts' => time()
];
file_put_contents($file, json_encode($items, JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES));
echo json_encode(['ok'=>true,'count'=>count($items)]);
