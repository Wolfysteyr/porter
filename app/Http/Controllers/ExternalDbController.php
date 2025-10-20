<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\ExternalDatabase;

class ExternalDbController extends Controller
{

    // create a new external database configuration
    public function createExternalDb(Request $request){
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:external_databases,name',
            'description' => 'nullable|string|max:100',
            'driver' => 'required|string|in:mysql,pgsql,sqlsrv,sqlite,mariadb,oracle',
            'host' => 'required|string|max:255',
            'port' => 'nullable|integer',
            'username' => 'required|string|max:255',
            'password' => 'nullable|string|max:255',
        ]);

        $testConfig = [
            'driver' => $validated['driver'],
            'host' => $validated['host'],
            'port' => $validated['port'] != "" ? $validated['port'] : 3306,
            'database' => $validated['name'], // use 'name' as database name
            'username' => $validated['username'],
            'password' => $validated['password'],
            'charset' => config('database.connections.' . $validated['driver'] . '.charset', 'utf8mb4'),
            'collation' => config('database.connections.' . $validated['driver'] . '.collation', 'utf8mb4_unicode_ci'),
            'prefix' => '',
            'strict' => true,
            'engine' => null,
        ];

        

        $connName = 'test_external_' . uniqid();
        config(["database.connections.$connName" => $testConfig]);

        try {
            DB::connection($connName)->getPdo();
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Could not connect to the database with provided credentials.',
                'details' => $e->getMessage()
            ], 422);
        }

        $externalDb = ExternalDatabase::create($validated);

        return response()->json($externalDb, 201);
    }

    /**
     * Detect table owner/schema for drivers where schema matters (Oracle, Postgres, SQL Server, MySQL)
     * Returns schema/owner name (string) or null if not determinable.
     */
    protected function detectTableOwner($conn, $driver, $table)
    {
        $driver = strtolower($driver ?? $conn->getConfig('driver') ?? 'mysql');
        try {
            switch ($driver) {
                case 'oracle':
                case 'oci':
                case 'oci8':
                    // Search ALL_TAB_COLUMNS for an owner that has the table visible
                    $rows = $conn->select("SELECT OWNER FROM ALL_TAB_COLUMNS WHERE TABLE_NAME = UPPER(?) AND ROWNUM = 1", [$table]);
                    if (!empty($rows)) {
                        $r = current($rows);
                        return $r->OWNER ?? ($r->owner ?? null);
                    }
                    break;
                case 'pgsql':
                case 'postgres':
                case 'postgresql':
                    $rows = $conn->select("SELECT table_schema FROM information_schema.tables WHERE table_name = ? AND table_schema NOT IN ('pg_catalog','information_schema') LIMIT 1", [$table]);
                    if (!empty($rows)) {
                        $r = current($rows);
                        return $r->table_schema ?? ($r->tableSchema ?? null);
                    }
                    break;
                case 'sqlsrv':
                case 'sqlserver':
                    $rows = $conn->select("SELECT TABLE_SCHEMA FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = ?", [$table]);
                    if (!empty($rows)) {
                        $r = current($rows);
                        return $r->TABLE_SCHEMA ?? ($r->table_schema ?? null);
                    }
                    break;
                default:
                    // mysql/mariadb
                    $db = $conn->selectOne('SELECT DATABASE() AS db');
                    if ($db) return $db->db ?? null;
                    $cfg = $conn->getConfig('database');
                    return $cfg ?? null;
            }
        } catch (\Exception $e) {
            // ignore detection errors and return null
        }
        return null;
    }
    // List all configured external databases
    public function listExternalDbs()
    {
        $dbs = ExternalDatabase::all();
        return response()->json($dbs);
    }
    /**
     * Get a DB connection for a given external database identifier.
     */
    protected function getExternalConnection($name)
    {
        if (!$name) {
            // fallback to default 'external' connection
            return response()->json(['error' => 'No database name provided'], 400);
        }
        $db = ExternalDatabase::where('name', $name)->first();
        if (!$db) {
            abort(404, 'External database not found');
        }
        // Create a dynamic connection config
        $config = [
            'database' => $db->name,
            'driver' => $db->driver ?? 'mysql',
            'host' => $db->host,
            'port' => $db->port,
            'username' => $db->username,
            'password' => $db->password,
            'charset' =>  config('database.connections.' . $db->driver . '.charset', 'utf8mb4'),
            'collation' => config('database.connections.' . $db->driver . '.collation', 'utf8mb4_unicode_ci'),
            'prefix' => '',
            'strict' => true,
            'engine' => null,
        ];
        // Use a unique connection name per identifier
        $connName = 'external_' . $db->name;
        config(["database.connections.$connName" => $config]);
        return DB::connection($connName);
    }

    /**
     * Fetch column names for a table in a driver-aware way.
     * Returns an array of column names (strings).
     */
    protected function fetchColumnNames($conn, $driver, $table, $schema = null)
    {
        $driver = strtolower($driver ?? $conn->getConfig('driver') ?? 'mysql');
        $rows = [];
        switch ($driver) {
            case 'pgsql':
            case 'postgres':
            case 'postgresql':
                // try current_schema
                $rows = $conn->select("SELECT column_name, table_schema FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = ? ORDER BY ordinal_position", [$table]);
                if (empty($rows) && $schema) {
                    $rows = $conn->select("SELECT column_name, table_schema FROM information_schema.columns WHERE table_schema = ? AND table_name = ? ORDER BY ordinal_position", [$schema, $table]);
                }
                if (empty($rows)) {
                    // try public
                    $rows = $conn->select("SELECT column_name, table_schema FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ? ORDER BY ordinal_position", [$table]);
                }
                if (empty($rows)) {
                    // as last resort, find any non-system schema with that table
                    $rows = $conn->select("SELECT column_name, table_schema FROM information_schema.columns WHERE table_name = ? AND table_schema NOT IN ('pg_catalog','information_schema') ORDER BY table_schema, ordinal_position", [$table]);
                }
                return array_map(fn($r) => $r->column_name ?? current((array)$r), $rows);
            case 'sqlite':
                $rows = $conn->select("PRAGMA table_info('" . $table . "')");
                return array_map(fn($r) => $r->name ?? current((array)$r), $rows);
            case 'oracle':
            case 'oci':
            case 'oci8':
                // try USER_TAB_COLUMNS (current schema)
                $rows = $conn->select("SELECT COLUMN_NAME FROM USER_TAB_COLUMNS WHERE TABLE_NAME = UPPER(?) ORDER BY COLUMN_ID", [$table]);
                if (empty($rows) && $schema) {
                    $rows = $conn->select("SELECT COLUMN_NAME FROM ALL_TAB_COLUMNS WHERE OWNER = UPPER(?) AND TABLE_NAME = UPPER(?) ORDER BY COLUMN_ID", [$schema, $table]);
                }
                if (empty($rows)) {
                    // try ALL_TAB_COLUMNS for any visible table
                    $rows = $conn->select("SELECT COLUMN_NAME FROM ALL_TAB_COLUMNS WHERE TABLE_NAME = UPPER(?) ORDER BY COLUMN_ID", [$table]);
                }
                return array_map(fn($r) => $r->COLUMN_NAME ?? $r->column_name ?? current((array)$r), $rows);
            case 'sqlsrv':
            case 'sqlserver':
                if ($schema) {
                    $rows = $conn->select("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION", [$schema, $table]);
                } else {
                    $rows = $conn->select("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ? ORDER BY ORDINAL_POSITION", [$table]);
                }
                return array_map(fn($r) => $r->COLUMN_NAME ?? current((array)$r), $rows);
            default:
                // mysql / mariadb
                if ($schema) {
                    $rows = $conn->select("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION", [$schema, $table]);
                } else {
                    $rows = $conn->select("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION", [$table]);
                }
                return array_map(fn($r) => $r->COLUMN_NAME ?? current((array)$r), $rows);
        }
    }

    /**
     * Fetch foreign key metadata for a table in a driver-aware way.
     * Returns an array of objects with keys: CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
     */
    protected function fetchForeignKeys($conn, $driver, $table, $schema = null)
    {
        $driver = strtolower($driver ?? $conn->getConfig('driver') ?? 'mysql');
        $rows = [];
        switch ($driver) {
            case 'pgsql':
            case 'postgres':
            case 'postgresql':
                $rows = $conn->select(
                    "SELECT kcu.constraint_name, kcu.column_name, ccu.table_name AS referenced_table_name, ccu.column_name AS referenced_column_name
                     FROM information_schema.key_column_usage kcu
                     JOIN information_schema.constraint_column_usage ccu ON kcu.constraint_name = ccu.constraint_name
                     WHERE kcu.table_schema = current_schema() AND kcu.table_name = ?",
                    [$table]
                );
                return array_map(function($r) {
                    return (object)[
                        'CONSTRAINT_NAME' => $r->constraint_name ?? null,
                        'COLUMN_NAME' => $r->column_name ?? null,
                        'REFERENCED_TABLE_NAME' => $r->referenced_table_name ?? null,
                        'REFERENCED_COLUMN_NAME' => $r->referenced_column_name ?? null,
                    ];
                }, $rows ?: []);
            case 'sqlite':
                $fkRows = $conn->select("PRAGMA foreign_key_list('" . $table . "')");
                return array_map(function($r) {
                    return (object)[
                        'CONSTRAINT_NAME' => null,
                        'COLUMN_NAME' => $r->from ?? $r->FROM ?? null,
                        'REFERENCED_TABLE_NAME' => $r->table ?? $r->TABLE ?? null,
                        'REFERENCED_COLUMN_NAME' => $r->to ?? $r->TO ?? null,
                    ];
                }, $fkRows ?: []);
            case 'oracle':
            case 'oci':
            case 'oci8':
                // If schema provided, prefer ALL_* views filtered by owner/table
                if (!empty($schema)) {
                    $rows = $conn->select(
                        "SELECT acc.constraint_name AS constraint_name, acc.column_name AS column_name, ac_pk.table_name AS referenced_table_name, acc_pk.column_name AS referenced_column_name
                         FROM all_cons_columns acc
                         JOIN all_constraints ac ON acc.owner = ac.owner AND acc.constraint_name = ac.constraint_name
                         JOIN all_constraints ac_pk ON ac.r_constraint_name = ac_pk.constraint_name AND ac.r_owner = ac_pk.owner
                         JOIN all_cons_columns acc_pk ON acc_pk.owner = ac_pk.owner AND acc_pk.constraint_name = ac_pk.constraint_name AND acc_pk.position = acc.position
                         WHERE ac.constraint_type = 'R' AND acc.owner = UPPER(?) AND acc.table_name = UPPER(?)",
                        [$schema, $table]
                    );
                }
                // Fallback: try USER_* (current schema) then ALL_* for any visible table
                if (empty($rows)) {
                    $rows = $conn->select(
                        "SELECT a.constraint_name AS constraint_name, a.column_name AS column_name, c_pk.table_name AS referenced_table_name, b.column_name AS referenced_column_name
                         FROM user_cons_columns a
                         JOIN user_constraints c ON a.constraint_name = c.constraint_name
                         JOIN user_constraints c_pk ON c.r_constraint_name = c_pk.constraint_name
                         JOIN user_cons_columns b ON b.constraint_name = c_pk.constraint_name AND b.position = a.position
                         WHERE c.constraint_type = 'R' AND a.table_name = UPPER(?)",
                        [$table]
                    );
                }
                if (empty($rows)) {
                    $rows = $conn->select(
                        "SELECT acc.constraint_name AS constraint_name, acc.column_name AS column_name, ac_pk.table_name AS referenced_table_name, acc_pk.column_name AS referenced_column_name
                         FROM all_cons_columns acc
                         JOIN all_constraints ac ON acc.owner = ac.owner AND acc.constraint_name = ac.constraint_name
                         JOIN all_constraints ac_pk ON ac.r_constraint_name = ac_pk.constraint_name AND ac.r_owner = ac_pk.owner
                         JOIN all_cons_columns acc_pk ON acc_pk.owner = ac_pk.owner AND acc_pk.constraint_name = ac_pk.constraint_name AND acc_pk.position = acc.position
                         WHERE ac.constraint_type = 'R' AND acc.table_name = UPPER(?)",
                        [$table]
                    );
                }
                return array_map(function($r) {
                    return (object)[
                        'CONSTRAINT_NAME' => $r->constraint_name ?? $r->CONSTRAINT_NAME ?? null,
                        'COLUMN_NAME' => $r->column_name ?? $r->COLUMN_NAME ?? null,
                        'REFERENCED_TABLE_NAME' => $r->referenced_table_name ?? $r->REFERENCED_TABLE_NAME ?? null,
                        'REFERENCED_COLUMN_NAME' => $r->referenced_column_name ?? $r->REFERENCED_COLUMN_NAME ?? null,
                    ];
                }, $rows ?: []);
            case 'sqlsrv':
            case 'sqlserver':
                $rows = $conn->select(
                    "SELECT fk.name AS CONSTRAINT_NAME, pc.name AS COLUMN_NAME, rt.name AS REFERENCED_TABLE_NAME, rc.name AS REFERENCED_COLUMN_NAME
                     FROM sys.foreign_keys fk
                     JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
                     JOIN sys.columns pc ON fkc.parent_object_id = pc.object_id AND fkc.parent_column_id = pc.column_id
                     JOIN sys.columns rc ON fkc.referenced_object_id = rc.object_id AND fkc.referenced_column_id = rc.column_id
                     JOIN sys.tables pt ON pc.object_id = pt.object_id
                     JOIN sys.tables rt ON rc.object_id = rt.object_id
                     WHERE pt.name = ?",
                    [$table]
                );
                return array_map(function($r) {
                    return (object)[
                        'CONSTRAINT_NAME' => $r->CONSTRAINT_NAME ?? null,
                        'COLUMN_NAME' => $r->COLUMN_NAME ?? null,
                        'REFERENCED_TABLE_NAME' => $r->REFERENCED_TABLE_NAME ?? null,
                        'REFERENCED_COLUMN_NAME' => $r->REFERENCED_COLUMN_NAME ?? null,
                    ];
                }, $rows ?: []);
            default:
                // mysql / mariadb
                // prefer using DATABASE(), but if that returns nothing (some drivers/configs), fall back to configured database name
                $rows = $conn->select(
                    "SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
                     FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL",
                    [$table]
                );
                if (empty($rows)) {
                    $cfgDb = $conn->getConfig('database') ?? null;
                    if ($cfgDb) {
                        $rows = $conn->select(
                            "SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
                             FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL",
                            [$cfgDb, $table]
                        );
                    }
                }
                return array_map(function($r) {
                    return (object)[
                        'CONSTRAINT_NAME' => $r->CONSTRAINT_NAME ?? null,
                        'COLUMN_NAME' => $r->COLUMN_NAME ?? null,
                        'REFERENCED_TABLE_NAME' => $r->REFERENCED_TABLE_NAME ?? null,
                        'REFERENCED_COLUMN_NAME' => $r->REFERENCED_COLUMN_NAME ?? null,
                    ];
                }, $rows ?: []);
        }
    }

    public function listTables(Request $request)
    {
        $db = ExternalDatabase::where('name', $request->input('name'))->first();
        if (!$db) {
            abort(404, 'External database not found');
        }
        $name = $request->input('name');
        $conn = $this->getExternalConnection($name);
        // If getExternalConnection returned a JsonResponse (error), pass it through
        if ($conn instanceof \Illuminate\Http\JsonResponse) {
            return $conn;
        }

        // Determine driver and run an appropriate query for listing tables
        $driver = strtolower($conn->getConfig('driver') ?? $db->driver ?? 'mysql');
        $tables = [];

        try {
            switch ($driver) {
                case 'pgsql':
                case 'postgres':
                case 'postgresql':
                    // Try current schema first, then fall back to all non-system tables
                    $rows = $conn->select("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = current_schema()");
                    if (empty($rows)) {
                        $rows = $conn->select("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')");
                    }
                    $tables = array_map(fn($r) => $r->tablename ?? current((array)$r), $rows);
                    break;
                case 'sqlite':
                    $rows = $conn->select("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
                    $tables = array_map(fn($r) => $r->name ?? current((array)$r), $rows);
                    break;
                case 'sqlsrv':
                case 'sqlserver':
                    // Prefer current schema (default schema), INFORMATION_SCHEMA will usually work
                    $rows = $conn->select("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'");
                    $tables = array_map(fn($r) => $r->TABLE_NAME ?? current((array)$r), $rows);
                    break;
                case 'oracle':
                case 'oci':
                case 'oci8':
                    // Try USER_TABLES first (tables in schema), then ALL_TABLES filtered by owner (username), then ALL_TABLES
                    $rows = $conn->select("SELECT TABLE_NAME FROM USER_TABLES");
                    if (empty($rows)) {
                        // try owner bound to the provided username (likely the schema)
                        $owner = strtoupper($db->username ?? '');
                        if (!empty($owner)) {
                            $rows = $conn->select("SELECT TABLE_NAME FROM ALL_TABLES WHERE OWNER = ?", [$owner]);
                        }
                    }
                    if (empty($rows)) {
                        // final fallback: list all tables visible
                        $rows = $conn->select("SELECT TABLE_NAME FROM ALL_TABLES");
                    }
                    $tables = array_map(fn($r) => $r->TABLE_NAME ?? $r->table_name ?? current((array)$r), $rows);
                    break;
                default:
                    // mysql / mariadb and other drivers that support SHOW TABLES
                    $rows = $conn->select('SHOW TABLES');
                    // The column name varies (e.g. Tables_in_database); extract the first value
                    $tables = array_map(fn($r) => current((array)$r), $rows);
                    break;
            }
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Could not list tables for the external database.',
                'details' => $e->getMessage(),
                'driver' => $driver,
            ], 422);
        }

        // Return driver plus tables to help debugging when empty
        return response()->json([
            'driver' => $driver,
            'tables' => array_values(array_filter($tables ?? [])),
        ]);
    }

    public function getTableData(Request $request, $table)
    {
        $identifier = $request->input('name');
        $conn = $this->getExternalConnection($identifier);

        $columns    = $request->input('columns', []);
        $limit      = $request->input('limit', 10);
        $foreign_keys  = $request->input('foreign_keys', []);
        $whereConds = $request->input('where', []);
        

        // validation for table and column names to prevent SQL injection
        $validateIdentifier = function($name) {
            return preg_match('/^[a-zA-Z0-9_]+$/', $name);
        };

        // detect driver and optional schema
        $driver = strtolower($conn->getConfig('driver') ?? 'mysql');
        $schema = $request->input('schema');
        if (!$schema && str_contains($table, '.')) {
            [$schema, $table] = explode('.', $table, 2);
        }

        // Prepare main table select columns (qualified with main table name)
        $selectParts = [];

        // choose identifier quoting based on driver
        $quoteLeft = '`';
        $quoteRight = '`';
        switch ($driver) {
            case 'pgsql':
            case 'postgres':
            case 'postgresql':
            case 'oracle':
            case 'oci':
            case 'oci8':
                $quoteLeft = '"';
                $quoteRight = '"';
                break;
            case 'sqlsrv':
            case 'sqlserver':
                $quoteLeft = '[';
                $quoteRight = ']';
                break;
            case 'sqlite':
                // sqlite accepts double quotes or backticks; use double quotes
                $quoteLeft = '"';
                $quoteRight = '"';
                break;
            default:
                // mysql / mariadb
                $quoteLeft = '`';
                $quoteRight = '`';
                break;
        }

        // fetch column list using schema when available
        // build quoted prefix for selects (include schema when provided)
        $selectPrefixQuoted = $quoteLeft . $table . $quoteRight . '.';
        if (!empty($schema)) {
            $selectPrefixQuoted = $quoteLeft . $schema . $quoteRight . '.' . $quoteLeft . $table . $quoteRight . '.';
        }

        $selectAll = empty($columns) || $columns === "*" || (is_array($columns) && in_array("*", $columns));
        if ($selectAll) {
            $dbCols = $this->fetchColumnNames($conn, $driver, $table, $schema);
            foreach ($dbCols as $col) {
                if (!$validateIdentifier($col)) continue;
                $selectParts[] = $selectPrefixQuoted . $quoteLeft . $col . $quoteRight . ' as ' . $quoteLeft . $col . $quoteRight;
            }
        } else {
            foreach ($columns as $col) {
                if (!$validateIdentifier($col)) continue;
                $selectParts[] = $selectPrefixQuoted . $quoteLeft . $col . $quoteRight . ' as ' . $quoteLeft . $col . $quoteRight;
            }
        }

        if (empty($selectParts)) {
            return response()->json(['error' => 'No valid columns found for the table.'], 400);
        }

        // prepare table name for the query builder; if schema not provided, try to auto-detect owner/schema
        $tableForQuery = $table;
        if (empty($schema)) {
            $detectedOwner = $this->detectTableOwner($conn, $driver, $table);
            if ($detectedOwner) {
                $schema = $detectedOwner;
            }
        }
        if (!empty($schema)) {
            // use dot-qualified form (schema.table). Leave unquoted here so the query builder/driver can handle it.
            $tableForQuery = $schema . '.' . $table;
        }

        $query = $conn->table($tableForQuery);

        // Track aliases per referenced table and per parent column
        $aliasCounter = 0;
        $aliasMap = [];
        $aliasByParent = [];

    if (!empty($foreign_keys) && is_array($foreign_keys)) {
            foreach ($foreign_keys as $sel) {
                $parentCol = $sel['parentCol'] ?? null;
                if (!$parentCol || !$validateIdentifier($parentCol)) continue;

                $fkTables = $sel['fkTables'] ?? [];
                if (!is_array($fkTables)) continue;

                foreach ($fkTables as $fkTable) {
                    $refTable = $fkTable['tableName'] ?? null;
                    if (!$refTable || !$validateIdentifier($refTable)) continue;

                    $fkCols = $fkTable['fkColumns'] ?? [];
                    if (!is_array($fkCols) || empty($fkCols)) continue;

                    // determine referenced column name using driver-aware foreign key metadata
                    $fkMeta = $this->fetchForeignKeys($conn, $driver, $table, $schema);
                    $refCol = null;
                    foreach ($fkMeta as $fk) {
                        if (($fk->COLUMN_NAME ?? null) === $parentCol && ($fk->REFERENCED_TABLE_NAME ?? null) === $refTable) {
                            $refCol = $fk->REFERENCED_COLUMN_NAME ?? null;
                            break;
                        }
                    }
                    // fallback: try to find any fk entry for parentCol
                    if (!$refCol) {
                        foreach ($fkMeta as $fk) {
                            if (($fk->COLUMN_NAME ?? null) === $parentCol) {
                                $refCol = $fk->REFERENCED_COLUMN_NAME ?? null;
                                break;
                            }
                        }
                    }
                    if (!$refCol || !$validateIdentifier($refCol)) continue;

                    // create unique alias
                    $alias = preg_replace('/[^A-Za-z0-9_]/', '_', $refTable) . '_' . $aliasCounter++;
                    $aliasMap[$refTable][] = $alias;
                    $aliasByParent[$parentCol][$refTable] = $alias;

                    // add join: qualify referenced table with schema if available (may help for Oracle)
                    $refTableForJoin = $refTable;
                    // If the referenced table looks unqualified, try to detect its owner as well
                    if (!empty($schema)) {
                        $refTableForJoin = $schema . '.' . $refTable;
                    } else {
                        $detRefOwner = $this->detectTableOwner($conn, $driver, $refTable);
                        if ($detRefOwner) $refTableForJoin = $detRefOwner . '.' . $refTable;
                    }
                    $query->leftJoin("{$refTableForJoin} as {$alias}", "{$tableForQuery}.{$parentCol}", '=', "{$alias}.{$refCol}");

                    // add referenced columns to selects (use correct quoting)
                    foreach ($fkCols as $fkCol) {
                        if (!$validateIdentifier($fkCol)) continue;
                        $aliasCol = $alias . '__' . $fkCol;
                        $selectParts[] = $quoteLeft . $alias . $quoteRight . '.' . $quoteLeft . $fkCol . $quoteRight . ' as ' . $quoteLeft . $aliasCol . $quoteRight;
                    }
                }
            }
        }

        $query->selectRaw(implode(', ', $selectParts));

        if (!empty($whereConds) && is_array($whereConds)) {
            foreach ($whereConds as $wc) {
                if (is_array($wc) && array_values($wc) === $wc) {
                    $col = $wc[0] ?? null;
                    $op = strtoupper($wc[1] ?? '=');
                    $val = $wc[2] ?? null;
                } elseif (is_array($wc)) {
                    $col = $wc['column'] ?? null;
                    $op = strtoupper($wc['operator'] ?? '=');
                    $val = $wc['value'] ?? null;
                } else {
                    continue;
                }
                if (!$col) continue;

                $qualified = null;
                if (str_contains($col, '.')) {
                    [$tbl, $cname] = explode('.', $col, 2);
                    if ($tbl === $table) {
                        $qualified = "{$table}.{$cname}";
                    } elseif (isset($aliasMap[$tbl]) && count($aliasMap[$tbl]) === 1) {
                        $qualified = "{$aliasMap[$tbl][0]}.{$cname}";
                    } elseif (isset($aliasMap[$tbl]) && count($aliasMap[$tbl]) > 1) {
                        $qualified = "{$aliasMap[$tbl][0]}.{$cname}";
                    } else {
                        $qualified = "{$table}.{$cname}";
                    }
                } else {
                    $qualified = "{$table}.{$col}";
                }

                if ($op === 'IS NULL') {
                    $query->whereNull($qualified);
                } elseif ($op === 'IS NOT NULL') {
                    $query->whereNotNull($qualified);
                } elseif (in_array($op, ['IN', 'NOT IN'])) {
                    if (!is_array($val)) {
                        $val = is_string($val) ? array_map('trim', explode(',', $val)) : [$val];
                    }
                    if ($op === 'IN') $query->whereIn($qualified, $val);
                    else $query->whereNotIn($qualified, $val);
                } else {
                    $query->where($qualified, $op, $val);
                }
            }
        }

        $limit = intval($limit) > 0 ? intval($limit) : 10;
        $results = $query->limit($limit)->get();

        return response()->json(['rows' => $results]);
    }

    public function getTableColumns(Request $request, $table)
    {
        $identifier = $request->input('name');
        $conn = $this->getExternalConnection(strtolower($identifier));

        // Check if $conn is a DB connection, not a JsonResponse
        if ($conn instanceof \Illuminate\Http\JsonResponse) {
            return $conn;
        }

        // detect driver and optional schema
        $driver = strtolower($conn->getConfig('driver') ?? 'mysql');

        // allow schema passed via query param `schema` or encoded in the table param as schema.table
        $schema = $request->input('schema');
        if (!$schema && str_contains($table, '.')) {
            [$schema, $table] = explode('.', $table, 2);
        }

        $columns = $this->fetchColumnNames($conn, $driver, $table, $schema);

        $foreignKeys = $this->fetchForeignKeys($conn, $driver, $table, $schema);

        $formattedForeignKeys = [];
        foreach ($foreignKeys as $fk) {
            $columnName = $fk->COLUMN_NAME ?? null;
            $referencedTable = $fk->REFERENCED_TABLE_NAME ?? null;
            $fkInfo = [
                'constraint_name' => $fk->CONSTRAINT_NAME ?? null,
                'column_name' => $columnName,
                'referenced_table' => $referencedTable,
                'referenced_column' => $fk->REFERENCED_COLUMN_NAME ?? null,
                'referenced_table_columns' => []
            ];

            if ($columnName && in_array($columnName, $columns) && $referencedTable) {
                $fkInfo['referenced_table_columns'] = $this->fetchColumnNames($conn, $driver, $referencedTable);
            }

            if ($columnName) {
                $formattedForeignKeys[$columnName] = $fkInfo;
            }
        }

        return response()->json([
            'columns' => $columns,
            'foreignKeys' => $formattedForeignKeys
        ]);
    }
    
}