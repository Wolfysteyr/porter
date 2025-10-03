<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\QueryTemplate;

class QueryTemplateController extends Controller
{
    public function __construct()
    {
        // apply auth middleware if desired
        // $this->middleware('auth:api');
    }

    public function index()
    {
        return response()->json(QueryTemplate::all());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|unique:query_templates,name',
            'query' => 'required|array',
            'database' => 'required|string',
            'table' => 'required|string',
            'user_id' => 'required|integer|exists:users,id',
        ]);

        $tpl = new QueryTemplate();
        $tpl->name = $data['name'];
        $tpl->query = $data['query'];
        $tpl->database = $data['database'];
        $tpl->table = $data['table'];
        $tpl->user_id = $data['user_id'];
        $tpl->save();
        return response()->json($tpl, 201);
    }

    public function show($id)
    {
        return response()->json(QueryTemplate::findOrFail($id));
    }

    public function update(Request $request, $id)
    {
        $tpl = QueryTemplate::findOrFail($id);
        $data = $request->validate([
            'name' => 'sometimes|required|string',
            'template' => 'sometimes|required|array',
            'database' => 'sometimes|required|string',
        ]);
        $tpl->update($data);
        return response()->json($tpl);
    }

    public function destroy($id)
    {
        QueryTemplate::findOrFail($id)->delete();
        return response()->json(null, 204);
    }
}
