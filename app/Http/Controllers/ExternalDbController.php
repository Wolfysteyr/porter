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

        if ($request->query('limit') <= 0){
            $limit = 10;
        } else {
            $limit = $request->query('limit');
        }
        $rows = DB::connection('external')->table($table)->limit($limit)->get();
        return response()->json($rows);
    }
}
