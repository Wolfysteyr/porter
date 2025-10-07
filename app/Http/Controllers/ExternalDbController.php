<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ExternalDbController extends Controller
{

    
    public function listTables()
    {
        $tables = DB::connection('external')->select('SHOW TABLES');
        return response()->json($tables);
    }

    public function getTableData(Request $request, $table)
    {
        $columns    = $request->input('columns', []);
        $limit      = $request->input('limit', 10);
        // incoming foreign keys selection payload (renamed from 'selection')
        $foreign_keys  = $request->input('foreign_keys', []);
        $whereConds = $request->input('where', []);


        // validation for table and column names to prevent SQL injection
        $validateIdentifier = function($name) {
            return preg_match('/^[a-zA-Z0-9_]+$/', $name);
        };

    // Prepare main table select columns (qualified with main table name)
    $selectParts = [];
        if (empty($columns)) {
            // fetch all columns for the main table and qualify them
            $dbCols = DB::connection('external')->select(
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
        $conn = DB::connection('external');

        // build query using query builder so we can append where clauses safely
        $query = $conn->table($table);

        // Track aliases per referenced table and per parent column
        $aliasCounter = 0;
        $aliasMap = []; // refTable => [alias1, alias2, ...]
        $aliasByParent = []; // parentCol => [refTable => alias]

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

        // finalize select list and execute
        $query->selectRaw(implode(', ', $selectParts));

        // apply WHERE payload (array of {column, operator, value} or [column, operator, value])
        if (!empty($whereConds) && is_array($whereConds)) {
            foreach ($whereConds as $wc) {
                // normalize
                if (is_array($wc) && array_values($wc) === $wc) {
                    // numeric-array: [col, op, val]
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

                // resolve column to qualified identifier
                $qualified = null;
                if (str_contains($col, '.')) {
                    [$tbl, $cname] = explode('.', $col, 2);
                    if ($tbl === $table) {
                        $qualified = "{$table}.{$cname}";
                    } elseif (isset($aliasMap[$tbl]) && count($aliasMap[$tbl]) === 1) {
                        $qualified = "{$aliasMap[$tbl][0]}.{$cname}";
                    } elseif (isset($aliasMap[$tbl]) && count($aliasMap[$tbl]) > 1) {
                        // ambiguous: multiple aliases exist for this referenced table. pick the first.
                        $qualified = "{$aliasMap[$tbl][0]}.{$cname}";
                    } else {
                        // no join for this referenced table; treat as main table column fallback
                        $qualified = "{$table}.{$cname}";
                    }
                } else {
                    // main table column
                    $qualified = "{$table}.{$col}";
                }

                // apply operator
                if ($op === 'IS NULL') {
                    $query->whereNull($qualified);
                } elseif ($op === 'IS NOT NULL') {
                    $query->whereNotNull($qualified);
                } elseif (in_array($op, ['IN', 'NOT IN'])) {
                    if (!is_array($val)) {
                        // try to parse comma-separated
                        $val = is_string($val) ? array_map('trim', explode(',', $val)) : [$val];
                    }
                    if ($op === 'IN') $query->whereIn($qualified, $val);
                    else $query->whereNotIn($qualified, $val);
                } else {
                    $query->where($qualified, $op, $val);
                }
            }
        }

        // limit and execute
        $limit = intval($limit) > 0 ? intval($limit) : 10;
        $results = $query->limit($limit)->get();

        return response()->json(['rows' => $results]);

        // $rows = DB::connection('external')
        //     ->table($table)
        //     ->select($columns)
        //     ->limit($limit)
        //     ->get();

        // if ($foreignKeys != "") {
        //     return response()->json([
        //     'rows' => $rows,
        //     'foreignKeys' => $foreignKeys
        // ]);} else {
        //     return response()->json([
        //         'rows' => $rows
        //     ]);
        // }
        
    }

public function getTableColumns($table)
{
    $columns = DB::connection('external')->getSchemaBuilder()->getColumnListing($table);

    // Get all the constraints (foreign keys) from the table
    $foreignKeys = DB::connection('external')
        ->select("
            SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = ? 
              AND REFERENCED_TABLE_NAME IS NOT NULL
        ", [$table]);

    $formattedForeignKeys = [];
    foreach ($foreignKeys as $fk) {
        $fkInfo = [
            'constraint_name' => $fk->CONSTRAINT_NAME,
            'column_name' => $fk->COLUMN_NAME,
            'referenced_table' => $fk->REFERENCED_TABLE_NAME,
            'referenced_column' => $fk->REFERENCED_COLUMN_NAME,
            'referenced_table_columns' => []
        ];

        // If the foreign key column exists in the fetched columns, get columns from referenced table
        if (in_array($fk->COLUMN_NAME, $columns)) {
            $fkInfo['referenced_table_columns'] = DB::connection('external')->getSchemaBuilder()->getColumnListing($fk->REFERENCED_TABLE_NAME);
        }

        $formattedForeignKeys[$fk->COLUMN_NAME] = $fkInfo;
    }

    return response()->json([
        'columns' => $columns,
        'foreignKeys' => $formattedForeignKeys
    ]);
}
}