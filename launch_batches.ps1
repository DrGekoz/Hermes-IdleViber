@'
# Clear old output
$outDir = "F:\aaaaaVIBECODING\Hermes-IdleViber\sprites\images\icons\individual"
if (Test-Path $outDir) { Remove-Item "$outDir\*.webp" -Force }
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

# Working directory for temp repos
$tmpBase = "C:\Users\josep\AppData\Local\Temp\codex-batches"
New-Item -ItemType Directory -Force -Path $tmpBase | Out-Null

function New-CodexBatch {
    param($Name, $Prompt)
    $tmpDir = Join-Path $tmpBase $Name
    Remove-Item -Recurse -Force $tmpDir -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
    Set-Location $tmpDir
    git init -q 2>&1 | Out-Null
    
    $logFile = Join-Path $tmpBase "$Name.log"
    $script = "cd '$tmpDir'; codex exec '/imagegen $Prompt' 2>&1 | Out-File -FilePath '$logFile' -Encoding utf8"
    
    Start-Process powershell -ArgumentList "-NoExit","-Command","$script" -WindowStyle Minimized
    Write-Host "Launched: $Name"
}

# ================= BATCHES - BETTER PROMPTS =================
# Each batch generates multiple icons with detailed descriptions
# Using black #000000 background for BiRefNet compatibility

# Batch 1: Campfire Grove Autoclickers (13 icons)
New-CodexBatch -Name "cg_ac" -Prompt @"
I need 13 detailed pixel-art game upgrade icons, each on a perfect solid black #000000 background. No gradients, no shadows on the background. Black must not appear in the icon subjects. No text in any image. Dark outlines around each subject. Each icon looks like a retro game upgrade item, sharp edges, clean pixel work, limited color palette, game-ready. Separate image file for each item. The 13 items:

1. Spark Tinder - tiny orange flame sparks, bright yellow core
2. Kindling Pile - small pile of brown sticks and twigs
3. Campfire - orange and yellow flames on brown logs, warm glow
4. Bonfire - large roaring blaze, tall red-orange flames
5. Fire Pit - gray stone ring with orange flames inside
6. Watchtower - tall wooden lookout tower, brown planks, small roof
7. Hunting Lodge - brown log cabin with deer antlers over door
8. Forge - dark anvil with orange-glowing hammer, sparks
9. Log Cabin - sturdy brown log house with chimney smoke
10. Sawmill - circular silver saw blade, wooden frame, sawdust
11. Lumber Yard - stacked brown timber planks, organized piles
12. Tree Farm - rows of green pine trees, neat grid pattern
13. Forest Spirit - ancient tree face, brown bark, green moss, glowing eyes
"@

# Batch 2: Cyber Den Autoclickers (13 icons)
New-CodexBatch -Name "cd_ac" -Prompt @"
I need 13 detailed pixel-art game upgrade icons, each on a perfect solid black #000000 background. No gradients, no shadows on the background. Black must not appear in the icon subjects. No text in any image. Dark outlines around each subject. Sharp edges, clean pixel work, limited color palette, game-ready. Cyber/tech theme. Separate image file for each item:

1. LED Strip - thin glowing RGB neon strip, bright colors
2. Raspberry Pi - small green circuit board with silver traces
3. Network Switch - gray metal box with blinking green/yellow ports
4. Gaming PC - black tower case with cyan RGB fan glow
5. Render Farm - rack of silver server boxes with blue lights
6. Server Rack - tall black rack with blinking green LEDs
7. Data Center - rows of server aisles, blue-lit corridor
8. Supercomputer - large silver Cray-style supercomputer, blue lights
9. Neural Net - glowing blue brain-shaped circuit pattern
10. AI Core - pulsing cyan crystal in metal frame
11. Digital Realm - glowing green matrix-style code waterfall
12. Cyberspace - neon purple grid fading into horizon
13. Techno God - golden glowing AI face, digital halo
"@

# Batch 3: Zen Garden Autoclickers (13 icons)
New-CodexBatch -Name "zg_ac" -Prompt @"
I need 13 detailed pixel-art game upgrade icons, each on a perfect solid black #000000 background. No gradients, no shadows on the background. Black must not appear in the icon subjects. No text in any image. Dark outlines around each subject. Sharp edges, clean pixel work, limited color palette, game-ready. Zen/Japanese garden theme. Separate image file for each item:

1. Meditation Mat - rectangular tatami mat, tan woven texture
2. Wind Chime - metal tubes hanging on string, silver and blue
3. Bamboo Grove - green bamboo stalks with leaves
4. Koi Pond - blue water with orange and white koi fish
5. Rock Garden - gray raked pebbles with dark stones
6. Tea House - wooden hut with curved roof, paper screens
7. Zen Temple - traditional pagoda with red pillars
8. Waterfall - cascading blue water over gray rocks
9. Cherry Grove - pink cherry blossom tree, falling petals
10. Meditation Hall - large wooden hall with paper lanterns
11. Enlightened Mind - glowing gold lotus symbol
12. Cosmic Awareness - purple cosmic wheel, stars
13. Nirvana - radiant white-gold diamond, transcendent glow
"@

# Batch 4: Star Deck Autoclickers (13 icons)
New-CodexBatch -Name "sd_ac" -Prompt @"
I need 13 detailed pixel-art game upgrade icons, each on a perfect solid black #000000 background. No gradients, no shadows on the background. Black must not appear in the icon subjects. No text in any image. Dark outlines around each subject. Sharp edges, clean pixel work, limited color palette, game-ready. Space/astronomy theme. Separate image file for each item:

1. Star Chart - parchment map with constellation dots and lines
2. Telescope - brass telescope on tripod, pointed up
3. Observatory - white domed observatory building
4. Satellite - silver satellite with solar panel wings
5. Space Station - modular ISS-style station, silver modules
6. Lunar Base - dome habitats on gray moon surface
7. Mars Colony - red domes on red Martian surface
8. Asteroid Mine - gray rocky asteroid with drill
9. Star Forge - brilliant orange star in metal cage, forging
10. Nebula Harvester - purple-blue nebula cloud with collector
11. Black Hole Core - dark void with glowing accretion disk
12. Galaxy Cluster - spiral galaxy, bright core, star swirls
13. Cosmic String - vibrating golden string through spacetime
"@

# Batch 5: Study Lounge Autoclickers (13 icons)
New-CodexBatch -Name "sl_ac" -Prompt @"
I need 13 detailed pixel-art game upgrade icons, each on a perfect solid black #000000 background. No gradients, no shadows on the background. Black must not appear in the icon subjects. No text in any image. Dark outlines around each subject. Sharp edges, clean pixel work, limited color palette, game-ready. Library/study theme. Separate image file for each item:

1. Bookmark - red silk bookmark with gold tassel
2. Reading Lamp - brass desk lamp with warm yellow glow
3. Bookshelf - wooden shelf with colorful book spines
4. Study Desk - brown oak desk with inkwell
5. Typewriter - black vintage typewriter, silver keys
6. Library Cart - metal cart with stacked books
7. Reading Room - cozy armchair by window, warm lamp
8. Archive - rows of filing cabinets, organized
9. Grand Library - tall arched shelves, grand staircase
10. Knowledge Vault - stone vault door with runes
11. Ancient Tome - thick leather-bound book, gold lettering
12. Wisdom Well - stone well with glowing blue water
13. Omniscience - glowing all-seeing eye, cosmic knowledge
"@

# Batch 6: Beach Cove Autoclickers (13 icons)
New-CodexBatch -Name "bc_ac" -Prompt @"
I need 13 detailed pixel-art game upgrade icons, each on a perfect solid black #000000 background. No gradients, no shadows on the background. Black must not appear in the icon subjects. No text in any image. Dark outlines around each subject. Sharp edges, clean pixel work, limited color palette, game-ready. Beach/ocean theme. Separate image file for each item:

1. Sand Castle - beige sand castle with towers and flags
2. Seashell - pink spiraled conch shell
3. Beach Towel - striped red-and-white beach towel
4. Surfboard - blue surfboard with wave pattern
5. Tiki Torch - bamboo pole with orange flame
6. Sailboat - white sailboat with blue hull on water
7. Lighthouse - white lighthouse with red stripes, beacon
8. Pier - brown wooden pier extending over blue water
9. Resort - pink resort building with pool
10. Cruise Ship - white luxury cruise liner, blue windows
11. Underwater City - glass domes under blue water
12. Coral Reef - colorful coral, orange and purple
13. Ocean Spirit - blue-green wave entity, glowing crest
"@

Write-Host "All 6 batches launched in parallel! Check logs in $tmpBase"
"@

# Now launch from bash
