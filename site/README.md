# UNDERGROUND invite site

This is the Nov 20, 2026 public invite site that runs on Hostinger at https://theunderground.vip.

It is static HTML/CSS plus a small PHP invite form (`apply.php`, `csrf.php`). Applicant rows are written **outside** this web root (to an `underground-private/applications.csv` path on the host). Do not copy applicant CSVs into this tree or into git.

## Secrets

`inc/secret.php` holds the CSRF HMAC secret and is **not** in git. `inc/.htaccess` denies web access to `inc/`.

On a new host:

1. Copy `inc/secret.php.example` to `inc/secret.php`.
2. Replace the placeholder with a long random secret (32+ characters).
3. Confirm `inc/.htaccess` denies all web access.

The live secret stays only on the Hostinger site’s `inc/secret.php`.

## Assets

`index.html` references `assets/mark.svg`. The Nov 20 `new_public` staging folder had only `assets/README.txt` (live mark/garage were left in place on Hostinger). `assets/mark.svg` here is the copy that matches the live file byte-for-byte. `garage.jpg` is still only on the live host; do not overwrite it from an older backup.

## Deploy

The invite site stays on Hostinger. Do not point this tree at Atlas. The Atlas work is the app API (`services/api`), not this form.
