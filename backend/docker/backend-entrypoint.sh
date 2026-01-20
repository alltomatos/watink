#!/bin/sh
set -e

echo "Listing dist directory..."
ls -R dist

echo "Finding server.js..."
SERVER_PATH=$(find dist -name "server.js")
echo "Found server at: $SERVER_PATH"

echo "Waiting for database..."
if [ -n "$DB_HOST" ]; then
  echo "Waiting for database at $DB_HOST:${DB_PORT:-5432}..."
  dockerize -wait tcp://$DB_HOST:${DB_PORT:-5432} -timeout 60s
fi

echo "Running migrations..."
npx sequelize db:migrate

echo "Running seeds..."
npx sequelize db:seed:all

echo "Starting application..."
if [ -n "$SERVER_PATH" ]; then
  exec node "$SERVER_PATH"
else
  echo "server.js not found!"
  exit 1
fi
