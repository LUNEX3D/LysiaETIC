$p = "d:\LysiaETIC\frontend\src\pages\ProductManagementCenter.js"
$lines = [System.IO.File]::ReadAllLines($p)
$closeDiv = "</" + "div>"
for ($i = 2636; $i -le 2720; $i++) {
    $lines[$i] = $lines[$i] -replace '</motion\.div>', $closeDiv
}
[System.IO.File]::WriteAllLines($p, $lines)
Write-Host "ok"
