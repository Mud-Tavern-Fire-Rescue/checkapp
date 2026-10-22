# Limits the "MTVFR Equipment Checks" Entra app so it can only send mail as
# the truckcheck mailbox. Without this, its Mail.Send permission would let it
# send as any mailbox in the department.
#
# Exchange only accepts a mail-enabled security group as the policy scope (not
# a mailbox), so this creates a hidden group whose only member is truckcheck.
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
    [string]$Mailbox = "truckcheck@mudtavernfire.org",
    [string]$GroupEmail = "checkapp-senders@mudtavernfire.org"
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
    $group = Get-DistributionGroup -Identity $GroupEmail -ErrorAction SilentlyContinue
    if (-not $group) {
        New-DistributionGroup -Name "MTVFR Equipment Checks senders" -Alias "checkapp-senders" `
            -PrimarySmtpAddress $GroupEmail -Type Security -Members $Mailbox | Out-Null
        # Keep it out of the address book and closed to outside mail.
        Set-DistributionGroup -Identity $GroupEmail -HiddenFromAddressListsEnabled $true `
            -RequireSenderAuthenticationEnabled $true
        Write-Host "Created hidden security group $GroupEmail containing $Mailbox."
    } else {
        $members = Get-DistributionGroupMember -Identity $GroupEmail | ForEach-Object { $_.PrimarySmtpAddress }
        if ($members -notcontains $Mailbox) {
            Add-DistributionGroupMember -Identity $GroupEmail -Member $Mailbox
            Write-Host "Added $Mailbox to $GroupEmail."
        }
    }

    # Errors when the tenant has no policies at all, which just means none exist yet.
    $existing = Get-ApplicationAccessPolicy -ErrorAction SilentlyContinue |
        Where-Object { $_.AppId -eq $AppId }
    if ($existing) {
        Write-Host "A restriction for this app already exists; leaving it as is."
    } else {
        New-ApplicationAccessPolicy -AppId $AppId -PolicyScopeGroupId $GroupEmail `
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
        Write-Host "`nThe results aren't what we expected yet. A new group can take a few minutes"
        Write-Host "to take effect; run this script again in 10 minutes. If it still differs, send these lines to Claude."
    }
} finally {
    Disconnect-ExchangeOnline -Confirm:$false | Out-Null
}
