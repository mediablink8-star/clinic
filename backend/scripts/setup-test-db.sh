#!/bin/bash
# Test database setup script

set -e

echo "🧪 Setting up test database..."

# Create test database
psql -h localhost -U postgres -c "DROP DATABASE IF EXISTS clinicflow_test;" 2>/dev/null || true
psql -h localhost -U postgres -c "CREATE DATABASE clinicflow_test;"

echo "✅ Test database created"

# Run migrations
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/clinicflow_test" npx prisma migrate deploy

echo "✅ Migrations applied"

# Generate Prisma client
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/clinicflow_test" npx prisma generate

echo "✅ Prisma client generated"

echo "🎉 Test database ready!"