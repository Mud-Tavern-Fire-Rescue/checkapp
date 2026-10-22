# Limits the "MTVFR Equipment Checks" Entra app so it can only send mail as
# the truckcheck mailbox. Without this, its Mail.Send permission would let it
# send as any mailbox in the department.
#
# Run from a Mac terminal (it signs you in through the browser):
#   pwsh-preview -File scripts/m365/restrict-alert-mailbox.ps1
#
# Needs: PowerShell 7 and the ExchangeOnlineManagement module
# (Install-Module ExchangeOnlineManagement -Scope CurrentUser), and an
# Exchange admin account.

param(
    [string]$AppId,
    [string]$AdminEmail = "Mike.Russell@mudtavernfire.org",
    [string]$Mailbox = "truckcheck@mudtavernfire.org"
)

$ErrorActionPreference = "Stop"

if (-not $AppId) {
    Write-Host "Find the ID in Entra: App registrations > MTVFR Equipment Checks > Overview > Application (client) ID"
    $AppId = Read-Host "Paste the Application (client) ID"
}
$AppId = $AppId.Trim()
if ($AppId -notmatch '^[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$') {
    throw "That doesn't look like a client ID (it should look like 1a2b3c4d-1234-5678-9abc-1234567890ab)."
}
if ($AppId -eq "1a2b3c4d-1234-5678-9abc-1234567890ab") {
    throw "That's the example ID from the instructions. Copy your app's real ID from Entra."
}

Import-Module ExchangeOnlineManagement
Write-Host "Signing in as $AdminEmail (a browser window will open)..."
Connect-ExchangeOnline -UserPrincipalName $AdminEmail -ShowBanner:$false

try {
    $existing = Get-ApplicationAccessPolicy | Where-Object { $_.AppId -eq $AppId }
    if ($existing) {
        Write-Host "A restriction for this app already exists; leaving it as is."
    } else {
        New-ApplicationAccessPolicy -AppId $AppId -PolicyScopeGroupId $Mailbox `
            -AccessRight RestrictAccess `
            -Description "MTVFR Equipment Checks sends only as $Mailbox" | Out-Null
        Write-Host "Restriction created."
    }

    $allowed = (Test-ApplicationAccessPolicy -Identity $Mailbox -AppId $AppId).AccessCheckResult
    $blocked = (Test-ApplicationAccessPolicy -Identity $AdminEmail -AppId $AppId).AccessCheckResult
    Write-Host ""
    Write-Host "Can send as $Mailbox : $allowed   (should be Granted)"
    Write-Host "Can send as $AdminEmail : $blocked   (should be Denied)"
    if ($allowed -eq "Granted" -and $blocked -eq "Denied") {
        Write-Host "`nDone. It can take up to an hour for Microsoft to enforce the restriction."
    } else {
        Write-Host "`nThe results aren't what we expected. Send these lines to Claude."
    }
} finally {
    Disconnect-ExchangeOnline -Confirm:$false | Out-Null
}
