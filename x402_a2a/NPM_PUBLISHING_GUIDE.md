# NPM Publishing Guide for a2a-x402

## Package Configuration

The package is configured for npm publishing with:
- ✅ Dual build output (ESM + CommonJS)
- ✅ Proper TypeScript declarations
- ✅ Modern package.json exports
- ✅ React/Next.js compatibility
- ✅ Tree-shaking support (`sideEffects: false`)

## Publishing to NPM

### First Time Setup

1. **Login to npm** (if not already logged in):
```bash
npm login
```

2. **Update package.json** - Set the correct repository URLs:
   - Update `repository.url`
   - Update `bugs.url`
   - Update `homepage`

### Publishing

1. **Build the package**:
```bash
cd x402_a2a
npm run build
```

2. **Test the package locally** (optional but recommended):
```bash
npm pack
```

3. **Publish to npm**:
```bash
# For first publish or public package
npm publish --access public

# For updates
npm publish
```

### Version Management

Before publishing updates:
```bash
# Patch version (1.0.0 -> 1.0.1)
npm version patch

# Minor version (1.0.0 -> 1.1.0)
npm version minor

# Major version (1.0.0 -> 2.0.0)
npm version major
```

## Installing in Your Projects

Once published, install using:

```bash
npm install a2a-x402
```

## Updating Client and Merchant Agents

### 1. Update package.json

Replace the local file reference with the npm package:

**Before:**
```json
{
  "dependencies": {
    "x402-a2a-typescript": "file:../x402_a2a"
  }
}
```

**After:**
```json
{
  "dependencies": {
    "a2a-x402": "^0.0.1"
  }
}
```

### 2. Install the package

```bash
# In client-agent directory
cd ../client-agent
npm install

# In merchant-agent directory
cd ../merchant-agent
npm install
```

### 3. Update imports (if needed)

The package name changed from `x402-a2a-typescript` to `a2a-x402`, so update imports:

**Before:**
```typescript
import { processPayment } from 'x402-a2a-typescript';
```

**After:**
```typescript
import { processPayment } from 'a2a-x402';
```

## Build Output Structure

```
dist/
├── cjs/              # CommonJS build
│   ├── package.json  # { "type": "commonjs" }
│   └── ...
├── esm/              # ES Modules build
│   ├── package.json  # { "type": "module" }
│   └── ...
└── types/            # TypeScript declarations
    └── ...
```

## Compatibility

The package supports:
- ✅ Node.js >= 18.0.0
- ✅ React applications
- ✅ Next.js applications
- ✅ Vite/Webpack/other bundlers
- ✅ TypeScript projects
- ✅ JavaScript projects
- ✅ Both ESM and CommonJS consumers

## Troubleshooting

### Issue: Module resolution errors

If you encounter module resolution errors, ensure your project's `package.json` or `tsconfig.json` is properly configured for the module system you're using.

### Issue: TypeScript errors

Make sure your project has TypeScript >= 5.0.0 installed.

### Issue: Bundler errors

Modern bundlers should automatically pick the correct format. If issues persist, check your bundler's configuration for proper ESM/CJS handling.
