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
    $limit = max((int) $request->query('limit', 10), 1);

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

    return response()->json($rows);
}



    public function getTableColumns($table){
         $columns = DB::connection('external')->getSchemaBuilder()->getColumnListing($table);
        return response()->json($columns);
    }
}
