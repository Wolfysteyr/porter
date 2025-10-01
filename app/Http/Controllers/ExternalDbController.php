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
        $limit      = $request->input('limit');
        $selection  = $request->input('selection', []);


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

        $sql = "SELECT " . implode(", ", $selectParts) . " FROM `$table`";

        // Joins: alias every referenced table occurrence to avoid duplicate table/alias errors
        $aliasCounter = 0;
        if (!empty($selection) && is_array($selection)) {
            foreach ($selection as $sel) {
                $parentCol = $sel['parentCol'] ?? null;
                if (!$parentCol || !$validateIdentifier($parentCol)) continue;

                $fkTables = $sel['fkTables'] ?? [];
                if (!is_array($fkTables)) continue;

                foreach ($fkTables as $fkTable) {
                    $refTable = $fkTable['tableName'] ?? null;
                    if (!$refTable || !$validateIdentifier($refTable)) continue;

                    $fkCols = $fkTable['fkColumns'] ?? [];
                    if (!is_array($fkCols) || empty($fkCols)) continue;

                    // determine referenced column name (the column in referenced table that parentCol maps to)
                    $refInfo = DB::connection('external')->select(
                        "SELECT REFERENCED_COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? AND REFERENCED_TABLE_NAME = ? LIMIT 1",
                        [$table, $parentCol, $refTable]
                    );
                    $refCol = $refInfo[0]->REFERENCED_COLUMN_NAME ?? null;
                    if (!$refCol || !$validateIdentifier($refCol)) {
                        // fallback: try without REFERENCED_TABLE_NAME filter
                        $refInfo = DB::connection('external')->select(
                            "SELECT REFERENCED_COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1",
                            [$table, $parentCol]
                        );
                        $refCol = $refInfo[0]->REFERENCED_COLUMN_NAME ?? null;
                    }
                    if (!$refCol || !$validateIdentifier($refCol)) continue;

                    // create unique alias for this join occurrence
                    $alias = preg_replace('/[^A-Za-z0-9_]/', '_', $refTable) . '_' . $aliasCounter++;

                    // add LEFT JOIN with alias
                    $sql .= " LEFT JOIN `$refTable` AS `$alias` ON `$table`.`$parentCol` = `$alias`.`$refCol`";

                    // add requested referenced columns to select (aliased to avoid collisions)
                    foreach ($fkCols as $fkCol) {
                        if (!$validateIdentifier($fkCol)) continue;
                        $aliasCol = $alias . '__' . $fkCol;
                        $sql .= ""; // no-op to keep patches neat
                        $selectParts[] = "`$alias`.`$fkCol` as `$aliasCol`";
                    }
                }
            }
        }

        // Rebuild full select with any referenced columns appended
        $sql = "SELECT " . implode(", ", $selectParts) . " FROM `$table`";

        // Re-append the joins by extracting from the earlier built SQL (we added join clauses to $sql earlier, but since we overwrote it we need to reconstruct joins)
        // For simplicity create joins again in the same way using the selection loop (repeat logic but only to append joins)
        $aliasCounter = 0;
        if (!empty($selection) && is_array($selection)) {
            foreach ($selection as $sel) {
                $parentCol = $sel['parentCol'] ?? null;
                if (!$parentCol || !$validateIdentifier($parentCol)) continue;
                $fkTables = $sel['fkTables'] ?? [];
                if (!is_array($fkTables)) continue;
                foreach ($fkTables as $fkTable) {
                    $refTable = $fkTable['tableName'] ?? null;
                    if (!$refTable || !$validateIdentifier($refTable)) continue;
                    $fkCols = $fkTable['fkColumns'] ?? [];
                    if (!is_array($fkCols) || empty($fkCols)) continue;
                    $refInfo = DB::connection('external')->select(
                        "SELECT REFERENCED_COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? AND REFERENCED_TABLE_NAME = ? LIMIT 1",
                        [$table, $parentCol, $refTable]
                    );
                    $refCol = $refInfo[0]->REFERENCED_COLUMN_NAME ?? null;
                    if (!$refCol || !$validateIdentifier($refCol)) {
                        $refInfo = DB::connection('external')->select(
                            "SELECT REFERENCED_COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1",
                            [$table, $parentCol]
                        );
                        $refCol = $refInfo[0]->REFERENCED_COLUMN_NAME ?? null;
                    }
                    if (!$refCol || !$validateIdentifier($refCol)) continue;
                    $alias = preg_replace('/[^A-Za-z0-9_]/', '_', $refTable) . '_' . $aliasCounter++;
                    $sql .= " LEFT JOIN `$refTable` AS `$alias` ON `$table`.`$parentCol` = `$alias`.`$refCol`";
                }
            }
        }

        // Limit results
        if ($limit < 1) $limit = 10;
        $sql .= " LIMIT " . intval($limit);

        $results = DB::connection('external')->select($sql);

        return response()->json([
            'rows' => $results
        ]);

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