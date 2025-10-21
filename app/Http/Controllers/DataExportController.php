<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Http\Controllers\ExternalDbController;
use Illuminate\Support\Facades\Log;

class DataExportController extends ExternalDbController
{

    public function checkExportType(Request $request) {
        $exportType = (int) $request->input('exportType', 0);
        if ($exportType === 0) {
            Log::info('ExportDataCSV called');
            return $this->exportDataCSV($request);
        } else if ($exportType === 1) {
            Log::info('ExportDataDB called');
            return $this->exportDataDB($request);
        }
    }
    // exports the data from an external database table to a CSV file
    public function exportDataCSV(Request $request) {
        $template_name = $request->input('template_name');
        $database = $request->input('database');
        $table = $request->input('table');
        $columns = $request->input('query.columns', []);
        $foreign_keys = $request->input('query.foreign_keys', []);
        $whereConds = $request->input('query.where', []);
        $limit = $request->input('limit', 1000); // default limit for export
        $offset = $request->input('offset', 0);
        $findReplaceRules = $request->input('find_replace_rules', []);
        $colNameChanges = $request->input('column_name_changes', []);
        // Build mapping: original => new
        $colNameMap = [];
        if (!empty($colNameChanges) && is_array($colNameChanges)) {
            foreach ($colNameChanges as $change) {
                if (isset($change['original'], $change['new']) && $change['original'] && $change['new']) {
                    $colNameMap[$change['original']] = $change['new'];
                }
            }
        }

        // use the inherited helper to get a dynamic connection
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
        // detect driver and optional schema
        $driver = strtolower($conn->getConfig('driver') ?? 'mysql');
        $schema = $request->input('schema');
        if (!$schema && str_contains($table, '.')) {
            [$schema, $table] = explode('.', $table, 2);
        }

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
                $quoteLeft = '"';
                $quoteRight = '"';
                break;
            default:
                $quoteLeft = '`';
                $quoteRight = '`';
                break;
        }

        // auto-detect owner/schema when missing
        if (empty($schema)) {
            $detectedOwner = $this->detectTableOwner($conn, $driver, $table);
            if ($detectedOwner) $schema = $detectedOwner;
        }

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

        // prepare table name for the query builder; qualify with schema if provided
        $tableForQuery = $table;
        if (!empty($schema)) {
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

        // Validate and set limit and offset
        $limit = intval($limit) > 0 ? intval($limit) : 1000;
        $offset = intval($offset) > 0 ? intval($offset) : 0;

        // Add limit and offset
        $results = $query->limit($limit)->offset($offset)->get();

        // Apply optional find/replace rules: only replace values that exactly match 'find', not substrings
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
                            if ((string)$arr[$col] === (string)$find) {
                                $arr[$col] = $replace;
                            }
                        }
                        continue;
                    }

                    // No column specified -> apply to all columns
                    foreach ($arr as $colName => $val) {
                        if ($val === null) continue;
                        if ((string)$val === (string)$find) {
                            $arr[$colName] = $replace;
                        }
                    }
                }

                return (object) $arr;
            });
        }

        // Prepare CSV
        $csv = '';
        if (count($results) > 0) {
            $header = array_keys((array)$results[0]);
            // Apply column name changes to header
            $headerOut = array_map(function($col) use ($colNameMap) {
                return $colNameMap[$col] ?? $col;
            }, $header);
            $csv .= implode(';', $headerOut) . "\n";
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
            // $csv .= implode(';', $headerOut) . "\n";
        }

        $filename = $template_name . '_export_' . date('Ymd_His') . '.csv';
        return response($csv)
            ->header('Content-Type', 'text/csv')
            ->header('Content-Disposition', "attachment; filename=\"$filename\"");
    }

    public function exportDataDB(Request $request) {
        $template_name = $request->input('template_name');
        $database = $request->input('database');
        $table = $request->input('table');
        $columns = $request->input('query.columns', []);
        $foreign_keys = $request->input('query.foreign_keys', []);
        $whereConds = $request->input('query.where', []);
        $limit = $request->input('limit', 1000); // default limit for export
        $offset = $request->input('offset', 0);
        $findReplaceRules = $request->input('find_replace_rules', []);
        $colNameChanges = $request->input('column_name_changes', []);
        $target_database = $request->input('target_database');
        $target_table = $request->input('target_table');

        // Build mapping: original => new
        $colNameMap = [];
        if (!empty($colNameChanges) && is_array($colNameChanges)) {
            foreach ($colNameChanges as $change) {
                if (isset($change['original'], $change['new']) && $change['original'] && $change['new']) {
                    $colNameMap[$change['original']] = $change['new'];
                }
            }
        }

        // use the inherited helper to get a dynamic connection
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
        // detect driver and optional schema
        $driver = strtolower($conn->getConfig('driver') ?? 'mysql');
        $schema = $request->input('schema');
        if (!$schema && str_contains($table, '.')) {
            [$schema, $table] = explode('.', $table, 2);
        }

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
                $quoteLeft = '"';
                $quoteRight = '"';
                break;
            default:
                $quoteLeft = '`';
                $quoteRight = '`';
                break;
        }

        // auto-detect owner/schema when missing
        if (empty($schema)) {
            $detectedOwner = $this->detectTableOwner($conn, $driver, $table);
            if ($detectedOwner) $schema = $detectedOwner;
        }

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

        // prepare table name for the query builder; qualify with schema if provided
        $tableForQuery = $table;
        if (!empty($schema)) {
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

        // Validate and set limit and offset
        $limit = intval($limit) > 0 ? intval($limit) : 1000;
        $offset = intval($offset) > 0 ? intval($offset) : 0;

        // Add limit and offset
        $results = $query->limit($limit)->offset($offset)->get();

        // Apply optional find/replace rules: only replace values that exactly match 'find', not substrings
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
                            if ((string)$arr[$col] === (string)$find) {
                                $arr[$col] = $replace;
                            }
                        }
                        continue;
                    }

                    // No column specified -> apply to all columns
                    foreach ($arr as $colName => $val) {
                        if ($val === null) continue;
                        if ((string)$val === (string)$find) {
                            $arr[$colName] = $replace;
                        }
                    }
                }

                return (object) $arr;
            });
        }

        // Map column names
        $mappedResults = $results->map(function($row) use ($colNameMap) {
            $arr = (array) $row;
            $newArr = [];
            foreach ($arr as $col => $val) {
                $newCol = $colNameMap[$col] ?? $col;
                $newArr[$newCol] = $val;
            }
            return $newArr;
        });

        // Get target connection
        $targetConn = $this->getExternalConnection($target_database);
        if ($targetConn instanceof \Illuminate\Http\JsonResponse) {
            return $targetConn;
        }

        // Handle target schema
        $targetSchema = null;
        if (str_contains($target_table, '.')) {
            [$targetSchema, $target_table] = explode('.', $target_table, 2);
        }

        $targetTableForQuery = $target_table;
        if (!empty($targetSchema)) {
            $targetTableForQuery = $targetSchema . '.' . $target_table;
        }

        // Detect target driver
        $targetDriver = strtolower($targetConn->getConfig('driver') ?? 'mysql');

        // Fetch target table columns
        $targetCols = $this->fetchColumnNames($targetConn, $targetDriver, $target_table, $targetSchema);

        // Insert data into target table
        if ($mappedResults->isNotEmpty()) {
            // Filter data to only include columns that exist in the target table
            $filteredResults = $mappedResults->map(function($row) use ($targetCols) {
                return array_intersect_key($row, array_flip($targetCols));
            });
            $targetConn->table($targetTableForQuery)->insert($filteredResults->toArray());
        }

        return response()->json(['message' => 'Data exported to database successfully']);
    }
}
