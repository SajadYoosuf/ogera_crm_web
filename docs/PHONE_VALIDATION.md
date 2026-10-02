# Phone Number and Country Code Validation

## Overview

The contact adding form now includes country-based phone number validation. Users can select from a predefined list of GCC (Gulf Cooperation Council) and European countries, and phone numbers are validated according to the mobile number format rules for each country.

## Supported Countries

### GCC Countries
- **Saudi Arabia** (+966): Format `9XXXXXXXX` (9 digits starting with 9)
- **UAE** (+971): Format `4XXXXXXXX` or `5XXXXXXXX` (9 digits starting with 4 or 5)
- **Kuwait** (+965): Format `9XXXXXXX` (8 digits starting with 5, 6, or 9)
- **Qatar** (+974): Format `3XXXXXXX` (8 digits starting with 3, 4, 5, or 6)
- **Bahrain** (+973): Format `3XXXXXXX` (8 digits starting with 3 or 6)
- **Oman** (+968): Format `9XXXXXXX` (8 digits starting with 7 or 9)

### European Countries
Supported countries include: UK, Germany, France, Italy, Spain, Netherlands, Belgium, Switzerland, Austria, Sweden, Norway, Denmark, Finland, Poland, Czech Republic, Hungary, Romania, Greece, Portugal, and Ireland.

Each country has its own mobile number format validation rules.

## Database Migration

Before using the new country code validation feature, you need to run the database migration:

```bash
npm run migrate
```

This will add the `country_code` column to the `contacts` table if it doesn't already exist.

### Manual Migration

If you prefer to run the SQL migration manually, connect to your MySQL database and execute:

```sql
ALTER TABLE contacts ADD COLUMN country_code VARCHAR(10) DEFAULT '+971' NOT NULL AFTER phone;
ALTER TABLE contacts ADD INDEX idx_country_code (country_code);
```

## API Changes

### Contact Creation
When creating a contact, the API now accepts:
- `countryCode`: Country dial code (e.g., "+971" for UAE)
- `phone`: Mobile number without country code (e.g., "501234567" for UAE)

### Request Example
```json
{
  "name": "John Doe",
  "phone": "501234567",
  "countryCode": "+971",
  "contactType": "lead",
  "source": "online"
}
```

## Frontend Features

1. **Country Selection Dropdown**: Users select their country from a categorized list (GCC vs European)
2. **Real-time Validation**: Phone number is validated as the user types
3. **Format Helper**: The form displays the expected format for the selected country
4. **Error Messages**: Clear error messages guide users if they enter an invalid format

## Validation Rules

- **Phone Number**: Must match the country's specific mobile number format
- **Country Code**: Must be in the format `+XXX` (plus sign followed by 1-3 digits)
- **Required Fields**: Country code and phone number are both required

## File Structure

- `/src/lib/countries.ts` - Country definitions and validation utilities
- `/src/app/dashboard/page.tsx` - Contact form with country selector
- `/src/app/api/contacts/route.ts` - API endpoint for contact creation
- `/src/app/api/contacts/[id]/route.ts` - API endpoint for contact updates
- `/migrations/001_add_country_code_to_contacts.sql` - Database migration
- `/scripts/migrate.ts` - Migration runner script

## Example Countries and Formats

| Country | Code | Example Number | Expected Digits |
|---------|------|-----------------|-----------------|
| UAE | +971 | 501234567 | 9 digits (4 or 5 start) |
| Saudi Arabia | +966 | 912345678 | 9 digits (9 start) |
| Kuwait | +965 | 95123456 | 8 digits (5, 6, or 9 start) |
| UK | +44 | 7911123456 | 10 digits (7 start) |
| Germany | +49 | 15112345678 | 10-11 digits |
| France | +33 | 612345678 | 9 digits (1-9 start) |

## Troubleshooting

### Migration Error: "Column already exists"
This is expected if the column was already added. You can safely ignore this error.

### Validation Failing
Check that:
1. The phone number doesn't include the country code
2. The phone number matches the format for the selected country
3. No spaces or dashes are in the input (they are automatically removed)

### Invalid Country Code
Ensure only GCC and European countries are selected. The validation only allows pre-defined country codes.
