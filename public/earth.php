<!doctype html>
<html lang="en">
    <!-- Developed by Abdulwahab Almusailem -->
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Earth — HorizonsExplorer</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <style>html,body,#map{height:100%;margin:0} .toolbar{position:absolute;top:10px;left:10px;z-index:9999;background:#0b1020cc;color:#dff;padding:8px 10px;border-radius:8px;font:500 13px system-ui}</style>
</head>
<body>
  <div id="map"></div>
  <div style="margin-left:35px" class="toolbar">
      <img
        src="assets/utility/logo.png"
        alt="Horizons Explorer logo"
        width="38"
        height="20"
      />
      <button class="cta" onclick="location.href='index.php'">Home</button>
  <label style="margin-left:8px">Date <input id="date" type="date"/></label>
  <button id="add-pin">Add label</button>

  <span style="margin-left:8px">
    <label>Go to (lat,lon)
      <input id="goto" type="text" placeholder="e.g., 25.3, 51.5" style="width:140px">
      <button id="goto-btn" title="Fly">Go</button>
    </label>
  </span>

  <button id="dl-labels" style="margin-left:8px">Download labels</button>
  <button id="share-view" style="margin-left:8px">Share view</button>
  
 
</div>


  

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/leaflet-side-by-side@2.0.1/leaflet-side-by-side.min.js"></script>
    <script src="js/labels-service.js"></script>
  <script src="js/earth.js"></script>
</body>
</html>
