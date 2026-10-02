# Role-Based Access Control (RBAC) Implementation

## Overview
Implemented backend role-based access control for the Ogera CRM web system at the login level. Only users with `admin` or `sales_head` roles can successfully login. All other roles (e.g., `sales_staff`) receive a 401 Unauthorized response.

## Key Security Point
Login endpoint is the single point of entry. Role check happens BEFORE token generation.
Sales staff users cannot obtain a valid token to access web features.

## How It Works

1. User enters credentials
2. Backend validates credentials
3. NEW: Backend checks user role
   - If role is `admin` or `sales_head` → Login succeeds, token generated
   - If role is `sales_staff` or other → Return 401 "You don't have access to this system"

## Implementation

Login endpoint (src/app/api/auth/login/route.ts) added:
- Role validation after credential authentication
- Checks if user.role is in ["admin", "sales_head"]
- Returns 401 if access denied
- Logs role check for audit trail

## Response Format

Access Denied:
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You don't have access to this system"
  }
}
HTTP Status: 401 Unauthorized

## Allowed vs Blocked

admin      -> Can Login (Full Access)
sales_head -> Can Login (Full Access)  
sales_staff -> Cannot Login (Blocked at login)
other      -> Cannot Login (Blocked at login)

## Defense in Depth

Primary Control: Login endpoint (blocks token generation)
Secondary Control: Route guards (validates roles on each request)

This ensures even if a token is compromised, the role is validated again.
