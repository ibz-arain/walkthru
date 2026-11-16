#!/bin/sh
# Assemble the site from src/
#   walkthru.html          -> single-file build of the 3D app (no landing page)
#   site/index.html        -> landing page (/)
#   site/playground.html   -> the 3D player / editor / studio (/playground)
cd "$(dirname "$0")"
{ cat src/head.html; echo '<style>'; cat src/css/ui.css src/css/editor.css; echo '</style>'; cat src/body.html; echo '<script type="module">'; cat src/core.js src/walls.js src/build.js src/furniture.js src/house2.js src/car.js src/builder.js src/furnish3.js src/editor.js src/app.js src/designs.js src/account.js src/cloud.js src/ui.js; echo '</script>'; } > walkthru.html
mkdir -p site
cp src/landing.html site/index.html
cp src/account.html site/account.html
cp src/track.js site/track.js
{ printf '<!doctype html>\n<html lang="en">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="description" content="Walkthru playground: design a floor plan and explore it in 3D.">\n'; cat walkthru.html; printf '\n</html>\n'; } > site/playground.html
