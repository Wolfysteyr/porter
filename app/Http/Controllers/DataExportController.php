<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Http\Controllers\ExternalDbController;
use Illuminate\Support\Facades\Log;
use Illuminate\Database\QueryException;
use App\Models\TemplateExportHistory;


// DataExportController handles exporting data from external databases to CSV or another database.
class DataExportController extends ExternalDbController
{

    // Check export type and route to appropriate method
    // made for clarity from frontend exportType selection
    public function checkExportType(Request $request) {
        // normalize export payload (accept camelCase or snake_case)
        $export = $request->input('export', []);
        // determine export type
        $exportType = (int) ($export['exportType'] ?? $export['export_type'] ?? $request->input('export.exportType', 0));
         if ($exportType === 0) {
             Log::info('ExportDataCSV called'); // log for debugging
             return $this->exportDataCSV($request);
         } else if ($exportType === 1) {
             Log::info('ExportDataDB called'); // log for debugging
             return $this->exportDataDB($request);
         }
    }

    // exports the data from an external database table to a CSV file
    public function exportDataCSV(Request $request) {
        $startTime = microtime(true);  // Track start time for duration (optional, if you add duration_ms later)

            // build CSV from query results and return as downloadable response
            $template_id = $request->input('id');
            $template_name = $request->input('template_name');
            $database = $request->input('database');
            $table = $request->input('table');

            // Validate required source DB fields
            if (empty($database) || empty($table)) {
                $msg = 'Export failed: missing source database or table';
                Log::error($msg);
                TemplateExportHistory::saveToExportHistory($template_id, 'csv', null, $database, $table, $msg);
                return response()->json(['error' => $msg], 400);
            }
            $columns = $request->input('query.columns', []);
            $foreign_keys = $request->input('query.foreign_keys', []);
            $whereConds = $request->input('query.where', []);

            // normalize export block (accept multiple frontend shapes)
            $export = $request->input('export', []);
            // limit/offset: prefer export.limit & export.offset, fall back to limitOffsetRules array
            $limit = $export['limit'] ?? ($export['limitOffsetRules'][0]['limit'] ?? $request->input('export.limitOffsetRules.limit', 1000));
            $offset = $export['offset'] ?? ($export['limitOffsetRules'][0]['offset'] ?? $request->input('export.limitOffsetRules.offset', 0));
            // find/replace rules (accept snake_case or camelCase keys)
            $findReplaceRules = $export['find_replace_rules'] ?? $export['findReplaceRules'] ?? $request->input('export.find_replace_rules', []);
            // column name changes
            $colNameChanges = $export['column_name_changes'] ?? $export['columnNameChanges'] ?? $request->input('export.column_name_changes', []);
            $target_database = $export['target_database'] ?? $export['targetDatabase'] ?? $request->input('export.target_database', null);
            $target_table = $export['target_table'] ?? $export['targetTable'] ?? $request->input('export.target_table', null);

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

            // build query with joins for foreign keys
            $query = $conn->table($tableForQuery);

            // Track aliases per referenced table and per parent column
            $aliasCounter = 0;
            $aliasMap = [];
            $aliasByParent = [];

            // process foreign keys
            // each foreign key selection may reference multiple tables
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

            // finalize select
            $query->selectRaw(implode(', ', $selectParts));

            // process where conditions
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
            $limit = intval($limit) > 0 ? intval($limit) : 1000; // should make this just output all if not set?
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

            // return CSV as downloadable response
            $filename = $template_name . '_export_' . date('Ymd_His') . '.csv';

            // At the end, before returning the response:
            TemplateExportHistory::saveToExportHistory($template_id, 'csv', $filename, null, null, 'success');

            return response($csv)
                ->header('Content-Type', 'text/csv')
                ->header('Content-Disposition', "attachment; filename=\"$filename\"");
        } 

    // Remove rows from chunk that already exist in target table based on primary key(s)
    // need to change it to check all fields, and only skip if all match
    // later implement edit/update option if one or more fields differ
    private function dedupeRowsByPk($chunk, $targetConn, $targetTableForQuery, $targetPkCols, $validateIdentifier) {
        if (empty($targetPkCols)) {
            return $chunk; // No PK info: cannot dedupe, return all
        }

        $toInsert = [];
        if (count($targetPkCols) === 1) {
            $pk = $targetPkCols[0];
            $vals = array_filter(array_column($chunk, $pk), function($v) { return $v !== null; });
            if (!empty($vals)) {
                $existing = $targetConn->table($targetTableForQuery)->whereIn($pk, array_values($vals))->pluck($pk)->map(function($v){ return (string)$v; })->toArray();
                foreach ($chunk as $r) {
                    $valKey = isset($r[$pk]) ? (string)$r[$pk] : null;
                    if ($valKey === null || in_array($valKey, $existing, true)) {
                        continue;
                    }
                    $toInsert[] = $r;
                }
            } else {
                $toInsert = $chunk;
            }
        } else {
            // Composite PK
            $clauses = [];
            $bindings = [];
            foreach ($chunk as $r) {
                $parts = [];
                $hasAll = true;
                foreach ($targetPkCols as $pk) {
                    if (!array_key_exists($pk, $r)) { $hasAll = false; break; }
                    $parts[] = "{$pk} = ?";
                    $bindings[] = $r[$pk];
                }
                if ($hasAll) $clauses[] = '(' . implode(' AND ', $parts) . ')';
            }
            $existingKeys = [];
            if (!empty($clauses)) {
                $rawWhere = implode(' OR ', $clauses);
                try {
                    $existingRows = $targetConn->table($targetTableForQuery)->select($targetPkCols)->whereRaw($rawWhere, $bindings)->get();
                    foreach ($existingRows as $er) {
                        $keyParts = [];
                        $erArr = (array)$er;
                        foreach ($targetPkCols as $pk) $keyParts[] = (string)($erArr[$pk] ?? '');
                        $existingKeys[] = implode('||', $keyParts);
                    }
                } catch (\Exception $e) {
                    Log::warning('Composite PK existence check failed; skipping dedupe for this chunk: ' . $e->getMessage());
                    $existingKeys = [];
                }
            }
            foreach ($chunk as $r) {
                $keyParts = [];
                $hasAll = true;
                foreach ($targetPkCols as $pk) {
                    if (!array_key_exists($pk, $r)) { $hasAll = false; break; }
                    $keyParts[] = (string)$r[$pk];
                }
                if ($hasAll) {
                    $k = implode('||', $keyParts);
                    if (in_array($k, $existingKeys, true)) {
                        continue;
                    }
                }
                $toInsert[] = $r;
            }
        }
        return $toInsert;
    }


    // exports the data from an external database table to another database table
    public function exportDataDB(Request $request) {
        Log::info('Starting exportDataDB process');
        set_time_limit(300); // allow up to 5 minutes

        // get parameters
        $template_id = $request->input('id');
        $database = $request->input('database');
        $table = $request->input('table');

        // Validate required source DB fields
        if (empty($database) || empty($table)) {
            $msg = 'Export failed: missing source database or table';
            Log::error($msg);
            TemplateExportHistory::saveToExportHistory($template_id, 'database', null, $database, $table, $msg);
            return response()->json(['error' => $msg], 400);
        }
        $columns = $request->input('query.columns', []);
        $foreign_keys = $request->input('query.foreign_keys', []);
        $whereConds = $request->input('query.where', []);

        // normalize export block (accept multiple frontend shapes)
        $export = $request->input('export', []);
        // limit/offset: prefer export.limit & export.offset, fall back to limitOffsetRules array
        $limit = $export['limit'] ?? ($export['limitOffsetRules'][0]['limit'] ?? $request->input('export.limitOffsetRules.limit', 1000));
        $offset = $export['offset'] ?? ($export['limitOffsetRules'][0]['offset'] ?? $request->input('export.limitOffsetRules.offset', 0));
        // find/replace rules (accept snake_case or camelCase keys)
        $findReplaceRules = $export['find_replace_rules'] ?? $export['findReplaceRules'] ?? $request->input('export.find_replace_rules', []);
        // column name changes
        $colNameChanges = $export['column_name_changes'] ?? $export['columnNameChanges'] ?? $request->input('export.column_name_changes', []);
        $target_database = $export['target_database'] ?? $export['targetDatabase'] ?? $request->input('export.target_database', null);
        $target_table = $export['target_table'] ?? $export['targetTable'] ?? $request->input('export.target_table', null);

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

        // build query with joins for foreign keys
        $query = $conn->table($tableForQuery);

        // Track aliases per referenced table and per parent column
        $aliasCounter = 0;
        $aliasMap = [];
        $aliasByParent = [];

        // process foreign keys
        // each foreign key selection may reference multiple tables
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

        // finalize select
        $query->selectRaw(implode(', ', $selectParts));

        // process where conditions
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
        $limit = intval($limit) > 0 ? intval($limit) : 1000; // should make this just output all if not set?
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
        
        // prepare target table name for the query builder; qualify with schema if provided
        $targetTableForQuery = $target_table;
        if (!empty($targetSchema)) {
            $targetTableForQuery = $targetSchema . '.' . $target_table;
        }

        // Detect target driver
        $targetDriver = strtolower($targetConn->getConfig('driver') ?? 'mysql');

        // Fetch target table columns
        $targetCols = $this->fetchColumnNames($targetConn, $targetDriver, $target_table, $targetSchema);

        // Validate that every column present in the export exists on the target table.
        // If even one column is missing, fail, log and record history.
        if (!empty($mappedResults)) {
            $usedCols = [];
            foreach ($mappedResults as $r) {
                $row = is_object($r) ? (array)$r : (array)$r;
                $usedCols = array_unique(array_merge($usedCols, array_keys($row)));
            }
            $missing = array_values(array_diff($usedCols, $targetCols));
            if (!empty($missing)) {
                $msg = 'Export failed: target table missing columns: ' . implode(', ', $missing);
                Log::error($msg);
                TemplateExportHistory::saveToExportHistory($template_id, 'database', null, $target_database, $target_table, $msg);
                return response()->json(['error' => $msg, 'missing_columns' => $missing], 400);
            }
        }

        // Insert data into target table
        if ($mappedResults->isNotEmpty()) {
            // Filter data to only include columns that exist in the target table
            $filteredResultsAll = $mappedResults->map(function($row) use ($targetCols) {
                return array_intersect_key($row, array_flip($targetCols));
            })->toArray();

            // Optional: allow caller to request skipping FK checks (MySQL only)
            $skipFk = $export['skip_foreign_checks'] ?? $export['skipForeignChecks'] ?? false;

            // Default chunk size; can be overridden via export.insert_chunk_size
            $desiredChunk = intval($export['insert_chunk_size'] ?? 1000);
            $desiredChunk = $desiredChunk > 0 ? $desiredChunk : 1000;

            // Protect against too many bound params: compute safe rows per chunk
            $maxPlaceholders = 60000; // conservative (MySQL/PDO limit ~65535)
            $colsCount = count($filteredResultsAll[0] ?? []);
            if ($colsCount > 0) {
                $maxRowsPerChunk = max(1, (int) floor($maxPlaceholders / $colsCount));
                $chunkSize = min($desiredChunk, $maxRowsPerChunk);
            } else {
                $chunkSize = $desiredChunk;
            }

            // Insert in chunks with deduplication
            try {
                if ($skipFk && $targetDriver === 'mysql') {
                    $targetConn->statement('SET FOREIGN_KEY_CHECKS=0');
                }
                // Track insert/skipped counts
                $totalInserted = 0;
                $totalSkipped = 0;
                // Process chunks
                foreach (array_chunk($filteredResultsAll, $chunkSize) as $chunkIndex => $chunk) {
                    if (empty($chunk)) continue;

                    // Use the new helper for deduplication
                    $toInsert = $this->dedupeRowsByPk($chunk, $targetConn, $targetTableForQuery, $targetPkCols, $validateIdentifier);

                    // If all rows were duplicates, skip this chunk
                    if (empty($toInsert)) {
                        Log::debug("Chunk " . ($chunkIndex+1) . " skipped entirely due to duplicates.");
                        $totalSkipped += count($chunk);
                        continue;
                    }
                    // Try bulk insert
                    try {
                        $targetConn->table($targetTableForQuery)->insert($toInsert);
                        $totalInserted += count($toInsert);
                        Log::debug("Inserted chunk " . ($chunkIndex+1) . " (rows: " . count($toInsert) . ")");
                    } catch (QueryException $qe) {
                        // If it's a constraint/foreign-key related error, fallback to per-row inserts and skip failing rows
                        $msg = $qe->getMessage();
                        $isConstraint = stripos($msg, 'foreign key') !== false
                            || stripos($msg, 'integrity constraint') !== false
                            || stripos($msg, 'Cannot add or update a child row') !== false
                            || $qe->getCode() == 23000;
                        // Fall back to per-row inserts
                        if ($isConstraint) {
                            Log::warning("Chunk insert failed due to constraint; falling back to per-row insert for chunk " . ($chunkIndex+1));
                            foreach ($toInsert as $rowIndex => $singleRow) {
                                try {
                                    $targetConn->table($targetTableForQuery)->insert($singleRow);
                                    $totalInserted++;
                                } catch (QueryException $qeRow) {
                                    $totalSkipped++;
                                    Log::warning("Skipping row due to insert error (constraint). chunk={$chunkIndex}, rowInChunk={$rowIndex}, err=" . $qeRow->getMessage());
                                }
                            }
                        } else {
                            throw $qe;
                        }
                    }
                }
                // Final logging
                if ($skipFk && $targetDriver === 'mysql') {
                    $targetConn->statement('SET FOREIGN_KEY_CHECKS=1');
                }
                Log::info("Insert summary: inserted={$totalInserted}, skipped={$totalSkipped}");
             } catch (QueryException $e) {
                 // Log full DB error for diagnostics
                 Log::error('Target insert failed: ' . $e->getMessage());
 
                 // Try to extract constraint / referenced table info from MySQL message
                 $msg = $e->getMessage();
                 $constraint = null;
                 $refTable = null;
                 $refCol = null;
                 if (preg_match("/CONSTRAINT `([^`]*)` .*REFERENCES `?([a-zA-Z0-9_]+)`? \\(`?([a-zA-Z0-9_]+)`?\\)/", $msg, $m)) {
                     $constraint = $m[1] ?? null;
                     $refTable = $m[2] ?? null;
                     $refCol = $m[3] ?? null;
                 }
 
                 $userMsg = 'Integrity constraint violation during insert.';
                 if ($constraint) $userMsg .= " Constraint: {$constraint}.";
                 if ($refTable && $refCol) $userMsg .= " Missing referenced row in {$refTable}.{$refCol}.";
                 $userMsg .= ' Ensure referenced parent rows exist in the target database, insert parent tables first, or set export.skip_foreign_checks=true to bypass checks (MySQL only).';
 
                 return response()->json([
                     'error' => $userMsg,
                     'sql_error' => $msg
                 ], 400);
             }
         }
        Log::info('Data exported to database successfully'); // should make this be written to future history logs
                
        // log export in history
        TemplateExportHistory::saveToExportHistory($template_id, 'database', null, $target_database, $target_table,  'success');
        
        return response()->json(['message' => 'Data exported to database successfully', 'total_inserted' => $totalInserted, 'total_skipped' => $totalSkipped]);
    }

    // fetch primary key column names for a given table
    private function fetchPrimaryKeys($conn, $driver, $table, $schema = null) {
        $driver = strtolower($driver ?? '');
        $tableName = $table;
        $schemaName = $schema;

        // driver-specific queries
        // good lord, why did they all have to be different
        try {
            switch ($driver) {
                case 'mysql':
                case 'mariadb':
                    $dbName = $conn->getConfig('database');
                    $rows = $conn->select(
                        'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE COLUMN_KEY = \'PRI\' AND TABLE_SCHEMA = ? AND TABLE_NAME = ?',
                        [$dbName, $tableName]
                    );
                    return array_map(function($r){ $r = (array)$r; return $r['COLUMN_NAME'] ?? $r['column_name'] ?? null; }, $rows);

                case 'pgsql':
                case 'postgres':
                case 'postgresql':
                    $schemaName = $schemaName ?: 'public';
                    $rows = $conn->select(
                        'SELECT a.attname AS column_name
                         FROM pg_index i
                         JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
                         JOIN pg_class c ON c.oid = i.indrelid
                         JOIN pg_namespace n ON c.relnamespace = n.oid
                         WHERE i.indisprimary = TRUE AND c.relname = ? AND n.nspname = ?',
                        [$tableName, $schemaName]
                    );
                    return array_map(function($r){ $r = (array)$r; return $r['column_name'] ?? null; }, $rows);

                case 'sqlite':
                    $rows = $conn->select("PRAGMA table_info('".$tableName."')");
                    $cols = [];
                    foreach ($rows as $r) {
                        $r = (array)$r;
                        // PRAGMA table_info returns 'pk' and 'name' fields
                        if (!empty($r['pk']) && (int)$r['pk'] > 0) {
                            $cols[] = $r['name'] ?? $r['NAME'] ?? null;
                        }
                    }
                    return array_values(array_filter($cols));

                case 'sqlsrv':
                case 'sqlserver':
                    $schemaName = $schemaName ?: ($conn->getConfig('schema') ?? 'dbo');
                    $rows = $conn->select(
                        "SELECT c.name AS column_name
                         FROM sys.indexes i
                         JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
                         JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
                         JOIN sys.tables t ON i.object_id = t.object_id
                         JOIN sys.schemas s ON t.schema_id = s.schema_id
                         WHERE i.is_primary_key = 1 AND t.name = ? AND s.name = ?",
                        [$tableName, $schemaName]
                    );
                    return array_map(function($r){ $r = (array)$r; return $r['column_name'] ?? null; }, $rows);

                default:
                    // Fallback: try INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                    $dbName = $conn->getConfig('database') ?? $schemaName;
                    $rows = $conn->select(
                        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_NAME = ?".
                        ($dbName ? " AND TABLE_SCHEMA = ?" : ""),
                        $dbName ? [$tableName, $dbName] : [$tableName]
                    );
                    return array_map(function($r){ $r = (array)$r; return $r['COLUMN_NAME'] ?? $r['column_name'] ?? null; }, $rows);
            }
        } catch (\Exception $e) {
            Log::warning('fetchPrimaryKeys failed: ' . $e->getMessage());
            return [];
        }
    }
}

// save me