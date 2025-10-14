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

    public function listTables(Request $request)
    {
        $db = ExternalDatabase::where('name', $request->input('name'))->first();
        if (!$db) {
            abort(404, 'External database not found');
        }
        $name = $request->input('name');
        $conn = $this->getExternalConnection($name);
        $tables = $conn->select('SHOW TABLES');
        return response()->json($tables);
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

        // Prepare main table select columns (qualified with main table name)
        $selectParts = [];
        if (empty($columns)) {
            $dbCols = $conn->select(
                "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION",
                [$table]
            );
            $dbCols = array_map(fn($c) => $c->COLUMN_NAME, $dbCols);
            foreach ($dbCols as $col) {
                if (!$validateIdentifier($col)) continue;
                $selectParts[] = "`$table`.`$col` as `$col`";
            }
        } else {
            foreach ($columns as $col) {
                if (!$validateIdentifier($col)) continue;
                $selectParts[] = "`$table`.`$col` as `$col`";
            }
        }

        $query = $conn->table($table);

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

                    // determine referenced column name
                    $refInfo = $conn->select(
                        "SELECT REFERENCED_COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? AND REFERENCED_TABLE_NAME = ? LIMIT 1",
                        [$table, $parentCol, $refTable]
                    );
                    $refCol = $refInfo[0]->REFERENCED_COLUMN_NAME ?? null;
                    if (!$refCol || !$validateIdentifier($refCol)) {
                        $refInfo = $conn->select(
                            "SELECT REFERENCED_COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1",
                            [$table, $parentCol]
                        );
                        $refCol = $refInfo[0]->REFERENCED_COLUMN_NAME ?? null;
                    }
                    if (!$refCol || !$validateIdentifier($refCol)) continue;

                    // create unique alias
                    $alias = preg_replace('/[^A-Za-z0-9_]/', '_', $refTable) . '_' . $aliasCounter++;
                    $aliasMap[$refTable][] = $alias;
                    $aliasByParent[$parentCol][$refTable] = $alias;

                    // add join
                    $query->leftJoin("{$refTable} as {$alias}", "{$table}.{$parentCol}", '=', "{$alias}.{$refCol}");

                    // add referenced columns to selects
                    foreach ($fkCols as $fkCol) {
                        if (!$validateIdentifier($fkCol)) continue;
                        $aliasCol = $alias . '__' . $fkCol;
                        $selectParts[] = "`{$alias}`.`{$fkCol}` as `{$aliasCol}`";
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

        $columns = $conn->getSchemaBuilder()->getColumnListing($table);

        $foreignKeys = $conn->select(
            "SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL",
            [$table]
        );

        $formattedForeignKeys = [];
        foreach ($foreignKeys as $fk) {
            $fkInfo = [
                'constraint_name' => $fk->CONSTRAINT_NAME,
                'column_name' => $fk->COLUMN_NAME,
                'referenced_table' => $fk->REFERENCED_TABLE_NAME,
                'referenced_column' => $fk->REFERENCED_COLUMN_NAME,
                'referenced_table_columns' => []
            ];

            if (in_array($fk->COLUMN_NAME, $columns)) {
                $fkInfo['referenced_table_columns'] = $conn->getSchemaBuilder()->getColumnListing($fk->REFERENCED_TABLE_NAME);
            }

            $formattedForeignKeys[$fk->COLUMN_NAME] = $fkInfo;
        }

        return response()->json([
            'columns' => $columns,
            'foreignKeys' => $formattedForeignKeys
        ]);
    }
    // exports the data from an external database table to a CSV file
    public function exportData(Request $request) {
        $database = $request->input('database');
        $table = $request->input('table');
        $columns = $request->input('query.columns', []);
        $foreign_keys = $request->input('query.foreign_keys', []);
        $whereConds = $request->input('query.where', []);
        $limit = $request->input('limit', 1000); // default limit for export
        $offset = $request->input('offset', 0);
        $findReplaceRules = $request->input('find_replace_rules', []);

        $conn = $this->getExternalConnection($database);
        if ($conn instanceof \Illuminate\Http\JsonResponse) {
            return $conn;
        }

        // validation for table and column names to prevent SQL injection
        $validateIdentifier = function($name) {
            return preg_match('/^[a-zA-Z0-9_]+$/', $name);
        };

        // Prepare main table select columns (qualified with main table name)
        $selectParts = [];
        if (empty($columns)) {
            $dbCols = $conn->select(
                "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION",
                [$table]
            );
            $dbCols = array_map(fn($c) => $c->COLUMN_NAME, $dbCols);
            foreach ($dbCols as $col) {
                if (!$validateIdentifier($col)) continue;
                $selectParts[] = "`$table`.`$col` as `$col`";
            }
        } else {
            foreach ($columns as $col) {
                if (!$validateIdentifier($col)) continue;
                $selectParts[] = "`$table`.`$col` as `$col`";
            }
        }

        $query = $conn->table($table);

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

                    // determine referenced column name
                    $refInfo = $conn->select(
                        "SELECT REFERENCED_COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? AND REFERENCED_TABLE_NAME = ? LIMIT 1",
                        [$table, $parentCol, $refTable]
                    );
                    $refCol = $refInfo[0]->REFERENCED_COLUMN_NAME ?? null;
                    if (!$refCol || !$validateIdentifier($refCol)) {
                        $refInfo = $conn->select(
                            "SELECT REFERENCED_COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1",
                            [$table, $parentCol]
                        );
                        $refCol = $refInfo[0]->REFERENCED_COLUMN_NAME ?? null;
                    }
                    if (!$refCol || !$validateIdentifier($refCol)) continue;

                    // create unique alias
                    $alias = preg_replace('/[^A-Za-z0-9_]/', '_', $refTable) . '_' . $aliasCounter++;
                    $aliasMap[$refTable][] = $alias;
                    $aliasByParent[$parentCol][$refTable] = $alias;

                    // add join
                    $query->leftJoin("{$refTable} as {$alias}", "{$table}.{$parentCol}", '=', "{$alias}.{$refCol}");

                    // add referenced columns to selects
                    foreach ($fkCols as $fkCol) {
                        if (!$validateIdentifier($fkCol)) continue;
                        $aliasCol = $alias . '__' . $fkCol;
                        $selectParts[] = "`{$alias}`.`{$fkCol}` as `{$aliasCol}`";
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

        // Validate and set limit and offset
        $limit = intval($limit) > 0 ? intval($limit) : 1000;
        $offset = intval($offset) > 0 ? intval($offset) : 0;

        // Add limit and offset
        $results = $query->limit($limit)->offset($offset)->get();

        // Apply optional find/replace rules safely (avoid foreach by-reference)
        if (!empty($findReplaceRules) && $results->count() > 0) {
            $results = $results->map(function($row) use ($findReplaceRules) {
                $arr = (array) $row;

                foreach ($findReplaceRules as $rule) {
                    // normalize rule (allow stdClass or array)
                    if (is_object($rule)) $rule = (array) $rule;
                    if (!is_array($rule) || !isset($rule['find'])) continue;

                    $find = $rule['find'];
                    $replace = $rule['replace'] ?? '';

                    // If rule targets a specific column
                    if (isset($rule['column']) && is_string($rule['column'])) {
                        $col = $rule['column'];
                        if (array_key_exists($col, $arr) && $arr[$col] !== null) {
                            $arr[$col] = str_replace($find, $replace, (string) $arr[$col]);
                        }
                        continue;
                    }

                    // No column specified -> apply to all columns
                    foreach ($arr as $colName => $val) {
                        if ($val === null) continue;
                        $arr[$colName] = str_replace($find, $replace, (string) $val);
                    }
                }

                return (object) $arr;
            });
        }

        // Prepare CSV
        $csv = '';
        if (count($results) > 0) {
            $header = array_keys((array)$results[0]);
            $csv .= implode(';', $header) . "\n"; // <-- use semicolon
            foreach ($results as $row) {
                $csv .= implode(';', array_map(function($v) {
                    $v = str_replace('"', '""', $v);
                    if (strpos($v, ';') !== false || strpos($v, '"') !== false || strpos($v, "\n") !== false) {
                        return "\"$v\"";
                    }
                    return $v;
                }, (array)$row)) . "\n";
            }
        } else {
            // Optionally, output header only if you know the columns
            // $csv .= implode(';', $header) . "\n";
        }

        $filename = $table . '_export_' . date('Ymd_His') . '.csv';
        return response($csv)
            ->header('Content-Type', 'text/csv')
            ->header('Content-Disposition', "attachment; filename=\"$filename\"");
    }
}