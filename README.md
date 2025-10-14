<a href="https://www.vtl.lv/"> <img src="https://www.vtl.lv/uploads/2023/08/vtl-logo-1.svg"  width="200" alt="VTL logo"/> </a>
<a href="https://laravel.com" target="_blank"><img src="https://raw.githubusercontent.com/laravel/art/master/logo-lockup/5%20SVG/2%20CMYK/1%20Full%20Color/laravel-logolockup-cmyk-red.svg" width="200" alt="Laravel Logo"> </a>
<a href="https://react.dev/"> <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/React-icon.svg/2300px-React-icon.svg.png"  width="200" alt="React Logo"/> </a>
<a href="https://vite.dev/"> <img src="https://logospng.org/download/vite-js/vite-js-4096-logo.png"  width="200" alt="Vite Logo"> </a>

# Porter

Porter is a small full-stack utility that combines a Laravel backend with a React + Vite frontend to let authenticated users explore external databases, build table queries, save reusable query templates, and export results.

Key parts
- Backend (Laravel)
  - API routes: [routes/api.php](routes/api.php)
  - User model (auth + admin flag): [`App\Models\User`](app/Models/User.php)
  - External database metadata: migration [database/migrations/2025_10_07_092832_create_external_databases_table.php](database/migrations/2025_10_07_092832_create_external_databases_table.php)
  - Blade welcome UI (branding/examples): [resources/views/welcome.blade.php](resources/views/welcome.blade.php)

- Frontend (React + Vite)
  - Project root: [porter-react/](porter-react)
  - App context / auth token loader: [`AppContext`](porter-react/src/Context/AppContext.jsx)
  - Main pages:
    - Table Query Builder: [porter-react/src/Pages/Views/Database.jsx](porter-react/src/Pages/Views/Database.jsx)
    - Templates (list / edit / delete / use): [porter-react/src/Pages/Views/Templates.jsx](porter-react/src/Pages/Views/Templates.jsx)
    - Export UI: [porter-react/src/Pages/Views/Export.jsx](porter-react/src/Pages/Views/Export.jsx)
  - Frontend manifests & scripts: [porter-react/package.json](porter-react/package.json) and top-level [package.json](package.json)

What the app does
- Authenticate users (Laravel + Sanctum) and surface a React SPA.
- Let users connect to and manage "external databases" (metadata stored by the app).
- Browse tables and columns from external DBs and construct a query via the Table Query Builder UI (`Database.jsx`).
- Save and reuse query templates (CRUD via API + UI in `Templates.jsx`).
- Use a template to populate the Export UI and POST to the backend export endpoint (see [routes/api.php](routes/api.php) for endpoints such as `/databases/external/tables/{table}/columns` and `/databases/external/export`).

Quick start (dev)
1. Backend
   - Install PHP dependencies: composer install
   - Configure .env (see [.env.example](.env.example)) and run migrations: php artisan migrate
   - Start backend: php artisan serve
2. Frontend
   - cd porter-react && npm install
   - Start dev server: npm run dev (Vite proxies /api to the Laravel backend)

Where to look next
- API wiring and endpoints: [routes/api.php](routes/api.php)
- External DB interactions used by the React UI: [porter-react/src/Pages/Views/Database.jsx](porter-react/src/Pages/Views/Database.jsx)
- Template flows: [porter-react/src/Pages/Views/Templates.jsx](porter-react/src/Pages/Views/Templates.jsx)
- App-wide context & token handling: [`AppContext`](porter-react/src/Context/AppContext.jsx)

License & notes
- The project layout follows a typical Laravel + Vite/React structure. See the frontend README at [porter-react/README.md](porter-react/README.md) for frontend-specific notes.
- This README is a concise overview — check the referenced files for implementation details and API contracts.