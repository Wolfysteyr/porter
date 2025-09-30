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

    $limit = (int) $request->query('limit', 10);
    $foreignKeys = "";

    // Columns requested
    $columns = $request->query('columns');
    if ($columns) {
        $columns = explode(',', $columns);

        

       
        
        // Get natural order from schema
        $dbColumns = DB::connection('external')
            ->select("
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                  AND TABLE_NAME = ?
                ORDER BY ORDINAL_POSITION
            ", [$table]);

        $dbColumns = array_map(fn($col) => $col->COLUMN_NAME, $dbColumns);

        // Reorder user-selected columns to match DB order
        $columns = array_values(array_intersect($dbColumns, $columns));
    } else {
        $columns = ['*'];
    }

    $rows = DB::connection('external')
        ->table($table)
        ->select($columns)
        ->limit($limit)
        ->get();

    if ($foreignKeys != "") {
        return response()->json([
        'rows' => $rows,
        'foreignKeys' => $foreignKeys
    ]);} else {
        return response()->json([
            'rows' => $rows
        ]);
    }
    
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