#!/bin/sh
set -e

./node_modules/.bin/prisma migrate deploy

# exec replaces the shell with node, making it PID 1 and receiving OS signals correctly
exec node dist/main
