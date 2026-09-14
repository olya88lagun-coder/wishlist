SELECT format('CREATE ROLE wishlist LOGIN PASSWORD %L', :'pw')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wishlist') \gexec

SELECT 'CREATE DATABASE wishlist OWNER wishlist'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'wishlist') \gexec

SELECT datname FROM pg_database WHERE datname = 'wishlist';
