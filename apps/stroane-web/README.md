# Stroane Web

A full-stack e-commerce platform for browsing and purchasing products.

## Technology Stack

- **Frontend**: React 19, TypeScript, React Router 7, TailwindCSS
- **Backend**: Express 5, Node.js
- **Database**: PostgreSQL with Prisma ORM
- **UI**: Shared `@faako/ui` component library

## Project Structure

```
stroane-web/
├── backend/
│   ├── src/
│   │   ├── routes/        # API route handlers
│   │   └── middleware/    # Express middleware (CORS, auth, etc.)
│   └── server.js          # Express server entry point
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── migrations/        # Database migrations
├── src/
│   ├── pages/             # Page components (Home, ProductList, ProductDetail)
│   ├── components/        # Reusable UI components (Header, Layout)
│   ├── api/               # API client functions (productApi)
│   ├── types/             # TypeScript types (Product interface)
│   ├── styles/            # Global styles (TailwindCSS setup)
│   ├── App.tsx            # Main app component with routes
│   └── main.tsx           # React entry point
├── .env.example           # Environment variables template
├── .env.development       # Development environment
├── .env.production        # Production environment
├── vite.config.ts         # Vite configuration
├── tailwind.config.js     # Tailwind CSS configuration
├── postcss.config.js      # PostCSS configuration
└── package.json           # Dependencies and scripts
```

## Setup

### Prerequisites

- Node.js 18+
- pnpm 10+
- PostgreSQL 12+

### Local Development

1. **Install dependencies**
   ```bash
   pnpm install
   ```

2. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your PostgreSQL database URL
   ```

3. **Initialize database**
   ```bash
   pnpm db:migrate:dev
   ```

4. **Start development servers (frontend + backend)**
   ```bash
   pnpm dev:with-backend
   ```

   Or run separately:
   ```bash
   # Terminal 1: Frontend (port 5175)
   pnpm dev:frontend

   # Terminal 2: Backend (port 3000)
   pnpm server:dev
   ```

5. **Open browser**
   - Frontend: http://localhost:5175
   - Backend Health Check: http://localhost:3000/health

## Database

### Create migration
```bash
pnpm db:migrate:dev
```

### View database
```bash
pnpm db:studio
```

### Check migration status
```bash
pnpm db:status:dev    # Development
pnpm db:status:prod   # Production
```

## Build

```bash
pnpm build
```

Frontend bundle will be in `dist/`.

## Production

1. **Deploy database**
   ```bash
   pnpm db:deploy:prod
   ```

2. **Start server**
   ```bash
   pnpm server:prod
   ```

3. **Netlify deployment**
   - Build: `pnpm build`
   - Publish: `dist`

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` or `production` |
| `PORT` | Backend server port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost/stroane` |
| `VITE_BACKEND_BASE_URL` | Backend API base URL | `http://localhost:3000` |

## API Endpoints (Skeleton)

| Method | Endpoint | Status |
|--------|----------|--------|
| `GET` | `/api/products` | 🔄 Not implemented |
| `GET` | `/api/products/:id` | 🔄 Not implemented |
| `GET` | `/health` | ✅ Ready |

## Next Steps

1. Implement product API endpoints in `backend/src/routes/`
2. Add product API client methods in `src/api/products.ts`
3. Connect frontend pages to API
4. Add authentication (if needed)
5. Add error handling and validation

## Debugging

Enable Prisma Studio for database inspection:
```bash
pnpm db:studio
```

Check server logs:
```bash
pnpm server:dev
```

## Monorepo Integration

Stroane Web is part of the @faako monorepo. Workspace scripts:

```bash
# From monorepo root
pnpm -F stroane-web dev:with-backend
pnpm -F stroane-web build
pnpm -F stroane-web lint
```

## License

Proprietary - All rights reserved

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
