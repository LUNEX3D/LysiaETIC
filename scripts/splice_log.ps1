$p = "d:\LysiaETIC\frontend\src\pages\ProductManagementCenter.js"
$b = "d:\LysiaETIC\scripts\log_block.txt"
$block = [System.IO.File]::ReadAllText($b) -replace '</motion\.div>', '</div>' -replace '<motion\.motion.div', '<div'
$block = $block -replace 'motion\.div', 'div'
$lines = [System.IO.File]::ReadAllLines($p)
$newLines = $block -split "`r?`n"
# remove trailing empty
if ($newLines[-1] -eq '') { $newLines = $newLines[0..($newLines.Length-2)] }
$before = $lines[0..2706]
$after = $lines[2720..($lines.Length-1)]
$out = $before + $newLines + $after
[System.IO.File]::WriteAllLines($p, $out)
Write-Host "spliced" $newLines.Length "lines"
