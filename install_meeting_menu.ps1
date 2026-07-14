$pages = @('dashboard.html','leave.html','projects.html','admin.html')
$tag = '<script src="assets/js/meeting-menu-global.js?v=meeting-menu-global-v2"></script>'
foreach ($page in $pages) {
  if (Test-Path $page) {
    $html = Get-Content $page -Raw -Encoding UTF8
    if ($html -notmatch 'meeting-menu-global\.js') {
      $html = $html -replace '</body>', "$tag`r`n</body>"
      Set-Content $page $html -Encoding UTF8
      Write-Host "Patched $page"
    } else { Write-Host "Already patched $page" }
  }
}
