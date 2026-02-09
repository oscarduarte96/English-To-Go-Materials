$baseUrl = "http://localhost:8080/v1/projects/materials-to-go/databases/(default)/documents"

function Seed-Coupon {
    param (
        [string]$Id,
        [int]$StartPercent
    )

    $url = "$baseUrl/coupons/$Id"
    $body = @{
        fields = @{
            code = @{ stringValue = $Id }
            discount_percent = @{ integerValue = "$StartPercent" }
            is_active = @{ booleanValue = $true }
            usage_count = @{ integerValue = "0" }
            usage_limit = @{ integerValue = "1000" }
            descr = @{ stringValue = "Seed Coupon ($StartingPercent%)" }
        }
    } | ConvertTo-Json -Depth 5

    try {
        Write-Host "Seeding $Id..."
        $response = Invoke-RestMethod -Method Patch -Uri $url -Body $body -ContentType "application/json"
        Write-Host "Success: $($response.name)" -ForegroundColor Green
    } catch {
        Write-Host "Error seeding $Id" -ForegroundColor Red
        Write-Host $_.Exception.Message
        # Print detailed error if available
        if ($_.Exception.Response) {
             $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
             $reader.BaseStream.Position = 0
             $reader.ReadToEnd()
        }
    }
}

Seed-Coupon -Id "ETG-VIP-USER" -StartPercent 100
Seed-Coupon -Id "PRO-TEACHER" -StartPercent 50
