# IMPORTANT: Do NOT upload laravel-fresh/ via SFTP
# All backend fixes are made directly on the server via SSH
# Only upload public_html/ via SFTP for frontend changes

## Files fixed directly on server (not in local copy):
# - laravel-fresh/public_html/api/index.php → points to laravel-fresh
# - laravel-fresh/app/Services/InvoiceProcessingService.php → storage path
# - laravel-fresh/app/Models/Customer.php → removed duplicate SalesOrder
# - laravel-fresh/app/Http/Controllers/InvoiceController.php → sync processing
# - laravel-fresh/config/auth.php → JWT guard config
# - laravel-fresh/bootstrap/app.php → JWT + apiPrefix fixes
# - storage/app/ → real folder (not symlink)

## SFTP rule:
## Only right-click invoice.kynetropo.com/public_html → Upload Folder
## NEVER upload the whole invoice.kynetropo.com folder
