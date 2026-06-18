# Launch 3 parallel Codex CLI instances
$tmpBase = "$env:TEMP\codex-parallel"

# Batch 1: ZG remaining (6 icons)
$d1 = "$tmpBase\zg2"
ri -r $d1 -ea 0|Out-Null; ni $d1 -f -ty d|Out-Null; cd $d1; gi q 2>&1|Out-Null
Start-Process powershell -ArgumentList "-NoExit","-Command","cd $d1; codex exec '/imagegen 6 pixel-art game icons, black #000000 background, no text. Zen garden: 8.Waterfall - blue water, gray rocks 9.Cherry Grove - pink blossoms, falling 10.Meditation Hall - wooden hall with paper lanterns 11.Enlightened Mind - gold lotus, glowing 12.Cosmic Awareness - purple cosmic wheel with stars 13.Nirvana - radiant white-gold diamond'" -WindowStyle Normal
Write-Host "Launched ZG2"

# Batch 2: Star Deck batch 1 (7 icons)
$d2 = "$tmpBase\sd1"
ri -r $d2 -ea 0|Out-Null; ni $d2 -f -ty d|Out-Null; cd $d2; gi q 2>&1|Out-Null
Start-Process powershell -ArgumentList "-NoExit","-Command","cd $d2; codex exec '/imagegen 7 pixel-art game icons, black #000000 background, no text. Space theme: 1.Star Chart - parchment with constellation dots 2.Telescope - brass on tripod 3.Observatory - white domed building 4.Satellite - silver with solar panels 5.Space Station - ISS-style modules 6.Lunar Base - domes on gray moon surface 7.Mars Colony - red domes on red surface'" -WindowStyle Normal
Write-Host "Launched SD1"

# Batch 3: Star Deck batch 2 (6 icons)
$d3 = "$tmpBase\sd2"
ri -r $d3 -ea 0|Out-Null; ni $d3 -f -ty d|Out-Null; cd $d3; gi q 2>&1|Out-Null
Start-Process powershell -ArgumentList "-NoExit","-Command","cd $d3; codex exec '/imagegen 6 pixel-art game icons, black #000000 background, no text. Space theme: 8.Asteroid Mine - gray rocky asteroid with drill 9.Star Forge - brilliant orange star in metal cage 10.Nebula Harvester - purple-blue nebula cloud 11.Black Hole Core - dark void with glowing accretion disk 12.Galaxy Cluster - spiral galaxy with star swirls 13.Cosmic String - golden vibrating thread through spacetime'" -WindowStyle Normal
Write-Host "Launched SD2"
