# Authentication

The current backend has one endpoint only:

```text
POST /api/auth/login
```

It checks an active user in the shared MySQL `users` table, verifies the password, assigns an application role, and returns a JWT bearer token with the user details. There are no cookies, refresh tokens, sessions, logout routes, or other authentication APIs.

## Login flow

```text
Client
  -> POST /api/auth/login
  -> validate email and password
  -> find active user in MySQL
  -> compare bcrypt password hash
  -> resolve user role
  -> create JWT with user details
  <- { accessToken, user }
```

## API contract

### `POST /api/auth/login`

**Request**

```json
{
  "email": "staff@company.com",
  "password": "password"
}
```

**Success: `200 OK`**

```json
{
  "success": true,
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1784270564,
    "email": "staff@company.com",
    "name": "Staff Name",
    "phone": "+919876543210",
    "role": "sales_staff"
  }
}
```

**Errors**

| Status | Code | Meaning |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Email, password, or JSON body is invalid. |
| `401` | `INVALID_CREDENTIALS` | Credentials are incorrect, the user is inactive, or the user is not an allowed staff account. |
| `500` | `SERVER_ERROR` | Database or server configuration failed. |

## Frontend web request

The web login form sends JSON to the same-origin API. The returned token is kept for the current browser session and attached to later API requests.

```ts
const response = await fetch("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: email.trim(),
    password,
  }),
});

const result = await response.json();

if (!response.ok || !result.success) {
  throw new Error(result.error?.message ?? "Login failed");
}

sessionStorage.setItem("ogera_access_token", result.accessToken);
console.log("Signed in user:", result.user);
```

Call a protected API from the web client like this:

```ts
const accessToken = sessionStorage.getItem("ogera_access_token");

const response = await fetch("/api/contacts", {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});
```

Use the deployed web origin in production. During local development, the web client can call `/api/auth/login` without a host because it is same-origin.

## Mobile app request

The mobile app uses the same endpoint and JSON body. It must use the API server's reachable URL, not `localhost` on a physical phone.

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

const secureStorage = FlutterSecureStorage();

Future<Map<String, dynamic>> login(String baseUrl, String email, String password) async {
  final response = await http.post(
    Uri.parse('$baseUrl/api/auth/login'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({
      'email': email.trim(),
      'password': password,
    }),
  );

  final result = jsonDecode(response.body) as Map<String, dynamic>;
  if (response.statusCode != 200 || result['success'] != true) {
    final error = result['error'] as Map<String, dynamic>?;
    throw Exception(error?['message'] ?? 'Login failed');
  }

  await secureStorage.write(
    key: 'ogera_access_token',
    value: result['accessToken'] as String,
  );
  return result['user'] as Map<String, dynamic>;
}
```

Use the token on a mobile API request:

```dart
final token = await secureStorage.read(key: 'ogera_access_token');
final response = await http.get(
  Uri.parse('$baseUrl/api/contacts'),
  headers: {'Authorization': 'Bearer $token'},
);
```

Recommended local base URLs:

| Client | Base URL |
| --- | --- |
| Web browser on the development computer | `http://localhost:3000` |
| Android emulator | `http://10.0.2.2:3000` |
| iOS simulator | `http://localhost:3000` |
| Physical phone on the same Wi-Fi | `http://YOUR_COMPUTER_LAN_IP:3000` |
| Production mobile and web | `https://your-api-domain.com` |

Never log or display the password or JWT. Store the token in Flutter secure storage on mobile. The current web implementation uses `sessionStorage`; move web token storage to an HTTP-only cookie before production if stronger browser-side protection is required.

## Roles

| Database role (`users.admin_role_slug`) | JWT `user.role` |
| --- | --- |
| `super_admin` or `admin` | `admin` |
| `sales_head` | `sales_head` |
| `sales_staff` | `sales_staff` |

The login code also treats the older `technical`, `accountant`, `digital_marketer`, and `showroom_manager` values as `sales_staff`. Only active users with `is_admin = 1` can receive a token.

## Files and function reference

### `src/app/api/auth/login/route.ts`

| Function | Purpose |
| --- | --- |
| `POST(request)` | The HTTP endpoint. Validates the request, calls credential authentication, and returns either the JWT/user data or a clear JSON error. |

### `src/lib/auth/request.ts`

| Item | Purpose |
| --- | --- |
| `loginSchema` | Defines the accepted request body: a valid email and a non-empty password. |
| `parseLoginRequest(request)` | Reads JSON from the request and validates it with `loginSchema`. It safely returns a validation error when the body is invalid JSON. |

### `src/lib/auth/service.ts`

| Function | Purpose |
| --- | --- |
| `roleForUser(user)` | Converts the existing database role into one of the three application roles: `admin`, `sales_head`, or `sales_staff`. It rejects non-staff users. |
| `authenticateCredentials(email, password)` | Finds the active user by email, verifies the bcrypt password hash, resolves their role, and returns `{ user, accessToken }`. It returns `null` when login must fail. |

### `src/lib/auth/tokens.ts`

| Function | Purpose |
| --- | --- |
| `jwtSecret()` | Reads `JWT_SECRET` securely from the server environment and stops the request if it is missing. |
| `issueAccessToken(user)` | Signs a JWT containing the complete `user` object. The expiry defaults to 60 days. |

### `src/lib/auth/types.ts`

| Item | Purpose |
| --- | --- |
| `ROLES` and `Role` | Keep the allowed roles limited to `admin`, `sales_head`, and `sales_staff`. |
| `AuthUser` | Defines the safe user details included in the API response and JWT. It never includes a password. |
| `UserAuthRow` | Defines the database fields used only while authenticating. |

### `src/lib/db.ts`

| Function | Purpose |
| --- | --- |
| `requiredEnvironment(name)` | Ensures a required database environment variable exists. |
| `getDatabase()` | Creates one reusable MySQL connection pool for the server. |
| `queryOne(sql, values)` | Runs a parameterized query and returns the first row or `null`. Parameterized values prevent SQL injection. |

## JWT payload

The token contains this shape:

```json
{
  "user": {
    "id": 1784270564,
    "email": "staff@company.com",
    "name": "Staff Name",
    "phone": "+919876543210",
    "role": "sales_staff"
  },
  "iat": 0,
  "exp": 0
}
```

For a future protected API, send the returned token in this header:

```http
Authorization: Bearer <accessToken>
```

That API must verify the token with the same `JWT_SECRET` before trusting `user.id` or `user.role`.

## Environment variables

Copy `.env.example` to `.env.local` and set:

| Variable | Purpose |
| --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Existing shared MySQL database connection. |
| `DB_SSL` | Set to `true` when the database requires SSL. |
| `JWT_SECRET` | Long private secret used to sign tokens. Never expose it to the frontend. |
| `JWT_EXPIRES_IN` | Token lifetime, such as `8h`, `1d`, or `60d`. Defaults to `60d`. |
