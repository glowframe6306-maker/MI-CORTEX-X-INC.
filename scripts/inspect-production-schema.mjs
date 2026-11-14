import { Pool } from '@neondatabase/serverless';

const STATEMENT_TIMEOUT_MS = 10000;
const APPLICATION_TABLES = [
  'site_admins',
  'admins',
  'sessions',
  'rate_limits',
  'applications',
  'documents',
  'orders',
  'order_idempotency_keys'
];
const REQUIRED_CATALOGS = [
  'pg_catalog.pg_database',
  'pg_catalog.pg_namespace',
  'pg_catalog.pg_class',
  'pg_catalog.pg_attribute',
  'pg_catalog.pg_constraint',
  'pg_catalog.pg_index',
  'pg_catalog.pg_roles',
  'pg_catalog.pg_auth_members',
  'pg_catalog.pg_proc',
  'pg_catalog.pg_type'
];

class SafetyFailure extends Error {
  constructor(checks, identity, role) {
    super('Database-level read-only checks did not pass.');
    this.checks = checks;
    this.identity = identity;
    this.role = role;
  }
}

class SafeConfigurationFailure extends Error {}

function isPostgresUrl(value) {
  try {
    const url = new URL(value);
    return ['postgres:', 'postgresql:'].includes(url.protocol)
      && Boolean(url.hostname)
      && url.pathname.length > 1;
  } catch {
    return false;
  }
}

function getErrorClass(error) {
  return error instanceof Error && /^[A-Za-z]+Error$/.test(error.name)
    ? error.name
    : 'Error';
}

async function main() {
  const connectionString = process.env.READONLY_DATABASE_URL;
  if (!connectionString) {
    throw new SafeConfigurationFailure('READONLY_DATABASE_URL is required; DATABASE_URL is never used.');
  }
  if (!isPostgresUrl(connectionString)) {
    throw new SafeConfigurationFailure('READONLY_DATABASE_URL must be a valid PostgreSQL URL.');
  }

  let pool;
  let client;
  let stage = 'connection';
  let report;
  let failure;

  try {
    pool = new Pool({
      connectionString,
      max: 1,
      connectionTimeoutMillis: STATEMENT_TIMEOUT_MS,
      options: `-c default_transaction_read_only=on -c statement_timeout=${STATEMENT_TIMEOUT_MS}`
    });
    client = await pool.connect();

    stage = 'identity and safety metadata';
    const identityResult = await client.query(`
      SELECT current_database() AS database_name,
        current_schema() AS schema_name,
        current_user AS role_name,
        session_user AS session_role_name,
        current_schemas(false) AS active_schemas,
        current_setting('transaction_read_only') AS transaction_read_only,
        current_setting('statement_timeout') AS statement_timeout,
        (EXTRACT(EPOCH FROM current_setting('statement_timeout')::interval) * 1000)::integer
          AS statement_timeout_ms
    `);
    const identity = identityResult.rows[0];

    const roleResult = await client.query(`
      SELECT r.rolname AS role_name,
        r.rolcanlogin AS can_login,
        r.rolinherit AS inherits_role_privileges,
        r.rolsuper AS is_superuser,
        r.rolcreatedb AS can_create_database,
        r.rolcreaterole AS can_create_roles,
        r.rolreplication AS can_replicate,
        r.rolbypassrls AS bypasses_row_security,
        d.datdba = current_user::regrole::oid AS owns_database,
        has_database_privilege(current_user, d.oid, 'CONNECT') AS can_connect,
        has_database_privilege(current_user, d.oid, 'CREATE') AS can_create_schema,
        has_database_privilege(current_user, d.oid, 'TEMP') AS can_create_temp_objects
      FROM pg_catalog.pg_roles AS r
      JOIN pg_catalog.pg_database AS d ON d.datname = current_database()
      WHERE r.rolname = current_user
    `);
    const role = roleResult.rows[0];

    const membershipResult = await client.query(`
      SELECT granted_role.rolname AS granted_role,
        membership.admin_option
      FROM pg_catalog.pg_auth_members AS membership
      JOIN pg_catalog.pg_roles AS member_role ON member_role.oid = membership.member
      JOIN pg_catalog.pg_roles AS granted_role ON granted_role.oid = membership.roleid
      WHERE member_role.rolname = current_user
      ORDER BY granted_role.rolname
    `);

    const schemasResult = await client.query(`
      SELECT namespace.nspname AS schema_name,
        pg_catalog.pg_get_userbyid(namespace.nspowner) AS schema_owner,
        namespace.nspowner = current_user::regrole::oid AS is_owner,
        has_schema_privilege(current_user, namespace.oid, 'USAGE') AS can_use,
        has_schema_privilege(current_user, namespace.oid, 'CREATE') AS can_create_objects
      FROM pg_catalog.pg_namespace AS namespace
      WHERE namespace.nspname !~ '^pg_'
        AND namespace.nspname <> 'information_schema'
      ORDER BY namespace.nspname
    `);

    const catalogValues = REQUIRED_CATALOGS.map((_, index) => `($${index + 1}::text)`).join(', ');
    const catalogResult = await client.query(`
      SELECT required.name AS catalog_name,
        has_table_privilege(current_user, required.name::regclass, 'SELECT') AS can_select
      FROM (VALUES ${catalogValues}) AS required(name)
      ORDER BY required.name
    `, REQUIRED_CATALOGS);

    const relationResult = await client.query(`
      SELECT namespace.nspname AS schema_name,
        relation.relname AS relation_name,
        relation.relkind AS relation_kind,
        pg_catalog.pg_get_userbyid(relation.relowner) AS relation_owner,
        relation.relowner = current_user::regrole::oid AS is_owner,
        has_table_privilege(current_user, relation.oid, 'SELECT') AS can_select,
        has_table_privilege(current_user, relation.oid, 'INSERT') AS can_insert,
        has_any_column_privilege(current_user, relation.oid, 'INSERT') AS can_insert_columns,
        has_table_privilege(current_user, relation.oid, 'UPDATE') AS can_update,
        has_any_column_privilege(current_user, relation.oid, 'UPDATE') AS can_update_columns,
        has_table_privilege(current_user, relation.oid, 'DELETE') AS can_delete,
        has_table_privilege(current_user, relation.oid, 'TRUNCATE') AS can_truncate,
        has_table_privilege(current_user, relation.oid, 'REFERENCES') AS can_add_references,
        has_table_privilege(current_user, relation.oid, 'TRIGGER') AS can_add_triggers
      FROM pg_catalog.pg_class AS relation
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname !~ '^pg_'
        AND namespace.nspname <> 'information_schema'
        AND relation.relkind IN ('r', 'p', 'v', 'm', 'f')
      ORDER BY namespace.nspname, relation.relname
    `);

    const sequenceResult = await client.query(`
      SELECT namespace.nspname AS schema_name,
        sequence.relname AS sequence_name,
        pg_catalog.pg_get_userbyid(sequence.relowner) AS sequence_owner,
        sequence.relowner = current_user::regrole::oid AS is_owner,
        has_sequence_privilege(current_user, sequence.oid, 'SELECT') AS can_read,
        has_sequence_privilege(current_user, sequence.oid, 'USAGE') AS can_advance,
        has_sequence_privilege(current_user, sequence.oid, 'UPDATE') AS can_set_value
      FROM pg_catalog.pg_class AS sequence
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = sequence.relnamespace
      WHERE namespace.nspname !~ '^pg_'
        AND namespace.nspname <> 'information_schema'
        AND sequence.relkind = 'S'
      ORDER BY namespace.nspname, sequence.relname
    `);

    const functionResult = await client.query(`
      SELECT namespace.nspname AS schema_name,
        procedure.proname AS function_name,
        pg_catalog.pg_get_userbyid(procedure.proowner) AS function_owner,
        procedure.proowner = current_user::regrole::oid AS is_owner,
        procedure.prosecdef AS is_security_definer,
        has_function_privilege(current_user, procedure.oid, 'EXECUTE') AS can_execute
      FROM pg_catalog.pg_proc AS procedure
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
      WHERE namespace.nspname !~ '^pg_'
        AND namespace.nspname <> 'information_schema'
        AND (
          procedure.proowner = current_user::regrole::oid
          OR (
            procedure.prosecdef
            AND has_function_privilege(current_user, procedure.oid, 'EXECUTE')
          )
        )
      ORDER BY namespace.nspname, procedure.proname
    `);

    const typeResult = await client.query(`
      SELECT namespace.nspname AS schema_name,
        data_type.typname AS type_name,
        pg_catalog.pg_get_userbyid(data_type.typowner) AS type_owner
      FROM pg_catalog.pg_type AS data_type
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = data_type.typnamespace
      WHERE namespace.nspname !~ '^pg_'
        AND namespace.nspname <> 'information_schema'
        AND data_type.typowner = current_user::regrole::oid
        AND data_type.typtype <> 'p'
      ORDER BY namespace.nspname, data_type.typname
    `);

    const checks = [];
    if (!identity.database_name || !identity.schema_name || !identity.role_name) {
      checks.push('database identity is incomplete');
    }
    if (identity.role_name !== identity.session_role_name) {
      checks.push('current role differs from the login role');
    }
    if (identity.transaction_read_only !== 'on') {
      checks.push('transaction is not read-only');
    }
    if (!identity.statement_timeout_ms || identity.statement_timeout_ms > STATEMENT_TIMEOUT_MS) {
      checks.push('statement timeout is missing or exceeds the configured limit');
    }
    if (!role) {
      checks.push('connected role metadata is unavailable');
    } else {
      if (!role.can_login) checks.push('connected role cannot log in');
      if (role.is_superuser) checks.push('connected role is a superuser');
      if (role.can_create_database) checks.push('connected role can create databases');
      if (role.can_create_roles) checks.push('connected role can create or alter roles');
      if (role.can_replicate) checks.push('connected role has replication privileges');
      if (role.bypasses_row_security) checks.push('connected role bypasses row security');
      if (role.owns_database) checks.push('connected role owns the database');
      if (!role.can_connect) checks.push('connected role lacks database CONNECT');
      if (role.can_create_schema) checks.push('connected role can create schemas');
      if (role.can_create_temp_objects) checks.push('connected role can create temporary objects');
    }
    if (membershipResult.rows.length) {
      checks.push('connected role is a member of another role');
    }

    const currentSchema = schemasResult.rows.find((entry) => entry.schema_name === identity.schema_name);
    if (!currentSchema || !currentSchema.can_use) {
      checks.push('connected role lacks USAGE on the current schema');
    }
    if (schemasResult.rows.some((entry) => entry.is_owner)) {
      checks.push('connected role owns an application schema');
    }
    if (schemasResult.rows.some((entry) => entry.can_create_objects)) {
      checks.push('connected role can create objects in an application schema');
    }
    if (catalogResult.rows.some((entry) => !entry.can_select)) {
      checks.push('connected role lacks SELECT on required PostgreSQL catalogs');
    }
    if (relationResult.rows.some((entry) => (
      entry.is_owner
      || entry.can_insert
      || entry.can_insert_columns
      || entry.can_update
      || entry.can_update_columns
      || entry.can_delete
      || entry.can_truncate
      || entry.can_add_references
      || entry.can_add_triggers
    ))) {
      checks.push('connected role owns an application relation or has write/DDL privileges on one');
    }
    if (sequenceResult.rows.some((entry) => (
      entry.is_owner || entry.can_advance || entry.can_set_value
    ))) {
      checks.push('connected role owns or can modify an application sequence');
    }
    if (functionResult.rows.some((entry) => (
      entry.is_owner || (entry.is_security_definer && entry.can_execute)
    ))) {
      checks.push('connected role owns an application function or can execute a SECURITY DEFINER function');
    }
    if (typeResult.rows.length) {
      checks.push('connected role owns an application type');
    }

    if (checks.length) {
      throw new SafetyFailure(checks, identity, {
        ...role,
        memberships: membershipResult.rows
      });
    }

    stage = 'application schema metadata';
    const tableValues = APPLICATION_TABLES.map((_, index) => `($${index + 1}::text)`).join(', ');
    const tableNames = await client.query(`
      SELECT requested.name AS table_name,
        EXISTS (
          SELECT 1
          FROM pg_catalog.pg_class AS relation
          JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
          WHERE namespace.nspname = $${APPLICATION_TABLES.length + 1}
            AND relation.relname = requested.name
            AND relation.relkind IN ('r', 'p')
        ) AS exists_in_current_schema
      FROM (VALUES ${tableValues}) AS requested(name)
      ORDER BY requested.name
    `, [...APPLICATION_TABLES, identity.schema_name]);

    const columns = await client.query(`
      SELECT namespace.nspname AS schema_name,
        relation.relname AS table_name,
        attribute.attname AS column_name,
        pg_catalog.format_type(attribute.atttypid, attribute.atttypmod) AS data_type,
        NOT attribute.attnotnull AS is_nullable,
        attribute.atthasdef AS has_default
      FROM pg_catalog.pg_attribute AS attribute
      JOIN pg_catalog.pg_class AS relation ON relation.oid = attribute.attrelid
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname !~ '^pg_'
        AND namespace.nspname <> 'information_schema'
        AND relation.relname = ANY($1::text[])
        AND relation.relkind IN ('r', 'p')
        AND attribute.attnum > 0
        AND NOT attribute.attisdropped
      ORDER BY namespace.nspname, relation.relname, attribute.attnum
    `, [APPLICATION_TABLES]);

    const constraints = await client.query(`
      SELECT namespace.nspname AS schema_name,
        relation.relname AS table_name,
        constraint_info.conname AS constraint_name,
        CASE constraint_info.contype
          WHEN 'p' THEN 'primary_key'
          WHEN 'f' THEN 'foreign_key'
          WHEN 'u' THEN 'unique'
          WHEN 'c' THEN 'check'
          WHEN 'x' THEN 'exclusion'
          ELSE constraint_info.contype::text
        END AS constraint_type,
        pg_catalog.pg_get_constraintdef(constraint_info.oid, true) AS definition,
        constraint_info.convalidated AS is_validated
      FROM pg_catalog.pg_constraint AS constraint_info
      JOIN pg_catalog.pg_class AS relation ON relation.oid = constraint_info.conrelid
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname !~ '^pg_'
        AND namespace.nspname <> 'information_schema'
        AND relation.relname = ANY($1::text[])
      ORDER BY namespace.nspname, relation.relname, constraint_info.conname
    `, [APPLICATION_TABLES]);

    const indexes = await client.query(`
      SELECT namespace.nspname AS schema_name,
        table_relation.relname AS table_name,
        index_relation.relname AS index_name,
        index_info.indisprimary AS is_primary,
        index_info.indisunique AS is_unique,
        index_info.indisvalid AS is_valid,
        index_info.indisready AS is_ready,
        pg_catalog.pg_get_indexdef(index_info.indexrelid) AS definition
      FROM pg_catalog.pg_index AS index_info
      JOIN pg_catalog.pg_class AS table_relation ON table_relation.oid = index_info.indrelid
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = table_relation.relnamespace
      JOIN pg_catalog.pg_class AS index_relation ON index_relation.oid = index_info.indexrelid
      WHERE namespace.nspname !~ '^pg_'
        AND namespace.nspname <> 'information_schema'
        AND table_relation.relname = ANY($1::text[])
      ORDER BY namespace.nspname, table_relation.relname, index_relation.relname
    `, [APPLICATION_TABLES]);

    const relations = relationResult.rows;
    report = {
      status: 'read-only metadata inspection completed',
      identity: {
        database: identity.database_name,
        schema: identity.schema_name,
        role: identity.role_name,
        activeSchemas: identity.active_schemas,
        transactionReadOnly: identity.transaction_read_only,
        statementTimeout: identity.statement_timeout
      },
      roleSafety: {
        ...role,
        memberships: membershipResult.rows,
        catalogSelect: catalogResult.rows,
        applicationSchemaPrivileges: schemasResult.rows,
        applicationRelationPrivileges: relations,
        sequencePrivileges: sequenceResult.rows,
        ownedOrSecurityDefinerFunctions: functionResult.rows,
        ownedTypes: typeResult.rows
      },
      tables: tableNames.rows,
      similarlyNamedObjects: relations.filter((entry) => (
        entry.relation_name === 'orders' || entry.relation_name === 'order_idempotency_keys'
      )),
      columns: columns.rows,
      constraints: constraints.rows,
      indexes: indexes.rows
    };
  } catch (error) {
    failure = error;
  } finally {
    if (client) {
      try {
        client.release();
      } catch {
        failure ||= new Error('connection cleanup failed');
      }
    }
    if (pool) {
      try {
        await pool.end();
      } catch {
        failure ||= new Error('connection pool cleanup failed');
      }
    }
  }

  if (failure instanceof SafetyFailure) {
    console.error(JSON.stringify({
      status: 'inspection stopped before application schema details',
      reason: failure.message,
      identity: failure.identity && {
        database: failure.identity.database_name,
        schema: failure.identity.schema_name,
        role: failure.identity.role_name,
        transactionReadOnly: failure.identity.transaction_read_only
      },
      role: failure.role && {
        name: failure.role.role_name,
        memberships: failure.role.memberships
      },
      failedChecks: failure.checks
    }, null, 2));
    process.exitCode = 1;
  } else if (failure) {
    console.error(JSON.stringify({
      status: 'inspection failed safely',
      stage,
      errorClass: getErrorClass(failure)
    }));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify(report, null, 2));
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    status: 'inspection stopped safely',
    reason: error instanceof SafeConfigurationFailure ? error.message : 'unexpected failure',
    errorClass: getErrorClass(error)
  }));
  process.exitCode = 1;
});
