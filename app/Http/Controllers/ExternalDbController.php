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

    public function getTableData($connection, $table, Request $request)
    {
        $columns = $request->query('columns'); // comma-separated string

        if ($columns) {
            $columns = explode(',', $columns);
            $data = DB::connection($connection)
                ->table($table)
                ->select($columns)
                ->limit(100)
                ->get();
        } else {
            $data = DB::connection($connection)
                ->table($table)
                ->limit(100)
                ->get();
        }

        return response()->json($data);
    }


    public function getTableColumns($table)
    {
        $columns = DB::connection('external')->getSchemaBuilder()->getColumnListing($table);

        return response()->json($columns);
    }
}
